import type { Revision, Tarjeta } from '../repositorio/tipos'

export interface TemaFlojo {
  temaId: string
  repasos: number
  olvidos: number
  /** Proporción de "Otra vez" entre los repasos recientes. */
  tasa: number
}

/**
 * Temas flojos: los que más "Otra vez" acumulan en los repasos recientes
 * (mínimo `minimo` repasos para no exagerar con pocas respuestas).
 */
export function temasFlojos(revs: Revision[], tarjetas: Map<string, Tarjeta>, minimo = 4, cuantos = 3): TemaFlojo[] {
  const por = new Map<string, { repasos: number; olvidos: number }>()
  for (const r of revs) {
    const temaId = tarjetas.get(r.tarjetaId)?.temaId
    if (!temaId) continue
    const x = por.get(temaId) ?? { repasos: 0, olvidos: 0 }
    x.repasos++
    if (r.calificacion === 1) x.olvidos++
    por.set(temaId, x)
  }
  return [...por.entries()]
    .map(([temaId, x]) => ({ temaId, ...x, tasa: x.olvidos / x.repasos }))
    .filter((x) => x.repasos >= minimo && x.olvidos > 0)
    .sort((a, b) => b.tasa - a.tasa || b.olvidos - a.olvidos)
    .slice(0, cuantos)
}
