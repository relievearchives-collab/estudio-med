import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { EstadoFuente } from '../componentes/EstadoFuente'
import { Icono } from '../componentes/Icono'
import { paqueteActivo } from '../contenido'
import { marca } from '../marca'
import { useAjustes, useConteoFragmentos, useFuentes, useUsoIAHoy } from '../repositorio/hooks'
import { hacerBackup } from './Ajustes'

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
  if (!a) return null

  const proximos = paqueteActivo.parciales
    .map((p) => ({ ...p, fecha: a.fechasParciales[p.id], dias: a.fechasParciales[p.id] ? diasHasta(a.fechasParciales[p.id]) : null }))
    .filter((p) => p.dias !== null && p.dias >= 0)
    .sort((x, y) => x.dias! - y.dias!)
  const enProceso = fuentes.filter((f) => f.estado !== 'listo')
  const guia = fuentes.find((f) => f.esGuia)
  const necesitaBackup = nFrag > 0 && (!a.ultimoBackup || Date.now() - a.ultimoBackup > 7 * DIA)
  const hora = new Date().getHours()
  const saludo = hora < 12 ? 'Buen día' : hora < 20 ? 'Buenas tardes' : 'Buenas noches'

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <header className="flex items-center gap-3 lg:hidden">
        <span className="h-9 w-9" dangerouslySetInnerHTML={{ __html: marca.logoSvg }} />
        <div className="flex-1"><p className="text-xs texto-suave">{marca.nombre}</p><h1 className="text-lg font-bold">{saludo}</h1></div>
        <button className="btn-fantasma !p-2" onClick={() => navegar('/buscar')} aria-label="Buscar"><Icono nombre="buscar" /></button>
      </header>
      <h1 className="hidden text-2xl font-bold lg:block">{saludo}</h1>

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
        {nFrag} fragmentos indexados · {uso?.llamadas ?? 0} llamadas a la IA hoy
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
