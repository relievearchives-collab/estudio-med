import { nombreDisciplina, paqueteActivo, unidadPorId } from '../contenido'
import type { Alcance } from '../repositorio/tipos'
import { useFuentes, useTemas } from '../repositorio/hooks'

export function describirAlcance(a: Alcance, nombresTemas: Map<string, string>, nombresFuentes: Map<string, string>) {
  switch (a.tipo) {
    case 'unidad': { const u = unidadPorId(a.unidadId); return u ? `${u.sigla} · ${u.titulo}` : 'Unidad' }
    case 'disciplina': return nombreDisciplina(a.disciplinaId)
    case 'tema': return nombresTemas.get(a.temaId ?? '') ?? 'Tema'
    case 'fuentes': return (a.fuenteIds ?? []).map((id) => nombresFuentes.get(id)).filter(Boolean).join(', ') || 'Fuentes elegidas'
    default: return 'Todas mis fuentes'
  }
}

/** Alcance de la búsqueda: todo / una UP / una disciplina / un tema / fuentes elegidas. */
export function SelectorAlcance({ valor, alCambiar }: { valor: Alcance; alCambiar: (a: Alcance) => void }) {
  const temas = useTemas() ?? []
  const fuentes = (useFuentes() ?? []).filter((f) => f.estado === 'listo')
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <select
        className="campo !w-auto !py-1.5" value={valor.tipo} aria-label="Alcance"
        onChange={(e) => {
          const tipo = e.target.value as Alcance['tipo']
          if (tipo === 'unidad') alCambiar({ tipo, unidadId: paqueteActivo.unidades[0].id })
          else if (tipo === 'disciplina') alCambiar({ tipo, disciplinaId: 'fisiologia' })
          else if (tipo === 'tema') alCambiar({ tipo, temaId: temas[0]?.id })
          else if (tipo === 'fuentes') alCambiar({ tipo, fuenteIds: fuentes.slice(0, 1).map((f) => f.id) })
          else alCambiar({ tipo: 'todo' })
        }}
      >
        <option value="todo">Todo</option>
        <option value="unidad">Una UP</option>
        <option value="disciplina">Una disciplina</option>
        <option value="tema">Un tema</option>
        <option value="fuentes">Fuentes elegidas</option>
      </select>
      {valor.tipo === 'unidad' && (
        <select className="campo !w-auto !py-1.5" value={valor.unidadId} onChange={(e) => alCambiar({ tipo: 'unidad', unidadId: e.target.value })}>
          {paqueteActivo.unidades.map((u) => <option key={u.id} value={u.id}>{u.sigla} · {u.titulo}</option>)}
        </select>
      )}
      {valor.tipo === 'disciplina' && (
        <select className="campo !w-auto !py-1.5" value={valor.disciplinaId} onChange={(e) => alCambiar({ tipo: 'disciplina', disciplinaId: e.target.value })}>
          {paqueteActivo.disciplinas.map((d) => <option key={d.id} value={d.id}>{d.nombre}</option>)}
        </select>
      )}
      {valor.tipo === 'tema' && (
        <select className="campo !w-auto max-w-[16rem] !py-1.5" value={valor.temaId} onChange={(e) => alCambiar({ tipo: 'tema', temaId: e.target.value })}>
          {paqueteActivo.unidades.map((u) => (
            <optgroup key={u.id} label={u.sigla}>
              {temas.filter((t) => t.unidadId === u.id).map((t) => <option key={t.id} value={t.id}>{nombreDisciplina(t.disciplinaId)}: {t.nombre}</option>)}
            </optgroup>
          ))}
        </select>
      )}
      {valor.tipo === 'fuentes' && (
        <div className="flex flex-wrap gap-1">
          {fuentes.map((f) => {
            const activa = valor.fuenteIds?.includes(f.id)
            return (
              <button key={f.id} className={activa ? 'chip-activo' : 'chip'} onClick={() => {
                const ids = new Set(valor.fuenteIds ?? [])
                if (activa) ids.delete(f.id); else ids.add(f.id)
                alCambiar({ tipo: 'fuentes', fuenteIds: [...ids] })
              }}>{f.nombre}</button>
            )
          })}
        </div>
      )}
    </div>
  )
}
