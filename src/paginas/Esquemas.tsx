import { useMemo, useRef, useState, type PointerEvent as EventoPuntero } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CitaSup } from '../componentes/Citas'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { SelectorAlcance } from '../componentes/SelectorAlcance'
import { generarEsquema } from '../esquemas/generar'
import { bordeCaja, disponerMapa, mapaAMarkdown, tablaAMarkdown, type Referencia } from '../esquemas/layout'
import { esquemas as repoEsquemas, fragmentos as repoFragmentos, fuentes as repoFuentes, notas } from '../repositorio'
import { useEsquema, useEsquemas } from '../repositorio/hooks'
import type { Alcance, CeldaCitada, Esquema, MapaConceptual, NodoMapa, TablaComparativa } from '../repositorio/tipos'

function AvisoError({ texto }: { texto: string }) {
  return <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />{texto}</p>
}

const TABLA_VACIA: TablaComparativa = { columnas: ['A', 'B'], filas: [{ aspecto: 'Aspecto', celdas: [{ texto: '' }, { texto: '' }] }] }
const MAPA_VACIO: MapaConceptual = { nodos: [{ id: 'n1', texto: 'Concepto central' }], relaciones: [] }

// ───────────────────────── Índice ─────────────────────────

export function EsquemasIndice() {
  const [params] = useSearchParams()
  const [tipo, setTipo] = useState<'tabla' | 'mapa'>(params.get('tipo') === 'tabla' ? 'tabla' : 'mapa')
  const [consigna, setConsigna] = useState(params.get('q') ?? '')
  const [alcance, setAlcance] = useState<Alcance>(() => {
    const id = params.get('id')
    if (params.get('alcance') === 'unidad' && id) return { tipo: 'unidad', unidadId: id }
    if (params.get('alcance') === 'tema' && id) return { tipo: 'tema', temaId: id }
    return { tipo: 'todo' }
  })
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const lista = useEsquemas() ?? []
  const navegar = useNavigate()

  const generar = async () => {
    setGenerando(true); setError('')
    try { navegar(`/esquema/${(await generarEsquema(tipo, consigna, alcance)).id}`) } catch (e) { setError((e as Error).message) } finally { setGenerando(false) }
  }
  const enBlanco = async () => {
    const nuevo = await repoEsquemas.crear({ tipo, titulo: consigna.trim() || (tipo === 'tabla' ? 'Tabla comparativa' : 'Mapa conceptual'), consigna: consigna.trim(), alcance, ...(tipo === 'tabla' ? { tabla: TABLA_VACIA } : { mapa: MAPA_VACIO }) })
    navegar(`/esquema/${nuevo.id}`)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Tablas y mapas" subtitulo="Generados con tus fuentes, cada dato con su cita, y editables" />
      <section className="tarjeta space-y-3 p-4">
        <div className="flex gap-2">
          <button className={tipo === 'mapa' ? 'btn-primario' : 'btn-secundario'} onClick={() => setTipo('mapa')}>Mapa conceptual</button>
          <button className={tipo === 'tabla' ? 'btn-primario' : 'btn-secundario'} onClick={() => setTipo('tabla')}>Tabla comparativa</button>
        </div>
        <input
          className="campo" value={consigna} onChange={(e) => setConsigna(e.target.value)}
          placeholder={tipo === 'tabla' ? 'Ej.: arteriola aferente vs. eferente' : 'Ej.: regulación de la filtración glomerular'}
          onKeyDown={(e) => { if (e.key === 'Enter' && consigna.trim() && !generando) generar() }}
        />
        <div className="space-y-1"><p className="text-xs font-semibold texto-suave">Buscar en</p><SelectorAlcance valor={alcance} alCambiar={setAlcance} /></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" disabled={generando || !consigna.trim()} onClick={generar}>{generando ? 'Armando con tus fuentes…' : 'Generar'}</button>
          <button className="btn-fantasma" onClick={enBlanco}>Empezar en blanco</button>
        </div>
      </section>
      {error && <AvisoError texto={error} />}
      {lista.length > 0 && (
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-sm font-semibold">Tus tablas y mapas</h2>
          <ul className="space-y-1.5 text-sm">
            {lista.map((e) => (
              <li key={e.id} className="flex items-center gap-2">
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{e.tipo === 'tabla' ? 'Tabla' : 'Mapa'}</span>
                <Link className="min-w-0 flex-1 truncate text-marca underline dark:text-marca-claro" to={`/esquema/${e.id}`}>{e.titulo}</Link>
                <span className="text-xs texto-suave">{new Date(e.actualizado).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ───────────────────────── Editor ─────────────────────────

/** "(Fuente, pág. N)" para las citas verificadas (para la nota y el Markdown). */
async function referencias(e: Esquema): Promise<Referencia> {
  const celdas: CeldaCitada[] = e.tabla ? e.tabla.filas.flatMap((f) => f.celdas) : (e.mapa?.nodos ?? [])
  const ids = [...new Set(celdas.filter((c) => c.cita?.verificada && c.cita.fragmentoId).map((c) => c.cita!.fragmentoId!))]
  const frags = await repoFragmentos.varios(ids)
  const nombres = new Map<string, string>()
  for (const f of frags) if (!nombres.has(f.fuenteId)) nombres.set(f.fuenteId, (await repoFuentes.obtener(f.fuenteId))?.nombre ?? 'Fuente')
  const porId = new Map(frags.map((f) => [f.id, `(${nombres.get(f.fuenteId)}, pág. ${f.pagina})`]))
  return (c) => (c.cita?.verificada && !c.editado && c.cita.fragmentoId ? porId.get(c.cita.fragmentoId) ?? '' : '')
}

export function EsquemaPagina() {
  const { id = '' } = useParams()
  const e = useEsquema(id)
  const navegar = useNavigate()
  const { avisar } = useApp()
  if (e === undefined) return <p className="p-4 texto-suave">Cargando…</p>
  if (e === null) return <p className="p-4">No encontré esa tabla o mapa. <Link className="text-marca underline" to="/esquemas">Volver</Link></p>

  const markdown = async () => {
    const ref = await referencias(e)
    return `## ${e.titulo}\n\n${e.tabla ? tablaAMarkdown(e.tabla, ref) : mapaAMarkdown(e.mapa!, ref)}`
  }
  const guardarNota = async () => {
    const n = await notas.crear({ titulo: e.titulo, markdown: await markdown(), temaIds: e.alcance.temaId ? [e.alcance.temaId] : [], origen: 'manual' })
    avisar('Guardado como nota', 'ok')
    navegar(`/notas/${n.id}`)
  }
  const copiar = async () => {
    try { await navigator.clipboard.writeText(await markdown()); avisar('Copiado en Markdown', 'ok') } catch { avisar('No se pudo copiar', 'error') }
  }
  const borrar = async () => {
    if (!confirm('¿Borrar esta tabla o mapa?')) return
    await repoEsquemas.borrar(e.id)
    navegar('/esquemas', { replace: true })
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Encabezado volver titulo={e.tipo === 'tabla' ? 'Tabla comparativa' : 'Mapa conceptual'} subtitulo={e.consigna || undefined}
        acciones={<button className="btn-fantasma" onClick={borrar} aria-label="Borrar"><Icono nombre="basura" /></button>} />
      <input key={e.titulo} className="campo text-lg font-semibold" defaultValue={e.titulo} aria-label="Título"
        onBlur={(ev) => ev.target.value.trim() && ev.target.value.trim() !== e.titulo && repoEsquemas.actualizar(e.id, { titulo: ev.target.value.trim() })} />
      {e.tabla && <EditorTabla e={e} tabla={e.tabla} />}
      {e.mapa && <EditorMapa e={e} mapa={e.mapa} />}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secundario" onClick={guardarNota}><Icono nombre="nota" /> Guardar como nota</button>
        <button className="btn-fantasma" onClick={copiar}>Copiar en Markdown</button>
      </div>
      <p className="text-xs texto-suave">Las citas respaldan el texto generado; si lo editás, queda marcado como "editado". Las citas grises no se pudieron verificar en tus fuentes.</p>
    </div>
  )
}

function Cita({ c }: { c: CeldaCitada }) {
  if (!c.cita) return null
  return <><CitaSup cita={c.cita} numero={c.cita.n} />{c.editado && <span className="ml-0.5 text-[10px] texto-suave">editado</span>}</>
}

/** Cambia el texto de una celda: si difiere del original, queda marcada como editada. */
const editarCelda = (c: CeldaCitada, texto: string): CeldaCitada => (texto === c.texto ? c : { ...c, texto, editado: !!c.cita || c.editado })

function EditorTabla({ e, tabla }: { e: Esquema; tabla: TablaComparativa }) {
  const guardar = (t: TablaComparativa) => repoEsquemas.actualizar(e.id, { tabla: t })
  const filaVacia = () => ({ aspecto: 'Nuevo aspecto', celdas: tabla.columnas.map(() => ({ texto: '' })) })
  // La clave cambia cuando cambia la estructura: los campos se vuelven a montar con los valores guardados.
  const k = `${tabla.columnas.length}x${tabla.filas.length}-${e.actualizado}`
  return (
    <div className="tarjeta overflow-x-auto p-2">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr>
            <th className="w-36 p-1" />
            {tabla.columnas.map((col, i) => (
              <th key={`${k}-c${i}`} className="p-1 align-top">
                <div className="flex items-center gap-1">
                  <input className="campo !py-1 font-semibold" defaultValue={col} aria-label={`Columna ${i + 1}`}
                    onBlur={(ev) => ev.target.value !== col && guardar({ ...tabla, columnas: tabla.columnas.map((x, j) => (j === i ? ev.target.value : x)) })} />
                  {tabla.columnas.length > 2 && (
                    <button className="texto-suave hover:text-red-600" aria-label={`Quitar columna ${col}`}
                      onClick={() => guardar({ columnas: tabla.columnas.filter((_, j) => j !== i), filas: tabla.filas.map((f) => ({ ...f, celdas: f.celdas.filter((_, j) => j !== i) })) })}>
                      <Icono nombre="cerrar" className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tabla.filas.map((f, fi) => (
            <tr key={`${k}-f${fi}`} className="border-t border-black/10 dark:border-white/10">
              <th className="p-1 align-top">
                <div className="flex items-start gap-1">
                  <textarea className="campo !py-1 min-h-[2.5rem] font-semibold" rows={2} defaultValue={f.aspecto} aria-label={`Aspecto ${fi + 1}`}
                    onBlur={(ev) => ev.target.value !== f.aspecto && guardar({ ...tabla, filas: tabla.filas.map((x, j) => (j === fi ? { ...x, aspecto: ev.target.value } : x)) })} />
                  <button className="mt-1 texto-suave hover:text-red-600" aria-label={`Quitar fila ${f.aspecto}`} onClick={() => guardar({ ...tabla, filas: tabla.filas.filter((_, j) => j !== fi) })}>
                    <Icono nombre="cerrar" className="h-4 w-4" />
                  </button>
                </div>
              </th>
              {f.celdas.map((c, ci) => (
                <td key={ci} className="p-1 align-top">
                  <textarea className="campo !py-1 min-h-[2.5rem]" rows={2} defaultValue={c.texto} aria-label={`${f.aspecto} · ${tabla.columnas[ci]}`}
                    onBlur={(ev) => ev.target.value !== c.texto && guardar({ ...tabla, filas: tabla.filas.map((x, j) => (j === fi ? { ...x, celdas: x.celdas.map((y, l) => (l === ci ? editarCelda(y, ev.target.value) : y)) } : x)) })} />
                  <div className="px-1"><Cita c={c} /></div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap gap-2 p-1 pt-2">
        <button className="btn-fantasma text-sm" onClick={() => guardar({ ...tabla, filas: [...tabla.filas, filaVacia()] })}><Icono nombre="mas2" className="h-4 w-4" /> Fila</button>
        {tabla.columnas.length < 6 && (
          <button className="btn-fantasma text-sm" onClick={() => guardar({ columnas: [...tabla.columnas, 'Nueva'], filas: tabla.filas.map((f) => ({ ...f, celdas: [...f.celdas, { texto: '' }] })) })}>
            <Icono nombre="mas2" className="h-4 w-4" /> Columna
          </button>
        )}
      </div>
    </div>
  )
}

function EditorMapa({ e, mapa }: { e: Esquema; mapa: MapaConceptual }) {
  const [elegido, setElegido] = useState<string | null>(null)
  const [arrastre, setArrastre] = useState<{ id: string; x: number; y: number; dx: number; dy: number; movio: boolean } | null>(null)
  const svg = useRef<SVGSVGElement>(null)
  const guardar = (m: MapaConceptual) => repoEsquemas.actualizar(e.id, { mapa: m })
  const disp = useMemo(() => disponerMapa(mapa), [mapa])
  const caja = (id: string) => {
    const c = disp.cajas.get(id)!
    return arrastre?.id === id ? { ...c, x: arrastre.x, y: arrastre.y } : c
  }
  const punto = (ev: EventoPuntero) => {
    const m = svg.current!.getScreenCTM()!.inverse()
    const p = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(m)
    return { x: p.x, y: p.y }
  }
  const soltar = () => {
    if (!arrastre) return
    if (arrastre.movio) guardar({ ...mapa, nodos: mapa.nodos.map((n) => (n.id === arrastre.id ? { ...n, x: Math.round(arrastre.x), y: Math.round(arrastre.y) } : n)) })
    else setElegido((x) => (x === arrastre.id ? null : arrastre.id))
    setArrastre(null)
  }
  const nodo = elegido ? mapa.nodos.find((n) => n.id === elegido) : undefined

  return (
    <>
      <div className="tarjeta overflow-auto p-0">
        <svg
          ref={svg} width={disp.ancho} height={disp.alto} viewBox={`0 0 ${disp.ancho} ${disp.alto}`} className="block select-none" role="img" aria-label={`Mapa conceptual: ${e.titulo}`}
          onPointerMove={(ev) => { if (arrastre) { const p = punto(ev); setArrastre({ ...arrastre, x: p.x - arrastre.dx, y: p.y - arrastre.dy, movio: arrastre.movio || Math.hypot(p.x - arrastre.dx - arrastre.x, p.y - arrastre.dy - arrastre.y) > 3 }) } }}
          onPointerUp={soltar} onPointerLeave={soltar}
        >
          <defs>
            <marker id="flecha" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" className="texto-suave" /></marker>
          </defs>
          {mapa.relaciones.map((r, i) => {
            const a = caja(r.desde), b = caja(r.hasta)
            const p1 = bordeCaja(a, b), p2 = bordeCaja(b, a)
            return (
              <g key={i} className="texto-suave">
                <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="currentColor" strokeWidth={1.5} markerEnd="url(#flecha)" />
                {r.etiqueta && (
                  <text x={(p1.x + p2.x) / 2} y={(p1.y + p2.y) / 2} textAnchor="middle" dominantBaseline="middle" fontSize={12} fill="currentColor" paintOrder="stroke" stroke="var(--tarjeta)" strokeWidth={4}>{r.etiqueta}</text>
                )}
              </g>
            )
          })}
          {mapa.nodos.map((n, i) => {
            const c = caja(n.id)
            const sel = elegido === n.id
            return (
              <g key={n.id} className="cursor-grab" style={{ touchAction: 'none' }} role="button" aria-label={n.texto}
                onPointerDown={(ev) => { ev.currentTarget.ownerSVGElement?.setPointerCapture?.(ev.pointerId); const p = punto(ev); setArrastre({ id: n.id, x: c.x, y: c.y, dx: p.x - c.x, dy: p.y - c.y, movio: false }) }}>
                <rect x={c.x - c.w / 2} y={c.y - c.h / 2} width={c.w} height={c.h} rx={12}
                  className={i === 0 ? 'fill-marca' : ''} fill={i === 0 ? undefined : 'var(--tarjeta)'} stroke={sel ? '#f59e0b' : 'currentColor'} strokeWidth={sel ? 3 : 1.2} strokeOpacity={sel ? 1 : 0.35} />
                {c.lineas.map((l, k) => (
                  <text key={k} x={c.x} y={c.y - ((c.lineas.length - 1) * 18) / 2 + k * 18} textAnchor="middle" dominantBaseline="middle" fontSize={13} fontWeight={i === 0 ? 700 : 500} fill={i === 0 ? '#fff' : 'currentColor'}>{l}</text>
                ))}
                {n.cita && <circle cx={c.x + c.w / 2 - 8} cy={c.y - c.h / 2 + 8} r={4} fill={n.cita.verificada && !n.editado ? '#22c55e' : '#9ca3af'}><title>{n.cita.verificada ? (n.editado ? 'Con cita (texto editado)' : 'Con cita verificada') : 'Cita no verificada'}</title></circle>}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="texto-suave">Tocá un concepto para editarlo; arrastralo para moverlo.</span>
        <button className="btn-fantasma text-sm" onClick={() => guardar({ ...mapa, nodos: mapa.nodos.map(({ x: _x, y: _y, ...n }) => n) })}>Reacomodar</button>
        <button className="btn-fantasma text-sm" onClick={() => {
          const id = nuevoIdNodo(mapa)
          guardar({ ...mapa, nodos: [...mapa.nodos, { id, texto: 'Nuevo concepto' }] }); setElegido(id)
        }}><Icono nombre="mas2" className="h-4 w-4" /> Concepto suelto</button>
      </div>
      {nodo && <PanelNodo key={`${nodo.id}-${e.actualizado}`} mapa={mapa} nodo={nodo} guardar={guardar} elegir={setElegido} />}
    </>
  )
}

function nuevoIdNodo(m: MapaConceptual) {
  let i = m.nodos.length + 1
  while (m.nodos.some((n) => n.id === `n${i}`)) i++
  return `n${i}`
}

function PanelNodo({ mapa, nodo, guardar, elegir }: { mapa: MapaConceptual; nodo: NodoMapa; guardar: (m: MapaConceptual) => void; elegir: (id: string | null) => void }) {
  const [destino, setDestino] = useState('')
  const [etiqueta, setEtiqueta] = useState('se relaciona con')
  const nombre = (id: string) => mapa.nodos.find((n) => n.id === id)?.texto ?? id
  const relaciones = mapa.relaciones.map((r, i) => ({ ...r, i })).filter((r) => r.desde === nodo.id || r.hasta === nodo.id)
  const otros = mapa.nodos.filter((n) => n.id !== nodo.id && !mapa.relaciones.some((r) => r.desde === nodo.id && r.hasta === n.id))
  const agregarHijo = () => {
    const id = nuevoIdNodo(mapa)
    guardar({ nodos: [...mapa.nodos, { id, texto: 'Nuevo concepto' }], relaciones: [...mapa.relaciones, { desde: nodo.id, hasta: id, etiqueta }] })
    elegir(id)
  }
  return (
    <section className="tarjeta space-y-3 p-4">
      <div className="flex items-start gap-2">
        <textarea className="campo font-medium" rows={2} defaultValue={nodo.texto} aria-label="Texto del concepto"
          onBlur={(ev) => ev.target.value.trim() && guardar({ ...mapa, nodos: mapa.nodos.map((n) => (n.id === nodo.id ? { ...editarCelda(n, ev.target.value.trim()), id: n.id, x: n.x, y: n.y } : n)) })} />
        <button className="btn-fantasma !p-2" onClick={() => elegir(null)} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
      </div>
      {nodo.cita && <p className="text-sm">Respaldo: <Cita c={nodo} /> <span className="texto-suave">{nodo.cita.verificada ? '' : '(no verificada)'}</span></p>}
      {relaciones.length > 0 && (
        <ul className="space-y-1.5 text-sm">
          {relaciones.map((r) => (
            <li key={`${r.i}-${r.etiqueta}`} className="flex flex-wrap items-center gap-1">
              <span className="font-medium">{nombre(r.desde)}</span>
              <input className="campo !w-40 !py-0.5 text-xs" defaultValue={r.etiqueta} aria-label="Etiqueta de la relación"
                onBlur={(ev) => ev.target.value !== r.etiqueta && guardar({ ...mapa, relaciones: mapa.relaciones.map((x, j) => (j === r.i ? { ...x, etiqueta: ev.target.value } : x)) })} />
              <span className="font-medium">→ {nombre(r.hasta)}</span>
              <button className="texto-suave hover:text-red-600" aria-label="Quitar relación" onClick={() => guardar({ ...mapa, relaciones: mapa.relaciones.filter((_, j) => j !== r.i) })}><Icono nombre="cerrar" className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <input className="campo !w-44 !py-1" value={etiqueta} onChange={(ev) => setEtiqueta(ev.target.value)} aria-label="Etiqueta para la nueva relación" />
        <button className="btn-secundario !py-1" onClick={agregarHijo}><Icono nombre="mas2" className="h-4 w-4" /> Concepto nuevo</button>
        {otros.length > 0 && (
          <>
            <select className="campo !w-auto !py-1" value={destino} onChange={(ev) => setDestino(ev.target.value)} aria-label="Relacionar con">
              <option value="">Relacionar con…</option>
              {otros.map((n) => <option key={n.id} value={n.id}>{n.texto}</option>)}
            </select>
            <button className="btn-secundario !py-1" disabled={!destino} onClick={() => { guardar({ ...mapa, relaciones: [...mapa.relaciones, { desde: nodo.id, hasta: destino, etiqueta }] }); setDestino('') }}>Relacionar</button>
          </>
        )}
      </div>
      {mapa.nodos.length > 1 && (
        <button className="btn-fantasma text-sm text-red-600" onClick={() => { guardar({ nodos: mapa.nodos.filter((n) => n.id !== nodo.id), relaciones: mapa.relaciones.filter((r) => r.desde !== nodo.id && r.hasta !== nodo.id) }); elegir(null) }}>
          <Icono nombre="basura" className="h-4 w-4" /> Borrar concepto
        </button>
      )}
    </section>
  )
}
