import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db } from '../repositorio/db'
import { chats, fragmentos, fuentes, guardarAjuste, leerAjustes, notas, sembrarTemas, temas } from '../repositorio'
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
    }
    const zip = await exportarRespaldo()

    await db.delete()
    await db.open()
    expect(await fragmentos.contar()).toBe(0)

    const r = await importarRespaldo(await zip.arrayBuffer())
    expect(r).toEqual({ fuentes: 1, fragmentos: 2, notas: 1 })

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
    expect((await leerAjustes()).fechasParciales).toEqual({ 'parcial-1': '2026-11-20' })
  })

  it('rechaza archivos que no son respaldos', async () => {
    const JSZip = (await import('jszip')).default
    const z = new JSZip()
    z.file('otra.txt', 'hola')
    await expect(importarRespaldo(await z.generateAsync({ type: 'arraybuffer' }))).rejects.toThrow(/respaldo/)
  })
})
