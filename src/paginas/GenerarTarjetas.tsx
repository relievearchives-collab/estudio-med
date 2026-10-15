import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { EditorTarjeta, SelectorTemaTarjeta } from '../componentes/EditorTarjeta'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { describirAlcance, SelectorAlcance } from '../componentes/SelectorAlcance'
import { nombreDisciplina, unidadPorId } from '../contenido'
import type { TiposPedidos } from '../ia/prompts/tarjetas'
import { imagenesTarjeta, tarjetas as repoTarjetas } from '../repositorio'
import { useAjustes, useFuentes, useTemas } from '../repositorio/hooks'
import type { Alcance } from '../repositorio/tipos'
import { problemaBorrador, type BorradorTarjeta } from '../tarjetas/crear'
import { generarTarjetas, type OrigenGeneracion, type Propuesta } from '../tarjetas/generar'

function alcanceDeParams(p: URLSearchParams): Alcance {
  const tipo = p.get('alcance')
  const id = p.get('id') ?? undefined
  if (tipo === 'unidad') return { tipo, unidadId: id }
  if (tipo === 'disciplina') return { tipo, disciplinaId: id }
  if (tipo === 'tema') return { tipo, temaId: id }
  if (tipo === 'fuentes') return { tipo, fuenteIds: id?.split(',') }
  return { tipo: 'todo' }
}

/**
 * Generar tarjetas con IA (desde un alcance, una selección del visor o una respuesta del chat)
 * o crearlas a mano (básica/cloze u oclusión de imagen). Nada se guarda sin pasar por la vista previa.
 */
export default function GenerarTarjetas() {
  const [params] = useSearchParams()
  const origenParam = params.get('origen')
  if (origenParam === 'manual' || origenParam === 'oclusion') return <CrearManual oclusion={params.get('imagen') ?? undefined} />
  return <GenerarIA params={params} />
}

function GenerarIA({ params }: { params: URLSearchParams }) {
  const tipoOrigen = params.get('origen') ?? 'alcance'
  const [alcance, setAlcance] = useState<Alcance>(() => alcanceDeParams(params))
  const [cantidad, setCantidad] = useState(() => Number(params.get('n')) || (tipoOrigen === 'alcance' ? 20 : 5))
  const [tipos, setTipos] = useState<TiposPedidos>('ambas')
  const [estado, setEstado] = useState<'inicio' | 'generando' | 'listo'>('inicio')
  const [progreso, setProgreso] = useState('')
  const [error, setError] = useState('')
  const [propuestas, setPropuestas] = useState<Propuesta[]>([])
  const [aceptadas, setAceptadas] = useState<Set<string>>(new Set())
  const [editando, setEditando] = useState<string | null>(null)
  const ajustes = useAjustes()
  const temas = useTemas() ?? []
  const fuentes = useFuentes() ?? []
  const { abrirVisor, avisar } = useApp()
  const navegar = useNavigate()

  const origen: OrigenGeneracion = useMemo(() => {
    if (tipoOrigen === 'seleccion') return { tipo: 'seleccion', texto: params.get('texto') ?? '', fuenteId: params.get('fuente') ?? '', pagina: Number(params.get('p')) || 1 }
    if (tipoOrigen === 'chat') return { tipo: 'chat', chatId: params.get('chat') ?? '', mensajeId: params.get('m') ?? '' }
    return { tipo: 'alcance', alcance }
  }, [tipoOrigen, params, alcance])

  const generar = async () => {
    setEstado('generando'); setError('')
    try {
      const ps = await generarTarjetas(origen, cantidad, tipos, (h, t) => setProgreso(t > 1 ? `Lote ${Math.min(h + 1, t)} de ${t}` : ''))
      setPropuestas((prev) => [...prev, ...ps])
      setAceptadas((prev) => new Set([...prev, ...ps.map((p) => p.clave)]))
      if (!ps.length) setError('La IA no devolvió tarjetas válidas. Probá con otro alcance o de nuevo.')
    } catch (e) { setError((e as Error).message) }
    setEstado('listo'); setProgreso('')
  }

  // Desde el visor o el chat, el pedido ya está claro: se genera al entrar.
  const auto = useRef(false)
  useEffect(() => {
    if (!auto.current && (tipoOrigen === 'seleccion' || tipoOrigen === 'chat')) { auto.current = true; generar() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const guardar = async () => {
    const elegidas = propuestas.filter((p) => aceptadas.has(p.clave))
    const malas = elegidas.map(problemaBorrador).filter(Boolean)
    if (malas.length) return avisar(`Hay ${malas.length} tarjeta(s) incompletas: ${malas[0]}`, 'error')
    const creadas = await repoTarjetas.crear(elegidas.map(({ clave: _c, frase: _f, verificada: _v, ...b }) => b))
    avisar(`${creadas.length} tarjeta(s) guardadas. Ya están en tu cola de repaso.`, 'ok')
    navegar('/tarjetas')
  }

  const nombresTemas = new Map(temas.map((t) => [t.id, t.nombre]))
  const nombresFuentes = new Map(fuentes.map((f) => [f.id, f.nombre]))
  const sinClave = ajustes && ajustes.proveedorIA === 'gemini' && !ajustes.claveIA
  const descripcion = tipoOrigen === 'seleccion' ? `De tu selección (${nombresFuentes.get(params.get('fuente') ?? '') ?? 'fuente'}, pág. ${params.get('p')})`
    : tipoOrigen === 'chat' ? 'De una respuesta del chat'
      : describirAlcance(alcance, nombresTemas, nombresFuentes)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Generar tarjetas con IA" subtitulo={descripcion} />

      <section className="tarjeta space-y-3 p-4">
        {tipoOrigen === 'alcance' && (
          <div className="space-y-1">
            <p className="text-sm font-medium">¿De qué?</p>
            <SelectorAlcance valor={alcance} alCambiar={setAlcance} />
          </div>
        )}
        {tipoOrigen === 'seleccion' && <blockquote className="border-l-4 border-marca/50 pl-3 text-sm texto-suave">{params.get('texto')}</blockquote>}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Cantidad
            <input type="number" min={1} max={60} className="campo mt-1 !w-24" value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(60, Number(e.target.value) || 1)))} />
          </label>
          <div className="text-sm">
            <span className="mb-1 block">Tipo</span>
            <div className="flex gap-1">
              {([['ambas', 'Mixtas'], ['basica', 'Pregunta/respuesta'], ['cloze', 'Completar']] as const).map(([v, n]) => (
                <button key={v} className={tipos === v ? 'chip-activo' : 'chip'} onClick={() => setTipos(v)}>{n}</button>
              ))}
            </div>
          </div>
          <button className="btn-primario" disabled={estado === 'generando' || !!sinClave} onClick={generar}>
            <Icono nombre="estrella" />{estado === 'generando' ? 'Generando…' : propuestas.length ? 'Generar más' : 'Generar'}
          </button>
        </div>
        <p className="text-xs texto-suave">Usa el modelo liviano ({ajustes?.modeloLote}) en lotes de hasta 20 tarjetas: {Math.ceil(cantidad / 20)} llamada(s) a la IA. Cada tarjeta queda enlazada al fragmento de donde salió.</p>
        {sinClave && <p className="text-sm text-amber-600">Necesitás tu clave gratuita de Gemini: <Link className="underline" to="/ajustes">cargala en Ajustes</Link>. Mientras tanto podés <Link className="underline" to="/tarjetas/generar?origen=manual">crear tarjetas a mano</Link>.</p>}
        {estado === 'generando' && <p className="flex items-center gap-2 text-sm texto-suave"><span className="h-2 w-2 animate-bounce rounded-full bg-marca" />Leyendo tus fuentes y armando tarjetas… {progreso}</p>}
        {error && <p className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{error}</p>}
      </section>

      {propuestas.length > 0 && (
        <section className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="flex-1 text-sm font-semibold">Vista previa · {aceptadas.size} de {propuestas.length} aceptadas</h2>
            <button className="btn-fantasma !py-1 text-xs" onClick={() => setAceptadas(new Set(propuestas.map((p) => p.clave)))}>Aceptar todas</button>
            <button className="btn-fantasma !py-1 text-xs" onClick={() => setAceptadas(new Set())}>Ninguna</button>
          </div>
          {propuestas.map((p) => {
            const ok = aceptadas.has(p.clave)
            const alternar = () => setAceptadas((s) => { const n = new Set(s); if (n.has(p.clave)) n.delete(p.clave); else n.add(p.clave); return n })
            const cambiar = (b: BorradorTarjeta) => setPropuestas((ps) => ps.map((x) => (x.clave === p.clave ? { ...x, ...b } : x)))
            return (
              <article key={p.clave} className={`tarjeta p-3 transition ${ok ? '' : 'opacity-50'}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" className="mt-1 h-5 w-5 accent-[var(--color-marca)]" checked={ok} onChange={alternar} aria-label="Aceptar tarjeta" />
                  <div className="min-w-0 flex-1 space-y-1">
                    {editando === p.clave ? (
                      <>
                        <EditorTarjeta b={p} alCambiar={cambiar} compacto />
                        <SelectorTemaTarjeta b={p} alCambiar={cambiar} />
                      </>
                    ) : p.tipo === 'cloze' ? (
                      <p className="text-sm">{(p.cloze ?? '').split(/(\{\{c\d+::.*?\}\})/s).map((x, i) => {
                        const m = /\{\{c\d+::(.*?)(?:::.*?)?\}\}/s.exec(x)
                        return m ? <span key={i} className="rounded bg-marca/15 px-1 font-semibold text-marca dark:text-marca-claro">{m[1]}</span> : <span key={i}>{x}</span>
                      })}</p>
                    ) : (
                      <>
                        <p className="text-sm font-medium">{p.frente}</p>
                        <p className="text-sm texto-suave">{p.dorso}</p>
                      </>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs texto-suave">
                      <span className="chip !py-0">{p.tipo === 'cloze' ? 'Completar' : 'Pregunta'}</span>
                      {p.unidadId && <span>{unidadPorId(p.unidadId)?.sigla}{p.temaId ? ` · ${nombresTemas.get(p.temaId)}` : p.disciplinaId ? ` · ${nombreDisciplina(p.disciplinaId)}` : ''}</span>}
                      {p.fuenteId && (
                        <button className={`underline ${p.verificada ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`} title={p.frase}
                          onClick={() => abrirVisor({ fuenteId: p.fuenteId!, pagina: p.pagina ?? 1, objetivo: { frase: p.verificada ? p.frase : undefined } })}>
                          {p.verificada ? '✓ Respaldo verificado' : 'Respaldo sin verificar'} · {nombresFuentes.get(p.fuenteId)}, pág. {p.pagina}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button className="btn-fantasma !p-1.5" aria-label="Editar" onClick={() => setEditando(editando === p.clave ? null : p.clave)}><Icono nombre={editando === p.clave ? 'check' : 'lapiz'} className="h-4 w-4" /></button>
                    <button className="btn-fantasma !p-1.5" aria-label="Descartar" onClick={() => setPropuestas((ps) => ps.filter((x) => x.clave !== p.clave))}><Icono nombre="basura" className="h-4 w-4" /></button>
                  </div>
                </div>
              </article>
            )
          })}
          <div className="sticky bottom-0 flex gap-2 rounded-2xl p-2 shadow-lg" style={{ background: 'var(--tarjeta)' }}>
            <button className="btn-primario flex-1" disabled={!aceptadas.size} onClick={guardar}>Guardar {aceptadas.size} tarjeta(s)</button>
            <button className="btn-secundario" onClick={() => { setPropuestas([]); setAceptadas(new Set()) }}>Descartar todo</button>
          </div>
        </section>
      )}
    </div>
  )
}

/** Crear a mano: básica/cloze, u oclusión sobre una imagen (subida o capturada del visor). */
function CrearManual({ oclusion }: { oclusion?: string }) {
  const [params] = useSearchParams()
  const [b, setB] = useState<BorradorTarjeta>(() => {
    // Origen que llega por URL (página del visor capturada).
    const origen = { fuenteId: params.get('fuente') ?? undefined, pagina: Number(params.get('p')) || undefined }
    return oclusion ? { tipo: 'oclusion', frente: '', dorso: '', imagenId: oclusion, mascaras: [], ...origen } : { tipo: 'basica', frente: '', dorso: '' }
  })
  const { avisar } = useApp()
  const navegar = useNavigate()

  const subirImagen = async (f: File) => {
    const img = await imagenesTarjeta.guardar(f, f.name)
    setB({ ...b, tipo: 'oclusion', imagenId: img.id, mascaras: [] })
  }
  const guardar = async (seguir: boolean) => {
    const p = problemaBorrador(b)
    if (p) return avisar(p, 'error')
    const ts = await repoTarjetas.crear([{ ...b, origen: 'manual' }])
    avisar(`${ts.length} tarjeta(s) creadas`, 'ok')
    if (seguir && b.tipo !== 'oclusion') setB({ ...b, frente: '', dorso: '', cloze: '' })
    else navegar('/tarjetas')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo={b.tipo === 'oclusion' ? 'Oclusión de imagen' : 'Nueva tarjeta'} />
      <section className="tarjeta space-y-3 p-4">
        {b.tipo !== 'oclusion' || !b.imagenId ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="texto-suave">¿Oclusión de imagen?</span>
            <label className="btn-secundario cursor-pointer"><Icono nombre="imagen" />Elegir imagen
              <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) subirImagen(f) }} />
            </label>
            <span className="text-xs texto-suave">También podés capturar una página desde el visor (botón <Icono nombre="imagen" className="inline h-3.5 w-3.5" />).</span>
          </div>
        ) : null}
        <EditorTarjeta b={b} alCambiar={setB} />
        <div className="flex flex-wrap gap-2">
          <button className="btn-primario" onClick={() => guardar(false)}>Guardar</button>
          {b.tipo !== 'oclusion' && <button className="btn-secundario" onClick={() => guardar(true)}>Guardar y crear otra</button>}
        </div>
      </section>
    </div>
  )
}
