import type { CeldaCitada, MapaConceptual, TablaComparativa } from '../repositorio/tipos'

/** Disposición del mapa conceptual por niveles (sin librerías) y exportación a Markdown. */

export const ANCHO_NODO = 168
const SEP_X = 36
const SEP_Y = 64
const ALTO_LINEA = 18
const PADDING_NODO = 12
const MARGEN = 24
const MAX_LINEAS = 4

/** Corta un texto en renglones de hasta `max` caracteres (por palabras); como mucho 4, con "…". */
export function partirLineas(texto: string, max = 20): string[] {
  const lineas: string[] = []
  let actual = ''
  for (const p of texto.split(/\s+/).filter(Boolean)) {
    if (!actual) actual = p
    else if ((actual + ' ' + p).length <= max) actual += ' ' + p
    else { lineas.push(actual); actual = p }
  }
  if (actual) lineas.push(actual)
  if (lineas.length > MAX_LINEAS) return [...lineas.slice(0, MAX_LINEAS - 1), lineas[MAX_LINEAS - 1] + '…']
  return lineas.length ? lineas : ['']
}

export interface CajaNodo { x: number; y: number; w: number; h: number; lineas: string[] }

/** Nivel de cada nodo: distancia mínima desde las raíces (nodos sin relaciones entrantes). Tolera ciclos y nodos sueltos. */
export function niveles(mapa: MapaConceptual): Map<string, number> {
  const entrantes = new Set(mapa.relaciones.map((r) => r.hasta))
  const hijos = new Map<string, string[]>()
  for (const r of mapa.relaciones) hijos.set(r.desde, [...(hijos.get(r.desde) ?? []), r.hasta])
  const nivel = new Map<string, number>()
  const recorrer = (inicio: string[]) => {
    const cola = inicio.filter((id) => !nivel.has(id))
    for (const id of cola) nivel.set(id, 0)
    while (cola.length) {
      const id = cola.shift()!
      for (const h of hijos.get(id) ?? []) if (!nivel.has(h)) { nivel.set(h, nivel.get(id)! + 1); cola.push(h) }
    }
  }
  recorrer(mapa.nodos.filter((n) => !entrantes.has(n.id)).map((n) => n.id))
  // Lo que quedó (ciclos sin raíz o islas) arranca desde su primer nodo.
  for (const n of mapa.nodos) if (!nivel.has(n.id)) recorrer([n.id])
  return nivel
}

/** Posición (centro) y tamaño de cada nodo; respeta las posiciones movidas a mano. */
export function disponerMapa(mapa: MapaConceptual): { cajas: Map<string, CajaNodo>; ancho: number; alto: number } {
  const nivel = niveles(mapa)
  const filas: string[][] = []
  for (const n of mapa.nodos) (filas[nivel.get(n.id)!] ??= []).push(n.id)
  // Dentro de cada fila, ordenar por el promedio de la posición de los padres (menos cruces).
  const orden = new Map<string, number>()
  filas.forEach((fila, i) => {
    if (i > 0) {
      const prom = (id: string) => {
        const padres = mapa.relaciones.filter((r) => r.hasta === id && orden.has(r.desde)).map((r) => orden.get(r.desde)!)
        return padres.length ? padres.reduce((s, x) => s + x, 0) / padres.length : Infinity
      }
      fila.sort((a, b) => prom(a) - prom(b))
    }
    fila.forEach((id, k) => orden.set(id, k))
  })
  const texto = new Map(mapa.nodos.map((n) => [n.id, partirLineas(n.texto)]))
  const altoNodo = (id: string) => texto.get(id)!.length * ALTO_LINEA + PADDING_NODO * 2
  const maxPorFila = Math.max(1, ...filas.map((f) => f?.length ?? 0))
  const anchoTotal = maxPorFila * (ANCHO_NODO + SEP_X) - SEP_X
  const cajas = new Map<string, CajaNodo>()
  let y = MARGEN
  for (const fila of filas) {
    if (!fila) continue
    const altoFila = Math.max(...fila.map(altoNodo))
    const inicio = MARGEN + (anchoTotal - (fila.length * (ANCHO_NODO + SEP_X) - SEP_X)) / 2
    fila.forEach((id, k) => cajas.set(id, { x: inicio + k * (ANCHO_NODO + SEP_X) + ANCHO_NODO / 2, y: y + altoFila / 2, w: ANCHO_NODO, h: altoNodo(id), lineas: texto.get(id)! }))
    y += altoFila + SEP_Y
  }
  for (const n of mapa.nodos) {
    const c = cajas.get(n.id)!
    if (n.x !== undefined && n.y !== undefined) cajas.set(n.id, { ...c, x: n.x, y: n.y })
  }
  const todas = [...cajas.values()]
  const ancho = Math.max(...todas.map((c) => c.x + c.w / 2)) + MARGEN
  const alto = Math.max(...todas.map((c) => c.y + c.h / 2)) + MARGEN
  return { cajas, ancho, alto }
}

/** Punto donde la línea entre dos centros sale del borde de la caja (para que la flecha no quede tapada). */
export function bordeCaja(c: CajaNodo, hacia: { x: number; y: number }) {
  const dx = hacia.x - c.x, dy = hacia.y - c.y
  if (!dx && !dy) return { x: c.x, y: c.y }
  const t = Math.min(dx ? (c.w / 2) / Math.abs(dx) : Infinity, dy ? (c.h / 2) / Math.abs(dy) : Infinity)
  return { x: c.x + dx * t, y: c.y + dy * t }
}

// ───────────────────────── Markdown ─────────────────────────

/** Referencia "(Fuente, pág. N)" de una cita verificada, o vacío. */
export type Referencia = (c: CeldaCitada) => string

const escapar = (s: string) => s.replace(/\|/g, '\\|').replace(/\n/g, ' ')
const conRef = (c: CeldaCitada, ref: Referencia) => [c.texto, ref(c)].filter(Boolean).join(' ')

export function tablaAMarkdown(t: TablaComparativa, ref: Referencia = () => '') {
  const enc = `| Aspecto | ${t.columnas.map(escapar).join(' | ')} |`
  const sep = `|${' --- |'.repeat(t.columnas.length + 1)}`
  const filas = t.filas.map((f) => `| **${escapar(f.aspecto)}** | ${f.celdas.map((c) => escapar(conRef(c, ref))).join(' | ')} |`)
  return [enc, sep, ...filas].join('\n')
}

/** Mapa como esquema de viñetas desde las raíces: "concepto → (etiqueta) concepto"; cada nodo una sola vez. */
export function mapaAMarkdown(m: MapaConceptual, ref: Referencia = () => '') {
  const porId = new Map(m.nodos.map((n) => [n.id, n]))
  const nivel = niveles(m)
  const raices = m.nodos.filter((n) => nivel.get(n.id) === 0)
  const vistos = new Set<string>()
  const lineas: string[] = []
  const escribir = (id: string, prof: number, etiqueta?: string) => {
    const n = porId.get(id)!
    const repetido = vistos.has(id)
    lineas.push(`${'  '.repeat(prof)}- ${etiqueta ? `*${etiqueta}* → ` : ''}**${n.texto}**${repetido ? ' (ver arriba)' : ref(n) ? ` ${ref(n)}` : ''}`)
    if (repetido) return
    vistos.add(id)
    for (const r of m.relaciones.filter((x) => x.desde === id)) escribir(r.hasta, prof + 1, r.etiqueta)
  }
  for (const r of raices) escribir(r.id, 0)
  return lineas.join('\n')
}
