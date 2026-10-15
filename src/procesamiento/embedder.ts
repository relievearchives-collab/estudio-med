/**
 * Embeddings locales con transformers.js (se ejecuta DENTRO del Web Worker).
 * Modelo multilingüe chico (familia multilingual-e5-small, 384 dimensiones, cuantizado).
 * Se descarga una sola vez (~120 MB) y queda en la caché del navegador. Cero llamadas a la API de IA.
 */
import { env, pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'

import { MODELO_EMBEDDINGS } from './constantes'
export { MODELO_EMBEDDINGS }

env.allowLocalModels = false
env.useBrowserCache = true

let cargando: Promise<FeatureExtractionPipeline> | null = null

export function cargarEmbedder(alProgresar?: (p: number) => void) {
  if (!cargando) {
    const progress_callback = (e: { status?: string; progress?: number }) => {
      if (e.status === 'progress' && typeof e.progress === 'number') alProgresar?.(e.progress / 100)
    }
    // WASM + modelo cuantizado q8 (~120 MB). WebGPU necesitaría el modelo fp32 (~470 MB): demasiado para datos móviles.
    cargando = pipeline('feature-extraction', MODELO_EMBEDDINGS, { dtype: 'q8', progress_callback }) as Promise<FeatureExtractionPipeline>
    cargando.catch(() => { cargando = null })
  }
  return cargando
}

/** e5 necesita prefijos: "passage: " para documentos y "query: " para búsquedas. */
export async function embeber(textos: string[], tipo: 'passage' | 'query'): Promise<Float32Array[]> {
  const ex = await cargarEmbedder()
  const salida = await ex(textos.map((t) => `${tipo}: ${t}`), { pooling: 'mean', normalize: true })
  const datos = salida.data as Float32Array
  const dim = salida.dims[salida.dims.length - 1]
  return textos.map((_, i) => datos.slice(i * dim, (i + 1) * dim))
}
