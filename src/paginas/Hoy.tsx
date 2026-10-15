import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { EstadoFuente } from '../componentes/EstadoFuente'
import { Icono } from '../componentes/Icono'
import { paqueteActivo } from '../contenido'
import { marca } from '../marca'
import { useState } from 'react'
import { useAjustes, useConteoFragmentos, useFragmentosPorUnidad, useFuentes, useEstadosAtlas, useRevisionesDesde, useTarjetas, useTemas, useUsoIAHoy } from '../repositorio/hooks'
import { armarCola, ESTADO, inicioDelDia, racha } from '../tarjetas/fsrs'
import { temasFlojos } from '../tarjetas/flojos'
import { hacerBackup } from './Ajustes'
import { DiaDelPlan } from '../plan/ComponentesPlan'
import { planDeHoy } from '../plan/planificar'
import { usePlan } from '../plan/usePlan'

const DIA = 864e5

export function diasHasta(fechaISO: string, hoy = new Date()) {
  const [a, m, d] = fechaISO.split('-').map(Number)
  const objetivo = new Date(a, m - 1, d).getTime()
  const base = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()
  return Math.round((objetivo - base) / DIA)
}

export default function Hoy() {
  const a = useAjustes()
  const fuentes = useFuentes() ?? []
  const nFrag = useConteoFragmentos() ?? 0
  const uso = useUsoIAHoy()
  const navegar = useNavigate()
  const { avisar } = useApp()
  const tarjetas = useTarjetas()
  const temas = useTemas() ?? []
  const fragsPorUnidad = useFragmentosPorUnidad() ?? {}
  // Un año de repasos alcanza para la racha; los temas flojos miran los últimos 30 días.
  // Hora de referencia de la pantalla: se renueva al volver a entrar.
  const [ahora] = useState(() => Date.now())
  const desde = inicioDelDia(ahora) - 365 * DIA
  const revs = useRevisionesDesde(desde)
  const estadosAtlas = useEstadosAtlas()
  const plan = usePlan(ahora)
  if (!a) return null

  const hoy = inicioDelDia(ahora)
  const nuevasHoy = (revs ?? []).filter((r) => r.fecha >= hoy && r.antes.state === ESTADO.nueva).length
  const cola = armarCola(tarjetas ?? [], ahora, a.nuevasPorDia, nuevasHoy)
  const pendientes = cola.vencidas.length + cola.nuevas.length + cola.enEspera.length
  const hechasHoy = (revs ?? []).filter((r) => r.fecha >= hoy).length
  const diasRacha = racha((revs ?? []).map((r) => r.fecha), ahora)
  const porId = new Map((tarjetas ?? []).map((t) => [t.id, t]))
  // Estructuras del atlas que vencen hoy (Modo Museo), agrupadas por escena.
  const atlasVencidas = (estadosAtlas ?? []).filter((e) => e.vence <= ahora)
  const escenaAtlas = Object.entries(atlasVencidas.reduce<Record<string, number>>((r, e) => ({ ...r, [e.escena]: (r[e.escena] ?? 0) + 1 }), {})).sort((x, y) => y[1] - x[1])[0]?.[0]
  const flojos = temasFlojos((revs ?? []).filter((r) => r.fecha >= ahora - 30 * DIA), porId)
  // Sin datos de repaso todavía: sugerir las UP con material y sin tarjetas.
  const unidadesSinTarjetas = paqueteActivo.unidades.filter((u) => fragsPorUnidad[u.id] && !(tarjetas ?? []).some((t) => t.unidadId === u.id))

  const proximos = paqueteActivo.parciales
    .map((p) => ({ ...p, fecha: a.fechasParciales[p.id], dias: a.fechasParciales[p.id] ? diasHasta(a.fechasParciales[p.id]) : null }))
    .filter((p) => p.dias !== null && p.dias >= 0)
    .sort((x, y) => x.dias! - y.dias!)
  const deHoy = plan ? planDeHoy(plan.planes, ahora) : null
  const enProceso = fuentes.filter((f) => f.estado !== 'listo')
  const guia = fuentes.find((f) => f.esGuia)
  const necesitaBackup = nFrag > 0 && (!a.ultimoBackup || ahora - a.ultimoBackup > 7 * DIA)
  const hora = new Date(ahora).getHours()
  const saludo = hora < 12 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center gap-3 lg:hidden">
        <span className="h-9 w-9" dangerouslySetInnerHTML={{ __html: marca.logoSvg }} />
        <div className="flex-1"><p className="text-xs texto-suave">{marca.nombre}</p><h1 className="text-lg font-bold">{saludo}</h1></div>
        <button className="btn-fantasma !p-2" onClick={() => navegar('/buscar')} aria-label="Buscar"><Icono nombre="buscar" /></button>
      </header>
      <h1 className="hidden text-2xl font-bold lg:block">{saludo}</h1>

      {/* Repasos del día: lo primero */}
      {tarjetas && (
        <section className="tarjeta flex flex-wrap items-center gap-4 p-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-marca dark:text-marca-claro">{pendientes}</div>
            <div className="text-xs texto-suave">para hoy</div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{pendientes ? 'Repasos del día' : tarjetas.length ? 'Repasos al día' : 'Repetición espaciada'}</p>
            <p className="text-sm texto-suave">
              {tarjetas.length
                ? `${cola.vencidas.length + cola.enEspera.length} para repasar · ${cola.nuevas.length} nuevas${hechasHoy ? ` · ya hiciste ${hechasHoy}` : ''}`
                : 'Generá tarjetas de una UP y repasalas con FSRS.'}
            </p>
            {diasRacha > 0 && <p className="mt-1 flex items-center gap-1 text-sm font-medium text-amber-600"><Icono nombre="fuego" className="h-4 w-4" />Racha de {diasRacha} {diasRacha === 1 ? 'día' : 'días'}</p>}
          </div>
          {pendientes > 0
            ? <Link to="/repaso" className="btn-primario">Repasar</Link>
            : <Link to="/tarjetas/generar" className="btn-secundario">Generar tarjetas</Link>}
        </section>
      )}

      {/* Plan de estudio: lo que toca hoy */}
      {plan && deHoy && (
        <section className="tarjeta space-y-3 p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold">Plan de hoy</h2>
            <span className="text-xs texto-suave">{deHoy.plan.parcial.nombre} · {deHoy.plan.estudiados}/{deHoy.plan.total} temas</span>
          </div>
          <DiaDelPlan dia={deHoy.dia} plan={deHoy.plan} temas={plan.temas} estudiados={plan.estudiados} />
          {deHoy.plan.noAlcanza && deHoy.dia.tipo !== 'parcial' && <p className="flex items-center gap-1 text-xs text-amber-600"><Icono nombre="alerta" className="h-3.5 w-3.5" />Vas justo de tiempo: hasta {deHoy.plan.temasPorDia} temas por día.</p>}
          <Link to="/plan" className="text-sm text-marca underline dark:text-marca-claro">Ver el plan completo</Link>
        </section>
      )}

      {(flojos.length > 0 || unidadesSinTarjetas.length > 0) && (
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-sm font-semibold">{flojos.length ? 'Temas flojos (últimos 30 días)' : 'Sugerencias'}</h2>
          <ul className="space-y-2 text-sm">
            {flojos.map((f) => {
              const t = temas.find((x) => x.id === f.temaId)
              return (
                <li key={f.temaId} className="flex flex-wrap items-center gap-2">
                  <span className="min-w-0 flex-1"><b>{t?.nombre ?? 'Tema'}</b> <span className="texto-suave">· {Math.round(f.tasa * 100)} % de olvidos en {f.repasos} repasos</span></span>
                  <Link className="btn-fantasma !py-1 text-xs" to={`/repaso?tema=${f.temaId}`}>Repasar</Link>
                  <Link className="btn-fantasma !py-1 text-xs" to={`/chat?alcance=tema&id=${f.temaId}`}>Preguntar</Link>
                  <Link className="btn-fantasma !py-1 text-xs" to={`/tarjetas/generar?alcance=tema&id=${f.temaId}&n=10`}>Más tarjetas</Link>
                </li>
              )
            })}
            {!flojos.length && unidadesSinTarjetas.slice(0, 3).map((u) => (
              <li key={u.id} className="flex items-center gap-2">
                <span className="flex-1"><b>{u.sigla}</b> <span className="texto-suave">tiene material y todavía no tiene tarjetas</span></span>
                <Link className="btn-fantasma !py-1 text-xs" to={`/tarjetas/generar?alcance=unidad&id=${u.id}&n=30`}>Hacer 30 tarjetas</Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {atlasVencidas.length > 0 && escenaAtlas && (
        <Link to={`/atlas/${escenaAtlas}?modo=museo&repaso=1`} className="tarjeta flex items-center gap-4 p-4">
          <div className="text-center"><div className="text-3xl font-bold text-cyan-600 dark:text-cyan-300">{atlasVencidas.length}</div><div className="text-xs texto-suave">estructuras</div></div>
          <div className="min-w-0 flex-1"><p className="font-semibold">Atlas: repaso de estructuras</p><p className="text-sm texto-suave">Modo Museo con las que te tocan hoy (las que fallaste vuelven antes).</p></div>
          <Icono nombre="cubo" className="h-6 w-6 text-cyan-600 dark:text-cyan-300" />
        </Link>
      )}

      {/* Cuenta regresiva */}
      {proximos.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {proximos.map((p) => (
            <div key={p.id} className="tarjeta flex items-center gap-4 p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-marca dark:text-marca-claro">{p.dias}</div>
                <div className="text-xs texto-suave">{p.dias === 1 ? 'día' : 'días'}</div>
              </div>
              <div><p className="font-semibold">{p.nombre}</p><p className="text-sm texto-suave">{new Date(p.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}</p></div>
            </div>
          ))}
        </div>
      ) : (
        <Link to="/ajustes" className="tarjeta block p-4 text-sm"><Icono nombre="reloj" className="mr-2 inline h-4 w-4" />Cargá las fechas de los parciales para ver la cuenta regresiva →</Link>
      )}

      {/* Avisos */}
      {necesitaBackup && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <Icono nombre="alerta" className="h-5 w-5 text-amber-600" />
          <p className="flex-1">{a.ultimoBackup ? 'Pasó más de una semana desde tu último respaldo.' : 'Todavía no hiciste ningún respaldo.'} Tus datos viven solo en este dispositivo.</p>
          <button className="btn-primario" onClick={async () => { await hacerBackup(); avisar('Respaldo descargado', 'ok') }}>Hacer respaldo</button>
        </div>
      )}
      {uso?.agotado && (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
          Llegaste al límite gratis de IA de hoy; se renueva mañana. Todo lo demás (biblioteca, visor, notas, búsqueda) sigue funcionando.
        </div>
      )}
      {!guia && (
        <Link to="/biblioteca" className="tarjeta flex items-center gap-3 p-4 text-sm">
          <Icono nombre="pdf" className="h-6 w-6 text-marca" />
          <span className="flex-1"><b>Importá la guía del área</b> para que las respuestas se citen con la página exacta.</span>
          <Icono nombre="der" />
        </Link>
      )}
      {enProceso.length > 0 && (
        <div className="tarjeta space-y-3 p-4">
          <h2 className="text-sm font-semibold">Procesando tus fuentes</h2>
          {enProceso.map((f) => <div key={f.id}><p className="mb-1 text-sm">{f.nombre}</p><EstadoFuente f={f} /></div>)}
        </div>
      )}

      {/* Práctica activa */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Accion a="/repaso" icono="tarjetas" titulo="Repasar tarjetas" texto="FSRS: justo antes de olvidar" />
        <Accion a="/atlas" icono="cubo" titulo="Atlas 3D" texto="Desarmá, armá y Modo Museo" />
        <Accion a="/practica" icono="check" titulo="Práctica de parcial" texto="Preguntas, ejercicios y simulacro" />
        <Accion a="/oral" icono="mic" titulo="Examen oral" texto="Te pregunta, repregunta y califica" />
        <Accion a="/simuladores" icono="grafico" titulo="Simuladores" texto="Starling, clearance, ácido-base…" />
        <Accion a="/chat" icono="chat" titulo="Preguntale a tus fuentes" texto="Respuestas con cita a la página" />
        <Accion a="/biblioteca" icono="biblioteca" titulo="Unidades Problema" texto="Situaciones y temas por UP" />
        <Accion a="/notas" icono="nota" titulo="Notas" texto="Tus resúmenes enlazados" />
      </section>

      <section className="tarjeta p-4">
        <h2 className="mb-3 text-sm font-semibold">Seguí por una unidad</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {paqueteActivo.unidades.map((u) => (
            <Link key={u.id} to={`/up/${u.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-black/5 dark:hover:bg-white/5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-marca/15 text-sm font-bold text-marca dark:text-marca-claro">{u.sigla}</span>
              <span className="min-w-0"><span className="block truncate text-sm font-medium">{u.titulo}</span><span className="text-xs texto-suave">{u.modulo}</span></span>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-center text-xs texto-suave">
        {nFrag} fragmentos indexados · {tarjetas?.length ?? 0} tarjetas · {uso?.llamadas ?? 0} llamadas a la IA hoy
      </p>
    </div>
  )
}

function Accion({ a, icono, titulo, texto }: { a: string; icono: string; titulo: string; texto: string }) {
  return (
    <Link to={a} className="tarjeta flex flex-col gap-2 p-4 transition hover:-translate-y-0.5 hover:shadow-md">
      <Icono nombre={icono} className="h-6 w-6 text-marca dark:text-marca-claro" />
      <span className="text-sm font-semibold leading-tight">{titulo}</span>
      <span className="text-xs texto-suave">{texto}</span>
    </Link>
  )
}
