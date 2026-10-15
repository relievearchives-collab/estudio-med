import { Link } from 'react-router-dom'
import { Icono } from '../componentes/Icono'
import { colorDisciplina, nombreDisciplina, unidadPorId } from '../contenido'
import { marcarEstudiado } from '../repositorio'
import type { Tema } from '../repositorio/tipos'
import type { DiaPlan, PlanParcial } from './planificar'

/** Tema del plan con su casilla de "estudiado" y accesos rápidos. */
export function FilaTema({ tema, estudiado }: { tema: Tema; estudiado: boolean }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <input
        type="checkbox" className="h-4 w-4 shrink-0" checked={estudiado} onChange={(e) => marcarEstudiado(tema.id, e.target.checked)}
        aria-label={`Marcar "${tema.nombre}" como estudiado`}
      />
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: colorDisciplina(tema.disciplinaId) }} title={nombreDisciplina(tema.disciplinaId)} />
      <span className={`min-w-0 flex-1 ${estudiado ? 'line-through texto-suave' : ''}`}>
        {tema.nombre} <span className="text-xs texto-suave">· {unidadPorId(tema.unidadId)?.sigla} · {nombreDisciplina(tema.disciplinaId)}</span>
      </span>
      <Link className="btn-fantasma !p-1.5" to={`/chat?alcance=tema&id=${tema.id}`} aria-label={`Preguntar sobre ${tema.nombre}`}><Icono nombre="chat" className="h-4 w-4" /></Link>
      <Link className="btn-fantasma !p-1.5" to={`/resumen/${tema.id}`} aria-label={`Escuchar un resumen de ${tema.nombre}`}><Icono nombre="parlante" className="h-4 w-4" /></Link>
      <Link className="btn-fantasma !p-1.5" to={`/tarjetas/generar?alcance=tema&id=${tema.id}&n=10`} aria-label={`Tarjetas de ${tema.nombre}`}><Icono nombre="tarjetas" className="h-4 w-4" /></Link>
    </li>
  )
}

/** Contenido de un día del plan. */
export function DiaDelPlan({ dia, plan, temas, estudiados }: { dia: DiaPlan; plan: PlanParcial; temas: Tema[]; estudiados: Record<string, number> }) {
  const lista = dia.temaIds.map((id) => temas.find((t) => t.id === id)).filter((t): t is Tema => !!t)
  if (dia.tipo === 'parcial') {
    return (
      <div className="space-y-2 text-sm">
        <p className="font-medium">¡{plan.parcial.nombre}! Éxitos.</p>
        {lista.length > 0 && <><p className="texto-suave">Quedaron sin marcar como estudiados:</p><ul className="space-y-1.5">{lista.map((t) => <FilaTema key={t.id} tema={t} estudiado={!!estudiados[t.id]} />)}</ul></>}
      </div>
    )
  }
  if (dia.tipo === 'repaso') {
    return (
      <div className="space-y-2 text-sm">
        <p><b>Repaso general:</b> tarjetas vencidas y un simulacro del {plan.parcial.nombre.toLowerCase()}.</p>
        <div className="flex flex-wrap gap-2">
          <Link className="btn-secundario !py-1.5 text-xs" to={`/practica/simulacro?ups=${plan.parcial.unidadIds.join(',')}`}><Icono nombre="check" className="h-4 w-4" />Simulacro</Link>
          <Link className="btn-secundario !py-1.5 text-xs" to="/repaso"><Icono nombre="tarjetas" className="h-4 w-4" />Repasar tarjetas</Link>
        </div>
        {lista.length > 0 && <><p className="texto-suave">Reforzá tus temas flojos:</p><ul className="space-y-1.5">{lista.map((t) => <FilaTema key={t.id} tema={t} estudiado={!!estudiados[t.id]} />)}</ul></>}
      </div>
    )
  }
  if (!lista.length) return <p className="text-sm texto-suave">Día liviano: repasá tus tarjetas o adelantá un tema.</p>
  return <ul className="space-y-1.5">{lista.map((t) => <FilaTema key={t.id} tema={t} estudiado={!!estudiados[t.id]} />)}</ul>
}
