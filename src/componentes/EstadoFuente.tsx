import { reintentar } from '../procesamiento/importar'
import type { Fuente } from '../repositorio/tipos'

const ETIQUETA: Record<Fuente['estado'], string> = { en_cola: 'En cola', procesando: 'Procesando', listo: 'Listo', error: 'Error' }
const COLOR: Record<Fuente['estado'], string> = {
  en_cola: 'bg-slate-500/15 text-slate-600 dark:text-slate-300',
  procesando: 'bg-sky-500/15 text-sky-700 dark:text-sky-300',
  listo: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  error: 'bg-red-500/15 text-red-700 dark:text-red-300',
}

export function EstadoFuente({ f }: { f: Fuente }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${COLOR[f.estado]}`}>{ETIQUETA[f.estado]}</span>
        {f.estado === 'procesando' && <span className="truncate text-xs texto-suave">{f.etapa}</span>}
        {f.estado === 'error' && <button className="text-xs font-medium text-marca underline dark:text-marca-claro" onClick={() => reintentar(f.id)}>Reintentar</button>}
      </div>
      {(f.estado === 'procesando' || f.estado === 'en_cola') && (
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10" role="progressbar" aria-valuenow={Math.round(f.progreso * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-marca transition-all" style={{ width: `${Math.round(f.progreso * 100)}%` }} />
        </div>
      )}
      {f.error && <p className="text-xs text-red-600 dark:text-red-400">{f.error}</p>}
    </div>
  )
}
