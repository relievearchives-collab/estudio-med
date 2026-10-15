import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../repositorio/db'
import { atlas, chats, fichasAtlas, intentos, preguntas, fragmentos, fuentes, guardarAjuste, imagenesTarjeta, leerAjustes, notas, revisiones, sembrarTemas, tarjetas, temas } from '../repositorio'
import { calificar, estadoNuevo } from '../tarjetas/fsrs'
import { exportarRespaldo, importarRespaldo } from '../repositorio/respaldo'

async function poblar() {
  await sembrarTemas()
  await guardarAjuste('fechasParciales', { 'parcial-1': '2026-11-20' })
  const pdf = new Blob([new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55])], { type: 'application/pdf' })
  const f = await fuentes.crear({ nombre: 'Guía', tipo: 'pdf', esGuia: true, archivo: pdf, mime: 'application/pdf' })
  const emb = new Float32Array(384).map((_, i) => i / 384)
  await fragmentos.reemplazarDeFuente(f.id, [
    { id: 'fr-1', fuenteId: f.id, pagina: 42, inicio: 0, fin: 10, texto: 'Filtración glomerular', palabras: 2, unidadId: 'up3', embedding: emb },
    { id: 'fr-2', fuenteId: f.id, pagina: 43, inicio: 0, fin: 10, texto: 'Clearance', palabras: 1 },
  ])
  await notas.crear({ titulo: 'Nota', markdown: '**TFG**', fragmentoIds: ['fr-1'] })
  const c = await chats.crear({ tipo: 'unidad', unidadId: 'up3' }, 'Chat TFG')
  await chats.guardar({ ...c, mensajes: [{ id: 'm1', rol: 'usuario', texto: '¿Qué es la TFG?', fecha: 1 }] })
  // Tarjetas: una básica repasada dos veces (estado FSRS no trivial), un cloze con 2 huecos y una oclusión con imagen.
  const [b] = await tarjetas.crear([{ tipo: 'basica', frente: '¿Qué es la TFG?', dorso: 'Volumen filtrado por minuto', fragmentoId: 'fr-1', unidadId: 'up3', origen: 'ia' }])
  let e = b.fsrs
  const t0 = Date.UTC(2026, 9, 1, 12)
  for (const [i, nota] of [3, 3, 1].entries()) {
    const nuevo = calificar(e, nota, t0 + i * 3 * 864e5)
    await tarjetas.responder({ ...b, fsrs: e }, nota, nuevo, 4000)
    e = nuevo
  }
  await tarjetas.crear([{ tipo: 'cloze', frente: '', dorso: '', cloze: 'La {{c1::mácula densa}} sensa el {{c2::NaCl}}' }])
  const img = await imagenesTarjeta.guardar(new Blob([new Uint8Array([137, 80, 78, 71, 1, 2, 3])], { type: 'image/png' }), 'riñón')
  await tarjetas.crear([{ tipo: 'oclusion', frente: '', dorso: '', imagenId: img.id, mascaras: [{ id: 'm1', x: 0.1, y: 0.1, w: 0.2, h: 0.1, etiqueta: 'Corteza' }] }])
  // Atlas: una estructura fallada en el Modo Museo y una ficha editada y revisada
  await atlas.responder('rinon-der', 'rinones', false, calificar(estadoNuevo(t0), 1, t0))
  await fichasAtlas.guardar('rinon', { descripcion: 'Mi versión revisada' }, true)
  // Práctica: una pregunta del banco y dos intentos (uno de simulacro)
  await preguntas.crear([{ enunciado: '¿Qué determina la TFG?', opciones: [{ texto: 'Kf y PNF', explicacion: 'Starling' }, { texto: 'Solo la PA', explicacion: '' }, { texto: 'La ADH', explicacion: '' }, { texto: 'La aldosterona', explicacion: '' }], correcta: 0, explicacion: '', verificada: true, fragmentoId: 'fr-1', unidadId: 'up3', origen: 'ia' }])
  await intentos.registrar([{ origen: 'ejercicio', simulador: 'starling', enunciado: 'x', correcta: true, unidadId: 'up3' }, { origen: 'pregunta', enunciado: 'y', correcta: false, simulacroId: 'sim-1' }])
  return f.id
}

describe('exportar / importar todo', () => {
  beforeEach(async () => {
    await db.delete()
    await db.open()
  })

  it('restaura exactamente los datos, archivos y embeddings en una base vacía', async () => {
    const fuenteId = await poblar()
    const antes = {
      temas: (await temas.todos()).length,
      notas: await notas.todas(),
      chats: await chats.todos(),
      tarjetas: await tarjetas.todas(),
      revisiones: await revisiones.todas(),
      atlas: await atlas.estados(),
      fichas: await fichasAtlas.todas(),
      preguntas: await preguntas.todas(),
      intentos: await intentos.todos(),
    }
    const zip = await exportarRespaldo()

    await db.delete()
    await db.open()
    expect(await fragmentos.contar()).toBe(0)

    const r = await importarRespaldo(await zip.arrayBuffer())
    expect(r).toEqual({ fuentes: 1, fragmentos: 2, notas: 1, tarjetas: 4 })

    const f = await fuentes.obtener(fuenteId)
    expect(f?.esGuia).toBe(true)
    expect(new Uint8Array(await f!.archivo!.arrayBuffer())).toEqual(new Uint8Array([37, 80, 68, 70, 45, 49, 46, 55]))
    const fr = await fragmentos.obtener('fr-1')
    expect(fr?.embedding).toBeInstanceOf(Float32Array)
    expect(fr!.embedding![100]).toBeCloseTo(100 / 384)
    expect((await fragmentos.obtener('fr-2'))?.embedding).toBeUndefined()
    expect((await temas.todos()).length).toBe(antes.temas)
    expect(await notas.todas()).toEqual(antes.notas)
    expect(await chats.todos()).toEqual(antes.chats)
    // Estado FSRS y log de repasos idénticos (fechas en ms, sin perder precisión)
    expect(antes.revisiones).toHaveLength(3)
    expect(await tarjetas.todas()).toEqual(antes.tarjetas)
    expect(await revisiones.todas()).toEqual(antes.revisiones)
    const basica = (await tarjetas.todas()).find((t) => t.tipo === 'basica')!
    expect(basica.fsrs.reps).toBe(3)
    expect(basica.fsrs.lapses).toBe(1)
    expect(typeof basica.fsrs.due).toBe('number')
    expect(basica.vence).toBe(basica.fsrs.due)
    const ocl = (await tarjetas.todas()).find((t) => t.tipo === 'oclusion')!
    const im = await imagenesTarjeta.obtener(ocl.imagenId!)
    expect(new Uint8Array(await im!.archivo.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71, 1, 2, 3]))
    expect(im!.mime).toBe('image/png')
    // Atlas: estado FSRS de las estructuras y fichas editadas
    expect(antes.atlas).toHaveLength(1)
    expect(await atlas.estados()).toEqual(antes.atlas)
    expect(await fichasAtlas.todas()).toEqual(antes.fichas)
    expect((await fichasAtlas.obtener('rinon'))?.revisado).toBe(true)
    expect(await preguntas.todas()).toEqual(antes.preguntas)
    expect(await intentos.todos()).toEqual(antes.intentos)
    expect(antes.intentos).toHaveLength(2)
    expect((await leerAjustes()).fechasParciales).toEqual({ 'parcial-1': '2026-11-20' })
  })

  it('rechaza archivos que no son respaldos', async () => {
    const JSZip = (await import('jszip')).default
    const z = new JSZip()
    z.file('otra.txt', 'hola')
    await expect(importarRespaldo(await z.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow(/respaldo/)
  })
})
