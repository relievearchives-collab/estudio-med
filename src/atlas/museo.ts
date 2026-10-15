import type { EstructuraAtlas } from '../repositorio/tipos'
import { calificar, estadoNuevo } from '../tarjetas/fsrs'

/**
 * Tanda del Modo Museo / "¿Dónde está?": primero las estructuras vencidas (FSRS, la más atrasada
 * primero), después las que nunca practicó y al final las demás (la que vio hace más tiempo primero).
 */
export function elegirTanda(ids: string[], estados: Map<string, EstructuraAtlas>, ahora: number, cuantas: number, azar: () => number = Math.random): string[] {
  const unicos = [...new Set(ids)]
  const vencidas = unicos.filter((id) => estados.get(id) && estados.get(id)!.vence <= ahora).sort((a, b) => estados.get(a)!.vence - estados.get(b)!.vence)
  const nuevas = mezclar(unicos.filter((id) => !estados.get(id)), azar)
  const resto = unicos.filter((id) => estados.get(id) && estados.get(id)!.vence > ahora).sort((a, b) => (estados.get(a)!.ultimo ?? 0) - (estados.get(b)!.ultimo ?? 0))
  return [...vencidas, ...nuevas, ...resto].slice(0, cuantas)
}

export function mezclar<T>(xs: T[], azar: () => number = Math.random): T[] {
  const a = [...xs]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/**
 * Nuevo estado FSRS de una estructura según la respuesta: acierto → "Bien" (o "Difícil" si
 * necesitó pista); error → "Otra vez", para que vuelva pronto.
 */
export function estadoTrasRespuesta(previo: EstructuraAtlas | undefined, acierto: boolean, conPista = false, ahora = Date.now(), retencion = 0.9) {
  const base = previo?.fsrs ?? estadoNuevo(ahora)
  return calificar(base, acierto ? (conPista ? 2 : 3) : 1, ahora, retencion)
}

/** Puntaje de una tanda (0–100). */
export const puntaje = (aciertos: number, total: number) => (total ? Math.round((aciertos / total) * 100) : 0)
