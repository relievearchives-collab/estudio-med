import { createEmptyCard, fsrs, type Card, type FSRS, type Grade } from 'ts-fsrs'
import type { EstadoFSRS, Tarjeta } from '../repositorio/tipos'

/**
 * Repetición espaciada con ts-fsrs (no se reimplementa el algoritmo).
 * Acá solo se convierte entre `Card` de ts-fsrs y el estado que se guarda
 * (fechas en ms) y se arma la cola del día.
 */

export const CALIFICACIONES = [
  { valor: 1, nombre: 'Otra vez', tecla: '1', clase: 'bg-red-600' },
  { valor: 2, nombre: 'Difícil', tecla: '2', clase: 'bg-amber-600' },
  { valor: 3, nombre: 'Bien', tecla: '3', clase: 'bg-emerald-600' },
  { valor: 4, nombre: 'Fácil', tecla: '4', clase: 'bg-sky-600' },
] as const

export const ESTADO = { nueva: 0, aprendiendo: 1, repaso: 2, reaprendiendo: 3 } as const

/** Las tarjetas en aprendizaje que vencen dentro de este margen se muestran en la misma sesión (como Anki). */
export const MARGEN_APRENDIZAJE = 20 * 60_000

const planificadores = new Map<number, FSRS>()
export function planificador(retencion = 0.9): FSRS {
  const r = Math.min(0.99, Math.max(0.7, retencion))
  if (!planificadores.has(r)) planificadores.set(r, fsrs({ request_retention: r, enable_fuzz: false, enable_short_term: true }))
  return planificadores.get(r)!
}

export function aCard(e: EstadoFSRS): Card {
  return {
    due: new Date(e.due), stability: e.stability, difficulty: e.difficulty, elapsed_days: e.elapsed_days,
    scheduled_days: e.scheduled_days, learning_steps: e.learning_steps, reps: e.reps, lapses: e.lapses,
    state: e.state, last_review: e.last_review !== undefined ? new Date(e.last_review) : undefined,
  }
}

export function deCard(c: Card): EstadoFSRS {
  const e: EstadoFSRS = {
    due: c.due.getTime(), stability: c.stability, difficulty: c.difficulty, elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days, learning_steps: c.learning_steps, reps: c.reps, lapses: c.lapses, state: c.state,
  }
  if (c.last_review) e.last_review = c.last_review.getTime()
  return e
}

export function estadoNuevo(ahora = Date.now()): EstadoFSRS {
  return deCard(createEmptyCard(new Date(ahora)))
}

/** Aplica una calificación (1–4) y devuelve el estado nuevo. */
export function calificar(e: EstadoFSRS, calificacion: number, ahora = Date.now(), retencion = 0.9): EstadoFSRS {
  const r = planificador(retencion).next(aCard(e), new Date(ahora), calificacion as Grade)
  return deCard(r.card)
}

/** Próximo vencimiento de cada botón, para mostrarlo antes de responder. */
export function previsualizar(e: EstadoFSRS, ahora = Date.now(), retencion = 0.9): Record<1 | 2 | 3 | 4, EstadoFSRS> {
  const p = planificador(retencion).repeat(aCard(e), new Date(ahora))
  return { 1: deCard(p[1].card), 2: deCard(p[2].card), 3: deCard(p[3].card), 4: deCard(p[4].card) }
}

/** "1 min", "10 min", "3 h", "4 d", "2,5 meses", "1,2 años". */
export function formatearIntervalo(ms: number) {
  const min = Math.max(1, Math.round(ms / 60_000))
  if (min < 60) return `${min} min`
  const h = ms / 3_600_000
  if (h < 24) return `${Math.round(h)} h`
  const d = ms / 86_400_000
  if (d < 30) return `${Math.round(d)} d`
  const coma = (n: number) => (Math.round(n * 10) / 10).toLocaleString('es-AR')
  if (d < 365) return `${coma(d / 30)} ${d / 30 < 1.05 ? 'mes' : 'meses'}`
  return `${coma(d / 365)} ${d / 365 < 1.05 ? 'año' : 'años'}`
}

export function finDelDia(ahora = Date.now()) {
  const d = new Date(ahora)
  d.setHours(23, 59, 59, 999)
  return d.getTime()
}
export function inicioDelDia(ahora = Date.now()) {
  const d = new Date(ahora)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export interface Cola {
  /** Ya vencidas (aprendizaje y repaso), la más atrasada primero. */
  vencidas: Tarjeta[]
  /** Nuevas que entran hoy (respeta el tope diario). */
  nuevas: Tarjeta[]
  /** En aprendizaje que vencen en los próximos minutos (se muestran si no queda otra cosa). */
  enEspera: Tarjeta[]
  /** Repasos que vencen más tarde hoy (para el total del día). */
  masTarde: Tarjeta[]
}

/**
 * Cola del día: primero lo vencido, después las nuevas hasta el tope diario.
 * `nuevasHoy` = nuevas ya vistas hoy (cuentan para el tope).
 */
export function armarCola(tarjetas: Tarjeta[], ahora: number, nuevasPorDia: number, nuevasHoy: number): Cola {
  const activas = tarjetas.filter((t) => !t.suspendida)
  const vencidas = activas.filter((t) => t.estado !== ESTADO.nueva && t.vence <= ahora).sort((a, b) => a.vence - b.vence)
  const cupo = Math.max(0, nuevasPorDia - nuevasHoy)
  const nuevas = activas.filter((t) => t.estado === ESTADO.nueva).sort((a, b) => a.creada - b.creada || a.id.localeCompare(b.id)).slice(0, cupo)
  const enEspera = activas
    .filter((t) => (t.estado === ESTADO.aprendiendo || t.estado === ESTADO.reaprendiendo) && t.vence > ahora && t.vence <= ahora + MARGEN_APRENDIZAJE)
    .sort((a, b) => a.vence - b.vence)
  const fin = finDelDia(ahora)
  const masTarde = activas.filter((t) => t.estado !== ESTADO.nueva && t.vence > ahora && t.vence <= fin && !enEspera.includes(t))
  return { vencidas, nuevas, enEspera, masTarde }
}

/** Siguiente tarjeta a mostrar: vencidas → nuevas → aprendizaje que vence en minutos. */
export function siguiente(c: Cola): Tarjeta | undefined {
  return c.vencidas[0] ?? c.nuevas[0] ?? c.enEspera[0]
}

/** Días seguidos con al menos un repaso, terminando hoy (o ayer, si hoy todavía no repasó). */
export function racha(fechas: number[], ahora = Date.now()): number {
  const dias = new Set(fechas.map((f) => inicioDelDia(f)))
  let d = inicioDelDia(ahora)
  if (!dias.has(d)) d = inicioDelDia(d - 12 * 3_600_000)
  let n = 0
  while (dias.has(d)) {
    n++
    d = inicioDelDia(d - 12 * 3_600_000)
  }
  return n
}

// ───────────────────────── Cloze ─────────────────────────

const RE_CLOZE = /\{\{c(\d+)::(.*?)(?:::(.*?))?\}\}/gs

/** Números de hueco presentes en un texto cloze (c1, c2…), ordenados. */
export function numerosCloze(texto: string): number[] {
  return [...new Set([...texto.matchAll(RE_CLOZE)].map((m) => Number(m[1])))].sort((a, b) => a - b)
}

/** Texto de la pregunta (n oculto) o de la respuesta (todo visible, el hueco n marcado). */
export function renderCloze(texto: string, n: number, revelar: boolean): { texto: string; partes: { t: string; hueco?: boolean }[] } {
  const partes: { t: string; hueco?: boolean }[] = []
  let i = 0
  for (const m of texto.matchAll(RE_CLOZE)) {
    partes.push({ t: texto.slice(i, m.index) })
    const esEste = Number(m[1]) === n
    if (!esEste) partes.push({ t: m[2] })
    else if (revelar) partes.push({ t: m[2], hueco: true })
    else partes.push({ t: m[3] ? `[${m[3]}]` : '[…]', hueco: true })
    i = (m.index ?? 0) + m[0].length
  }
  partes.push({ t: texto.slice(i) })
  return { texto: partes.map((p) => p.t).join(''), partes }
}
