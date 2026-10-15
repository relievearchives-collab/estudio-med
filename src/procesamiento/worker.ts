/// <reference lib="webworker" />
/**
 * Web Worker de procesamiento. Todo lo pesado ocurre acá para no congelar la interfaz:
 * texto por página (pdf.js) → OCR si hace falta (tesseract.js) → fragmentos →
 * embeddings locales → asignación sugerida de unidad/disciplina/tema.
 * Escribe directamente en IndexedDB a través de la capa repositorio.
 */
import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { paqueteActivo, rangoDePaginaGuia } from '../contenido'
import { normalizar } from '../busqueda/normalizar'
import { masParecido } from '../busqueda/vectores'
import { contenidoGuia, fragmentos as repoFragmentos, fuentes, nuevoId, paginas, temas as repoTemas } from '../repositorio'
import type { Fragmento, Pagina } from '../repositorio/tipos'
import { cargarEmbedder, embeber } from './embedder'
import { detectarEncabezados, fragmentarPagina } from './fragmentar'
import { extraerSeccionesGuia } from './seccionesGuia'
import { construirTextoPagina, type ItemTexto } from './textoPagina'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

export type MensajeAlWorker =
  | { tipo: 'procesar'; fuenteId: string }
  | { tipo: 'embeber'; id: number; textos: string[] }
  | { tipo: 'completarEmbeddings' }
  | { tipo: 'reasignarTemas' }

export type MensajeDelWorker =
  | { tipo: 'progreso'; fuenteId: string; progreso: number; etapa: string }
  | { tipo: 'listo'; fuenteId: string }
  | { tipo: 'error'; fuenteId?: string; mensaje: string }
  | { tipo: 'vectores'; id: number; vectores?: Float32Array[]; error?: string }
  | { tipo: 'modelo'; progreso: number; listo?: boolean; error?: string }

const ctx = self as unknown as DedicatedWorkerGlobalScope
const enviar = (m: MensajeDelWorker) => ctx.postMessage(m)

let cola: Promise<unknown> = Promise.resolve()
const enCola = <T>(fn: () => Promise<T>) => (cola = cola.then(fn, fn))

ctx.onmessage = (ev: MessageEvent<MensajeAlWorker>) => {
  const m = ev.data
  if (m.tipo === 'embeber') {
    // Las búsquedas no esperan a la cola de procesamiento.
    embeber(m.textos, 'query')
      .then((vectores) => enviar({ tipo: 'vectores', id: m.id, vectores }))
      .catch((e) => enviar({ tipo: 'vectores', id: m.id, error: String(e?.message ?? e) }))
  } else if (m.tipo === 'procesar') {
    enCola(() => procesar(m.fuenteId))
  } else if (m.tipo === 'completarEmbeddings') {
    enCola(completarEmbeddings)
  } else if (m.tipo === 'reasignarTemas') {
    enCola(() => asignarTemas())
  }
}

async function progreso(fuenteId: string, p: number, etapa: string) {
  enviar({ tipo: 'progreso', fuenteId, progreso: p, etapa })
  await fuentes.actualizar(fuenteId, { progreso: p, etapa, estado: 'procesando' })
}

// ───────────────────────── Extracción de texto ─────────────────────────

async function textosDePdf(fuenteId: string, archivo: Blob): Promise<Pagina[]> {
  const tarea = pdfjs.getDocument({ data: new Uint8Array(await archivo.arrayBuffer()) })
  const doc = await tarea.promise
  const resultado: Pagina[] = []
  const sinTexto: number[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n)
    const tc = await pagina.getTextContent()
    const { texto } = construirTextoPagina(tc.items as ItemTexto[])
    resultado.push({ fuenteId, numero: n, texto })
    if (texto.replace(/\s/g, '').length < 25) sinTexto.push(n)
    if (n % 5 === 0 || n === doc.numPages) await progreso(fuenteId, 0.3 * (n / doc.numPages), `Leyendo páginas (${n}/${doc.numPages})`)
  }
  // Páginas escaneadas (sin capa de texto) → OCR. Si la mayoría tiene texto, las pocas vacías suelen ser
  // páginas en blanco o separadores: solo se hace OCR cuando el PDF parece escaneado.
  if (sinTexto.length && sinTexto.length / doc.numPages > 0.3) {
    for (const [i, n] of sinTexto.entries()) {
      await progreso(fuenteId, 0.3 + 0.2 * (i / sinTexto.length), `Reconociendo texto (OCR) ${i + 1}/${sinTexto.length}`)
      try {
        const imagen = await renderizarPagina(await doc.getPage(n))
        resultado[n - 1] = { fuenteId, numero: n, texto: await ocr(imagen), ocr: true }
      } catch (e) {
        console.warn('OCR falló en la página', n, e)
      }
    }
  }
  await tarea.destroy()
  return resultado
}

async function renderizarPagina(pagina: pdfjs.PDFPageProxy): Promise<Blob> {
  const viewport = pagina.getViewport({ scale: 2 })
  const canvas = new OffscreenCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height))
  const c2d = canvas.getContext('2d')!
  await pagina.render({ canvas: null, canvasContext: c2d as unknown as CanvasRenderingContext2D, viewport }).promise
  return canvas.convertToBlob({ type: 'image/png' })
}

let ocrWorker: Promise<import('tesseract.js').Worker> | null = null
async function ocr(imagen: Blob): Promise<string> {
  if (!ocrWorker) {
    const { createWorker } = await import('tesseract.js')
    ocrWorker = createWorker('spa')
  }
  const w = await ocrWorker
  const r = await w.recognize(imagen)
  return r.data.text
}

// ───────────────────────── Procesamiento completo ─────────────────────────

async function procesar(fuenteId: string) {
  const fuente = await fuentes.obtener(fuenteId)
  if (!fuente) return
  try {
    await fuentes.actualizar(fuenteId, { error: undefined })
    await progreso(fuenteId, 0, 'Preparando')
    let lista: Pagina[]
    if (fuente.tipo === 'pdf' && fuente.archivo) {
      lista = await textosDePdf(fuenteId, fuente.archivo)
    } else if (fuente.tipo === 'imagen' && fuente.archivo) {
      await progreso(fuenteId, 0.1, 'Reconociendo texto (OCR)')
      lista = [{ fuenteId, numero: 1, texto: await ocr(fuente.archivo), ocr: true }]
    } else {
      lista = (await paginas.deFuente(fuenteId))
    }
    await paginas.guardar(lista)
    await fuentes.actualizar(fuenteId, { paginas: lista.length })

    // Fragmentos
    await progreso(fuenteId, 0.5, 'Cortando en fragmentos')
    const encabezados = detectarEncabezados(lista.map((p) => p.texto))
    const aliasADisciplina = new Map(paqueteActivo.disciplinas.flatMap((d) => d.alias.map((a) => [normalizar(a), d.id] as const)))
    const nuevos: Fragmento[] = []
    let titulo: string | undefined
    let disciplinaVigente: string | undefined
    let unidadPrevia: string | undefined
    for (const p of lista) {
      const rango = fuente.esGuia ? rangoDePaginaGuia(p.numero) : undefined
      if (rango?.unidadId !== unidadPrevia) { disciplinaVigente = undefined; unidadPrevia = rango?.unidadId }
      const r = fragmentarPagina(p.texto, { encabezados, tituloInicial: titulo })
      titulo = r.tituloFinal
      for (const f of r.fragmentos) {
        const porTitulo = f.titulo ? aliasADisciplina.get(normalizar(f.titulo)) : undefined
        if (porTitulo) disciplinaVigente = porTitulo
        nuevos.push({
          id: nuevoId('fr-'),
          fuenteId,
          pagina: p.numero,
          inicio: f.inicio,
          fin: f.fin,
          texto: f.texto,
          titulo: f.titulo,
          palabras: f.palabras,
          unidadId: rango?.unidadId,
          disciplinaId: rango?.disciplinaId ?? (rango?.tipo === 'unidad' ? disciplinaVigente : porTitulo),
        })
      }
    }
    await repoFragmentos.reemplazarDeFuente(fuenteId, nuevos)

    if (fuente.esGuia) {
      const porNumero = new Map(lista.map((p) => [p.numero, p.texto]))
      await contenidoGuia.guardar(extraerSeccionesGuia(paqueteActivo, (n) => porNumero.get(n), encabezados, fuenteId))
    }

    // Embeddings locales
    try {
      await embeberFragmentos(nuevos, (k) => progreso(fuenteId, 0.55 + 0.4 * k, `Calculando embeddings (${Math.round(k * 100)} %)`))
      await progreso(fuenteId, 0.96, 'Asignando temas')
      await asignarTemas(fuenteId)
    } catch (e) {
      console.warn('Embeddings no disponibles', e)
      await fuentes.actualizar(fuenteId, { error: 'Sin búsqueda por significado todavía (se necesita internet la primera vez para bajar el modelo). La búsqueda por texto funciona.' })
    }

    const unidadIds = [...new Set((await repoFragmentos.deFuente(fuenteId)).map((f) => f.unidadId).filter((x): x is string => !!x))].sort()
    await fuentes.actualizar(fuenteId, { estado: 'listo', progreso: 1, etapa: 'Listo', unidadIds })
    enviar({ tipo: 'listo', fuenteId })
  } catch (e) {
    const mensaje = (e as Error)?.message ?? String(e)
    await fuentes.actualizar(fuenteId, { estado: 'error', error: mensaje, etapa: 'Error' })
    enviar({ tipo: 'error', fuenteId, mensaje })
  }
}

async function embeberFragmentos(lista: Fragmento[], alAvanzar: (k: number) => Promise<void> | void) {
  await cargarEmbedder((p) => enviar({ tipo: 'modelo', progreso: p }))
  enviar({ tipo: 'modelo', progreso: 1, listo: true })
  const LOTE = 8
  for (let i = 0; i < lista.length; i += LOTE) {
    const lote = lista.slice(i, i + LOTE)
    const vectores = await embeber(lote.map((f) => (f.titulo ? `${f.titulo}. ` : '') + f.texto), 'passage')
    await repoFragmentos.guardarEmbeddings(lote.map((f, k) => ({ id: f.id, embedding: vectores[k] })))
    lote.forEach((f, k) => { f.embedding = vectores[k] })
    if (i % (LOTE * 4) === 0) await alAvanzar(Math.min(1, (i + LOTE) / lista.length))
  }
}

async function completarEmbeddings() {
  const faltan = (await repoFragmentos.todos()).filter((f) => !f.embedding)
  if (!faltan.length) return
  try {
    await embeberFragmentos(faltan, () => {})
    await asignarTemas()
  } catch (e) {
    enviar({ tipo: 'modelo', progreso: 0, error: String((e as Error)?.message ?? e) })
  }
}

/** Asigna a cada fragmento el tema más parecido (dentro de su unidad/disciplina si se conocen). */
async function asignarTemas(fuenteId?: string) {
  const lista = (fuenteId ? await repoFragmentos.deFuente(fuenteId) : await repoFragmentos.todos()).filter((f) => f.embedding)
  if (!lista.length) return
  const ts = await repoTemas.todos()
  const vt = await embeber(
    ts.map((t) => {
      const u = paqueteActivo.unidades.find((x) => x.id === t.unidadId)
      const d = paqueteActivo.disciplinas.find((x) => x.id === t.disciplinaId)
      return `${t.nombre} (${d?.nombre ?? ''}; ${u?.titulo ?? ''})`
    }),
    'query',
  )
  const candidatos = ts.map((t, i) => ({ item: t, vector: vt[i] }))
  const cambios: { id: string; unidadId?: string; disciplinaId?: string; temaId?: string }[] = []
  for (const f of lista) {
    let pool = candidatos
    if (f.unidadId) pool = pool.filter((c) => c.item.unidadId === f.unidadId)
    if (f.disciplinaId) {
      const conDisc = pool.filter((c) => c.item.disciplinaId === f.disciplinaId)
      if (conDisc.length) pool = conDisc
    }
    if (!pool.length) pool = candidatos
    const m = masParecido(f.embedding!, pool)
    if (!m) continue
    cambios.push({ id: f.id, temaId: m.item.id, unidadId: f.unidadId ?? m.item.unidadId, disciplinaId: f.disciplinaId ?? m.item.disciplinaId })
  }
  await repoFragmentos.actualizarVarios(cambios)
}
