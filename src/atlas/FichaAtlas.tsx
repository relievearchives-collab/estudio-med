import { useEffect, useState } from 'react'
import { buscarTexto } from '../busqueda/hibrida'
import { useApp } from '../componentes/Contexto'
import { Icono } from '../componentes/Icono'
import { fichasAtlas } from '../repositorio'
import { useFichaEditada, useFuentes } from '../repositorio/hooks'
import type { Fragmento } from '../repositorio/tipos'
import { fichaDePieza, type PiezaEscena } from './datos'

const CAMPOS: [keyof ReturnType<typeof fichaDePieza>, string][] = [
  ['descripcion', 'Descripción'], ['relaciones', 'Relaciones'], ['irrigacion', 'Irrigación'], ['inervacion', 'Inervación'],
  ['reabsorbe', 'Reabsorbe'], ['secreta', 'Secreta'], ['fisiologia', 'Fisiología'],
]
const EDITABLES = ['descripcion', 'relaciones', 'irrigacion', 'inervacion', 'reabsorbe', 'secreta', 'fisiologia'] as const

/** Nombre corto para buscar en los apuntes ("Músculo psoas mayor" → "psoas mayor"). */
function terminoBusqueda(nombre: string) {
  return nombre.replace(/^(músculo|glándula|nervio|hueso)\s+/i, '').replace(/\s*\(.*\)$/, '')
}

/**
 * Ficha de una estructura del atlas: datos anatómicos (editables), aviso si no fue revisada,
 * fragmentos de los apuntes que la mencionan (con cita clicable) y acciones.
 */
export function FichaAtlas({ pieza, alPreguntar, alCrearTarjeta, alCentrar, conTitulo = true }: {
  pieza: PiezaEscena
  /** En la hoja del celular el título ya está arriba. */
  conTitulo?: boolean
  alPreguntar: (nombre: string) => void
  alCrearTarjeta: () => Promise<void>
  alCentrar: () => void
}) {
  const editada = useFichaEditada(pieza.ficha)
  const f = fichaDePieza(pieza, editada?.cambios)
  const revisado = editada?.revisado ?? f.revisado
  const [editando, setEditando] = useState<Record<string, string> | null>(null)
  const [frags, setFrags] = useState<Fragmento[]>([])
  const [creando, setCreando] = useState(false)
  const fuentes = useFuentes() ?? []
  const { abrirVisor, avisar } = useApp()

  useEffect(() => {
    let vivo = true
    buscarTexto(terminoBusqueda(f.nombre), 4).then((r) => { if (vivo) setFrags(r) }).catch(() => {})
    return () => { vivo = false }
  }, [f.nombre])

  if (editada === undefined) return null
  const nombreFuente = (id: string) => fuentes.find((x) => x.id === id)?.nombre ?? 'Fuente'

  return (
    <div className="space-y-3 p-4 text-sm">
      <div>
        {conTitulo && <h2 className="text-lg font-bold leading-tight">{f.titulo}</h2>}
        <p className="italic texto-suave">{f.latin}</p>
      </div>
      {!revisado && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          <Icono nombre="alerta" className="mt-px h-3.5 w-3.5 shrink-0" />Texto generado: verificalo con Rouvière y marcalo como revisado.
        </p>
      )}

      {editando ? (
        <div className="space-y-2">
          {EDITABLES.filter((k) => f[k] !== undefined).map((k) => (
            <label key={k} className="block text-xs font-medium">
              {CAMPOS.find((c) => c[0] === k)?.[1]}
              <textarea className="campo mt-1 min-h-[3.5rem] text-sm" value={editando[k] ?? ''} onChange={(e) => setEditando({ ...editando, [k]: e.target.value })} />
            </label>
          ))}
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" onClick={async () => { await fichasAtlas.guardar(pieza.ficha, editando, true); setEditando(null); avisar('Ficha guardada y marcada como revisada', 'ok') }}>Guardar</button>
            <button className="btn-secundario" onClick={() => setEditando(null)}>Cancelar</button>
          </div>
        </div>
      ) : (
        <dl className="space-y-2">
          {CAMPOS.map(([k, titulo]) => {
            const valor = f[k] as string | undefined
            if (!valor || valor === '—') return null
            return (
              <div key={k}>
                <dt className="text-xs font-semibold uppercase tracking-wide texto-suave">{titulo}</dt>
                <dd className="leading-relaxed">{valor}</dd>
              </div>
            )
          })}
          {f.simulador && (
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide texto-suave">Simulador</dt>
              <dd><span className="chip opacity-60" title="Los simuladores llegan en la Fase 4">{f.simulador} · próximamente</span></dd>
            </div>
          )}
        </dl>
      )}

      {frags.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide texto-suave">En tus apuntes</p>
          <ul className="space-y-1">
            {frags.map((fr) => (
              <li key={fr.id}>
                <button className="w-full rounded-lg border px-2 py-1.5 text-left text-xs hover:bg-black/5 borde dark:hover:bg-white/5" onClick={() => abrirVisor({ fuenteId: fr.fuenteId, pagina: fr.pagina, objetivo: { frase: terminoBusqueda(f.nombre), inicio: fr.inicio, fin: fr.fin } })}>
                  <span className="font-semibold text-marca dark:text-marca-claro">{nombreFuente(fr.fuenteId)}, pág. {fr.pagina}</span>
                  <span className="line-clamp-2 texto-suave">{fr.texto.slice(0, 200)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2 border-t pt-3 borde">
        <button className="btn-secundario !py-1.5 text-xs" onClick={() => alPreguntar(f.titulo)}><Icono nombre="chat" className="h-4 w-4" />Preguntarle a mis apuntes</button>
        <button className="btn-secundario !py-1.5 text-xs" disabled={creando} onClick={async () => { setCreando(true); try { await alCrearTarjeta() } finally { setCreando(false) } }}><Icono nombre="tarjetas" className="h-4 w-4" />{creando ? 'Creando…' : 'Crear tarjeta'}</button>
        <button className="btn-fantasma !py-1.5 text-xs" onClick={alCentrar}>Centrar</button>
        {!editando && <button className="btn-fantasma !py-1.5 text-xs" onClick={() => setEditando(Object.fromEntries(EDITABLES.filter((k) => f[k] !== undefined).map((k) => [k, (f[k] as string) ?? ''])))}><Icono nombre="lapiz" className="h-4 w-4" />Editar</button>}
        {!editando && !revisado && <button className="btn-fantasma !py-1.5 text-xs" onClick={() => fichasAtlas.guardar(pieza.ficha, editada?.cambios ?? {}, true)}><Icono nombre="check" className="h-4 w-4" />Marcar revisada</button>}
        {!editando && editada && <button className="btn-fantasma !py-1.5 text-xs texto-suave" onClick={() => fichasAtlas.restaurar(pieza.ficha)}>Restaurar original</button>}
      </div>
    </div>
  )
}
