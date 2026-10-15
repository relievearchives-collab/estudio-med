import { mezclar } from '../atlas/museo'
import type { SimuladorPaquete } from '../contenido/tipos'
import type { Intento, Pregunta } from '../repositorio/tipos'
import { corregir, nuevoEjercicio, type Azar, type Ejercicio } from '../simuladores/ejercicios'

/** Un ítem de práctica o de simulacro: pregunta del banco (con las opciones en orden mezclado) o ejercicio numérico. */
export type Item =
  | { tipo: 'pregunta'; pregunta: Pregunta; orden: number[]; unidadId?: string; disciplinaId?: string; temaId?: string }
  | { tipo: 'ejercicio'; ejercicio: Ejercicio; unidadId?: string; disciplinaId?: string; temaId?: string }

export function itemPregunta(p: Pregunta, azar: Azar = Math.random): Item {
  return { tipo: 'pregunta', pregunta: p, orden: mezclar(p.opciones.map((_, i) => i), azar), unidadId: p.unidadId, disciplinaId: p.disciplinaId, temaId: p.temaId }
}

export function itemEjercicio(v: SimuladorPaquete, azar: Azar = Math.random, unidadId?: string): Item {
  return { tipo: 'ejercicio', ejercicio: nuevoEjercicio(v.simulador, azar), unidadId: unidadId ?? v.unidadIds[0], disciplinaId: v.disciplinaId, temaId: v.temaIds[0] }
}

/**
 * Simulacro: preguntas del banco de las UP elegidas y, para cubrir lo numérico, ejercicios de los
 * simuladores de esas UP (alrededor de un 30 %, al menos 2 si hay). Si el banco no alcanza, se completa con ejercicios.
 */
export function armarSimulacro(op: { unidadIds: string[]; cantidad: number; banco: Pregunta[]; simuladores: SimuladorPaquete[]; azar?: Azar }): Item[] {
  const azar = op.azar ?? Math.random
  const preguntas = mezclar(op.banco.filter((p) => p.unidadId && op.unidadIds.includes(p.unidadId) && !p.reportada), azar)
  const sims = op.simuladores.filter((s) => s.unidadIds.some((u) => op.unidadIds.includes(u)))
  const numericos = sims.length ? Math.max(Math.min(2, op.cantidad), Math.round(op.cantidad * 0.3)) : 0
  const deBanco = Math.min(preguntas.length, op.cantidad - numericos)
  const items: Item[] = preguntas.slice(0, deBanco).map((p) => itemPregunta(p, azar))
  for (let k = 0; items.length < op.cantidad && sims.length; k++) {
    const s = sims[k % sims.length]
    items.push(itemEjercicio(s, azar, s.unidadIds.find((u) => op.unidadIds.includes(u))))
  }
  return mezclar(items, azar)
}

/** ¿Respuesta correcta? En preguntas, `respuesta` es el índice original de la opción elegida. */
export function esCorrecta(item: Item, respuesta: string | number | undefined): boolean {
  if (respuesta === undefined || respuesta === '') return false
  if (item.tipo === 'pregunta') return Number(respuesta) === item.pregunta.correcta
  return corregir(item.ejercicio, respuesta)
}

export function enunciadoDe(item: Item) {
  return item.tipo === 'pregunta' ? item.pregunta.enunciado : item.ejercicio.enunciado
}

/** Puntaje (0–10, como los parciales) y aciertos por UP. */
export function resultadoSimulacro(items: Item[], respuestas: (string | number | undefined)[]) {
  const porUnidad = new Map<string, { total: number; bien: number }>()
  let bien = 0
  items.forEach((it, i) => {
    const ok = esCorrecta(it, respuestas[i])
    if (ok) bien++
    const u = it.unidadId ?? 'sin-unidad'
    const x = porUnidad.get(u) ?? { total: 0, bien: 0 }
    x.total++
    if (ok) x.bien++
    porUnidad.set(u, x)
  })
  return { bien, total: items.length, nota: items.length ? Math.round((bien / items.length) * 100) / 10 : 0, porUnidad }
}

export interface Celda { unidadId: string; disciplinaId: string; total: number; bien: number }

/** Mapa de calor: aciertos por UP × disciplina (de todos los intentos: práctica, simulacros y ejercicios). */
export function mapaDeCalor(intentos: Intento[], unidadIds: string[], disciplinaIds: string[]): Celda[] {
  const celdas = new Map<string, Celda>()
  for (const u of unidadIds) for (const d of disciplinaIds) celdas.set(`${u}|${d}`, { unidadId: u, disciplinaId: d, total: 0, bien: 0 })
  for (const i of intentos) {
    const c = celdas.get(`${i.unidadId}|${i.disciplinaId}`)
    if (!c) continue
    c.total++
    if (i.correcta) c.bien++
  }
  return [...celdas.values()]
}

/** Temas con menor proporción de aciertos (mínimo `minimo` intentos). */
export function temasFlojosPractica(intentos: Intento[], minimo = 3, cuantos = 5) {
  const por = new Map<string, { total: number; bien: number }>()
  for (const i of intentos) {
    if (!i.temaId) continue
    const x = por.get(i.temaId) ?? { total: 0, bien: 0 }
    x.total++
    if (i.correcta) x.bien++
    por.set(i.temaId, x)
  }
  return [...por.entries()]
    .map(([temaId, x]) => ({ temaId, ...x, tasa: x.bien / x.total }))
    .filter((x) => x.total >= minimo && x.tasa < 0.7)
    .sort((a, b) => a.tasa - b.tasa || b.total - a.total)
    .slice(0, cuantos)
}
