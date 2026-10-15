import type { PreguntaAprendizaje, Tema } from '../repositorio/tipos'

/**
 * Lógica de la tutoría ABP que NO depende de la IA: la IA solo dice a qué temas apunta
 * cada pregunta (por número); qué quedó sin cubrir lo decide este módulo.
 */

/** Asignación devuelta por la IA: pregunta n (desde 1) → temas t (números desde 1 de la lista enviada). */
export interface AsignacionIA {
  p: number
  temas: number[]
}

/** Convierte la respuesta de la IA en temaIds válidos (descarta números fuera de rango y repetidos). */
export function aplicarAsignacion(textos: string[], asignaciones: AsignacionIA[], temas: Tema[]): PreguntaAprendizaje[] {
  return textos.map((texto, i) => {
    const a = asignaciones.find((x) => x.p === i + 1)
    const ids = (a?.temas ?? [])
      .filter((n) => Number.isInteger(n) && n >= 1 && n <= temas.length)
      .map((n) => temas[n - 1].id)
    return { texto, temaIds: [...new Set(ids)] }
  })
}

/** Temas de la UP que ninguna pregunta cubre, en el orden de la UP. */
export function temasSinCubrir(temas: Tema[], preguntas: PreguntaAprendizaje[]): Tema[] {
  const cubiertos = new Set(preguntas.flatMap((p) => p.temaIds))
  return temas.filter((t) => !cubiertos.has(t.id))
}

/** Disciplinas presentes en la UP sin ningún tema cubierto. */
export function disciplinasSinCubrir(temas: Tema[], cubiertos: Iterable<string>): string[] {
  const set = new Set(cubiertos)
  const disciplinas = [...new Set(temas.map((t) => t.disciplinaId))]
  return disciplinas.filter((d) => !temas.some((t) => t.disciplinaId === d && set.has(t.id)))
}

/**
 * Elige hasta `max` faltantes repartidos entre disciplinas (uno de cada una por vuelta),
 * para que la devolución no sean diez temas de la misma disciplina.
 */
export function priorizarFaltantes(faltan: Tema[], max: number): Tema[] {
  const porDisciplina = new Map<string, Tema[]>()
  for (const t of faltan) porDisciplina.set(t.disciplinaId, [...(porDisciplina.get(t.disciplinaId) ?? []), t])
  const colas = [...porDisciplina.values()]
  const salida: Tema[] = []
  for (let vuelta = 0; salida.length < max && colas.some((c) => c.length > vuelta); vuelta++) {
    for (const c of colas) if (c[vuelta] && salida.length < max) salida.push(c[vuelta])
  }
  return salida
}

/** Separa un texto pegado o dictado en ítems (renglones, viñetas o "?"), sin vacíos ni repetidos. */
export function separarItems(texto: string): string[] {
  const items = texto
    .split(/\n+|(?<=\?)\s+/)
    .map((s) => s.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, '').trim())
    .filter((s) => s.length > 2)
  return [...new Set(items)]
}
