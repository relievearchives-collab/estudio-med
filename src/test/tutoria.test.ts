import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { db } from '../repositorio/db'
import { fragmentos, fuentes, sembrarTemas, tarjetas, temas as repoTemas, tutorias } from '../repositorio'
import type { Tema } from '../repositorio/tipos'
import { aplicarAsignacion, disciplinasSinCubrir, priorizarFaltantes, separarItems, temasSinCubrir } from '../tutoria/cobertura'

// La IA se simula: devuelve lo que diga cada test y guarda los prompts enviados.
const respuestas: unknown[] = []
const llamadas: { texto: string; sistema?: string; uso?: string }[] = []
vi.mock('../ia/cliente', () => ({
  iaJSON: vi.fn(async (msgs: { texto: string }[], _e: unknown, op: { sistema?: string; uso?: string }) => { llamadas.push({ texto: msgs[0].texto, ...op }); return respuestas.shift() }),
  iaTexto: vi.fn(async (msgs: { texto: string }[], op: { sistema?: string; uso?: string }) => { llamadas.push({ texto: msgs.map((m) => m.texto).join('\n'), ...op }); return respuestas.shift() }),
}))
vi.mock('../procesamiento/cola', () => ({ embeberConsulta: async () => null }))
const { analizarPreguntas, cerrarTutoria, guardarSugeridas, responderTutor } = await import('../tutoria/tutor')

const tema = (id: string, disciplinaId: string): Tema => ({ id, unidadId: 'up', disciplinaId, nombre: `Tema ${id}`, orden: 0, origen: 'paquete' })

describe('cobertura de las preguntas de aprendizaje (sin IA)', () => {
  const ts = [tema('a1', 'anatomia'), tema('a2', 'anatomia'), tema('f1', 'fisiologia'), tema('h1', 'histologia')]

  it('aplica la asignación de la IA descartando números inválidos y repetidos', () => {
    const r = aplicarAsignacion(['¿P1?', '¿P2?', '¿P3?'], [{ p: 1, temas: [1, 1, 3] }, { p: 2, temas: [0, 9, 2.5] }, { p: 7, temas: [4] }], ts)
    expect(r).toEqual([{ texto: '¿P1?', temaIds: ['a1', 'f1'] }, { texto: '¿P2?', temaIds: [] }, { texto: '¿P3?', temaIds: [] }])
  })

  it('calcula temas y disciplinas sin cubrir', () => {
    const ps = [{ texto: 'x', temaIds: ['a1', 'f1'] }]
    expect(temasSinCubrir(ts, ps).map((t) => t.id)).toEqual(['a2', 'h1'])
    expect(disciplinasSinCubrir(ts, ['a1', 'f1'])).toEqual(['histologia'])
    expect(disciplinasSinCubrir(ts, [])).toEqual(['anatomia', 'fisiologia', 'histologia'])
  })

  it('reparte los faltantes entre disciplinas antes de repetir una', () => {
    const muchos = [tema('a1', 'anatomia'), tema('a2', 'anatomia'), tema('a3', 'anatomia'), tema('f1', 'fisiologia'), tema('b1', 'bioquimica')]
    expect(priorizarFaltantes(muchos, 4).map((t) => t.id)).toEqual(['a1', 'f1', 'b1', 'a2'])
    expect(priorizarFaltantes(muchos, 10)).toHaveLength(5)
  })

  it('separa ítems pegados o dictados', () => {
    expect(separarItems('- ¿Qué es la TFG? ¿Cómo se regula?\n1) Riñón\n\n• Riñón\nok')).toEqual(['¿Qué es la TFG?', '¿Cómo se regula?', 'Riñón'])
  })
})

describe('flujo de la tutoría con IA simulada', () => {
  const TEXTO = 'La tasa de filtrado glomerular depende de la presión neta de filtración y del coeficiente de filtración del glomérulo. ' + 'relleno '.repeat(40)
  let up: string
  let temasUP: Tema[]

  beforeEach(async () => {
    await db.delete(); await db.open()
    respuestas.length = 0; llamadas.length = 0
    ;(await import('../busqueda/hibrida')).invalidarIndice()
    await sembrarTemas()
    up = 'up3'
    temasUP = await repoTemas.deUnidad(up)
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    await fragmentos.reemplazarDeFuente(f.id, temasUP.map((t, i) => ({ id: `fr-${i}`, fuenteId: f.id, pagina: 40 + i, inicio: 0, fin: 1, texto: `${t.nombre}. ${TEXTO}`, palabras: 60, unidadId: up, disciplinaId: t.disciplinaId, temaId: t.id })))
  })

  it('el tutor recibe situación, ideas y la guía de temas, y la conversación se guarda', async () => {
    const t = await tutorias.crear(up)
    await tutorias.actualizar(t.id, { ideas: ['orina espumosa'], hipotesis: ['falla renal'] })
    respuestas.push('¿Qué órgano filtra la sangre?')
    await responderTutor(t.id)
    respuestas.push('¿Y de qué depende ese filtrado?')
    const r = await responderTutor(t.id, 'El riñón')
    expect(r.mensajes.map((m) => m.rol)).toEqual(['tutor', 'estudiante', 'tutor'])
    expect(llamadas[1].sistema).toContain('orina espumosa')
    expect(llamadas[1].sistema).toContain(temasUP[0].nombre)
    expect(llamadas[1].sistema).toContain('Nunca des respuestas')
    expect(llamadas[1].uso).toBe('chat')
  })

  it('si la IA falla, el mensaje del estudiante queda guardado', async () => {
    const t = await tutorias.crear(up)
    const { iaTexto } = await import('../ia/cliente')
    vi.mocked(iaTexto).mockRejectedValueOnce(new Error('sin clave'))
    await expect(responderTutor(t.id, 'Hola')).rejects.toThrow('sin clave')
    expect((await tutorias.obtener(t.id))!.mensajes).toHaveLength(1)
  })

  it('los faltantes los decide el código y cada uno lleva su cita verificada', async () => {
    const t = await tutorias.crear(up)
    // La IA asigna la única pregunta al tema 1; el resto queda sin cubrir.
    respuestas.push({ asignaciones: [{ p: 1, temas: [1] }] })
    // La IA redacta solo el primer faltante y con una frase real; omite los demás.
    respuestas.push({ faltantes: [{ t: 1, texto: 'Te faltó pensar en el filtrado [F1].', f: 1, frase: 'depende de la presión neta de filtración y del coeficiente' }] })
    const r = await analizarPreguntas(t.id, ['¿Qué es la TFG?'])
    expect(r.preguntas[0].temaIds).toEqual([temasUP[0].id])
    const esperados = priorizarFaltantes(temasUP.slice(1), 6)
    expect(r.faltantes!.map((f) => f.temaId)).toEqual(esperados.map((x) => x.id))
    expect(r.faltantes![0]).toMatchObject({ texto: 'Te faltó pensar en el filtrado.', cita: { verificada: true } })
    expect(r.faltantes![1].texto).toBe(`Te faltó pensar en ${esperados[1].nombre}.`)
    expect(llamadas[0].uso).toBe('lote')
    expect(r.etapa).toBe('preguntas')
  })

  it('cierre: devolución citada, disciplinas faltantes y tarjetas sugeridas que se guardan una sola vez', async () => {
    const t = await tutorias.crear(up)
    const cubierto = temasUP.findIndex((x) => x.disciplinaId === temasUP[0].disciplinaId) + 1
    respuestas.push({
      cubiertos: [cubierto, 99],
      devolucion: [
        { texto: 'Integraste bien la fisiología renal.', citas: [{ f: 1, frase: 'depende de la presión neta de filtración' }] },
        { texto: 'Faltó la histología del glomérulo.', citas: [{ f: 1, frase: 'una frase que no está en el texto' }] },
      ],
      tarjetas: [
        { tipo: 'basica', frente: '¿De qué depende la TFG?', dorso: 'De la PNF y el Kf', f: 1, frase: 'depende de la presión neta de filtración' },
        { tipo: 'cloze', cloze: 'La TFG depende de la {{c1::presión neta de filtración}}', f: 1, frase: 'depende de la presión neta de filtración' },
        { tipo: 'basica', frente: '', dorso: 'mal formada', f: 1, frase: 'x' },
      ],
    })
    await expect(cerrarTutoria(t.id, 'corta')).rejects.toThrow()
    const r = await cerrarTutoria(t.id, 'La persona tiene una alteración del filtrado glomerular porque cambia la presión neta de filtración en el riñón.')
    const d = r.devolucion!
    expect(d.segmentos.map((s) => s.citas[0].verificada)).toEqual([true, false])
    const disciplinas = [...new Set(temasUP.map((x) => x.disciplinaId))]
    expect(d.disciplinasFaltantes).toEqual(disciplinas.filter((x) => x !== temasUP[0].disciplinaId))
    expect(d.tarjetas).toHaveLength(2)
    expect(r.terminada).toBeTypeOf('number')

    expect(await guardarSugeridas(t.id, [0, 1])).toBe(2)
    expect(await guardarSugeridas(t.id, [0, 1])).toBe(0)
    const mazo = await tarjetas.todas()
    expect(mazo).toHaveLength(2)
    expect(mazo[0]).toMatchObject({ unidadId: up, etiquetas: ['tutoria'], origen: 'ia' })
    expect(mazo.some((x) => x.fragmentoId?.startsWith('fr-'))).toBe(true)
  })

  it('sin material procesado, el cierre avisa en vez de inventar', async () => {
    await db.fragmentos.clear()
    const { invalidarIndice } = await import('../busqueda/hibrida')
    invalidarIndice()
    const t = await tutorias.crear(up)
    await expect(cerrarTutoria(t.id, 'Una explicación suficientemente larga para pasar el control de longitud mínima.')).rejects.toThrow('No hay material procesado')
  })
})
