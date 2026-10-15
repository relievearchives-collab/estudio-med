import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { Icono } from '../componentes/Icono'
import { fragmentos as repoFragmentos, preguntas as repoPreguntas } from '../repositorio'
import { useFuentes } from '../repositorio/hooks'
import { fmt } from '../simuladores/ejercicios'
import { esCorrecta, type Item } from './sesion'
import { tarjetaDeItem } from './tarjeta'

/**
 * Un ítem de práctica. Con `corregido` muestra la corrección (explicación de cada opción, cita a la fuente,
 * "Hacer tarjeta" si estuvo mal y "Reportar"). En el simulacro se muestra sin corrección hasta el final.
 */
export function ItemPractica({ item, respuesta, alResponder, corregido, numero, modo = 'practica' }: {
  item: Item
  /** práctica: se responde y se corrige al toque; examen (simulacro): se guarda la respuesta sin corregir. */
  modo?: 'practica' | 'examen'
  respuesta: string | number | undefined
  alResponder: (r: string | number) => void
  corregido: boolean
  numero?: number
}) {
  const [texto, setTexto] = useState(typeof respuesta === 'string' ? respuesta : '')
  const [tarjetaHecha, setTarjetaHecha] = useState(false)
  const [reportada, setReportada] = useState(item.tipo === 'pregunta' && !!item.pregunta.reportada)
  const { abrirVisor, avisar } = useApp()
  const fuentes = useFuentes() ?? []
  const ok = corregido && esCorrecta(item, respuesta)
  const enunciado = item.tipo === 'pregunta' ? item.pregunta.enunciado : item.ejercicio.enunciado

  const verFuente = async () => {
    if (item.tipo !== 'pregunta' || !item.pregunta.fragmentoId) return
    const f = await repoFragmentos.obtener(item.pregunta.fragmentoId)
    if (f) abrirVisor({ fuenteId: f.fuenteId, pagina: f.pagina, objetivo: { frase: item.pregunta.verificada ? item.pregunta.frase : undefined, inicio: f.inicio, fin: f.fin } })
  }

  return (
    <div className="space-y-3">
      <p className="text-[15px] leading-relaxed">
        {numero !== undefined && <span className="mr-1 font-semibold text-marca dark:text-marca-claro">{numero}.</span>}
        {enunciado}
        {item.tipo === 'ejercicio' && <span className="ml-2 chip !py-0 align-middle">ejercicio numérico</span>}
      </p>

      {item.tipo === 'pregunta' || item.ejercicio.tipo === 'opcion' ? (
        <div className="grid gap-2">
          {(item.tipo === 'pregunta' ? item.orden : item.ejercicio.tipo === 'opcion' ? item.ejercicio.opciones.map((_, i) => i) : []).map((k) => {
            const textoOpcion = item.tipo === 'pregunta' ? item.pregunta.opciones[k].texto : item.ejercicio.tipo === 'opcion' ? item.ejercicio.opciones[k] : ''
            const correctaIdx = item.tipo === 'pregunta' ? item.pregunta.correcta : item.ejercicio.tipo === 'opcion' ? item.ejercicio.correcta : -1
            const elegida = String(respuesta) === String(k)
            const marca = corregido ? (k === correctaIdx ? 'border-emerald-500 bg-emerald-500/10' : elegida ? 'border-red-500 bg-red-500/10' : '') : elegida ? 'border-marca bg-marca/10' : ''
            return (
              <button key={k} disabled={corregido} onClick={() => alResponder(k)} className={`rounded-xl border px-3 py-2 text-left text-sm borde hover:bg-black/5 dark:hover:bg-white/5 ${marca}`}>
                <span>{textoOpcion}</span>
                {corregido && item.tipo === 'pregunta' && item.pregunta.opciones[k].explicacion && (k === correctaIdx || elegida) && (
                  <span className="mt-1 block text-xs texto-suave">{item.pregunta.opciones[k].explicacion}</span>
                )}
              </button>
            )
          })}
        </div>
      ) : (
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) alResponder(texto) }}>
          <input className="campo !w-40" inputMode="decimal" value={texto} disabled={corregido} onChange={(e) => { setTexto(e.target.value); if (modo === 'examen') alResponder(e.target.value) }} placeholder="Tu resultado" aria-label="Tu resultado" />
          <span className="text-sm texto-suave">{item.ejercicio.unidad}</span>
          {modo === 'practica' && !corregido && <button className="btn-primario" disabled={!texto.trim()}>Responder</button>}
        </form>
      )}

      {corregido && (
        <div className={`space-y-2 rounded-xl p-3 text-sm ${ok ? 'bg-emerald-500/10' : 'bg-red-500/10'}`}>
          <p className="font-semibold">{ok ? '✓ Correcto' : respuesta === undefined || respuesta === '' ? '— Sin responder' : '✗ Incorrecto'}
            {item.tipo === 'ejercicio' && item.ejercicio.tipo === 'numero' && !ok && <span className="font-normal"> · respuesta: {fmt(item.ejercicio.respuesta, item.ejercicio.decimales)} {item.ejercicio.unidad}</span>}
          </p>
          {item.tipo === 'pregunta' && item.pregunta.explicacion && <p>{item.pregunta.explicacion}</p>}
          {item.tipo === 'ejercicio' && <ol className="list-inside list-decimal space-y-0.5 texto-suave">{item.ejercicio.resolucion.map((p, i) => <li key={i}>{p}</li>)}</ol>}
          <div className="flex flex-wrap gap-2 pt-1">
            {item.tipo === 'pregunta' && item.pregunta.fragmentoId && (
              <button className={`btn-fantasma !px-2 !py-1 text-xs ${item.pregunta.verificada ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`} onClick={verFuente}>
                <Icono nombre="pdf" className="h-4 w-4" />{item.pregunta.verificada ? '✓ ' : ''}{fuentes.find((f) => f.id === item.pregunta.fuenteId)?.nombre ?? 'Fuente'}, pág. {item.pregunta.pagina}
              </button>
            )}
            {!ok && (
              <button className="btn-secundario !px-2 !py-1 text-xs" disabled={tarjetaHecha} onClick={async () => { await tarjetaDeItem(item); setTarjetaHecha(true); avisar('Tarjeta creada: ya está en tu cola de repaso', 'ok') }}>
                <Icono nombre="tarjetas" className="h-4 w-4" />{tarjetaHecha ? 'Tarjeta creada' : 'Hacer tarjeta'}
              </button>
            )}
            {item.tipo === 'pregunta' && (reportada ? (
              <Link className="btn-fantasma !px-2 !py-1 text-xs text-amber-700 dark:text-amber-400" to={`/practica/banco?editar=${item.pregunta.id}`}>Reportada · editar o regenerar</Link>
            ) : (
              <button className="btn-fantasma !px-2 !py-1 text-xs" onClick={async () => {
                const motivo = prompt('¿Qué tiene de malo esta pregunta? (ej. respuesta incorrecta, confusa, fuera del programa)')
                if (!motivo?.trim()) return
                await repoPreguntas.reportar(item.pregunta.id, motivo.trim())
                setReportada(true)
                avisar('Pregunta reportada: no va a aparecer en los simulacros hasta que la edites o regeneres', 'info')
              }}><Icono nombre="alerta" className="h-4 w-4" />Reportar pregunta</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
