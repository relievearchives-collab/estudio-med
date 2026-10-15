import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { Fuente } from '../repositorio/tipos'

/** pdf.js para el visor (se carga de forma diferida junto con él). */
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const documentos = new Map<string, Promise<pdfjs.PDFDocumentProxy>>()
export function abrirPdf(f: Fuente) {
  if (!documentos.has(f.id)) {
    documentos.set(f.id, f.archivo!.arrayBuffer().then((b) => pdfjs.getDocument({ data: new Uint8Array(b) }).promise))
  }
  return documentos.get(f.id)!
}

/**
 * Imagen de una página del PDF en buena resolución (para tarjetas de oclusión):
 * se renderiza aparte, a ~1800 px de ancho, sin depender del zoom ni del tamaño de pantalla.
 */
export async function imagenDePagina(f: Fuente, pagina: number, ancho = 1800): Promise<Blob> {
  const doc = await abrirPdf(f)
  const p = await doc.getPage(pagina)
  const vp = p.getViewport({ scale: ancho / p.getViewport({ scale: 1 }).width })
  const c = document.createElement('canvas')
  c.width = Math.floor(vp.width)
  c.height = Math.floor(vp.height)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, c.width, c.height)
  await p.render({ canvas: c, viewport: vp }).promise
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo capturar la página.'))), 'image/jpeg', 0.88))
}
