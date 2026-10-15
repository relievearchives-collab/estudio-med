/** Utilidades vectoriales (los embeddings ya vienen normalizados: coseno = producto punto). */
export function coseno(a: Float32Array, b: Float32Array) {
  let s = 0
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) s += a[i] * b[i]
  return s
}

export function masParecido<T>(v: Float32Array, candidatos: { item: T; vector: Float32Array }[]) {
  let mejor: { item: T; puntaje: number } | null = null
  for (const c of candidatos) {
    const p = coseno(v, c.vector)
    if (!mejor || p > mejor.puntaje) mejor = { item: c.item, puntaje: p }
  }
  return mejor
}
