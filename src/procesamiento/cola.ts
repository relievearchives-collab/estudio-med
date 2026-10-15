import { fuentes } from '../repositorio'
import type { MensajeAlWorker, MensajeDelWorker } from './worker'

/**
 * Lado "hilo principal" del worker: encola fuentes, pide embeddings de consultas
 * y expone el estado del modelo local de embeddings.
 */
let worker: Worker | null = null
let siguienteId = 1
const pendientes = new Map<number, (v: Float32Array[] | null) => void>()

export interface EstadoModelo { progreso: number; listo: boolean; error?: string }
let estadoModelo: EstadoModelo = { progreso: 0, listo: false }
const oyentesModelo = new Set<(e: EstadoModelo) => void>()

export function escucharModelo(fn: (e: EstadoModelo) => void) {
  oyentesModelo.add(fn)
  fn(estadoModelo)
  return () => { oyentesModelo.delete(fn) }
}

function obtenerWorker() {
  if (worker) return worker
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev: MessageEvent<MensajeDelWorker>) => {
    const m = ev.data
    if (m.tipo === 'vectores') {
      pendientes.get(m.id)?.(m.vectores ?? null)
      pendientes.delete(m.id)
    } else if (m.tipo === 'modelo') {
      estadoModelo = { progreso: m.progreso, listo: !!m.listo || estadoModelo.listo, error: m.error }
      oyentesModelo.forEach((f) => f(estadoModelo))
    }
  }
  worker.onerror = (e) => console.error('Worker de procesamiento', e)
  return worker
}

const mandar = (m: MensajeAlWorker) => obtenerWorker().postMessage(m)

export function encolarFuente(fuenteId: string) {
  mandar({ tipo: 'procesar', fuenteId })
}

/** Embedding de una consulta. Devuelve null si el modelo no está disponible (sin internet la primera vez). */
export function embeberConsulta(texto: string, espera = 60000): Promise<Float32Array | null> {
  const id = siguienteId++
  return new Promise((resolver) => {
    const t = setTimeout(() => { pendientes.delete(id); resolver(null) }, espera)
    pendientes.set(id, (v) => { clearTimeout(t); resolver(v?.[0] ?? null) })
    mandar({ tipo: 'embeber', id, textos: [texto] })
  })
}

/** Al abrir la app: retoma fuentes que quedaron a medio procesar y completa embeddings faltantes. */
export async function reanudarProcesamiento() {
  const lista = await fuentes.todas()
  for (const f of lista) if (f.estado === 'en_cola' || f.estado === 'procesando') encolarFuente(f.id)
  mandar({ tipo: 'completarEmbeddings' })
}

export function reasignarTemas() {
  mandar({ tipo: 'reasignarTemas' })
}
