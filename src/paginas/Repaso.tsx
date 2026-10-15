import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { EditorTarjeta } from '../componentes/EditorTarjeta'
import { Encabezado } from '../componentes/Encabezado'
import { Hoja } from '../componentes/Hoja'
import { Icono } from '../componentes/Icono'
import { ContenidoTarjeta } from '../componentes/TarjetaVista'
import { nombreDisciplina, unidadPorId } from '../contenido'
import { fragmentos as repoFragmentos, tarjetas as repoTarjetas } from '../repositorio'
import { useAjustes, useRevisionesDesde, useTarjetas, useTemas } from '../repositorio/hooks'
import type { Tarjeta } from '../repositorio/tipos'
import { borradorDe, problemaBorrador, type BorradorTarjeta } from '../tarjetas/crear'
import {
  armarCola, CALIFICACIONES, ESTADO, formatearIntervalo, inicioDelDia, previsualizar, siguiente, calificar,
} from '../tarjetas/fsrs'

/** Filtro opcional por URL: /repaso?unidad=up3 · ?tema=… · ?disciplina=… */
function filtroDe(p: URLSearchParams) {
  return { unidad: p.get('unidad') ?? undefined, tema: p.get('tema') ?? undefined, disciplina: p.get('disciplina') ?? undefined }
}

export default function Repaso() {
  const [params] = useSearchParams()
  const filtro = useMemo(() => filtroDe(params), [params])
  const ajustes = useAjustes()
  const todas = useTarjetas()
  const temas = useTemas() ?? []
  const [ahora, setAhora] = useState(() => Date.now())
  const hoy = inicioDelDia(ahora)
  const revHoy = useRevisionesDesde(hoy)
  const [actualId, setActualId] = useState<string | null>(null)
  const [revelada, setRevelada] = useState(false)
  const [editando, setEditando] = useState<BorradorTarjeta | null>(null)
  const mostrada = useRef(Date.now())
  /** Última respondida: hasta que la consulta en vivo traiga su estado nuevo, no se vuelve a mostrar. */
  const ultima = useRef<{ id: string; en: number } | null>(null)
  const { abrirVisor, avisar } = useApp()

  useEffect(() => { const id = setInterval(() => setAhora(Date.now()), 30_000); return () => clearInterval(id) }, [])

  const filtradas = useMemo(() => (todas ?? []).filter((t) =>
    (!filtro.unidad || t.unidadId === filtro.unidad) && (!filtro.tema || t.temaId === filtro.tema) && (!filtro.disciplina || t.disciplinaId === filtro.disciplina)), [todas, filtro])
  const nuevasHoy = (revHoy ?? []).filter((r) => r.antes.state === ESTADO.nueva).length
  const cola = useMemo(() => armarCola(filtradas, ahora, ajustes?.nuevasPorDia ?? 25, nuevasHoy), [filtradas, ahora, ajustes?.nuevasPorDia, nuevasHoy])
  const actual = filtradas.find((t) => t.id === actualId)

  // Elegir la siguiente cuando no hay una en pantalla.
  useEffect(() => {
    if (!todas || !revHoy || actual) return
    const s = siguiente(cola)
    if (s && ultima.current?.id === s.id && s.actualizada < ultima.current.en) return
    if (s) { setActualId(s.id); setRevelada(false); mostrada.current = Date.now() }
    else if (actualId) setActualId(null)
  }, [todas, revHoy, actual, actualId, cola])

  const retencion = ajustes?.retencion ?? 0.9
  const previa = useMemo(() => (actual ? previsualizar(actual.fsrs, Date.now(), retencion) : null), [actual, retencion])

  const responder = useCallback(async (n: number) => {
    if (!actual || !revelada) return
    const t = Date.now()
    const nuevo = calificar(actual.fsrs, n, t, retencion)
    ultima.current = { id: actual.id, en: t }
    await repoTarjetas.responder(actual, n, nuevo, t - mostrada.current)
    setAhora(t)
    setActualId(null)
  }, [actual, revelada, retencion])

  const deshacer = async () => {
    const t = await repoTarjetas.deshacerUltimo()
    if (t) { setActualId(t.id); setRevelada(true); setAhora(Date.now()) }
  }

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (editando || (e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (!revelada) setRevelada(true); else if (e.key === 'Enter') responder(3) }
      else if (['1', '2', '3', '4'].includes(e.key)) responder(Number(e.key))
      else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) deshacer()
    }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  })

  const verOrigen = async (t: Tarjeta) => {
    const f = t.fragmentoId ? await repoFragmentos.obtener(t.fragmentoId) : undefined
    if (f) abrirVisor({ fuenteId: f.fuenteId, pagina: f.pagina, objetivo: { inicio: f.inicio, fin: f.fin } })
    else if (t.fuenteId && t.pagina) abrirVisor({ fuenteId: t.fuenteId, pagina: t.pagina })
  }

  if (!todas || !ajustes || !revHoy) return null
  const tituloFiltro = filtro.unidad ? unidadPorId(filtro.unidad)?.sigla : filtro.tema ? temas.find((t) => t.id === filtro.tema)?.nombre : filtro.disciplina ? nombreDisciplina(filtro.disciplina) : ''

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <Encabezado volver titulo={`Repaso${tituloFiltro ? ` · ${tituloFiltro}` : ''}`} acciones={
        <div className="flex items-center gap-2 text-sm font-semibold tabular-nums">
          <span className="text-red-600" title="Para repasar (vencidas)">{cola.vencidas.length}</span>
          <span className="text-sky-600" title="Nuevas de hoy">{cola.nuevas.length}</span>
          <span className="texto-suave" title="En aprendizaje (vuelven en minutos)">{cola.enEspera.length}</span>
          <button className="btn-fantasma !p-2" onClick={deshacer} disabled={!revHoy.length} title="Deshacer el último (Ctrl+Z)" aria-label="Deshacer"><Icono nombre="deshacer" /></button>
        </div>
      } />

      {!actual ? (
        <Terminado hechas={revHoy.length} total={filtradas.length} cola={cola} ahora={ahora} />
      ) : (
        <>
          <div className="tarjeta flex min-h-[16rem] flex-col p-5" onClick={() => !revelada && setRevelada(true)}>
            <div className="mb-3 flex flex-wrap items-center gap-2 text-xs texto-suave">
              <span className="chip">{actual.estado === ESTADO.nueva ? 'Nueva' : actual.estado === ESTADO.repaso ? 'Repaso' : 'Aprendiendo'}</span>
              {actual.unidadId && <span>{unidadPorId(actual.unidadId)?.sigla}</span>}
              {actual.temaId && <span className="truncate">· {temas.find((t) => t.id === actual.temaId)?.nombre}</span>}
            </div>
            <div className="flex-1"><ContenidoTarjeta t={actual} revelar={revelada} /></div>
            {revelada && (
              <div className="mt-4 flex flex-wrap gap-2 border-t pt-3 text-xs borde" onClick={(e) => e.stopPropagation()}>
                {(actual.fragmentoId || actual.pagina) && <button className="btn-fantasma !px-2 !py-1 text-xs" onClick={() => verOrigen(actual)}><Icono nombre="pdf" className="h-4 w-4" />Ver en la fuente{actual.pagina ? `, pág. ${actual.pagina}` : ''}</button>}
                <button className="btn-fantasma !px-2 !py-1 text-xs" onClick={() => setEditando(borradorDe(actual))}><Icono nombre="lapiz" className="h-4 w-4" />Editar</button>
                <button className="btn-fantasma !px-2 !py-1 text-xs" onClick={async () => { await repoTarjetas.suspender(actual.id, true); setActualId(null); avisar('Tarjeta suspendida (la reactivás desde Tarjetas)') }}>Suspender</button>
              </div>
            )}
          </div>

          <div className="sticky bottom-0">
            {!revelada ? (
              <button className="btn-primario w-full !py-3 text-base" onClick={() => setRevelada(true)}>Mostrar respuesta <kbd className="ml-2 hidden rounded bg-white/20 px-1.5 text-xs sm:inline">espacio</kbd></button>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {CALIFICACIONES.map((c) => (
                  <button key={c.valor} className={`btn flex-col !gap-0 !px-1 !py-2 text-white ${c.clase} hover:brightness-110`} onClick={() => responder(c.valor)}>
                    <span className="text-[11px] font-normal opacity-90">{previa ? formatearIntervalo(previa[c.valor].due - Date.now()) : ''}</span>
                    <span>{c.nombre}</span>
                    <kbd className="hidden text-[10px] opacity-70 sm:block">{c.tecla}</kbd>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Hoja abierta={!!editando} alCerrar={() => setEditando(null)} titulo="Editar tarjeta">
        {editando && actual && (
          <div className="space-y-3 p-4">
            <EditorTarjeta b={editando} alCambiar={setEditando} />
            <div className="flex gap-2">
              <button className="btn-primario" onClick={async () => {
                const p = problemaBorrador(editando)
                if (p) return avisar(p, 'error')
                await repoTarjetas.editar(actual, editando)
                setEditando(null)
              }}>Guardar</button>
              <button className="btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
          </div>
        )}
      </Hoja>
    </div>
  )
}

function Terminado({ hechas, total, cola, ahora }: { hechas: number; total: number; cola: ReturnType<typeof armarCola>; ahora: number }) {
  if (!total) {
    return (
      <div className="tarjeta space-y-3 p-6 text-center">
        <Icono nombre="tarjetas" className="mx-auto h-10 w-10 text-marca dark:text-marca-claro" />
        <h2 className="text-lg font-semibold">Todavía no tenés tarjetas</h2>
        <p className="text-sm texto-suave">Generalas con IA desde una UP, una fuente, una selección del visor o una respuesta del chat, o creá las tuyas.</p>
        <Link to="/tarjetas/generar" className="btn-primario">Generar tarjetas</Link>
      </div>
    )
  }
  const proxima = cola.masTarde.map((t) => t.vence).sort((a, b) => a - b)[0]
  return (
    <div className="tarjeta space-y-3 p-6 text-center">
      <Icono nombre="check" className="mx-auto h-10 w-10 text-emerald-600" />
      <h2 className="text-lg font-semibold">{hechas ? '¡Listo por hoy!' : 'No hay nada para repasar ahora'}</h2>
      <p className="text-sm texto-suave">
        {hechas ? `Repasaste ${hechas} ${hechas === 1 ? 'tarjeta' : 'tarjetas'} hoy. ` : ''}
        {proxima ? `La próxima vence en ${formatearIntervalo(proxima - ahora)}.` : 'Volvé mañana: FSRS te va a traer cada tarjeta justo antes de que la olvides.'}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <Link to="/" className="btn-secundario">Volver a Hoy</Link>
        <Link to="/tarjetas" className="btn-secundario">Ver mis tarjetas</Link>
      </div>
    </div>
  )
}
