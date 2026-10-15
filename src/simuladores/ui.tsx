import { useState, type ReactNode } from 'react'
import { useApp } from '../componentes/Contexto'
import { Icono } from '../componentes/Icono'
import { paqueteActivo } from '../contenido'
import { intentos } from '../repositorio'
import { useFuentes } from '../repositorio/hooks'
import { azarConSemilla, corregir, fmt, nuevoEjercicio, type Ejercicio } from './ejercicios'

/** Deslizador con su valor y unidad (se puede tipear el número). */
export function Deslizador({ etiqueta, valor, min, max, paso = 1, unidad = '', decimales = 0, alCambiar, ayuda }: {
  etiqueta: string; valor: number; min: number; max: number; paso?: number; unidad?: string; decimales?: number; alCambiar: (v: number) => void; ayuda?: string
}) {
  return (
    <label className="block text-sm">
      <span className="flex items-baseline justify-between gap-2">
        <span className="font-medium">{etiqueta}</span>
        <span className="flex items-baseline gap-1 tabular-nums">
          <input
            type="number" className="campo !w-20 !px-2 !py-0.5 text-right text-sm" value={Number(valor.toFixed(decimales))} min={min} max={max} step={paso}
            onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) alCambiar(Math.min(max, Math.max(min, v))) }}
            aria-label={etiqueta}
          />
          <span className="w-16 text-xs texto-suave">{unidad}</span>
        </span>
      </span>
      <input type="range" min={min} max={max} step={paso} value={valor} onChange={(e) => alCambiar(Number(e.target.value))} className="mt-1 w-full accent-[var(--color-marca)]" aria-label={`${etiqueta} (deslizador)`} />
      {ayuda && <span className="block text-xs texto-suave">{ayuda}</span>}
    </label>
  )
}

/** Resultado destacado. */
export function Dato({ etiqueta, valor, unidad, decimales = 1, tono, nota }: {
  etiqueta: string; valor: number | string; unidad?: string; decimales?: number; tono?: 'bien' | 'alerta' | 'mal'; nota?: string
}) {
  const color = tono === 'mal' ? 'text-red-600' : tono === 'alerta' ? 'text-amber-600' : tono === 'bien' ? 'text-emerald-600' : ''
  return (
    <div className="rounded-xl border p-2.5 borde">
      <div className="text-xs texto-suave">{etiqueta}</div>
      <div className={`text-lg font-bold tabular-nums ${color}`}>{typeof valor === 'number' ? fmt(valor, decimales) : valor}{unidad && <span className="ml-1 text-xs font-normal texto-suave">{unidad}</span>}</div>
      {nota && <div className="text-xs texto-suave">{nota}</div>}
    </div>
  )
}

export function Panel({ titulo, children, className = '' }: { titulo?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`tarjeta space-y-3 p-4 ${className}`}>
      {titulo && <h2 className="text-sm font-semibold">{titulo}</h2>}
      {children}
    </section>
  )
}

/** "Ver en la guía, pág. N" para el tema del simulador (si la guía está importada). */
export function CitasGuia({ simulador }: { simulador: string }) {
  const vinculo = paqueteActivo.simuladores.find((s) => s.simulador === simulador)
  const guia = (useFuentes() ?? []).find((f) => f.esGuia)
  const { abrirVisor } = useApp()
  if (!vinculo?.paginasGuia.length) return null
  return (
    <p className="flex flex-wrap items-center gap-1 text-xs">
      <span className="texto-suave">En la guía:</span>
      {vinculo.paginasGuia.map((p) => guia
        ? <button key={p} className="chip hover:bg-black/5 dark:hover:bg-white/5" onClick={() => abrirVisor({ fuenteId: guia.id, pagina: p })}>pág. {p}</button>
        : <span key={p} className="chip opacity-70">pág. {p}</span>)}
      {!guia && <span className="texto-suave">(importá la guía para abrirlas)</span>}
    </p>
  )
}

/** Ejercicio con valores al azar, corregido por código; guarda el intento para el mapa de calor. */
export function EjercicioSim({ simulador }: { simulador: string }) {
  const [e, setE] = useState<Ejercicio>(() => nuevoEjercicio(simulador))
  const [respuesta, setRespuesta] = useState('')
  const [resultado, setResultado] = useState<boolean | null>(null)
  const [ejemplo, setEjemplo] = useState(false)
  const vinculo = paqueteActivo.simuladores.find((s) => s.simulador === simulador)

  const nuevo = () => { setE(nuevoEjercicio(simulador)); setRespuesta(''); setResultado(null) }
  const responder = async (r: string) => {
    if (resultado !== null) return
    const ok = corregir(e, r)
    setResultado(ok)
    await intentos.registrar([{
      origen: 'ejercicio', simulador, enunciado: e.enunciado, respuesta: r, correcta: ok,
      unidadId: vinculo?.unidadIds[0], disciplinaId: vinculo?.disciplinaId, temaId: vinculo?.temaIds[0],
    }])
  }
  const ej = ejemplo ? nuevoEjercicio(simulador, azarConSemilla(42)) : null

  return (
    <Panel titulo={<span className="flex items-center gap-2"><Icono nombre="check" className="h-4 w-4" />Ejercicio</span>}>
      <p className="text-sm leading-relaxed">{e.enunciado}</p>
      {e.tipo === 'numero' ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(ev) => { ev.preventDefault(); if (respuesta.trim()) responder(respuesta) }}>
          <input className="campo !w-40" inputMode="decimal" placeholder="Tu resultado" value={respuesta} disabled={resultado !== null} onChange={(ev) => setRespuesta(ev.target.value)} aria-label="Tu resultado" />
          <span className="text-sm texto-suave">{e.unidad}</span>
          <button className="btn-primario" disabled={!respuesta.trim() || resultado !== null}>Corregir</button>
        </form>
      ) : (
        <div className="grid gap-2">
          {e.opciones.map((o, i) => {
            const marcar = resultado !== null && (i === e.correcta ? 'border-emerald-500 bg-emerald-500/10' : String(i) === respuesta ? 'border-red-500 bg-red-500/10' : '')
            return <button key={i} className={`rounded-xl border px-3 py-2 text-left text-sm borde hover:bg-black/5 dark:hover:bg-white/5 ${marcar || ''}`} disabled={resultado !== null} onClick={() => { setRespuesta(String(i)); responder(String(i)) }}>{o}</button>
          })}
        </div>
      )}
      {resultado !== null && (
        <div className={`rounded-xl p-3 text-sm ${resultado ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <p className="font-semibold">{resultado ? '✓ ¡Correcto!' : `✗ No. ${e.tipo === 'numero' ? `La respuesta es ${fmt(e.respuesta, e.decimales)} ${e.unidad}.` : `Era: ${e.opciones[e.correcta]}.`}`}</p>
          <ol className="mt-1 list-inside space-y-1 texto-suave">{e.resolucion.map((p, i) => <li key={i}>{p}</li>)}</ol>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secundario" onClick={nuevo}>Ejercicio nuevo</button>
        <button className="btn-fantasma text-xs" onClick={() => setEjemplo((v) => !v)}>{ejemplo ? 'Ocultar ejemplo' : 'Ver un ejemplo resuelto'}</button>
      </div>
      {ej && (
        <div className="rounded-xl border border-dashed p-3 text-sm borde">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide texto-suave">Ejemplo resuelto</p>
          <p>{ej.enunciado}</p>
          <ol className="mt-1 list-inside list-decimal space-y-1 texto-suave">{ej.resolucion.map((p, i) => <li key={i}>{p}</li>)}</ol>
          <p className="mt-1 font-semibold">Respuesta: {ej.tipo === 'numero' ? `${fmt(ej.respuesta, ej.decimales)} ${ej.unidad}` : ej.opciones[ej.correcta]}</p>
        </div>
      )}
      <p className="text-[11px] texto-suave">Los valores y la corrección los calcula la app con fórmulas testeadas, no la IA.</p>
    </Panel>
  )
}

/** Barra horizontal simple con escala (para comparar volúmenes, cargas, etc.). */
export function Barra({ etiqueta, valor, maximo, color = 'bg-marca', texto }: { etiqueta: string; valor: number; maximo: number; color?: string; texto: string }) {
  return (
    <div className="text-xs">
      <div className="mb-0.5 flex justify-between"><span>{etiqueta}</span><span className="tabular-nums texto-suave">{texto}</span></div>
      <div className="h-3 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
        <div className={`h-full rounded-full ${color} transition-all duration-300`} style={{ width: `${Math.max(0, Math.min(100, (valor / maximo) * 100))}%` }} />
      </div>
    </div>
  )
}
