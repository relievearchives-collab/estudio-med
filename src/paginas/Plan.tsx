import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { paqueteActivo } from '../contenido'
import { DiaDelPlan, FilaTema } from '../plan/ComponentesPlan'
import { diasEntre, etiquetaFecha, fechaISO, type PlanParcial } from '../plan/planificar'
import { usePlan } from '../plan/usePlan'
import { guardarAjuste } from '../repositorio'
import type { Tema } from '../repositorio/tipos'

const DIAS_VISIBLES = 7

export default function Plan() {
  const [ahora] = useState(() => Date.now())
  const datos = usePlan(ahora)
  if (!datos) return null
  const { planes, temas, estudiados, maxPorDia, hayFechas } = datos

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Plan de estudio" subtitulo="Hasta cada parcial. Se recalcula solo con lo que te falta." />
      {!hayFechas && (
        <Link to="/ajustes" className="tarjeta flex items-center gap-3 p-4 text-sm">
          <Icono nombre="reloj" className="h-5 w-5" />
          <span className="flex-1">Cargá las fechas de los parciales en Ajustes para armar tu plan.</span>
          <Icono nombre="der" />
        </Link>
      )}
      {hayFechas && !planes.length && <p className="tarjeta p-4 text-sm">Los parciales que cargaste ya pasaron. Actualizá las fechas en <Link className="text-marca underline dark:text-marca-claro" to="/ajustes">Ajustes</Link>.</p>}

      <label className="tarjeta flex flex-wrap items-center gap-3 p-4 text-sm">
        <span className="flex-1">Máximo de temas nuevos por día que te resulta llevadero</span>
        <input
          type="number" min={1} max={10} className="campo !w-20" value={maxPorDia}
          onChange={(e) => { const n = Math.round(Number(e.target.value)); if (n >= 1 && n <= 10) guardarAjuste('temasPorDiaMax', n) }}
        />
      </label>

      {planes.map((p) => <PlanDeParcial key={p.parcial.id} plan={p} temas={temas} estudiados={estudiados} ahora={ahora} maxPorDia={maxPorDia} />)}

      <p className="text-xs texto-suave">
        Tildá un tema cuando lo estudiaste. Si un día no llegás, lo que quedó se reparte en los días que faltan. Los últimos días antes de cada parcial quedan para repaso general y simulacro, con tus temas flojos de la práctica y las tarjetas.
      </p>
    </div>
  )
}

function PlanDeParcial({ plan, temas, estudiados, ahora, maxPorDia }: { plan: PlanParcial; temas: Tema[]; estudiados: Record<string, number>; ahora: number; maxPorDia: number }) {
  const faltan = diasEntre(fechaISO(ahora), plan.parcial.fecha)
  const visibles = plan.dias.slice(0, DIAS_VISIBLES)
  const resto = plan.dias.slice(DIAS_VISIBLES)
  const pct = plan.total ? Math.round((plan.estudiados / plan.total) * 100) : 0
  const deParcial = plan.parcial.unidadIds.flatMap((u) => temas.filter((t) => t.unidadId === u))

  return (
    <section className="tarjeta space-y-4 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold">{plan.parcial.nombre}</h2>
        <p className="text-sm texto-suave">{new Date(plan.parcial.fecha + 'T12:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} · {faltan === 0 ? 'hoy' : faltan === 1 ? 'mañana' : `en ${faltan} días`}</p>
      </div>
      <div>
        <div className="mb-1 flex justify-between text-xs"><span>{plan.estudiados} de {plan.total} temas estudiados</span><span>{pct} %</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full rounded-full bg-marca" style={{ width: `${pct}%` }} /></div>
      </div>
      {plan.pendientes === 0
        ? <p className="rounded-xl bg-green-500/10 p-3 text-sm">¡Ya estudiaste todos los temas! Usá los días que quedan para repasar y hacer simulacros.</p>
        : plan.noAlcanza
          ? (
            <p className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm">
              <Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              {plan.diasEstudio === 0
                ? `Quedan ${plan.pendientes} temas sin estudiar y no hay días antes del parcial. Priorizá tus temas flojos y repasá tarjetas.`
                : `Te quedan ${plan.pendientes} temas en ${plan.diasEstudio} días: hasta ${plan.temasPorDia} por día, más que tu máximo de ${maxPorDia}. Priorizá lo que más se pregunta y los temas flojos.`}
            </p>
          )
          : <p className="text-sm">Te quedan <b>{plan.pendientes}</b> temas en <b>{plan.diasEstudio}</b> días de estudio: hasta <b>{plan.temasPorDia}</b> por día.</p>}

      <ol className="space-y-3">
        {visibles.map((d) => <Dia key={d.fecha} dia={d} plan={plan} temas={temas} estudiados={estudiados} ahora={ahora} />)}
      </ol>
      {resto.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium">Ver los {resto.length} días siguientes</summary>
          <ol className="mt-3 space-y-3">{resto.map((d) => <Dia key={d.fecha} dia={d} plan={plan} temas={temas} estudiados={estudiados} ahora={ahora} />)}</ol>
        </details>
      )}
      <details>
        <summary className="cursor-pointer text-sm font-medium">Todos los temas del {plan.parcial.nombre.toLowerCase()}</summary>
        <div className="mt-3 space-y-3">
          {plan.parcial.unidadIds.map((u) => {
            const ts = deParcial.filter((t) => t.unidadId === u)
            return (
              <div key={u}>
                <p className="mb-1 text-xs font-semibold texto-suave">{paqueteActivo.unidades.find((x) => x.id === u)?.sigla} · {ts.filter((t) => estudiados[t.id]).length}/{ts.length}</p>
                <ul className="space-y-1.5">{ts.map((t) => <FilaTema key={t.id} tema={t} estudiado={!!estudiados[t.id]} />)}</ul>
              </div>
            )
          })}
        </div>
      </details>
    </section>
  )
}

function Dia({ dia, plan, temas, estudiados, ahora }: { dia: PlanParcial['dias'][number]; plan: PlanParcial; temas: Tema[]; estudiados: Record<string, number>; ahora: number }) {
  const esHoy = dia.fecha === fechaISO(ahora)
  return (
    <li className={`rounded-xl border p-3 ${esHoy ? 'border-marca' : 'border-black/10 dark:border-white/10'}`}>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold first-letter:uppercase">
        {etiquetaFecha(dia.fecha, ahora)}
        {dia.tipo === 'repaso' && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium">Repaso</span>}
        {dia.tipo === 'parcial' && <span className="rounded-full bg-marca px-2 py-0.5 text-xs font-medium text-white">Parcial</span>}
      </p>
      <DiaDelPlan dia={dia} plan={plan} temas={temas} estudiados={estudiados} />
    </li>
  )
}
