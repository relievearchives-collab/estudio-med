import * as pdfjs from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { useLiveQuery } from 'dexie-react-hooks'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { buscarFrase } from '../busqueda/normalizar'
import { construirTextoPagina, type ItemTexto, type TextoPagina } from '../procesamiento/textoPagina'
import { fuentes, paginas, resaltados as repoResaltados } from '../repositorio'
import type { Fuente, Resaltado } from '../repositorio/tipos'
import { Icono } from './Icono'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

const documentos = new Map<string, Promise<pdfjs.PDFDocumentProxy>>()
function abrirPdf(f: Fuente) {
  if (!documentos.has(f.id)) {
    documentos.set(f.id, f.archivo!.arrayBuffer().then((b) => pdfjs.getDocument({ data: new Uint8Array(b) }).promise))
  }
  return documentos.get(f.id)!
}

export interface ObjetivoVisor {
  /** Frase a resaltar en amarillo (la cita). */
  frase?: string
  /** Rango alternativo (posición del fragmento) si la frase no aparece. */
  inicio?: number
  fin?: number
}

export interface AccionesSeleccion {
  alPreguntar?: (texto: string, ubicacion: { fuenteId: string; pagina: number }) => void
  alCrearNota?: (texto: string, ubicacion: { fuenteId: string; pagina: number }) => void
  alCrearTarjeta?: (texto: string, ubicacion: { fuenteId: string; pagina: number }) => void
  /** Imagen de la página (o la foto) para armar una tarjeta de oclusión. */
  alOclusion?: (imagen: Blob, ubicacion: { fuenteId: string; pagina: number }) => void
}

const COLORES: Record<Resaltado['color'], string> = {
  amarillo: 'rgba(250,204,21,.45)',
  verde: 'rgba(74,222,128,.45)',
  rosa: 'rgba(244,114,182,.45)',
  celeste: 'rgba(56,189,248,.45)',
}

/** Visor de una fuente (PDF, imagen o texto) en una página, con resaltados y selección. */
export function VisorFuente({ fuenteId, pagina: paginaInicial, objetivo, acciones }: {
  fuenteId: string
  pagina: number
  objetivo?: ObjetivoVisor
  acciones?: AccionesSeleccion
}) {
  const fuente = useLiveQuery(() => fuentes.obtener(fuenteId), [fuenteId])
  const [pagina, setPagina] = useState(paginaInicial)
  const [zoom, setZoom] = useState(1)
  useEffect(() => setPagina(paginaInicial), [paginaInicial, fuenteId])
  const objetivoActivo = pagina === paginaInicial ? objetivo : undefined
  const resaltadosPagina = useLiveQuery(() => repoResaltados.dePagina(fuenteId, pagina), [fuenteId, pagina]) ?? []
  const area = useRef<HTMLDivElement>(null)

  if (fuente === undefined) return <div className="p-6 text-sm texto-suave">Cargando…</div>
  if (!fuente) return <div className="p-6 text-sm">La fuente ya no existe.</div>
  const total = Math.max(1, fuente.paginas)

  return (
    <div className="flex h-full flex-col">
      <div className="sticky top-0 z-10 flex items-center gap-1 border-b px-2 py-1.5 borde" style={{ background: 'var(--tarjeta)' }}>
        <button className="btn-fantasma !px-2" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)} aria-label="Página anterior"><Icono nombre="izq" /></button>
        <label className="flex items-center gap-1 text-sm">
          Pág.
          <input
            className="campo !w-16 !py-1 text-center" type="number" min={1} max={total} value={pagina}
            onChange={(e) => { const n = Number(e.target.value); if (n >= 1 && n <= total) setPagina(n) }}
          />
          <span className="texto-suave">/ {total}</span>
        </label>
        <button className="btn-fantasma !px-2" disabled={pagina >= total} onClick={() => setPagina((p) => p + 1)} aria-label="Página siguiente"><Icono nombre="der" /></button>
        <div className="flex-1" />
        {acciones?.alOclusion && fuente.archivo && (
          <button className="btn-fantasma !px-2" title="Tarjeta de oclusión con esta página" aria-label="Oclusión de imagen" onClick={() => {
            if (fuente.tipo === 'imagen') return acciones.alOclusion!(fuente.archivo!, { fuenteId, pagina })
            area.current?.querySelector('canvas')?.toBlob((b) => b && acciones.alOclusion!(b, { fuenteId, pagina }), 'image/png')
          }}><Icono nombre="imagen" /></button>
        )}
        {fuente.tipo === 'pdf' && (
          <>
            <button className="btn-fantasma !px-2" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} aria-label="Alejar"><Icono nombre="zoomMenos" /></button>
            <button className="btn-fantasma !px-2" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} aria-label="Acercar"><Icono nombre="zoomMas" /></button>
          </>
        )}
      </div>
      <div ref={area} className="min-h-0 flex-1 overflow-auto p-2">
        {fuente.tipo === 'pdf' && fuente.archivo
          ? <PaginaPdf fuente={fuente} pagina={pagina} zoom={zoom} objetivo={objetivoActivo} resaltados={resaltadosPagina} acciones={acciones} />
          : <PaginaTexto fuente={fuente} pagina={pagina} objetivo={objetivoActivo} resaltados={resaltadosPagina} acciones={acciones} />}
        <ListaResaltados lista={resaltadosPagina} />
      </div>
    </div>
  )
}

function rangoObjetivo(texto: string, objetivo?: ObjetivoVisor) {
  if (!objetivo) return null
  if (objetivo.frase) {
    const r = buscarFrase(texto, objetivo.frase)
    if (r) return r
    // Si la frase tiene "…", resaltar el primer tramo
    const tramo = objetivo.frase.split(/\.{3}|…/)[0]
    if (tramo && tramo.length > 15) {
      const r2 = buscarFrase(texto, tramo)
      if (r2) return r2
    }
  }
  if (objetivo.inicio !== undefined && objetivo.fin !== undefined) return { inicio: objetivo.inicio, fin: objetivo.fin }
  return null
}

// ───────────────────────── PDF ─────────────────────────

function PaginaPdf({ fuente, pagina, zoom, objetivo, resaltados, acciones }: {
  fuente: Fuente; pagina: number; zoom: number; objetivo?: ObjetivoVisor; resaltados: Resaltado[]; acciones?: AccionesSeleccion
}) {
  const contenedor = useRef<HTMLDivElement>(null)
  const lienzo = useRef<HTMLCanvasElement>(null)
  const capaTexto = useRef<HTMLDivElement>(null)
  const [ancho, setAncho] = useState(0)
  const [estado, setEstado] = useState<{ texto: TextoPagina; divs: (HTMLElement | undefined)[]; tam: { w: number; h: number } } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const el = contenedor.current?.parentElement
    if (!el) return
    const ro = new ResizeObserver(() => setAncho(el.clientWidth - 16))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!ancho) return
    let cancelado = false
    let tarea: pdfjs.RenderTask | null = null
    let capa: pdfjs.TextLayer | null = null
    ;(async () => {
      try {
        const doc = await abrirPdf(fuente)
        const p = await doc.getPage(pagina)
        const base = p.getViewport({ scale: 1 })
        const escala = (Math.min(ancho, 1100) / base.width) * zoom
        const vp = p.getViewport({ scale: escala })
        const dpr = Math.min(window.devicePixelRatio || 1, 2)
        const c = lienzo.current!
        c.width = Math.floor(vp.width * dpr)
        c.height = Math.floor(vp.height * dpr)
        c.style.width = `${vp.width}px`
        c.style.height = `${vp.height}px`
        tarea = p.render({ canvas: c, viewport: vp, transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined })
        await tarea.promise
        if (cancelado) return
        const tc = await p.getTextContent()
        const cont = capaTexto.current!
        cont.replaceChildren()
        cont.style.setProperty('--total-scale-factor', String(escala))
        cont.style.setProperty('--scale-factor', String(escala))
        capa = new pdfjs.TextLayer({ textContentSource: tc, container: cont, viewport: vp })
        await capa.render()
        if (cancelado) return
        const items = tc.items as ItemTexto[]
        const texto = construirTextoPagina(items)
        // Alinear cada ítem con su <span> de la capa de texto
        const strs = capa.textContentItemsStr
        const divs: (HTMLElement | undefined)[] = []
        let j = 0
        for (const tr of texto.tramos) {
          const s = items[tr.item].str
          let k = j
          while (k < strs.length && strs[k] !== s) k++
          if (k < strs.length) { divs[tr.item] = capa.textDivs[k]; j = k + 1 }
        }
        setEstado({ texto, divs, tam: { w: vp.width, h: vp.height } })
        setError('')
      } catch (e) {
        if ((e as Error)?.name !== 'RenderingCancelledException') setError((e as Error).message)
      }
    })()
    return () => { cancelado = true; tarea?.cancel(); capa?.cancel() }
  }, [fuente, pagina, ancho, zoom])

  const rects = useCallback((inicio: number, fin: number) => {
    if (!estado || !contenedor.current) return []
    const base = contenedor.current.getBoundingClientRect()
    const salida: { x: number; y: number; w: number; h: number }[] = []
    for (const tr of estado.texto.tramos) {
      if (tr.fin <= inicio || tr.inicio >= fin) continue
      const div = estado.divs[tr.item]
      const nodo = div?.firstChild
      if (!div || !nodo || nodo.nodeType !== Node.TEXT_NODE) continue
      const largo = (nodo.textContent ?? '').length
      const r = document.createRange()
      r.setStart(nodo, Math.max(0, Math.min(largo, inicio - tr.inicio)))
      r.setEnd(nodo, Math.max(0, Math.min(largo, fin - tr.inicio)))
      for (const cr of r.getClientRects()) {
        if (cr.width < 1) continue
        salida.push({ x: cr.left - base.left, y: cr.top - base.top, w: cr.width, h: cr.height })
      }
    }
    return salida
  }, [estado])

  const rangoObj = useMemo(() => (estado ? rangoObjetivo(estado.texto.texto, objetivo) : null), [estado, objetivo])
  const [cajas, setCajas] = useState<{ obj: ReturnType<typeof rects>; res: { r: Resaltado; c: ReturnType<typeof rects> }[] }>({ obj: [], res: [] })
  useEffect(() => {
    // Se calcula después de pintar, cuando la capa de texto ya tiene su tamaño final.
    const calcular = () => setCajas({
      obj: rangoObj ? rects(rangoObj.inicio, rangoObj.fin) : [],
      res: resaltados.map((r) => ({ r, c: rects(r.inicio, r.fin) })),
    })
    const id = requestAnimationFrame(calcular)
    // Segunda pasada: la capa de texto ajusta el ancho de cada renglón después de cargar las fuentes.
    const t = setTimeout(calcular, 350)
    return () => { cancelAnimationFrame(id); clearTimeout(t) }
  }, [rects, rangoObj, resaltados])

  useEffect(() => {
    const primera = cajas.obj[0]
    if (primera && contenedor.current) {
      const scroller = contenedor.current.parentElement
      scroller?.scrollTo({ top: Math.max(0, primera.y - 120), left: Math.max(0, primera.x - 40), behavior: 'smooth' })
    }
  }, [cajas.obj])

  const seleccion = useSeleccion(capaTexto, estado?.texto, estado?.divs)

  return (
    <div className="flex flex-col items-center">
      {error && <p className="p-4 text-sm text-red-600">No se pudo mostrar la página: {error}</p>}
      {objetivo?.frase && estado && !rangoObj && (
        <p className="mb-2 rounded-lg bg-amber-500/15 px-3 py-2 text-xs">No encontré la frase exacta en esta página; revisá la cita.</p>
      )}
      <div ref={contenedor} className="relative bg-white shadow" style={estado ? { width: estado.tam.w, height: estado.tam.h } : undefined}>
        <canvas ref={lienzo} className="block" />
        <div className="resaltado-capa">
          {cajas.res.flatMap(({ r, c }) => c.map((b, i) => (
            <div key={r.id + i} title={r.comentario} style={{ left: b.x, top: b.y, width: b.w, height: b.h, background: COLORES[r.color] }} />
          )))}
          {cajas.obj.map((b, i) => <div key={'o' + i} className="resaltado-objetivo" style={{ left: b.x - 1, top: b.y - 1, width: b.w + 2, height: b.h + 2 }} />)}
        </div>
        <div ref={capaTexto} className="textLayer" />
        {seleccion.datos && (
          <BarraSeleccion
            pos={seleccion.datos.pos}
            alCerrar={seleccion.limpiar}
            alResaltar={async (color) => {
              const d = seleccion.datos!
              await repoResaltados.crear({ fuenteId: fuente.id, pagina, inicio: d.inicio, fin: d.fin, texto: d.texto, color })
              seleccion.limpiar()
            }}
            alPreguntar={acciones?.alPreguntar ? () => { acciones.alPreguntar!(seleccion.datos!.texto, { fuenteId: fuente.id, pagina }); seleccion.limpiar() } : undefined}
            alCrearNota={acciones?.alCrearNota ? () => { acciones.alCrearNota!(seleccion.datos!.texto, { fuenteId: fuente.id, pagina }); seleccion.limpiar() } : undefined}
            alCrearTarjeta={acciones?.alCrearTarjeta ? () => { acciones.alCrearTarjeta!(seleccion.datos!.texto, { fuenteId: fuente.id, pagina }); seleccion.limpiar() } : undefined}
          />
        )}
      </div>
    </div>
  )
}

/** Detecta la selección dentro de la capa de texto y la traduce a posiciones en el texto de la página. */
function useSeleccion(capa: React.RefObject<HTMLDivElement | null>, texto?: TextoPagina, divs?: (HTMLElement | undefined)[]) {
  const [datos, setDatos] = useState<{ texto: string; inicio: number; fin: number; pos: { x: number; y: number } } | null>(null)
  useEffect(() => {
    const el = capa.current
    if (!el || !texto || !divs) return
    const indice = new Map<Node, number>()
    divs.forEach((d, item) => { if (d?.firstChild) indice.set(d.firstChild, item) })
    const tramoDe = new Map(texto.tramos.map((t) => [t.item, t]))
    const alSoltar = () => {
      setTimeout(() => {
        const s = window.getSelection()
        if (!s || s.isCollapsed || !s.rangeCount) return
        const r = s.getRangeAt(0)
        if (!el.contains(r.commonAncestorContainer)) return
        const pos = (nodo: Node, off: number) => {
          const item = indice.get(nodo)
          const t = item !== undefined ? tramoDe.get(item) : undefined
          return t ? t.inicio + off : undefined
        }
        const a = pos(r.startContainer, r.startOffset)
        const b = pos(r.endContainer, r.endOffset)
        if (a === undefined || b === undefined || b <= a) return
        const base = el.getBoundingClientRect()
        const ult = r.getBoundingClientRect()
        setDatos({ texto: texto.texto.slice(a, b).replace(/\s+/g, ' ').trim(), inicio: a, fin: b, pos: { x: ult.left - base.left, y: ult.bottom - base.top + 6 } })
      }, 10)
    }
    el.addEventListener('mouseup', alSoltar)
    el.addEventListener('touchend', alSoltar)
    return () => { el.removeEventListener('mouseup', alSoltar); el.removeEventListener('touchend', alSoltar) }
  }, [capa, texto, divs])
  return { datos, limpiar: () => { setDatos(null); window.getSelection()?.removeAllRanges() } }
}

function BarraSeleccion({ pos, alCerrar, alResaltar, alPreguntar, alCrearNota, alCrearTarjeta }: {
  pos: { x: number; y: number }
  alCerrar: () => void
  alResaltar: (c: Resaltado['color']) => void
  alPreguntar?: () => void
  alCrearNota?: () => void
  alCrearTarjeta?: () => void
}) {
  return (
    <div className="absolute z-20 flex flex-wrap items-center gap-1 rounded-xl border p-1 text-xs shadow-lg borde" style={{ left: Math.max(0, pos.x - 20), top: pos.y, background: 'var(--tarjeta)', color: 'var(--texto)' }}>
      {alPreguntar && <button className="btn-fantasma !px-2 !py-1" onClick={alPreguntar}><Icono nombre="chat" className="h-4 w-4" />Preguntar</button>}
      {alCrearTarjeta && <button className="btn-fantasma !px-2 !py-1" onClick={alCrearTarjeta}><Icono nombre="tarjetas" className="h-4 w-4" />Crear tarjeta</button>}
      {alCrearNota && <button className="btn-fantasma !px-2 !py-1" onClick={alCrearNota}><Icono nombre="nota" className="h-4 w-4" />Crear nota</button>}
      {(Object.keys(COLORES) as Resaltado['color'][]).map((c) => (
        <button key={c} className="h-6 w-6 rounded-full border borde" style={{ background: COLORES[c] }} onClick={() => alResaltar(c)} aria-label={`Resaltar en ${c}`} title={`Resaltar (${c})`} />
      ))}
      <button className="btn-fantasma !p-1" onClick={alCerrar} aria-label="Cerrar"><Icono nombre="cerrar" className="h-4 w-4" /></button>
    </div>
  )
}

function ListaResaltados({ lista }: { lista: Resaltado[] }) {
  if (!lista.length) return null
  return (
    <div className="mx-auto mt-3 max-w-3xl space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide texto-suave">Resaltados de esta página</h4>
      {lista.map((r) => (
        <div key={r.id} className="tarjeta flex gap-2 p-2 text-sm">
          <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: COLORES[r.color] }} />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-3">{r.texto}</p>
            <input
              className="campo mt-1 !py-1 text-xs" placeholder="Agregar comentario…" defaultValue={r.comentario ?? ''}
              onBlur={(e) => repoResaltados.actualizar(r.id, { comentario: e.target.value })}
            />
          </div>
          <button className="btn-fantasma !p-1" onClick={() => repoResaltados.borrar(r.id)} aria-label="Borrar resaltado"><Icono nombre="basura" className="h-4 w-4" /></button>
        </div>
      ))}
    </div>
  )
}

// ───────────────────────── Imagen / texto pegado ─────────────────────────

function PaginaTexto({ fuente, pagina, objetivo, resaltados, acciones }: {
  fuente: Fuente; pagina: number; objetivo?: ObjetivoVisor; resaltados: Resaltado[]; acciones?: AccionesSeleccion
}) {
  const p = useLiveQuery(() => paginas.obtener(fuente.id, pagina), [fuente.id, pagina])
  const url = useMemo(() => (fuente.tipo === 'imagen' && fuente.archivo ? URL.createObjectURL(fuente.archivo) : ''), [fuente])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  const texto = p?.texto ?? ''
  const rango = rangoObjetivo(texto, objetivo)
  const marcas = [
    ...(rango ? [{ ...rango, clase: 'bg-yellow-300/80 dark:bg-yellow-500/60 rounded' }] : []),
    ...resaltados.map((r) => ({ inicio: r.inicio, fin: r.fin, clase: '', color: COLORES[r.color] })),
  ].sort((a, b) => a.inicio - b.inicio)
  const partes: React.ReactNode[] = []
  let i = 0
  for (const [k, m] of marcas.entries()) {
    if (m.inicio < i) continue
    partes.push(texto.slice(i, m.inicio))
    partes.push(<mark key={k} id={k === 0 && rango ? 'objetivo' : undefined} className={m.clase} style={'color' in m ? { background: m.color } : undefined}>{texto.slice(m.inicio, m.fin)}</mark>)
    i = m.fin
  }
  partes.push(texto.slice(i))
  useEffect(() => { document.getElementById('objetivo')?.scrollIntoView({ block: 'center', behavior: 'smooth' }) }, [texto, rango?.inicio])

  const ref = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState('')
  return (
    <div className="mx-auto max-w-3xl">
      {url && <img src={url} alt={fuente.nombre} className="mb-3 max-h-[60vh] w-full rounded-xl object-contain" />}
      <div
        ref={ref} className="tarjeta whitespace-pre-wrap p-4 text-sm leading-relaxed"
        onMouseUp={() => setSel(window.getSelection()?.toString().trim() ?? '')}
        onTouchEnd={() => setTimeout(() => setSel(window.getSelection()?.toString().trim() ?? ''), 50)}
      >
        {p ? partes : <span className="texto-suave">Sin texto en esta página.</span>}
      </div>
      {sel && acciones && (
        <div className="mt-2 flex gap-2">
          {acciones.alPreguntar && <button className="btn-secundario" onClick={() => { acciones.alPreguntar!(sel, { fuenteId: fuente.id, pagina }); setSel('') }}>Preguntar</button>}
          {acciones.alCrearTarjeta && <button className="btn-secundario" onClick={() => { acciones.alCrearTarjeta!(sel, { fuenteId: fuente.id, pagina }); setSel('') }}>Crear tarjeta</button>}
          {acciones.alCrearNota && <button className="btn-secundario" onClick={() => { acciones.alCrearNota!(sel, { fuenteId: fuente.id, pagina }); setSel('') }}>Crear nota</button>}
        </div>
      )}
    </div>
  )
}
