import { normalizar } from '../busqueda/normalizar'
import { paqueteActivo } from '../contenido'
import datosEscenas from './escenas.json'
import datosFichas from './estructuras.json'

/**
 * Datos del atlas 3D: escenas (qué piezas tiene cada una) y fichas de cada estructura.
 * Es contenido reutilizable entre áreas; qué escenas usa cada área está en el paquete de contenido.
 */

export type Lado = 'derecho' | 'izquierdo'

export interface PiezaEscena {
  id: string
  /** Código FMA de BodyParts3D (solo en escenas de modelo). */
  fma?: string
  ficha: string
  lado?: Lado
  /** Capa que se prende y apaga (urinario, vascular, óseo…). */
  capa: string
  /** Color en modo realista: arteria, vena, porta. */
  tono?: string
  /** Nivel (discos intervertebrales). */
  nivel?: string
}

export interface EscenaAtlas {
  id: string
  titulo: string
  tipo: 'modelo' | 'esquema'
  archivo?: string
  esquema?: string
  capasApagadas?: string[]
  vista?: VistaRapida
  piezas: PiezaEscena[]
}

export interface Ficha {
  nombre: string
  latin: string
  sinonimos: string[]
  descripcion: string
  relaciones: string
  irrigacion: string
  inervacion: string
  /** Nefrona: qué se reabsorbe y secreta en el segmento. */
  reabsorbe?: string
  secreta?: string
  fisiologia?: string
  /** Simulador de fisiología relacionado (Fase 4). */
  simulador?: string
  lados?: Partial<Record<Lado, Partial<Ficha>>>
  revisado: boolean
}

export type VistaRapida = 'anterior' | 'posterior' | 'lateral' | 'superior' | 'inferior'

export const escenas = datosEscenas.escenas as EscenaAtlas[]
export const fichas = datosFichas.fichas as unknown as Record<string, Ficha>

export function escenaPorId(id?: string) {
  return escenas.find((e) => e.id === id)
}

/** Escenas que usa el área activa, en orden de prioridad (con su unidad). */
export function escenasDelArea() {
  return paqueteActivo.atlas
    .map((a) => ({ ...a, datos: escenaPorId(a.escena)! }))
    .filter((a) => a.datos)
    .sort((a, b) => a.prioridad - b.prioridad || a.unidadId.localeCompare(b.unidadId))
}

const NOMBRE_LADO: Record<Lado, string> = { derecho: 'derecho', izquierdo: 'izquierdo' }

/** Nombre visible de una pieza: "Riñón derecho", "Disco intervertebral L1–L2". */
export function nombrePieza(p: PiezaEscena, f: Ficha = fichas[p.ficha]) {
  if (!f) return p.id
  let n = f.nombre
  if (p.lado) n += ` ${feminizar(n, NOMBRE_LADO[p.lado])}`
  if (p.nivel) n += ` ${p.nivel}`
  return n
}

/** "Glándula suprarrenal derecha", "Vena renal izquierda"… (concordancia con el sustantivo). */
function feminizar(nombre: string, lado: string) {
  const primera = normalizar(nombre.split(' ')[0])
  const femeninos = ['glandula', 'vena', 'arteria', 'costilla', 'vesicula', 'uretra', 'pelvis', 'columna', 'papila', 'piramide', 'corteza', 'medula', 'capsula', 'arteriola', 'rama', 'macula', 'undecima', 'duodecima', 'cresta', 'tuberosidad', 'fosa']
  return femeninos.includes(primera) ? lado.replace(/o$/, 'a') : lado
}

/** Ficha completa de una pieza: la base + lo propio de su lado + lo que editó el estudiante. */
export function fichaDePieza(p: PiezaEscena, editada?: Partial<Ficha>): Ficha & { titulo: string } {
  const base = fichas[p.ficha]
  const lado = p.lado ? base?.lados?.[p.lado] : undefined
  const f = { ...base, ...lado, ...editada } as Ficha
  return { ...f, titulo: nombrePieza(p, f) }
}

// ───────────────────────── Corrección del Modo Museo ─────────────────────────

const VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'y', 'musculo', 'm', 'glandula', 'nervio', 'n'])
const LADOS: Record<string, Lado> = { derecho: 'derecho', derecha: 'derecho', der: 'derecho', dexter: 'derecho', dextra: 'derecho', izquierdo: 'izquierdo', izquierda: 'izquierdo', izq: 'izquierdo', sinister: 'izquierdo', sinistra: 'izquierdo' }

/** Palabras significativas (sin tildes, artículos ni lado) + el lado si lo nombró. */
function tokens(s: string) {
  const ps = normalizar(s).split(' ').filter(Boolean)
  const lado = ps.map((x) => LADOS[x]).find(Boolean)
  return { clave: ps.filter((x) => !LADOS[x] && !VACIAS.has(x)).join(' '), lado }
}

/** Distancia de edición (para tolerar un error de tipeo). */
export function distancia(a: string, b: string) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  }
  return d[a.length][b.length]
}

/**
 * ¿La respuesta nombra a la pieza? Tolera tildes, mayúsculas, artículos, "músculo"/"glándula",
 * sinónimos, nombre latino y un error de tipeo (dos si el nombre es largo). Decir el lado no es
 * obligatorio, pero si dice el lado equivocado es incorrecta.
 */
export function esRespuestaCorrecta(respuesta: string, p: PiezaEscena, f: Ficha = fichaDePieza(p)): boolean {
  const r = tokens(respuesta)
  if (!r.clave) return false
  if (p.lado && r.lado && r.lado !== p.lado) return false
  const validas = [f.nombre, f.latin, ...(f.sinonimos ?? []), f.nombre.replace(/\s*\(.*\)\s*/, '')].map((x) => tokens(x).clave).filter(Boolean)
  return validas.some((v) => {
    if (v === r.clave) return true
    const tolerancia = v.length >= 12 ? 2 : v.length >= 5 ? 1 : 0
    return distancia(v, r.clave) <= tolerancia
  })
}
