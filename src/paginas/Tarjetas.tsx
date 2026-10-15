import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { BotonArchivo } from '../componentes/Archivos'
import { useApp } from '../componentes/Contexto'
import { EditorTarjeta } from '../componentes/EditorTarjeta'
import { Encabezado } from '../componentes/Encabezado'
import { Hoja } from '../componentes/Hoja'
import { Icono } from '../componentes/Icono'
import { resumenTarjeta } from '../componentes/TarjetaVista'
import { normalizar } from '../busqueda/normalizar'
import { paqueteActivo, unidadPorId } from '../contenido'
import { imagenesTarjeta, tarjetas as repoTarjetas } from '../repositorio'
import { useAjustes, useFuentes, useRevisionesDesde, useTarjetas, useTemas } from '../repositorio/hooks'
import type { Tarjeta } from '../repositorio/tipos'
import { borradorDe, problemaBorrador, textoPlano, type BorradorTarjeta } from '../tarjetas/crear'
import { exportarCSV, importarCSV, unaPorNota } from '../tarjetas/csv'
import { armarCola, ESTADO, formatearIntervalo, inicioDelDia } from '../tarjetas/fsrs'
import { descargar } from './Ajustes'

const POR_PAGINA = 60

function estadoTexto(t: Tarjeta, ahora: number) {
  if (t.suspendida) return { txt: 'Suspendida', clase: 'texto-suave' }
  if (t.estado === ESTADO.nueva) return { txt: 'Nueva', clase: 'text-sky-600' }
  if (t.vence <= ahora) return { txt: 'Para hoy', clase: 'text-red-600' }
  return { txt: `en ${formatearIntervalo(t.vence - ahora)}`, clase: 'texto-suave' }
}

export default function Tarjetas() {
  const todas = useTarjetas()
  const ajustes = useAjustes()
  const temas = useTemas() ?? []
  const fuentes = useFuentes() ?? []
  const { avisar } = useApp()
  const [params] = useSearchParams()
  const [q, setQ] = useState(() => params.get('q') ?? '')
  const [unidad, setUnidad] = useState('')
  const [tipo, setTipo] = useState('')
  const [verSuspendidas, setVerSuspendidas] = useState(false)
  const [limite, setLimite] = useState(POR_PAGINA)
  const [editando, setEditando] = useState<{ t: Tarjeta; b: BorradorTarjeta } | null>(null)
  const [ocupado, setOcupado] = useState('')
  const [hoy] = useState(() => inicioDelDia())
  const revHoy = useRevisionesDesde(hoy) ?? []
  const ahora = Date.now()

  const filtradas = useMemo(() => {
    const n = normalizar(q)
    return (todas ?? []).filter((t) =>
      (!unidad || t.unidadId === unidad) && (!tipo || t.tipo === tipo) && (verSuspendidas ? t.suspendida : true) &&
      (!n || normalizar(textoPlano(t)).includes(n)))
  }, [todas, q, unidad, tipo, verSuspendidas])
  if (!todas || !ajustes) return null

  const cola = armarCola(todas, ahora, ajustes.nuevasPorDia, revHoy.filter((r) => r.antes.state === ESTADO.nueva).length)
  const pendientes = cola.vencidas.length + cola.enEspera.length + cola.nuevas.length
  const cuenta = {
    nuevas: todas.filter((t) => t.estado === ESTADO.nueva).length,
    aprendiendo: todas.filter((t) => t.estado === ESTADO.aprendiendo || t.estado === ESTADO.reaprendiendo).length,
    maduras: todas.filter((t) => t.estado === ESTADO.repaso && t.fsrs.scheduled_days >= 21).length,
  }
  // En la lista, una fila por tarjeta (las hermanas de un cloze se distinguen por el hueco).
  const visibles = filtradas.slice(0, limite)
  const nombreFuente = (id?: string) => fuentes.find((f) => f.id === id)?.nombre ?? 'Fuente'

  const exportarAnki = async () => {
    setOcupado('apkg')
    try {
      const { exportarApkg } = await import('../tarjetas/anki')
      const imgs = await imagenesTarjeta.todas()
      const blob = await exportarApkg(filtradas, {
        imagenes: new Map(imgs.map((i) => [i.id, i])),
        fuenteDe: (t) => (t.fuenteId ? `${nombreFuente(t.fuenteId)}${t.pagina ? `, pág. ${t.pagina}` : ''}` : ''),
      })
      descargar(blob, `estudio-med-tarjetas-${new Date().toISOString().slice(0, 10)}.apkg`)
      avisar(`${filtradas.length} tarjeta(s) exportadas a Anki`, 'ok')
    } catch (e) { avisar(`No se pudo exportar: ${(e as Error).message}`, 'error') }
    setOcupado('')
  }
  const exportarCsv = () => {
    const sinImagen = filtradas.filter((t) => t.tipo !== 'oclusion')
    descargar(new Blob([exportarCSV(sinImagen, temas)], { type: 'text/csv;charset=utf-8' }), `estudio-med-tarjetas-${new Date().toISOString().slice(0, 10)}.csv`)
    const ocl = filtradas.length - sinImagen.length
    avisar(`${unaPorNota(sinImagen).length} nota(s) exportadas a CSV${ocl ? ` (las ${ocl} de oclusión van solo en .apkg y en el respaldo)` : ''}`, 'ok')
  }
  const importarCsv = async (f: File) => {
    const { borradores, omitidas } = importarCSV(await f.text(), temas)
    if (!borradores.length) return avisar('No encontré tarjetas en el CSV (columnas: frente, dorso; o un texto con {{c1::…}}).', 'error')
    const creadas = await repoTarjetas.crear(borradores)
    avisar(`Importadas ${creadas.length} tarjeta(s)${omitidas ? `; ${omitidas} fila(s) incompletas omitidas` : ''}`, 'ok')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Tarjetas" subtitulo={`${todas.length} tarjetas · repetición espaciada FSRS`} acciones={
        <Link to="/tarjetas/generar?origen=manual" className="btn-secundario !px-3"><Icono nombre="mas2" /><span className="hidden sm:inline">Nueva</span></Link>
      } />

      <section className="grid gap-3 sm:grid-cols-2">
        <Link to="/repaso" className={`tarjeta flex items-center gap-4 p-4 transition hover:shadow-md ${pendientes ? 'border-marca/50' : ''}`}>
          <span className="text-3xl font-bold text-marca dark:text-marca-claro">{pendientes}</span>
          <span className="flex-1"><b className="block">Repasar ahora</b><span className="text-xs texto-suave">{cola.vencidas.length + cola.enEspera.length} para repasar · {cola.nuevas.length} nuevas</span></span>
          <Icono nombre="der" />
        </Link>
        <Link to="/tarjetas/generar" className="tarjeta flex items-center gap-4 p-4 transition hover:shadow-md">
          <Icono nombre="estrella" className="h-8 w-8 text-marca dark:text-marca-claro" />
          <span className="flex-1"><b className="block">Generar con IA</b><span className="text-xs texto-suave">De una UP, tema o fuente; con vista previa</span></span>
          <Icono nombre="der" />
        </Link>
      </section>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="tarjeta p-2"><b className="block text-lg text-sky-600">{cuenta.nuevas}</b>nuevas</div>
        <div className="tarjeta p-2"><b className="block text-lg text-amber-600">{cuenta.aprendiendo}</b>aprendiendo</div>
        <div className="tarjeta p-2"><b className="block text-lg text-emerald-600">{cuenta.maduras}</b>maduras (≥21 d)</div>
      </div>

      <section className="tarjeta space-y-2 p-3">
        <div className="flex flex-wrap gap-2">
          <input className="campo !w-auto min-w-0 flex-1" placeholder="Buscar en tus tarjetas…" value={q} onChange={(e) => { setQ(e.target.value); setLimite(POR_PAGINA) }} />
          <select className="campo !w-auto" value={unidad} onChange={(e) => setUnidad(e.target.value)} aria-label="Unidad">
            <option value="">Todas las UP</option>
            {paqueteActivo.unidades.map((u) => <option key={u.id} value={u.id}>{u.sigla}</option>)}
          </select>
          <select className="campo !w-auto" value={tipo} onChange={(e) => setTipo(e.target.value)} aria-label="Tipo">
            <option value="">Todos los tipos</option>
            <option value="basica">Pregunta/respuesta</option>
            <option value="cloze">Completar</option>
            <option value="oclusion">Oclusión</option>
          </select>
          <button className={verSuspendidas ? 'chip-activo' : 'chip'} onClick={() => setVerSuspendidas((v) => !v)}>Suspendidas</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t pt-2 text-sm borde">
          <span className="text-xs texto-suave">{filtradas.length} con este filtro:</span>
          {unidad && <Link className="btn-fantasma !py-1 text-xs" to={`/repaso?unidad=${unidad}`}>Repasar solo {unidadPorId(unidad)?.sigla}</Link>}
          <button className="btn-secundario !py-1 text-xs" disabled={!filtradas.length || !!ocupado} onClick={exportarAnki}><Icono nombre="bajar" className="h-4 w-4" />{ocupado === 'apkg' ? 'Armando…' : 'Anki (.apkg)'}</button>
          <button className="btn-secundario !py-1 text-xs" disabled={!filtradas.length} onClick={exportarCsv}><Icono nombre="bajar" className="h-4 w-4" />CSV</button>
          <BotonArchivo className="btn-secundario !py-1 text-xs" aceptar=".csv,.tsv,.txt,text/csv" alElegir={([f]) => importarCsv(f)}><Icono nombre="subir" className="h-4 w-4" />Importar CSV</BotonArchivo>
        </div>
      </section>

      {!todas.length ? (
        <div className="tarjeta p-6 text-center text-sm texto-suave">
          Todavía no hay tarjetas. Generalas desde una <Link className="underline" to="/biblioteca">UP</Link>, una selección del visor o una respuesta del <Link className="underline" to="/chat">chat</Link>.
        </div>
      ) : (
        <ul className="space-y-2">
          {visibles.map((t) => {
            const e = estadoTexto(t, ahora)
            return (
              <li key={t.id} className={`tarjeta flex items-start gap-3 p-3 ${t.suspendida ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm">{resumenTarjeta(t)}{t.tipo === 'cloze' && t.grupoId ? <span className="texto-suave"> · hueco {t.clozeN}</span> : null}</p>
                  {t.tipo === 'basica' && <p className="line-clamp-1 text-xs texto-suave">{t.dorso}</p>}
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs texto-suave">
                    <span className={e.clase}>{e.txt}</span>
                    {t.unidadId && <span>· {unidadPorId(t.unidadId)?.sigla}</span>}
                    {t.temaId && <span className="truncate">· {temas.find((x) => x.id === t.temaId)?.nombre}</span>}
                    {t.fsrs.lapses > 0 && <span>· {t.fsrs.lapses} olvido(s)</span>}
                  </p>
                </div>
                <button className="btn-fantasma !p-1.5" aria-label="Editar" onClick={() => setEditando({ t, b: borradorDe(t) })}><Icono nombre="lapiz" className="h-4 w-4" /></button>
                <button className="btn-fantasma !p-1.5 text-xs" title={t.suspendida ? 'Reactivar' : 'Suspender'} onClick={() => repoTarjetas.suspender(t.id, !t.suspendida)}>{t.suspendida ? '▶' : '⏸'}</button>
                <button className="btn-fantasma !p-1.5" aria-label="Borrar" onClick={async () => {
                  const n = (await repoTarjetas.deGrupo(t)).length
                  if (confirm(n > 1 ? `¿Borrar esta nota y sus ${n} tarjetas (con su historial)?` : '¿Borrar esta tarjeta y su historial?')) await repoTarjetas.borrar(t)
                }}><Icono nombre="basura" className="h-4 w-4" /></button>
              </li>
            )
          })}
          {filtradas.length > limite && <li><button className="btn-secundario w-full" onClick={() => setLimite((l) => l + POR_PAGINA)}>Ver más ({filtradas.length - limite})</button></li>}
        </ul>
      )}

      <Hoja abierta={!!editando} alCerrar={() => setEditando(null)} titulo="Editar tarjeta">
        {editando && (
          <div className="space-y-3 p-4">
            <EditorTarjeta b={editando.b} alCambiar={(b) => setEditando({ ...editando, b })} />
            <div className="flex gap-2">
              <button className="btn-primario" onClick={async () => {
                const p = problemaBorrador(editando.b)
                if (p) return avisar(p, 'error')
                await repoTarjetas.editar(editando.t, editando.b)
                setEditando(null)
                avisar('Guardada', 'ok')
              }}>Guardar</button>
              <button className="btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
            </div>
            <p className="text-xs texto-suave">Editar el texto no reinicia el repaso. En un cloze, cada hueco nuevo crea su tarjeta y quitar uno borra la suya.</p>
          </div>
        )}
      </Hoja>
    </div>
  )
}
