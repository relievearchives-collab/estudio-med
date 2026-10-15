import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../repositorio/db'
import { chats, fragmentos, fuentes } from '../repositorio'
import type { Fragmento } from '../repositorio/tipos'

// La IA se simula: se verifica qué se le manda y cómo se valida lo que devuelve.
const llamadas: { prompt: string; uso?: string }[] = []
let respuesta: unknown = { tarjetas: [] }
vi.mock('../ia/cliente', () => ({
  iaJSON: vi.fn(async (msgs: { texto: string }[], _esq: unknown, op: { uso?: string }) => {
    llamadas.push({ prompt: msgs[0].texto, uso: op.uso })
    return respuesta
  }),
}))
const { generarTarjetas, elegirFragmentos, TARJETAS_POR_LOTE } = await import('../tarjetas/generar')

const TEXTO = 'La tasa de filtrado glomerular depende de la presión neta de filtración y del coeficiente de filtración, que refleja la permeabilidad y la superficie de los capilares glomerulares. ' + 'relleno '.repeat(40)

async function poblar(n: number) {
  const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
  const frs: Fragmento[] = Array.from({ length: n }, (_, i) => ({
    id: `fr-${i}`, fuenteId: f.id, pagina: 40 + i, inicio: 0, fin: TEXTO.length, texto: TEXTO, palabras: 70, unidadId: 'up3', disciplinaId: 'fisiologia', temaId: 'tema-x',
  }))
  await fragmentos.reemplazarDeFuente(f.id, frs)
  return f.id
}

describe('generación de tarjetas con IA', () => {
  beforeEach(async () => { await db.delete(); await db.open(); llamadas.length = 0 })

  it('"30 tarjetas de la UP3": 2 lotes con el modelo barato, fragmentos distintos en cada lote', async () => {
    await poblar(40)
    respuesta = { tarjetas: [{ tipo: 'basica', frente: '¿De qué depende la TFG?', dorso: 'De la presión neta y el Kf', f: 1, frase: 'depende de la presión neta de filtración y del coeficiente de filtración' }] }
    await generarTarjetas({ tipo: 'alcance', alcance: { tipo: 'unidad', unidadId: 'up3' } }, 30, 'ambas')
    expect(llamadas).toHaveLength(Math.ceil(30 / TARJETAS_POR_LOTE))
    expect(llamadas.every((l) => l.uso === 'lote')).toBe(true)
    expect(llamadas[0].prompt).toContain('hasta 20 tarjetas')
    expect(llamadas[1].prompt).toContain('hasta 10 tarjetas')
    const pags = (p: string) => [...p.matchAll(/pág\. (\d+)/g)].map((m) => m[1])
    expect(pags(llamadas[0].prompt).filter((x) => pags(llamadas[1].prompt).includes(x))).toEqual([])
  })

  it('valida la respuesta: enlaza el fragmento, verifica la frase y descarta tarjetas mal formadas', async () => {
    await poblar(3)
    respuesta = {
      tarjetas: [
        { tipo: 'basica', frente: '¿De qué depende la TFG? [F1]', dorso: 'Presión neta y Kf', f: 1, frase: 'depende de la presión neta de filtración y del coeficiente de filtración' },
        { tipo: 'cloze', cloze: 'La TFG depende del {{c1::coeficiente de filtración}}', f: 2, frase: 'una frase que no está en el fragmento para nada' },
        { tipo: 'cloze', cloze: 'sin hueco', f: 1, frase: 'x' },
        { tipo: 'basica', frente: 'Sin dorso', f: 1, frase: 'x' },
      ],
    }
    const ps = await generarTarjetas({ tipo: 'alcance', alcance: { tipo: 'todo' } }, 10, 'ambas')
    expect(ps).toHaveLength(2)
    expect(ps[0]).toMatchObject({ tipo: 'basica', frente: '¿De qué depende la TFG?', unidadId: 'up3', temaId: 'tema-x', verificada: true, origen: 'ia' })
    expect(ps[0].fragmentoId).toBeDefined()
    expect(ps[1]).toMatchObject({ tipo: 'cloze', verificada: false })
  })

  it('desde una respuesta del chat usa los fragmentos citados y manda la respuesta como foco', async () => {
    await poblar(5)
    const c = await chats.crear({ tipo: 'todo' })
    await chats.guardar({ ...c, mensajes: [
      { id: 'm1', rol: 'usuario', texto: '¿Qué determina la TFG?', fecha: 1 },
      { id: 'm2', rol: 'ia', texto: 'x', fecha: 2, fragmentoIds: ['fr-0', 'fr-1', 'fr-2'], segmentos: [{ texto: 'Depende de la presión neta.', citas: [{ n: 3, fragmentoId: 'fr-2', frase: 'x', verificada: true }] }] },
    ] })
    respuesta = { tarjetas: [] }
    await generarTarjetas({ tipo: 'chat', chatId: c.id, mensajeId: 'm2' }, 5, 'basica')
    expect(llamadas[0].prompt).toContain('RESPUESTA DEL CHAT')
    expect(llamadas[0].prompt).toContain('Depende de la presión neta.')
    expect(llamadas[0].prompt).toContain('pág. 42')
    expect(llamadas[0].prompt).not.toContain('pág. 40')
  })

  it('cuando el worker asigna el tema a un fragmento, sus tarjetas sin tema lo heredan', async () => {
    await poblar(1)
    await fragmentos.actualizarVarios([{ id: 'fr-0', temaId: undefined }])
    const { tarjetas } = await import('../repositorio')
    const [sinTema] = await tarjetas.crear([{ tipo: 'basica', frente: 'a', dorso: 'b', fragmentoId: 'fr-0' }])
    const [conTema] = await tarjetas.crear([{ tipo: 'basica', frente: 'c', dorso: 'd', fragmentoId: 'fr-0', temaId: 'elegido' }])
    await fragmentos.actualizarVarios([{ id: 'fr-0', temaId: 'tema-nuevo', unidadId: 'up3' }])
    expect((await tarjetas.obtener(sinTema.id))?.temaId).toBe('tema-nuevo')
    expect((await tarjetas.obtener(sinTema.id))?.unidadId).toBe('up3')
    expect((await tarjetas.obtener(conTema.id))?.temaId).toBe('elegido')
  })

  it('elige primero fragmentos sin tarjetas, repartidos a lo largo del material', () => {
    const fs = Array.from({ length: 10 }, (_, i) => ({ id: `f${i}`, fuenteId: 'a', pagina: i, inicio: 0, fin: 1, texto: '', palabras: 100 }))
    const conTarjetas = new Map([['f0', 2], ['f1', 1]])
    expect(elegirFragmentos(fs, 4, conTarjetas).map((f) => f.id)).toEqual(['f2', 'f4', 'f6', 'f8'])
    expect(elegirFragmentos(fs.slice(0, 3), 3, conTarjetas).map((f) => f.id)).toEqual(['f0', 'f1', 'f2'])
  })
})
