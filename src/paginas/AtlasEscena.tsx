import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { escenaPorId, escenasDelArea, esRespuestaCorrecta, fichaDePieza, nombrePieza, type EscenaAtlas, type VistaRapida } from '../atlas/datos'
import { FichaAtlas } from '../atlas/FichaAtlas'
import { NOMBRE_CAPA } from '../atlas/material'
import { elegirTanda, estadoTrasRespuesta, puntaje } from '../atlas/museo'
import { recorridoPorId } from '../atlas/recorridos'
import { VisorAtlas, type EjeCorte, type Estilo, type VisorAtlasRef } from '../atlas/VisorAtlas'
import { normalizar } from '../busqueda/normalizar'
import { useApp } from '../componentes/Contexto'
import { Hoja } from '../componentes/Hoja'
import { Icono } from '../componentes/Icono'
import { paqueteActivo, unidadPorId } from '../contenido'
import { atlas as repoAtlas, eventos, imagenesTarjeta, nuevoId, tarjetas } from '../repositorio'
import { useAjustes, useEstadosAtlas, useFichaEditada } from '../repositorio/hooks'

type Modo = 'explorar' | 'armar' | 'museo' | 'donde'
const MODOS: [Modo, string][] = [['explorar', 'Explorar'], ['armar', 'Armar'], ['museo', 'Modo Museo'], ['donde', '¿Dónde está?']]
const TANDA = 10

function useEsCelular() {
  const [cel, setCel] = useState(() => window.innerWidth < 1024)
  useEffect(() => { const f = () => setCel(window.innerWidth < 1024); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f) }, [])
  return cel
}

/** /atlas/:escena (con ?modo=museo|armar|donde) y /atlas/recorrido/:id (?paso=n). */
export default function AtlasEscena() {
  const { escena: idEscena, id: idRecorrido } = useParams()
  const [params, setParams] = useSearchParams()
  const recorrido = recorridoPorId(idRecorrido)
  const paso = recorrido ? Math.min(recorrido.pasos.length - 1, Math.max(0, Number(params.get('paso')) || 0)) : 0
  const pasoActual = recorrido?.pasos[paso]
  const escena = escenaPorId(pasoActual?.escena ?? idEscena)
  if (!escena) return <p className="p-4">Escena no encontrada. <Link className="underline" to="/atlas">Volver al atlas</Link></p>
  return <PantallaEscena key={(recorrido ? 'recorrido:' : '') + escena.id + (params.get('repaso') ? ':repaso' : '')} escena={escena} recorrido={recorrido ? { r: recorrido, paso, irA: (n: number) => setParams({ paso: String(n) }) } : undefined} modoInicial={(params.get('modo') as Modo) || 'explorar'} repaso={params.get('repaso') === '1'} />
}

function PantallaEscena({ escena, recorrido, modoInicial, repaso = false }: {
  escena: EscenaAtlas
  /** Repaso de lo vencido (FSRS): la tanda trae solo las estructuras que tocan hoy. */
  repaso?: boolean
  recorrido?: { r: NonNullable<ReturnType<typeof recorridoPorId>>; paso: number; irA: (n: number) => void }
  modoInicial: Modo
}) {
  const visor = useRef<VisorAtlasRef>(null)
  const navegar = useNavigate()
  const celular = useEsCelular()
  const { avisar } = useApp()
  const ajustes = useAjustes()
  const estados = useEstadosAtlas()
  const vinculo = paqueteActivo.atlas.find((a) => a.escena === escena.id)
  const unidad = unidadPorId(vinculo?.unidadId)
  const nombres = useMemo(() => Object.fromEntries(escena.piezas.map((p) => [p.id, nombrePieza(p)])), [escena])
  const capas = useMemo(() => [...new Set(escena.piezas.map((p) => p.capa))], [escena])

  const [modo, setModo] = useState<Modo>(recorrido ? 'explorar' : modoInicial)
  const [estilo, setEstilo] = useState<Estilo>('holograma')
  const [desarmar, setDesarmar] = useState(0)
  const [capasOcultas, setCapasOcultas] = useState(() => new Set(escena.capasApagadas ?? []))
  const [corte, setCorte] = useState<{ eje: EjeCorte; pos: number } | null>(null)
  const [rotulos, setRotulos] = useState<'todos' | 'ninguno' | 'seleccionado'>('seleccionado')
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [mover, setMover] = useState(false)
  const [herramientas, setHerramientas] = useState(!celular)
  const [calidadBaja, setCalidadBaja] = useState(false)

  // ── Recorrido guiado: resalta la pieza del paso y la centra
  const pasoRec = recorrido?.r.pasos[recorrido.paso]
  useEffect(() => {
    if (!pasoRec) return
    setSeleccion(pasoRec.pieza)
    const t = setTimeout(() => visor.current?.centrar(pasoRec.pieza), 700)
    return () => clearTimeout(t)
  }, [pasoRec])

  // ── Armar (rompecabezas)
  const piezasVisibles = escena.piezas.filter((p) => !capasOcultas.has(p.capa))
  const [armado, setArmado] = useState({ semilla: 1, colocadas: new Set<string>(), errores: 0, inicio: 0, fin: 0 })
  const record = useRecord(escena.id, armado.fin)
  const empezarArmado = () => setArmado({ semilla: Math.floor(Math.random() * 1e9) + 1, colocadas: new Set(), errores: 0, inicio: Date.now(), fin: 0 })
  const alSoltar = (id: string, encajo: boolean, cerca: boolean) => {
    setArmado((a) => {
      if (encajo) {
        const colocadas = new Set(a.colocadas).add(id)
        const listo = piezasVisibles.every((p) => colocadas.has(p.id))
        if (listo) {
          const fin = Date.now()
          eventos.registrar('rompecabezas', `${escena.id}:${a.errores}`, Math.round((fin - a.inicio) / 1000))
          return { ...a, colocadas, fin }
        }
        return { ...a, colocadas }
      }
      return cerca ? { ...a, errores: a.errores + 1 } : a
    })
    if (encajo) { setDestello({ [id]: '#34d399' }); setTimeout(() => setDestello({}), 600) }
  }
  const [destello, setDestello] = useState<Record<string, string>>({})

  // ── Museo y ¿Dónde está?
  const [tanda, setTanda] = useState<{ ids: string[]; i: number; resultados: { id: string; ok: boolean; respuesta?: string }[]; inicio: number; pista: boolean } | null>(null)
  const [respuesta, setRespuesta] = useState('')
  const [feedback, setFeedback] = useState<{ ok: boolean; id: string; tocada?: string } | null>(null)
  const empezarTanda = () => {
    const mapa = new Map((estados ?? []).map((e) => [e.id, e]))
    const ahora = Date.now()
    const vencidas = piezasVisibles.filter((p) => (mapa.get(p.id)?.vence ?? Infinity) <= ahora).map((p) => p.id)
    const ids = repaso && vencidas.length ? elegirTanda(vencidas, mapa, ahora, 20) : elegirTanda(piezasVisibles.map((p) => p.id), mapa, ahora, TANDA)
    setTanda({ ids, i: 0, resultados: [], inicio: Date.now(), pista: false })
    setRespuesta(''); setFeedback(null); setSeleccion(null)
  }
  useEffect(() => {
    if ((modo === 'museo' || modo === 'donde') && estados && !tanda) empezarTanda()
    if (modo === 'armar' && !armado.inicio) empezarArmado()
    if (modo !== 'explorar') { setDesarmar(0); setCorte(null); setMover(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modo, estados])
  // Cambiar las capas de la tanda (ej. "solo urinario") arma una tanda nueva.
  const capasTanda = [...capasOcultas].sort().join(',')
  const primeraVez = useRef(true)
  useEffect(() => {
    if (primeraVez.current) { primeraVez.current = false; return }
    if ((modo === 'museo' || modo === 'donde') && estados) empezarTanda()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capasTanda])
  // Al terminar un repaso: la próxima escena del área con estructuras vencidas.
  const siguienteRepaso = useMemo(() => {
    const ahora = Date.now()
    const vencidas = new Set((estados ?? []).filter((e) => e.vence <= ahora).map((e) => e.id))
    return escenasDelArea()
      .filter((a) => a.escena !== escena.id)
      .map((a) => ({ id: a.escena, titulo: a.datos.titulo, n: a.datos.piezas.filter((p) => vencidas.has(p.id)).length }))
      .find((a) => a.n > 0)
  }, [estados, escena.id])
  const objetivo = tanda && tanda.i < tanda.ids.length ? escena.piezas.find((p) => p.id === tanda.ids[tanda.i]) : undefined
  const responder = async (ok: boolean, extra: { respuesta?: string; tocada?: string } = {}) => {
    if (!tanda || !objetivo || feedback) return
    const previo = (estados ?? []).find((e) => e.id === objetivo.id)
    await repoAtlas.responder(objetivo.id, escena.id, ok, estadoTrasRespuesta(previo, ok, tanda.pista, Date.now(), ajustes?.retencion))
    setFeedback({ ok, id: objetivo.id, tocada: extra.tocada })
    setTimeout(() => {
      setFeedback(null); setRespuesta('')
      setTanda((t) => t && ({ ...t, i: t.i + 1, pista: false, resultados: [...t.resultados, { id: objetivo.id, ok, respuesta: extra.respuesta }] }))
    }, ok ? 900 : 1900)
  }

  // ── Selección (en "¿Dónde está?" tocar es responder)
  const alSeleccionar = (id: string | null) => {
    if (modo === 'donde') { if (id && objetivo && !feedback) responder(id === objetivo.id, { tocada: id }); return }
    if (modo === 'museo') return
    setSeleccion(id)
  }
  const piezaSel = escena.piezas.find((p) => p.id === seleccion)

  // ── Crear tarjeta de oclusión con la estructura resaltada
  const fichaSel = useFichaEditada(piezaSel?.ficha)
  const crearTarjeta = async () => {
    if (!piezaSel || !visor.current) return
    const { imagen, rect } = await visor.current.capturar(piezaSel.id)
    const img = await imagenesTarjeta.guardar(imagen, `Atlas: ${escena.titulo}`)
    const f = fichaDePieza(piezaSel, fichaSel?.cambios)
    const margen = 0.01
    await tarjetas.crear([{
      tipo: 'oclusion', frente: '¿Qué estructura es?', dorso: f.descripcion.split('. ')[0] + '.', imagenId: img.id,
      mascaras: [{ id: nuevoId('m-').slice(0, 12), x: Math.max(0, (rect?.x ?? 0.4) - margen), y: Math.max(0, (rect?.y ?? 0.4) - margen), w: Math.min(1, (rect?.w ?? 0.2) + margen * 2), h: Math.min(1, (rect?.h ?? 0.2) + margen * 2), etiqueta: f.titulo }],
      unidadId: vinculo?.unidadId, temaId: vinculo?.temaIds[0], disciplinaId: 'anatomia', etiquetas: ['atlas', escena.id], origen: 'manual',
    }])
    avisar('Tarjeta de oclusión creada: ya está en tu cola de repaso', 'ok')
  }

  const destacadas = useMemo(() => {
    const d: Record<string, string> = { ...destello }
    if (feedback) {
      d[feedback.id] = '#34d399'
      if (feedback.tocada && feedback.tocada !== feedback.id) d[feedback.tocada] = '#f87171'
      if (!feedback.ok && !feedback.tocada) d[feedback.id] = '#f87171'
    }
    return d
  }, [feedback, destello])

  const vistas: [VistaRapida, string][] = [['anterior', 'Ant.'], ['posterior', 'Post.'], ['lateral', 'Lat.'], ['superior', 'Sup.'], ['inferior', 'Inf.']]
  const fichaPanel = piezaSel && modo === 'explorar' && (
    <FichaAtlas
      pieza={piezaSel}
      alPreguntar={(n) => navegar(`/chat?alcance=unidad&id=${vinculo?.unidadId ?? ''}&q=${encodeURIComponent(`¿Qué dicen mis apuntes sobre ${n.toLowerCase()}? (relaciones, irrigación e inervación)`)}`)}
      alCrearTarjeta={crearTarjeta}
      alCentrar={() => visor.current?.centrar(piezaSel.id)}
      conTitulo={!celular}
    />
  )

  return (
    <div className="flex h-full flex-col">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 borde" style={{ background: 'var(--tarjeta)' }}>
        <button className="btn-fantasma !p-2" onClick={() => (recorrido ? navegar('/atlas') : navegar(-1))} aria-label="Volver"><Icono nombre="izq" /></button>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-bold leading-tight">{recorrido ? recorrido.r.titulo : escena.titulo}</h1>
          <p className="truncate text-xs texto-suave">
            {recorrido ? `Paso ${recorrido.paso + 1} de ${recorrido.r.pasos.length} · ${escena.titulo}` : `${unidad?.sigla ?? ''} · ${escena.piezas.length} estructuras`}
            {escena.tipo === 'esquema' && ' · Esquema – no a escala'}
            {calidadBaja && ' · calidad reducida'}
          </p>
        </div>
        {!recorrido && (
          <div className="flex gap-1 overflow-x-auto">
            {MODOS.map(([m, n]) => <button key={m} className={modo === m ? 'chip-activo' : 'chip'} onClick={() => { setModo(m); setTanda(null); setSeleccion(null) }}>{n}</button>)}
          </div>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          <VisorAtlas
            ref={visor}
            escena={escena}
            estilo={estilo}
            desarmar={desarmar}
            capasOcultas={capasOcultas}
            corte={corte}
            rotulos={modo === 'museo' || modo === 'donde' ? 'ninguno' : rotulos}
            nombres={nombres}
            seleccion={modo === 'explorar' ? seleccion : null}
            alSeleccionar={alSeleccionar}
            destacadas={destacadas}
            pin={modo === 'museo' && objetivo && !feedback ? objetivo.id : null}
            moverPiezas={modo === 'explorar' && mover}
            armar={modo === 'armar' && armado.inicio ? { semilla: armado.semilla, colocadas: armado.colocadas, alSoltar } : undefined}
            mostrarEstrechamientos={modo === 'explorar' && (!recorrido || !!pasoRec?.estrechamientos)}
            alCambiarCalidad={setCalidadBaja}
          />

          {/* Herramientas (modo explorar) */}
          {modo === 'explorar' && !recorrido && (
            <div className="absolute left-2 top-2 max-w-[calc(100%-1rem)] space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-secundario !px-2.5 !py-1.5 text-xs shadow" onClick={() => setHerramientas((v) => !v)}><Icono nombre="ajustes" className="h-4 w-4" />Herramientas</button>
                <BuscarEstructura nombres={nombres} ocultas={escena.piezas.filter((x) => capasOcultas.has(x.capa)).map((x) => x.id)} alElegir={(id) => {
                  const capa = escena.piezas.find((x) => x.id === id)?.capa
                  if (capa && capasOcultas.has(capa)) setCapasOcultas((c) => { const n = new Set(c); n.delete(capa); return n })
                  setSeleccion(id)
                  setTimeout(() => visor.current?.centrar(id), 150)
                }} />
              </div>
              {herramientas && (
                <div className="w-72 max-w-full space-y-3 rounded-2xl border p-3 text-xs shadow-lg borde" style={{ background: 'color-mix(in srgb, var(--tarjeta) 92%, transparent)' }}>
                  <div className="flex gap-1">
                    {(['holograma', 'realista'] as const).map((e) => <button key={e} className={estilo === e ? 'chip-activo' : 'chip'} onClick={() => setEstilo(e)}>{e === 'holograma' ? 'Holograma' : 'Realista'}</button>)}
                  </div>
                  <label className="block">
                    <span className="flex justify-between"><span>Desarmar</span><span className="texto-suave">{Math.round(desarmar * 100)} %</span></span>
                    <input type="range" min={0} max={1} step={0.01} value={desarmar} onChange={(e) => setDesarmar(Number(e.target.value))} className="w-full accent-cyan-500" />
                  </label>
                  {capas.length > 1 && (
                    <div>
                      <p className="mb-1 flex items-center gap-1"><Icono nombre="capas" className="h-3.5 w-3.5" />Capas</p>
                      <div className="flex flex-wrap gap-1">
                        {capas.map((c) => (
                          <button key={c} className={capasOcultas.has(c) ? 'chip opacity-50' : 'chip-activo'} onClick={() => setCapasOcultas((s) => { const n = new Set(s); if (n.has(c)) n.delete(c); else n.add(c); return n })}>{NOMBRE_CAPA[c] ?? c}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <p className="mb-1 flex items-center gap-1"><Icono nombre="tijera" className="h-3.5 w-3.5" />Plano de corte</p>
                    <div className="flex flex-wrap gap-1">
                      <button className={!corte ? 'chip-activo' : 'chip'} onClick={() => setCorte(null)}>Sin corte</button>
                      {(['coronal', 'sagital', 'transversal'] as const).map((e) => <button key={e} className={corte?.eje === e ? 'chip-activo' : 'chip'} onClick={() => setCorte({ eje: e, pos: corte?.pos ?? 0 })}>{e[0].toUpperCase() + e.slice(1)}</button>)}
                    </div>
                    {corte && <input type="range" min={-1} max={1} step={0.01} value={corte.pos} onChange={(e) => setCorte({ ...corte, pos: Number(e.target.value) })} className="mt-1 w-full accent-cyan-500" aria-label="Posición del corte" />}
                  </div>
                  <div>
                    <p className="mb-1">Rótulos</p>
                    <div className="flex gap-1">
                      {([['todos', 'Todos'], ['seleccionado', 'Solo el elegido'], ['ninguno', 'Ninguno']] as const).map(([v, n]) => <button key={v} className={rotulos === v ? 'chip-activo' : 'chip'} onClick={() => setRotulos(v)}>{n}</button>)}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1">Vistas</p>
                    <div className="flex flex-wrap gap-1">{vistas.map(([v, n]) => <button key={v} className="chip" onClick={() => visor.current?.vista(v)}>{n}</button>)}</div>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <button className={mover ? 'chip-activo' : 'chip'} onClick={() => setMover((v) => !v)}><Icono nombre="mano" className="h-3.5 w-3.5" />Mover piezas</button>
                    <button className="chip" onClick={() => { visor.current?.reacomodar(); setDesarmar(0) }}>Reacomodar</button>
                  </div>
                  <p className="texto-suave">Arrastrá para girar · pellizcá o rueda para zoom · dos dedos para desplazar · doble toque centra una estructura.</p>
                </div>
              )}
            </div>
          )}

          {/* Recorrido guiado */}
          {recorrido && pasoRec && (
            <div className="absolute inset-x-2 bottom-2 mx-auto max-w-xl rounded-2xl border p-3 text-sm shadow-lg borde" style={{ background: 'color-mix(in srgb, var(--tarjeta) 94%, transparent)' }}>
              <p className="mb-1 font-semibold">{nombres[pasoRec.pieza]}</p>
              <p className="leading-relaxed">{pasoRec.texto}</p>
              <div className="mt-2 flex items-center gap-2">
                <button className="btn-secundario !py-1.5" disabled={recorrido.paso === 0} onClick={() => recorrido.irA(recorrido.paso - 1)}><Icono nombre="izq" className="h-4 w-4" />Anterior</button>
                <div className="flex flex-1 justify-center gap-1">{recorrido.r.pasos.map((_, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i === recorrido.paso ? 'bg-cyan-500' : 'bg-slate-400/40'}`} />)}</div>
                {recorrido.paso < recorrido.r.pasos.length - 1
                  ? <button className="btn-primario !py-1.5" onClick={() => recorrido.irA(recorrido.paso + 1)}>Siguiente<Icono nombre="der" className="h-4 w-4" /></button>
                  : <Link className="btn-primario !py-1.5" to="/atlas">Terminar</Link>}
              </div>
            </div>
          )}

          {/* Armar */}
          {modo === 'armar' && (
            <div className="absolute inset-x-2 top-2 mx-auto flex max-w-xl flex-wrap items-center gap-3 rounded-2xl border px-3 py-2 text-sm shadow borde" style={{ background: 'color-mix(in srgb, var(--tarjeta) 94%, transparent)' }}>
              {armado.fin ? (
                <>
                  <span className="flex-1"><b>¡Armado!</b> {formatearTiempo(armado.fin - armado.inicio)} · {armado.errores} error(es){record ? ` · récord: ${formatearTiempo(record * 1000)}` : ''}</span>
                  <button className="btn-primario !py-1.5" onClick={empezarArmado}>Otra vez</button>
                </>
              ) : (
                <>
                  <Cronometro desde={armado.inicio} />
                  <span>{armado.colocadas.size}/{piezasVisibles.length} en su lugar</span>
                  <span className="texto-suave">{armado.errores} error(es)</span>
                  <span className="flex-1 text-right text-xs texto-suave">Arrastrá cada pieza a su lugar: encaja sola cuando está cerca.</span>
                  <button className="btn-fantasma !py-1 text-xs" onClick={empezarArmado}>Mezclar</button>
                </>
              )}
            </div>
          )}

          {/* Museo / ¿Dónde está? */}
          {(modo === 'museo' || modo === 'donde') && tanda && (
            <div className="absolute inset-x-2 bottom-2 mx-auto max-w-xl rounded-2xl border p-3 text-sm shadow-lg borde" style={{ background: 'color-mix(in srgb, var(--tarjeta) 95%, transparent)' }}>
              {capas.length > 1 && !repaso && (
                <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px]">
                  <span className="texto-suave">Preguntar sobre:</span>
                  {capas.map((c) => (
                    <button key={c} className={capasOcultas.has(c) ? 'chip !px-2 !py-0.5 opacity-50' : 'chip-activo !px-2 !py-0.5'} onClick={() => setCapasOcultas((x) => { const n = new Set(x); if (n.has(c)) n.delete(c); else if (capas.some((k) => k !== c && !n.has(k))) n.add(c); return n })}>{NOMBRE_CAPA[c] ?? c}</button>
                  ))}
                </div>
              )}
              {repaso && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-300">Repaso de lo que vence hoy</p>}
              {objetivo ? (
                <>
                  <div className="mb-2 flex items-center gap-2 text-xs texto-suave">
                    <span>{tanda.i + 1} / {tanda.ids.length}</span>
                    <span>· {tanda.resultados.filter((r) => r.ok).length} bien</span>
                    <span className="flex-1" />
                    <Cronometro desde={tanda.inicio} />
                  </div>
                  {feedback ? (
                    <p className={`font-semibold ${feedback.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                      {feedback.ok ? '✓ ¡Bien! ' : '✗ Era: '}{nombres[feedback.id]}
                    </p>
                  ) : modo === 'museo' ? (
                    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (respuesta.trim()) responder(esRespuestaCorrecta(respuesta, objetivo), { respuesta }) }}>
                      <input autoFocus className="campo" placeholder="¿Qué estructura señala el alfiler?" value={respuesta} onChange={(e) => setRespuesta(e.target.value)} />
                      <button className="btn-primario" disabled={!respuesta.trim()}>Responder</button>
                      <button type="button" className="btn-fantasma !px-2 text-xs" title="Pista: primera letra (cuenta como Difícil)" onClick={() => { setTanda({ ...tanda, pista: true }); setRespuesta(nombres[objetivo.id][0]) }}>Pista</button>
                      <button type="button" className="btn-fantasma !px-2 text-xs" onClick={() => responder(false)}>No sé</button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="flex-1">Tocá: <b>{nombres[objetivo.id]}</b></p>
                      <button className="btn-fantasma !px-2 text-xs" onClick={() => responder(false)}>No sé</button>
                    </div>
                  )}
                </>
              ) : (
                <ResultadoTanda tanda={tanda} nombres={nombres} siguiente={repaso ? siguienteRepaso : undefined} alSiguiente={(id) => navegar(`/atlas/${id}?modo=${modo}&repaso=1`)} alVer={(id) => { setModo('explorar'); setTanda(null); setSeleccion(id); setTimeout(() => visor.current?.centrar(id), 200) }} alOtra={empezarTanda} />
              )}
            </div>
          )}
        </div>

        {/* Ficha: panel lateral en compu, hoja desde abajo en celular */}
        {!celular && fichaPanel && <aside className="w-96 shrink-0 overflow-y-auto border-l borde" style={{ background: 'var(--tarjeta)' }}>{fichaPanel}</aside>}
      </div>
      {celular && <Hoja abierta={!!fichaPanel && !recorrido} alCerrar={() => setSeleccion(null)} titulo={piezaSel ? nombres[piezaSel.id] : ''} alto="h-[55vh]">{fichaPanel}</Hoja>}
    </div>
  )
}

function ResultadoTanda({ tanda, nombres, alVer, alOtra, siguiente, alSiguiente }: {
  siguiente?: { id: string; titulo: string; n: number }
  alSiguiente: (id: string) => void
  tanda: { ids: string[]; resultados: { id: string; ok: boolean; respuesta?: string }[]; inicio: number }
  nombres: Record<string, string>
  alVer: (id: string) => void
  alOtra: () => void
}) {
  const [fin] = useState(() => Date.now())
  const bien = tanda.resultados.filter((r) => r.ok).length
  const mal = tanda.resultados.filter((r) => !r.ok)
  return (
    <div className="space-y-2">
      <p><b className="text-lg">{puntaje(bien, tanda.resultados.length)} puntos</b> · {bien}/{tanda.resultados.length} bien · {formatearTiempo(fin - tanda.inicio)}</p>
      {mal.length > 0 ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide texto-suave">Para repasar (vuelven antes en tu cola)</p>
          <ul className="mt-1 max-h-32 space-y-1 overflow-y-auto">
            {mal.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <span className="flex-1">{nombres[r.id]}{r.respuesta ? <span className="texto-suave"> — dijiste "{r.respuesta}"</span> : null}</span>
                <button className="btn-fantasma !px-2 !py-0.5 text-xs" onClick={() => alVer(r.id)}>Ver</button>
              </li>
            ))}
          </ul>
        </div>
      ) : <p className="text-sm text-emerald-600">¡Sin errores!</p>}
      <div className="flex gap-2">
        {siguiente
          ? <button className="btn-primario" onClick={() => alSiguiente(siguiente.id)}>Seguir: {siguiente.titulo} ({siguiente.n})</button>
          : <button className="btn-primario" onClick={alOtra}>Otra tanda</button>}
        {siguiente && <button className="btn-secundario" onClick={alOtra}>Otra tanda acá</button>}
        <Link className="btn-secundario" to="/atlas">Otras escenas</Link>
      </div>
    </div>
  )
}

/** Buscar una estructura por nombre (útil en escenas con muchas piezas o muy finas). */
function BuscarEstructura({ nombres, ocultas, alElegir }: { nombres: Record<string, string>; ocultas: string[]; alElegir: (id: string) => void }) {
  const [q, setQ] = useState('')
  const [abierto, setAbierto] = useState(false)
  const n = normalizar(q)
  const resultados = n.length < 2 ? [] : Object.entries(nombres).filter(([, nombre]) => normalizar(nombre).includes(n)).slice(0, 8)
  return (
    <div className="relative">
      <input
        className="campo !w-44 !py-1.5 text-xs shadow" placeholder="Buscar estructura…" value={q} aria-label="Buscar estructura"
        onChange={(e) => { setQ(e.target.value); setAbierto(true) }} onFocus={() => setAbierto(true)} onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && resultados[0]) { alElegir(resultados[0][0]); setQ(''); setAbierto(false) } }}
      />
      {abierto && resultados.length > 0 && (
        <ul className="absolute z-20 mt-1 w-64 overflow-hidden rounded-xl border text-xs shadow-lg borde" style={{ background: 'var(--tarjeta)' }}>
          {resultados.map(([id, nombre]) => (
            <li key={id}>
              <button className="w-full px-3 py-1.5 text-left hover:bg-black/5 dark:hover:bg-white/10" onMouseDown={(e) => e.preventDefault()} onClick={() => { alElegir(id); setQ(''); setAbierto(false) }}>
                {nombre}{ocultas.includes(id) && <span className="texto-suave"> · capa apagada</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Cronometro({ desde }: { desde: number }) {
  const [ahora, setAhora] = useState(desde)
  useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 500); return () => clearInterval(id) }, [])
  return <span className="font-mono tabular-nums">{formatearTiempo(Math.max(0, ahora - desde))}</span>
}

function formatearTiempo(ms: number) {
  const s = Math.round(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Mejor tiempo (s) del rompecabezas de esta escena. */
function useRecord(escena: string, refresco: number) {
  const [r, setR] = useState<number | null>(null)
  useEffect(() => {
    eventos.todos().then((evs) => {
      const ts = evs.filter((e) => e.tipo === 'rompecabezas' && e.detalle?.startsWith(escena + ':') && e.duracion).map((e) => e.duracion!)
      setR(ts.length ? Math.min(...ts) : null)
    })
  }, [escena, refresco])
  return r
}

