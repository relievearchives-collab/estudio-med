import JSZip from 'jszip'
import { paqueteActivo } from '../contenido'
import { db, TABLAS_RESPALDO, type TablaRespaldo } from './db'
import type { Fragmento, Fuente, ImagenTarjeta } from './tipos'

/**
 * Respaldo completo en .zip:
 *   datos.json      → todas las tablas (sin archivos ni vectores)
 *   fuentes/<id>    → PDF o imagen original de cada fuente
 *   imagenes/<id>   → imágenes de las tarjetas de oclusión
 *   embeddings.bin  → vectores Float32 concatenados (índice en datos.json)
 * Importar restaura exactamente lo mismo, incluido el estado FSRS de las tarjetas y su historial.
 */
export const FORMATO_RESPALDO = 'estudio-med-respaldo'
export const VERSION_RESPALDO = 1

interface DatosRespaldo {
  formato: string
  version: number
  fecha: number
  paquete: string
  tablas: Partial<Record<TablaRespaldo, unknown[]>>
  /** fragmentoId → [desplazamiento en floats, dimensión] */
  embeddings: Record<string, [number, number]>
}

export async function exportarRespaldo(): Promise<Blob> {
  const zip = new JSZip()
  const datos: DatosRespaldo = {
    formato: FORMATO_RESPALDO, version: VERSION_RESPALDO, fecha: Date.now(), paquete: paqueteActivo.id, tablas: {}, embeddings: {},
  }
  const vectores: Float32Array[] = []
  let desplazamiento = 0

  for (const nombre of TABLAS_RESPALDO) {
    const filas = await db.table(nombre).toArray()
    if (nombre === 'fuentes') {
      datos.tablas.fuentes = await Promise.all(
        (filas as Fuente[]).map(async ({ archivo, ...resto }) => {
          if (archivo) zip.file(`fuentes/${resto.id}`, await archivo.arrayBuffer())
          return { ...resto, tieneArchivo: !!archivo }
        }),
      )
    } else if (nombre === 'imagenesTarjeta') {
      datos.tablas.imagenesTarjeta = await Promise.all(
        (filas as ImagenTarjeta[]).map(async ({ archivo, ...resto }) => {
          zip.file(`imagenes/${resto.id}`, await archivo.arrayBuffer())
          return resto
        }),
      )
    } else if (nombre === 'fragmentos') {
      datos.tablas.fragmentos = (filas as Fragmento[]).map(({ embedding, ...resto }) => {
        if (embedding?.length) {
          datos.embeddings[resto.id] = [desplazamiento, embedding.length]
          vectores.push(embedding)
          desplazamiento += embedding.length
        }
        return resto
      })
    } else {
      datos.tablas[nombre] = filas
    }
  }

  const todo = new Float32Array(desplazamiento)
  let o = 0
  for (const v of vectores) { todo.set(v, o); o += v.length }
  zip.file('embeddings.bin', todo.buffer)
  zip.file('datos.json', JSON.stringify(datos))
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } })
}

export async function importarRespaldo(archivo: Blob | ArrayBuffer): Promise<{ fuentes: number; fragmentos: number; notas: number; tarjetas: number }> {
  const zip = await JSZip.loadAsync(archivo)
  const json = await zip.file('datos.json')?.async('string')
  if (!json) throw new Error('El archivo no es un respaldo de la app (falta datos.json).')
  const datos = JSON.parse(json) as DatosRespaldo
  if (datos.formato !== FORMATO_RESPALDO) throw new Error('El archivo no es un respaldo de la app.')
  if (datos.version > VERSION_RESPALDO) throw new Error('El respaldo es de una versión más nueva de la app. Actualizá la app primero.')

  const binario = await zip.file('embeddings.bin')?.async('arraybuffer')
  const todo = binario ? new Float32Array(binario) : new Float32Array(0)

  const fuentes = await Promise.all(
    ((datos.tablas.fuentes ?? []) as (Fuente & { tieneArchivo?: boolean })[]).map(async ({ tieneArchivo, ...f }) => {
      const z = tieneArchivo ? zip.file(`fuentes/${f.id}`) : null
      const archivo = z ? new Blob([await z.async('arraybuffer')], { type: f.mime ?? 'application/octet-stream' }) : undefined
      return { ...f, archivo } as Fuente
    }),
  )
  const imagenes = await Promise.all(
    ((datos.tablas.imagenesTarjeta ?? []) as Omit<ImagenTarjeta, 'archivo'>[]).map(async (i) => {
      const z = zip.file(`imagenes/${i.id}`)
      const archivo = new Blob([z ? await z.async('arraybuffer') : new ArrayBuffer(0)], { type: i.mime })
      return { ...i, archivo } as ImagenTarjeta
    }),
  )
  const fragmentos = ((datos.tablas.fragmentos ?? []) as Fragmento[]).map((f) => {
    const e = datos.embeddings[f.id]
    return e ? { ...f, embedding: todo.slice(e[0], e[0] + e[1]) } : f
  })

  await db.transaction('rw', TABLAS_RESPALDO.map((t) => db.table(t)), async () => {
    for (const nombre of TABLAS_RESPALDO) await db.table(nombre).clear()
    for (const nombre of TABLAS_RESPALDO) {
      const filas = nombre === 'fuentes' ? fuentes : nombre === 'fragmentos' ? fragmentos : nombre === 'imagenesTarjeta' ? imagenes : (datos.tablas[nombre] ?? [])
      if (filas.length) await db.table(nombre).bulkPut(filas)
    }
  })
  return { fuentes: fuentes.length, fragmentos: fragmentos.length, notas: (datos.tablas.notas ?? []).length, tarjetas: (datos.tablas.tarjetas ?? []).length }
}

export function nombreArchivoRespaldo(d = new Date()) {
  const z = (n: number) => String(n).padStart(2, '0')
  return `estudio-med-respaldo-${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}.zip`
}
