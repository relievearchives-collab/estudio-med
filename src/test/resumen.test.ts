import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../repositorio/db'
import { fragmentos, fuentes, sembrarTemas, temas as repoTemas } from '../repositorio'

const respuestas: unknown[] = []
const llamadas: { texto: string; cache?: boolean; funcion?: string }[] = []
vi.mock('../ia/cliente', () => ({
  iaJSON: vi.fn(async (msgs: { texto: string }[], _e: unknown, op: { cache?: boolean; funcion?: string }) => { llamadas.push({ texto: msgs[0].texto, ...op }); return respuestas.shift() }),
}))
vi.mock('../procesamiento/cola', () => ({ embeberConsulta: async () => null }))
const { markdownDeResumen, resumirTema, textoParaVoz } = await import('../resumen/resumir')

describe('texto para la voz', () => {
  it('saca Markdown y marcas de cita y lee los símbolos', () => {
    expect(textoParaVoz('La **TFG** [F2] ≈ 125 mL/min; ↑ PA → ↑ filtrado [F1, F3]. pH 7,35-7,45 ± 0,05'))
      .toBe('La TFG aproximadamente 125 mL por min; aumento de PA lleva a aumento de filtrado. pH 7,35 a 7,45 más o menos 0,05')
    expect(textoParaVoz('Ver [la guía](http://x) | tabla')).toBe('Ver la guía tabla')
  })
})

describe('resumen de un tema', () => {
  const TEXTO = 'La tasa de filtrado glomerular depende de la presión neta de filtración y del coeficiente de filtración. ' + 'relleno '.repeat(40)

  beforeEach(async () => {
    await db.delete(); await db.open()
    respuestas.length = 0; llamadas.length = 0
    ;(await import('../busqueda/hibrida')).invalidarIndice()
    await sembrarTemas()
  })

  async function cargar(temaId: string | undefined, unidadId: string, n: number) {
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    const t = (await repoTemas.deUnidad(unidadId))[0]
    await fragmentos.reemplazarDeFuente(f.id, Array.from({ length: n }, (_, i) => ({
      id: `fr-${i}`, fuenteId: f.id, pagina: 40 + i, inicio: 0, fin: 1, texto: `${t.nombre}. ${TEXTO}`, palabras: 60, unidadId, temaId,
    })))
    return t
  }

  it('usa los fragmentos del tema, pide un resumen para escuchar y verifica las citas', async () => {
    const t0 = (await repoTemas.deUnidad('up3'))[0]
    const t = await cargar(t0.id, 'up3', 5)
    respuestas.push({ respuesta: [
      { texto: 'La TFG depende de la presión neta.', citas: [{ f: 1, frase: 'depende de la presión neta de filtración y del coeficiente' }] },
      { texto: 'Dato inventado.', citas: [{ f: 2, frase: 'esta frase no existe en el fragmento' }] },
      { texto: '', citas: [] },
    ] })
    const r = await resumirTema(t.id)
    expect(llamadas[0].texto).toContain(`RESUMEN DEL TEMA "${t.nombre}"`)
    expect(llamadas[0].texto).toContain('sin tablas')
    expect(llamadas[0]).toMatchObject({ cache: true, funcion: 'resumen' })
    expect(r.segmentos).toHaveLength(2)
    expect(r.segmentos.map((s) => s.citas[0].verificada)).toEqual([true, false])
    expect(r.fragmentos).toHaveLength(5)

    const md = await markdownDeResumen('Resumen: X', r)
    expect(md).toContain('## Resumen: X')
    expect(md).toContain('La TFG depende de la presión neta. (Guía, pág. 40)')
    expect(md).not.toContain('Dato inventado. (Guía')
  })

  it('"otra versión" no usa la caché', async () => {
    const t0 = (await repoTemas.deUnidad('up3'))[0]
    await cargar(t0.id, 'up3', 4)
    respuestas.push({ respuesta: [{ texto: 'x', citas: [] }] })
    await resumirTema(t0.id, { otraVersion: true })
    expect(llamadas[0].cache).toBe(false)
  })

  it('si el tema tiene pocos fragmentos propios, completa con los de la unidad', async () => {
    const t = await cargar(undefined, 'up3', 3)
    respuestas.push({ respuesta: [{ texto: 'x', citas: [] }] })
    const r = await resumirTema(t.id)
    expect(r.fragmentos.length).toBe(3)
  })

  it('sin material avisa en vez de inventar', async () => {
    const t = (await repoTemas.deUnidad('up3'))[0]
    await expect(resumirTema(t.id)).rejects.toThrow('No hay material procesado')
    expect(llamadas).toHaveLength(0)
  })
})

describe('pedidos simultáneos', () => {
  it('dos aperturas a la vez del mismo tema hacen una sola llamada', async () => {
    await db.delete(); await db.open(); respuestas.length = 0; llamadas.length = 0
    ;(await import('../busqueda/hibrida')).invalidarIndice()
    await sembrarTemas()
    const t = (await repoTemas.deUnidad('up3'))[0]
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    await fragmentos.reemplazarDeFuente(f.id, [{ id: 'fr-x', fuenteId: f.id, pagina: 1, inicio: 0, fin: 1, texto: `${t.nombre} ` + 'relleno '.repeat(50), palabras: 60, unidadId: 'up3', temaId: t.id }])
    respuestas.push({ respuesta: [{ texto: 'x', citas: [] }] })
    const [a, b] = await Promise.all([resumirTema(t.id), resumirTema(t.id)])
    expect(a).toBe(b)
    expect(llamadas).toHaveLength(1)
  })
})
