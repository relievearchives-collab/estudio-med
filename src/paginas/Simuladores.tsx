import { lazy, Suspense, useEffect, type ComponentType, type LazyExoticComponent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { paqueteActivo, unidadPorId } from '../contenido'
import { eventos } from '../repositorio'
import { simuladores, simuladorPorId } from '../simuladores/catalogo'

/** Índice de simuladores, en el orden de las unidades del área. */
export function IndiceSimuladores() {
  const lista = paqueteActivo.simuladores
    .map((v) => ({ v, s: simuladorPorId(v.simulador)! }))
    .filter((x) => x.s)
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Simuladores" subtitulo="Mové los valores y mirá qué pasa. Cada uno con ejercicios nuevos corregidos por la app." />
      <div className="grid gap-3 sm:grid-cols-2">
        {lista.map(({ v, s }) => (
          <Link key={s.id} to={`/simuladores/${s.id}`} className="tarjeta flex gap-3 p-4 transition hover:shadow-md">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-300"><Icono nombre="grafico" className="h-6 w-6" /></span>
            <span className="min-w-0">
              <span className="block font-semibold leading-tight">{s.titulo}</span>
              <span className="mt-0.5 block text-xs texto-suave">{v.unidadIds.map((u) => unidadPorId(u)?.sigla).join(' · ')} · {s.resumen}</span>
            </span>
          </Link>
        ))}
      </div>
      <Link to="/practica" className="tarjeta flex items-center gap-3 p-4 text-sm">
        <Icono nombre="check" className="h-6 w-6 text-marca" />
        <span className="flex-1"><b>Práctica de parcial</b><span className="block text-xs texto-suave">Preguntas, ejercicios numéricos y simulacro cronometrado.</span></span>
        <Icono nombre="der" />
      </Link>
    </div>
  )
}

/**
 * Un componente diferido por simulador, creado una sola vez: si se creara en cada render, una navegación
 * (que React Router hace dentro de una transition) quedaría suspendida para siempre.
 */
const DIFERIDOS: Record<string, LazyExoticComponent<ComponentType>> = Object.fromEntries(simuladores.map((s) => [s.id, lazy(s.cargar)]))

function SimuladorDiferido({ id }: { id: string }) {
  const C = DIFERIDOS[id]
  return <C />
}

/** Página de un simulador (cada uno se carga recién al abrirlo). */
export function PaginaSimulador() {
  const { id } = useParams()
  const s = simuladorPorId(id)
  useEffect(() => { if (s) eventos.registrar('simulador', s.id) }, [s])
  if (!s || !DIFERIDOS[s.id]) return <p className="p-4">Simulador no encontrado. <Link className="underline" to="/simuladores">Ver todos</Link></p>
  const v = paqueteActivo.simuladores.find((x) => x.simulador === s.id)
  return (
    <div className="mx-auto max-w-5xl space-y-4 p-4">
      <Encabezado volver titulo={s.titulo} subtitulo={v ? v.unidadIds.map((u) => `${unidadPorId(u)?.sigla} · ${unidadPorId(u)?.titulo}`).join(' / ') : undefined} />
      <Suspense fallback={<p className="text-sm texto-suave">Cargando simulador…</p>}>
        <SimuladorDiferido id={s.id} />
      </Suspense>
      <nav className="flex flex-wrap gap-1 pt-2 text-xs">
        {simuladores.filter((x) => x.id !== s.id).map((x) => <Link key={x.id} className="chip hover:bg-black/5 dark:hover:bg-white/5" to={`/simuladores/${x.id}`}>{x.titulo}</Link>)}
      </nav>
    </div>
  )
}
