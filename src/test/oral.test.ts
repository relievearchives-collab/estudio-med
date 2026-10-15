import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../repositorio/db'
import { eventos, fragmentos, fuentes, intentos, orales } from '../repositorio'
import { aPreguntasOrales, indicesValidos, notaFinal, notaPregunta } from '../oral/examen'

const respuestas: unknown[] = []
const llamadas: { texto: string; uso?: string }[] = []
vi.mock('../ia/cliente', () => ({
  iaJSON: vi.fn(async (msgs: { texto: string }[], _e: unknown, op: { uso?: string }) => { llamadas.push({ texto: msgs[0].texto, uso: op.uso }); return respuestas.shift() }),
}))
const { crearExamen, responder, siguiente } = await import('../oral/examen')

const TEXTO = 'La tasa de filtrado glomerular depende de la presión neta de filtración y del coeficiente de filtración del glomérulo. ' + 'relleno '.repeat(40)

describe('nota del oral (código)', () => {
  it('proporción de puntos, con menos valor después de la repregunta y descuento por error', () => {
    expect(notaPregunta(4, 4, 4, 0)).toBe(10)
    expect(notaPregunta(4, 2, 2, 0)).toBe(5)
    // 2 solos + 2 con ayuda: (2 + 0,7·2)/4·10 = 8,5
    expect(notaPregunta(4, 2, 4, 0)).toBe(8.5)
    expect(notaPregunta(3, 3, 3, 1)).toBe(8.5)
    expect(notaPregunta(2, 0, 0, 3)).toBe(0)
    expect(notaPregunta(0, 0, 0, 0)).toBe(0)
  })

  it('promedio final con un decimal e índices válidos', () => {
    expect(notaFinal([8.5, 6, 7])).toBe(7.2)
    expect(notaFinal([])).toBe(0)
    expect(indicesValidos([1, 1, 3, 0, 9, 2.5], 3)).toEqual([0, 2])
  })

  it('valida las preguntas de la IA y verifica su respaldo', () => {
    const frs = [{ id: 'f1', fuenteId: 'g', pagina: 42, inicio: 0, fin: 1, texto: TEXTO, palabras: 60, unidadId: 'up3' }]
    const r = aPreguntasOrales([
      { enunciado: 'Explicame de qué depende la TFG [F1]', puntos: ['presión neta', 'coeficiente de filtración'], f: 1, frase: 'depende de la presión neta de filtración y del coeficiente' },
      { enunciado: 'Un solo punto', puntos: ['x'], f: 1, frase: 'x' },
      { enunciado: 'Sin respaldo', puntos: ['a', 'b'], f: 5, frase: 'nada' },
    ], frs)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ enunciado: 'Explicame de qué depende la TFG', verificada: true, unidadId: 'up3', turnos: [{ rol: 'examinador' }] })
    expect(r[1].verificada).toBe(false)
  })
})

describe('flujo del examen con IA simulada', () => {
  beforeEach(async () => {
    await db.delete(); await db.open()
    respuestas.length = 0; llamadas.length = 0
    ;(await import('../busqueda/hibrida')).invalidarIndice()
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    await fragmentos.reemplazarDeFuente(f.id, Array.from({ length: 6 }, (_, i) => ({ id: `fr-${i}`, fuenteId: f.id, pagina: 40 + i, inicio: 0, fin: 1, texto: TEXTO, palabras: 60, unidadId: 'up3', disciplinaId: 'fisiologia' })))
  })

  const pregunta = (n: number) => ({ enunciado: `Pregunta ${n}: explicame la filtración`, puntos: ['presión neta', 'coeficiente', 'barrera'], f: 1, frase: 'depende de la presión neta de filtración' })

  it('repregunta una vez si faltan puntos, después califica por código y registra el intento', async () => {
    respuestas.push({ preguntas: [pregunta(1), pregunta(2)] })
    const ex = await crearExamen({ tipo: 'unidad', unidadId: 'up3' }, 'UP3', 2)
    expect(llamadas[0].uso).toBe('lote')
    expect(ex.preguntas).toHaveLength(2)

    // Primera respuesta: cubre P1 y dice algo falso → repregunta
    respuestas.push({ cubiertos: [1, 7], errores: ['Dijo que la TFG no depende de la presión.'], repregunta: '¿Y qué pasa con la permeabilidad?', devolucion: [] })
    let r = await responder(ex.id, 'Depende de la presión neta')
    let p = r!.preguntas[0]
    expect(p.repreguntada).toBe(true)
    expect(p.turnos.map((t) => t.rol)).toEqual(['examinador', 'estudiante', 'examinador'])
    expect(p.nota).toBeUndefined()
    expect(llamadas[1].uso).toBe('chat')
    expect(llamadas[1].texto).toContain('P3. barrera')

    // Segunda respuesta: suma P2; aunque falte P3 ya no se repregunta
    respuestas.push({ cubiertos: [2], errores: [], repregunta: '¿Y la barrera?', devolucion: [{ texto: 'Bien la presión neta.', citas: [{ f: 1, frase: 'depende de la presión neta de filtración' }] }] })
    r = await responder(ex.id, 'Y del coeficiente de filtración')
    p = r!.preguntas[0]
    expect(p.cubiertosPrimera).toEqual([0])
    expect(p.cubiertos).toEqual([0, 1])
    // (1 + 0,7)/3·10 = 5,67 → 5,5; −1,5 por el error → 4
    expect(p.nota).toBe(4)
    expect(p.devolucion![0].citas[0].verificada).toBe(true)
    const its = await intentos.todos()
    expect(its).toHaveLength(1)
    expect(its[0]).toMatchObject({ origen: 'oral', correcta: false, unidadId: 'up3' })
    expect((await eventos.todos()).some((e) => e.tipo === 'oral')).toBe(true)

    // Segunda pregunta completa a la primera: sin repregunta
    await siguiente(ex.id)
    respuestas.push({ cubiertos: [1, 2, 3], errores: [], repregunta: '', devolucion: [] })
    r = await responder(ex.id, 'Todo')
    expect(r!.preguntas[1]).toMatchObject({ nota: 10, repreguntada: false })
    const fin = await siguiente(ex.id)
    expect(fin.nota).toBe(7)
    expect(fin.terminado).toBeTypeOf('number')
  })

  it('si la IA falla, la respuesta queda guardada y el reintento no la duplica', async () => {
    respuestas.push({ preguntas: [pregunta(1)] })
    const ex = await crearExamen({ tipo: 'unidad', unidadId: 'up3' }, 'UP3', 1)
    const { iaJSON } = await import('../ia/cliente')
    vi.mocked(iaJSON).mockRejectedValueOnce(new Error('sin cuota'))
    await expect(responder(ex.id, 'Mi respuesta')).rejects.toThrow('sin cuota')
    expect((await orales.obtener(ex.id))!.preguntas[0].turnos).toHaveLength(2)
    respuestas.push({ cubiertos: [1, 2, 3], errores: [], repregunta: '', devolucion: [] })
    const r = await responder(ex.id, 'Mi respuesta', { reintento: true })
    expect(r!.preguntas[0].turnos).toHaveLength(2)
    expect(r!.preguntas[0].nota).toBe(10)
  })

  it('sin material avisa antes de llamar a la IA', async () => {
    await expect(crearExamen({ tipo: 'unidad', unidadId: 'up6' }, 'UP6', 3)).rejects.toThrow('No hay material')
    expect(llamadas).toHaveLength(0)
  })
})
