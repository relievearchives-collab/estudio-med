import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { paqueteActivo } from '../contenido'
import { db } from '../repositorio/db'
import { chats, fragmentos, fuentes, intentos, preguntas } from '../repositorio'
import type { Intento, Pregunta } from '../repositorio/tipos'
import { azarConSemilla } from '../simuladores/ejercicios'
import { armarSimulacro, esCorrecta, itemPregunta, mapaDeCalor, resultadoSimulacro, temasFlojosPractica } from '../practica/sesion'

let respuesta: unknown = { preguntas: [] }
const llamadas: string[] = []
vi.mock('../ia/cliente', () => ({
  iaJSON: vi.fn(async (msgs: { texto: string }[]) => { llamadas.push(msgs[0].texto); return respuesta }),
}))
const { generarPreguntas, aPreguntas } = await import('../practica/generar')

const TEXTO = 'La aldosterona actúa en las células principales del túbulo colector aumentando la reabsorción de sodio y la secreción de potasio. ' + 'relleno '.repeat(40)
const pregunta = (id: string, unidadId: string, extra: Partial<Pregunta> = {}): Pregunta => ({
  id, enunciado: `Pregunta ${id}`, opciones: [{ texto: 'A', explicacion: '' }, { texto: 'B', explicacion: '' }, { texto: 'C', explicacion: '' }, { texto: 'D', explicacion: '' }],
  correcta: 2, explicacion: '', verificada: true, unidadId, disciplinaId: 'fisiologia', origen: 'ia', creada: 0, actualizada: 0, ...extra,
})

describe('validación de preguntas de la IA', () => {
  it('descarta mal formadas, enlaza el fragmento y verifica la frase', () => {
    const frs = [{ id: 'f1', fuenteId: 'g', pagina: 60, inicio: 0, fin: 1, texto: TEXTO, palabras: 60, unidadId: 'up5', disciplinaId: 'fisiologia', temaId: 't' }]
    const op = (n: number) => Array.from({ length: n }, (_, i) => ({ texto: `Opción ${i}`, explicacion: 'x' }))
    const r = aPreguntas([
      { enunciado: '¿Qué hace la aldosterona? [F1]', opciones: op(4), correcta: 1, f: 1, frase: 'aumentando la reabsorción de sodio y la secreción de potasio' },
      { enunciado: 'Inventada', opciones: op(5), correcta: 0, f: 1, frase: 'frase que no está en ningún lado del texto' },
      { enunciado: 'Pocas opciones', opciones: op(2), correcta: 0, f: 1, frase: 'x' },
      { enunciado: 'Correcta fuera de rango', opciones: op(4), correcta: 7, f: 1, frase: 'x' },
      { enunciado: 'Repetidas', opciones: [{ texto: 'A', explicacion: '' }, { texto: 'a', explicacion: '' }, { texto: 'B', explicacion: '' }], correcta: 0, f: 1, frase: 'x' },
    ], frs)
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ enunciado: '¿Qué hace la aldosterona?', correcta: 1, verificada: true, unidadId: 'up5', fragmentoId: 'f1', pagina: 60 })
    expect(r[1].verificada).toBe(false)
  })
})

describe('generación y banco', () => {
  beforeEach(async () => { await db.delete(); await db.open(); llamadas.length = 0 })

  it('genera por lotes con el modelo de lotes y guarda en el banco', async () => {
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    await fragmentos.reemplazarDeFuente(f.id, Array.from({ length: 30 }, (_, i) => ({ id: `fr-${i}`, fuenteId: f.id, pagina: 50 + i, inicio: 0, fin: 1, texto: TEXTO, palabras: 60, unidadId: 'up5', disciplinaId: 'fisiologia' })))
    respuesta = { preguntas: [{ enunciado: '¿Qué hace la aldosterona?', opciones: [{ texto: 'a', explicacion: '' }, { texto: 'b', explicacion: '' }, { texto: 'c', explicacion: '' }, { texto: 'd', explicacion: '' }], correcta: 0, f: 1, frase: 'aumentando la reabsorción de sodio' }] }
    await generarPreguntas({ tipo: 'alcance', alcance: { tipo: 'unidad', unidadId: 'up5' } }, 12)
    expect(llamadas).toHaveLength(2)
    expect(llamadas[0]).toContain('hasta 8 preguntas')
    expect(await preguntas.contar()).toBe(2)
  })

  it('desde una respuesta del chat usa solo los fragmentos citados', async () => {
    const f = await fuentes.crear({ nombre: 'Guía', tipo: 'texto', esGuia: true })
    await fragmentos.reemplazarDeFuente(f.id, [0, 1, 2].map((i) => ({ id: `fr-${i}`, fuenteId: f.id, pagina: 70 + i, inicio: 0, fin: 1, texto: TEXTO, palabras: 60 })))
    const c = await chats.crear({ tipo: 'todo' })
    await chats.guardar({ ...c, mensajes: [{ id: 'u', rol: 'usuario', texto: '¿Aldosterona?', fecha: 1 }, { id: 'm', rol: 'ia', texto: '', fecha: 2, fragmentoIds: ['fr-0', 'fr-1', 'fr-2'], segmentos: [{ texto: 'Actúa en el colector.', citas: [{ n: 2, fragmentoId: 'fr-1', frase: 'x', verificada: true }] }] }] })
    respuesta = { preguntas: [] }
    await generarPreguntas({ tipo: 'chat', chatId: c.id, mensajeId: 'm' }, 5)
    expect(llamadas[0]).toContain('pág. 71')
    expect(llamadas[0]).not.toContain('pág. 70')
    expect(llamadas[0]).toContain('RESPUESTA DEL CHAT')
  })

  it('registrar intentos guarda también el evento para estadísticas', async () => {
    await intentos.registrar([{ origen: 'ejercicio', simulador: 'starling', enunciado: 'x', correcta: true, unidadId: 'up3', disciplinaId: 'fisiologia' }])
    expect(await intentos.todos()).toHaveLength(1)
    expect(await db.eventos.where('tipo').equals('ejercicio').count()).toBe(1)
  })
})

describe('simulacro', () => {
  const banco = [...Array.from({ length: 20 }, (_, i) => pregunta(`a${i}`, 'up3')), ...Array.from({ length: 5 }, (_, i) => pregunta(`b${i}`, 'up5')), pregunta('mala', 'up3', { reportada: 'confusa' })]

  it('mezcla preguntas de las UP elegidas (sin reportadas) con ≈30 % de ejercicios numéricos de esas UP', () => {
    const items = armarSimulacro({ unidadIds: ['up3'], cantidad: 10, banco, simuladores: paqueteActivo.simuladores, azar: azarConSemilla(3) })
    expect(items).toHaveLength(10)
    const pregs = items.filter((i) => i.tipo === 'pregunta')
    const ejs = items.filter((i) => i.tipo === 'ejercicio')
    expect(ejs).toHaveLength(3)
    expect(pregs.every((i) => i.unidadId === 'up3' && i.tipo === 'pregunta' && i.pregunta.id !== 'mala')).toBe(true)
    expect(ejs.every((i) => i.unidadId === 'up3')).toBe(true)
  })

  it('si el banco no alcanza, completa con ejercicios', () => {
    const items = armarSimulacro({ unidadIds: ['up6'], cantidad: 8, banco, simuladores: paqueteActivo.simuladores, azar: azarConSemilla(5) })
    expect(items).toHaveLength(8)
    expect(items.every((i) => i.tipo === 'ejercicio')).toBe(true)
  })

  it('la corrección usa el índice original aunque las opciones se muestren mezcladas', () => {
    const it0 = itemPregunta(pregunta('x', 'up3'), azarConSemilla(9))
    expect(esCorrecta(it0, 2)).toBe(true)
    expect(esCorrecta(it0, 1)).toBe(false)
    expect(esCorrecta(it0, undefined)).toBe(false)
    const r = resultadoSimulacro([it0, itemPregunta(pregunta('y', 'up5'))], [2, 0])
    expect(r).toMatchObject({ bien: 1, total: 2, nota: 5 })
    expect(r.porUnidad.get('up3')).toEqual({ total: 1, bien: 1 })
  })
})

describe('mapa de calor y temas flojos', () => {
  const i = (unidadId: string, disciplinaId: string, correcta: boolean, temaId?: string): Intento => ({ origen: 'pregunta', enunciado: '', correcta, unidadId, disciplinaId, temaId, fecha: 0 })
  it('agrega aciertos por UP × disciplina', () => {
    const celdas = mapaDeCalor([i('up3', 'fisiologia', true), i('up3', 'fisiologia', false), i('up5', 'anatomia', true), i('otra', 'x', true)], ['up3', 'up5'], ['fisiologia', 'anatomia'])
    expect(celdas).toHaveLength(4)
    expect(celdas.find((c) => c.unidadId === 'up3' && c.disciplinaId === 'fisiologia')).toMatchObject({ total: 2, bien: 1 })
    expect(celdas.find((c) => c.unidadId === 'up5' && c.disciplinaId === 'fisiologia')).toMatchObject({ total: 0 })
  })
  it('temas flojos: menos de 70 % con al menos 3 intentos, el peor primero', () => {
    const lista = [
      ...[true, false, false].map((c) => i('up3', 'f', c, 'tfg')),
      ...[true, true, false, false].map((c) => i('up3', 'f', c, 'clearance')),
      ...[true, true, true].map((c) => i('up3', 'f', c, 'bien')),
      i('up3', 'f', false, 'pocos'),
    ]
    expect(temasFlojosPractica(lista).map((x) => x.temaId)).toEqual(['tfg', 'clearance'])
  })
})
