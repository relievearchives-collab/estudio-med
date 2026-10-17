import { buscarFragmentos } from '../busqueda/hibrida'
import { etiquetaFragmento } from '../chat/preguntar'
import { fraseEnTexto, limpiarMarcas } from '../citas/verificar'
import { iaJSON } from '../ia/cliente'
import { armarPromptEsquema, ESQUEMA_MAPA, ESQUEMA_TABLA, SISTEMA_MAPA, SISTEMA_TABLA, type MapaIA, type TablaIA, type TextoCitadoIA } from '../ia/prompts/esquemas'
import { embeberConsulta } from '../procesamiento/cola'
import { esquemas } from '../repositorio'
import type { Alcance, CeldaCitada, Esquema, Fragmento, MapaConceptual, TablaComparativa } from '../repositorio/tipos'

const FRAGMENTOS = 10
const limpio = (s: unknown) => (typeof s === 'string' ? limpiarMarcas(s).trim() : '')

/** Texto con su cita verificada contra el fragmento (como en el chat). */
export function celda(x: TextoCitadoIA | undefined, frags: Fragmento[]): CeldaCitada {
  const texto = limpio(x?.texto)
  const f = x && Number.isInteger(x.f) && x.f >= 1 ? frags[x.f - 1] : undefined
  if (!f || !x?.frase) return { texto }
  return { texto, cita: { n: x.f, fragmentoId: f.id, frase: x.frase, verificada: fraseEnTexto(x.frase, f.texto) } }
}

/** Tabla válida: 2–4 columnas, filas con aspecto; las celdas faltantes quedan vacías para completar a mano. */
export function aTabla(r: TablaIA, frags: Fragmento[]): TablaComparativa | null {
  const columnas = (r.columnas ?? []).map(limpio).filter(Boolean).slice(0, 4)
  const filas = (r.filas ?? [])
    .map((f) => ({ aspecto: limpio(f.aspecto), celdas: columnas.map((_, i) => celda(f.celdas?.[i], frags)) }))
    .filter((f) => f.aspecto && f.celdas.some((c) => c.texto))
  return columnas.length >= 2 && filas.length >= 2 ? { columnas, filas } : null
}

/** Mapa válido: ids únicos, relaciones solo entre nodos existentes y sin repetir ni ciclos sobre sí mismos. */
export function aMapa(r: MapaIA, frags: Fragmento[]): MapaConceptual | null {
  const vistos = new Set<string>()
  const nodos = (r.nodos ?? [])
    .map((n) => ({ id: limpio(n.id), ...celda(n, frags) }))
    .filter((n) => n.id && n.texto && !vistos.has(n.id) && vistos.add(n.id))
  const ids = new Set(nodos.map((n) => n.id))
  const claves = new Set<string>()
  const relaciones = (r.relaciones ?? [])
    .map((x) => ({ desde: limpio(x.desde), hasta: limpio(x.hasta), etiqueta: limpio(x.etiqueta) }))
    .filter((x) => ids.has(x.desde) && ids.has(x.hasta) && x.desde !== x.hasta && !claves.has(`${x.desde}>${x.hasta}`) && claves.add(`${x.desde}>${x.hasta}`))
  return nodos.length >= 3 && relaciones.length >= 2 ? { nodos, relaciones } : null
}

export async function generarEsquema(tipo: 'tabla' | 'mapa', consigna: string, alcance: Alcance): Promise<Esquema> {
  if (consigna.trim().length < 3) throw new Error(tipo === 'tabla' ? 'Escribí qué querés comparar.' : 'Escribí el tema del mapa.')
  let vector: Float32Array | null = null
  try { vector = await embeberConsulta(consigna, 15000) } catch { /* búsqueda solo por texto */ }
  const frags = await buscarFragmentos(consigna, { alcance, limite: FRAGMENTOS, vector })
  if (!frags.length) throw new Error('No encontré material sobre eso en tus fuentes (dentro del alcance elegido).')
  const etiquetas = await Promise.all(frags.map(etiquetaFragmento))
  const prompt = armarPromptEsquema(tipo, consigna.trim(), frags.map((f, i) => ({ texto: f.texto, etiqueta: etiquetas[i] })))
  if (tipo === 'tabla') {
    const r = await iaJSON<TablaIA>([{ rol: 'usuario', texto: prompt }], ESQUEMA_TABLA, { sistema: SISTEMA_TABLA, uso: 'chat', funcion: 'esquema', temperatura: 0.3 })
    const tabla = aTabla(r, frags)
    if (!tabla) throw new Error('La IA no devolvió una tabla válida. Probá con otra consigna.')
    return esquemas.crear({ tipo, titulo: limpio(r.titulo) || consigna.trim(), consigna: consigna.trim(), alcance, tabla })
  }
  const r = await iaJSON<MapaIA>([{ rol: 'usuario', texto: prompt }], ESQUEMA_MAPA, { sistema: SISTEMA_MAPA, uso: 'chat', funcion: 'esquema', temperatura: 0.3 })
  const mapa = aMapa(r, frags)
  if (!mapa) throw new Error('La IA no devolvió un mapa válido. Probá con otra consigna.')
  return esquemas.crear({ tipo, titulo: limpio(r.titulo) || consigna.trim(), consigna: consigna.trim(), alcance, mapa })
}
