import { limpiarRenglones, normalizar } from '../busqueda/normalizar'

/**
 * Corta el texto de UNA página en fragmentos de ~150–300 palabras, respetando
 * títulos y párrafos. Un fragmento nunca cruza de página (así la cita "pág. N" es exacta).
 */
export interface FragmentoCrudo {
  inicio: number
  fin: number
  texto: string
  titulo?: string
  palabras: number
}

export interface OpcionesFragmentar {
  min?: number
  max?: number
  /** Renglones a ignorar (encabezados/pies repetidos), ya pasados por claveEncabezado(). */
  encabezados?: Set<string>
  /** Título vigente al empezar la página (viene de la página anterior). */
  tituloInicial?: string
}

interface Renglon { inicio: number; fin: number; texto: string }
interface Unidad { inicio: number; fin: number; lineas: Renglon[]; palabras: number; esTitulo: boolean }
const textos = (u: Unidad) => u.lineas.map((l) => l.texto)

const contar = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length

/** Clave para detectar encabezados repetidos: normalizado y sin números. */
export function claveEncabezado(linea: string) {
  return normalizar(linea).replace(/\d+/g, '#').trim()
}

export function esRenglonDescartable(l: string) {
  const t = l.trim()
  if (!t) return true
  const relleno = (t.match(/[._…\-–—]/g) ?? []).length
  return t.length >= 8 && relleno / t.length > 0.6
}

export function esTitulo(l: string) {
  const t = l.trim()
  if (t.length < 3 || t.length > 90 || /[.,;]$/.test(t)) return false
  const letras = t.match(/\p{L}/gu) ?? []
  if (letras.length < 3) return false
  const mayus = letras.filter((c) => c === c.toUpperCase() && c !== c.toLowerCase()).length
  return mayus / letras.length > 0.75 && contar(t) <= 12
}

function separarRenglones(texto: string): Renglon[] {
  const r: Renglon[] = []
  let ini = 0
  for (let i = 0; i <= texto.length; i++) {
    if (i === texto.length || texto[i] === '\n') {
      r.push({ inicio: ini, fin: i, texto: texto.slice(ini, i) })
      ini = i + 1
    }
  }
  return r
}

const INICIO_PARRAFO = /^\s*([•›▪·\-–*]|\d+[.)]\s|[a-zA-Z][.)]\s|y\s+[A-ZÁÉÍÓÚ])/u

function agruparParrafos(renglones: Renglon[]): Unidad[] {
  const unidades: Unidad[] = []
  let actual: Unidad | null = null
  for (const r of renglones) {
    const t = r.texto.trim()
    if (esTitulo(t)) {
      if (actual) unidades.push(actual)
      unidades.push({ inicio: r.inicio, fin: r.fin, lineas: [{ ...r, texto: t }], palabras: contar(t), esTitulo: true })
      actual = null
      continue
    }
    const previo = actual?.lineas[actual.lineas.length - 1]?.texto ?? ''
    const nuevoParrafo = !actual || (/[.:?!”"]$/.test(previo) && (/^[\p{Lu}¿¡“"]/u.test(t) || INICIO_PARRAFO.test(t))) || INICIO_PARRAFO.test(t)
    if (nuevoParrafo) {
      if (actual) unidades.push(actual)
      actual = { inicio: r.inicio, fin: r.fin, lineas: [{ ...r, texto: t }], palabras: contar(t), esTitulo: false }
    } else if (actual) {
      actual.lineas.push({ ...r, texto: t })
      actual.fin = r.fin
      actual.palabras += contar(t)
    }
  }
  if (actual) unidades.push(actual)
  return unidades
}

/** Parte un párrafo muy largo en oraciones (manteniendo posiciones aproximadas por renglón). */
function partirLargo(u: Unidad, max: number): Unidad[] {
  if (u.palabras <= max) return [u]
  const partes: Unidad[] = []
  let act: Unidad | null = null
  for (const l of u.lineas) {
    if (!act) act = { inicio: l.inicio, fin: l.fin, lineas: [], palabras: 0, esTitulo: false }
    act.lineas.push(l)
    act.fin = l.fin
    act.palabras += contar(l.texto)
    if (act.palabras >= max * 0.6 && /[.:?!]$/.test(l.texto)) {
      partes.push(act)
      act = null
    }
  }
  if (act) partes.push(act)
  return partes
}

export function fragmentarPagina(texto: string, op: OpcionesFragmentar = {}): { fragmentos: FragmentoCrudo[]; tituloFinal?: string } {
  const min = op.min ?? 150
  const max = op.max ?? 300
  const renglones = separarRenglones(texto).filter(
    (r) => !esRenglonDescartable(r.texto) && !op.encabezados?.has(claveEncabezado(r.texto)),
  )
  const unidades = agruparParrafos(renglones).flatMap((u) => partirLargo(u, max))
  const fragmentos: FragmentoCrudo[] = []
  let titulo = op.tituloInicial
  let grupo: Unidad[] = []
  let palabras = 0

  const cerrar = () => {
    const cuerpo = grupo.filter((u) => !u.esTitulo || grupo.length === 1)
    if (!grupo.length || !cuerpo.length) return
    const textoF = grupo.map((u) => limpiarRenglones(textos(u))).join('\n\n')
    fragmentos.push({ inicio: grupo[0].inicio, fin: grupo[grupo.length - 1].fin, texto: textoF, titulo, palabras })
    grupo = []
    palabras = 0
  }

  for (const u of unidades) {
    if (u.esTitulo) {
      if (palabras >= 80) cerrar()
      titulo = limpiarRenglones(textos(u))
      grupo.push(u)
      palabras += u.palabras
      continue
    }
    if (palabras + u.palabras > max && palabras >= 60) cerrar()
    grupo.push(u)
    palabras += u.palabras
    if (palabras >= Math.max(min, (min + max) / 2 - 25)) cerrar()
  }
  // Resto chico al final de la página: se suma al fragmento anterior si entra.
  if (grupo.length) {
    const ultimo = fragmentos[fragmentos.length - 1]
    if (ultimo && palabras < 50 && ultimo.palabras + palabras <= max + 60) {
      ultimo.texto += '\n\n' + grupo.map((u) => limpiarRenglones(textos(u))).join('\n\n')
      ultimo.fin = grupo[grupo.length - 1].fin
      ultimo.palabras += palabras
      grupo = []
    } else {
      // Página que solo tiene un título (ej. portada de unidad): igual se guarda si tiene contenido.
      if (grupo.some((u) => !u.esTitulo) || palabras >= 3) {
        const textoF = grupo.map((u) => limpiarRenglones(textos(u))).join('\n\n')
        fragmentos.push({ inicio: grupo[0].inicio, fin: grupo[grupo.length - 1].fin, texto: textoF, titulo, palabras })
      }
    }
  }
  return { fragmentos, tituloFinal: titulo }
}

/** Detecta renglones que se repiten en muchas páginas (encabezados/pies). */
export function detectarEncabezados(textosPaginas: string[], umbral = 0.3): Set<string> {
  const cuenta = new Map<string, number>()
  for (const t of textosPaginas) {
    const vistos = new Set<string>()
    for (const l of t.split('\n')) {
      const k = claveEncabezado(l)
      if (k.length < 4 || vistos.has(k)) continue
      vistos.add(k)
      cuenta.set(k, (cuenta.get(k) ?? 0) + 1)
    }
  }
  const conTexto = textosPaginas.filter((t) => t.trim()).length
  const r = new Set<string>()
  if (conTexto < 5) return r
  for (const [k, n] of cuenta) if (n / conTexto >= umbral) r.add(k)
  return r
}
