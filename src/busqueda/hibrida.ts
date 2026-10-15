import MiniSearch from 'minisearch'
import { fragmentos as repoFragmentos } from '../repositorio'
import type { Alcance, Fragmento } from '../repositorio/tipos'
import { normalizar } from './normalizar'
import { coseno } from './vectores'

/**
 * Búsqueda híbrida: texto exacto (MiniSearch: fármacos, siglas, epónimos, fórmulas)
 * + similitud por significado (embeddings locales), combinadas con Reciprocal Rank Fusion.
 */

/** Reciprocal Rank Fusion: combina rankings sin tener que calibrar puntajes. */
export function fusionarRRF(listas: string[][], k = 60): { id: string; puntaje: number }[] {
  const p = new Map<string, number>()
  for (const lista of listas) lista.forEach((id, i) => p.set(id, (p.get(id) ?? 0) + 1 / (k + i + 1)))
  return [...p.entries()].map(([id, puntaje]) => ({ id, puntaje })).sort((a, b) => b.puntaje - a.puntaje)
}

/** Palabras vacías del español (no aportan a la búsqueda exacta). */
const VACIAS = new Set(
  ('a al algo algun alguna algunas alguno algunos ante antes como con contra cual cuales cuando de del desde donde durante e el ella ellas ellos en entre era eran es esa esas ese eso esos esta estan estas este esto estos fue fueron ha han hay la las le les lo los mas me mi muy no nos o otra otras otro otros para pero poco por porque que quien se ser si sin sobre son su sus tambien tan tanto te tiene tienen todo todos tu un una unas uno unos y ya cual cuales cuanto como explicame explica que es')
    .split(' '),
)

export function crearIndiceTexto(lista: Fragmento[]) {
  const ms = new MiniSearch<Fragmento>({
    fields: ['texto', 'titulo'],
    storeFields: [],
    // Un término puede normalizarse en varias palabras (ej. "Na+/K+"): se indexan por separado.
    processTerm: (t) => {
      const partes = normalizar(t).split(' ').filter((n) => n && !VACIAS.has(n))
      return partes.length ? partes : null
    },
    tokenize: (s) => s.split(/[\s,.;:()¿?¡!"“”'/\-–—]+/u).filter(Boolean),
    searchOptions: { boost: { titulo: 1.5 }, prefix: (t) => t.length > 4, fuzzy: (t) => (t.length > 6 ? 0.15 : 0) },
  })
  ms.addAll(lista)
  return ms
}

let cache: { clave: string; indice: MiniSearch<Fragmento>; lista: Fragmento[] } | null = null

/** Índice de texto de TODOS los fragmentos (se reconstruye solo si cambió la cantidad). */
async function indiceGlobal() {
  const lista = await repoFragmentos.todos()
  const clave = `${lista.length}:${lista[0]?.id ?? ''}:${lista[lista.length - 1]?.id ?? ''}`
  if (!cache || cache.clave !== clave) cache = { clave, indice: crearIndiceTexto(lista), lista }
  return cache
}

export function invalidarIndice() { cache = null }

function enAlcance(f: Fragmento, a: Alcance) {
  switch (a.tipo) {
    case 'unidad': return f.unidadId === a.unidadId
    case 'disciplina': return f.disciplinaId === a.disciplinaId
    case 'tema': return f.temaId === a.temaId
    case 'fuentes': return (a.fuenteIds ?? []).includes(f.fuenteId)
    default: return true
  }
}

export interface OpcionesBusqueda {
  alcance?: Alcance
  limite?: number
  /** Embedding de la consulta (si el modelo local está disponible). */
  vector?: Float32Array | null
}

export async function buscarFragmentos(consulta: string, op: OpcionesBusqueda = {}): Promise<Fragmento[]> {
  const alcance = op.alcance ?? { tipo: 'todo' }
  const limite = op.limite ?? 10
  const { indice, lista } = await indiceGlobal()
  const porId = new Map(lista.map((f) => [f.id, f]))
  const candidatos = lista.filter((f) => enAlcance(f, alcance))
  const enAlc = new Set(candidatos.map((f) => f.id))

  const texto = indice.search(consulta, { combineWith: 'OR' })
    .filter((r) => enAlc.has(r.id as string))
    .slice(0, 40)
    .map((r) => r.id as string)

  const listas = [texto]
  if (op.vector) {
    const vec = candidatos
      .filter((f) => f.embedding)
      .map((f) => ({ id: f.id, s: coseno(op.vector!, f.embedding!) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 40)
      .map((x) => x.id)
    // La similitud semántica pesa doble: es la que encuentra paráfrasis.
    listas.push(vec, vec)
  }
  return fusionarRRF(listas).slice(0, limite).map((r) => porId.get(r.id)!).filter(Boolean)
}

/** Búsqueda solo por texto (para la barra de búsqueda unificada). */
export async function buscarTexto(consulta: string, limite = 30) {
  const { indice, lista } = await indiceGlobal()
  const porId = new Map(lista.map((f) => [f.id, f]))
  return indice.search(consulta, { combineWith: 'AND' }).slice(0, limite).map((r) => porId.get(r.id as string)!).filter(Boolean)
}
