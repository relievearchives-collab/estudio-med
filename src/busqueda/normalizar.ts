/**
 * Normalización tolerante para comparar citas con el texto de las fuentes:
 * - minúsculas, sin tildes ni diacríticos (NFKD: también "²" → "2", ligaduras → letras)
 * - signos de puntuación → espacio; espacios múltiples → uno
 * - une palabras cortadas por guion al final de renglón ("del-\ngada" → "delgada")
 * Además devuelve un mapa índice-normalizado → índice-original, para poder
 * resaltar en el PDF exactamente la frase encontrada.
 */
export interface TextoNormalizado {
  texto: string
  /** mapa[i] = posición en el texto original del carácter normalizado i */
  mapa: number[]
}

const LETRA = /[\p{L}\p{N}]/u
const MARCAS = /\p{M}/gu

export function normalizarConMapa(original: string): TextoNormalizado {
  const salida: string[] = []
  const mapa: number[] = []
  let i = 0
  while (i < original.length) {
    const c = original[i]
    // Guion de corte de renglón: letra + "-" + (espacios) + salto + (espacios) + letra
    if ((c === '-' || c === '­' || c === '‐') && i > 0 && LETRA.test(original[i - 1])) {
      let j = i + 1
      let saltos = 0
      while (j < original.length && /\s/.test(original[j])) { if (original[j] === '\n') saltos++; j++ }
      if (saltos > 0 && j < original.length && LETRA.test(original[j])) { i = j; continue }
      if (c === '­') { i++; continue }
    }
    const base = c.normalize('NFKD').replace(MARCAS, '').toLowerCase()
    for (const ch of base) {
      if (LETRA.test(ch)) {
        salida.push(ch)
        mapa.push(i)
      } else if (salida.length && salida[salida.length - 1] !== ' ') {
        salida.push(' ')
        mapa.push(i)
      }
    }
    i++
  }
  if (salida[salida.length - 1] === ' ') { salida.pop(); mapa.pop() }
  return { texto: salida.join(''), mapa }
}

export function normalizar(s: string): string {
  return normalizarConMapa(s).texto
}

/**
 * Busca una frase dentro de un texto con comparación normalizada.
 * Devuelve la posición [inicio, fin) en el texto ORIGINAL, o null.
 */
export function buscarFrase(texto: string, frase: string, desde = 0): { inicio: number; fin: number } | null {
  const f = normalizar(frase)
  if (!f) return null
  const n = normalizarConMapa(texto)
  let inicioNorm = 0
  if (desde > 0) inicioNorm = n.mapa.findIndex((m) => m >= desde)
  if (inicioNorm < 0) return null
  const idx = n.texto.indexOf(f, inicioNorm)
  if (idx < 0) return null
  return { inicio: n.mapa[idx], fin: n.mapa[idx + f.length - 1] + 1 }
}

/** Une renglones de un texto extraído de PDF en un texto limpio para leer (sin cortes de guion). */
export function limpiarRenglones(lineas: string[]): string {
  let r = ''
  for (const l0 of lineas) {
    const l = l0.trim()
    if (!l) continue
    if (!r) { r = l; continue }
    if (/[\p{L}][-­‐]$/u.test(r) && /^[\p{L}]/u.test(l)) r = r.slice(0, -1) + l
    else r += ' ' + l
  }
  return r
}
