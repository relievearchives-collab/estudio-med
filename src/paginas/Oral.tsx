import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CitaSup } from '../componentes/Citas'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { Markdown } from '../componentes/Markdown'
import { describirAlcance, SelectorAlcance } from '../componentes/SelectorAlcance'
import { callarVoz, hayDictado, hayLectura, leerEnVozAlta, useDictado } from '../componentes/voz'
import { paqueteActivo } from '../contenido'
import { orales as repoOrales } from '../repositorio'
import { useFuentes, useOral, useOrales, useTemas } from '../repositorio/hooks'
import type { Alcance, ExamenOral, PreguntaOral } from '../repositorio/tipos'
import { APROBADO, crearExamen, responder, siguiente } from '../oral/examen'

const colorNota = (n: number) => (n >= 8 ? 'text-green-700 dark:text-green-400' : n >= APROBADO ? 'text-marca dark:text-marca-claro' : 'text-red-600 dark:text-red-400')
const formatoNota = (n: number) => String(n).replace('.', ',')

function AvisoError({ texto }: { texto: string }) {
  return <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />{texto}</p>
}

// ───────────────────────── Inicio ─────────────────────────

export function OralInicio() {
  const [params] = useSearchParams()
  // ?alcance=unidad|tema&id=… preselecciona (desde una UP o un tema).
  const [alcance, setAlcance] = useState<Alcance>(() => {
    const id = params.get('id')
    if (params.get('alcance') === 'tema' && id) return { tipo: 'tema', temaId: id }
    return { tipo: 'unidad', unidadId: (params.get('alcance') === 'unidad' && id) || paqueteActivo.unidades[0].id }
  })
  const [cantidad, setCantidad] = useState(3)
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const temas = useTemas() ?? []
  const fuentes = useFuentes() ?? []
  const anteriores = useOrales() ?? []
  const navegar = useNavigate()

  const empezar = async () => {
    setCreando(true); setError('')
    try {
      const titulo = describirAlcance(alcance, new Map(temas.map((t) => [t.id, t.nombre])), new Map(fuentes.map((f) => [f.id, f.nombre])))
      navegar(`/oral/${(await crearExamen(alcance, titulo, cantidad)).id}`)
    } catch (e) { setError((e as Error).message) } finally { setCreando(false) }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Examen oral" subtitulo="Te pregunta, te repregunta y te califica, como en el oral" />
      <section className="tarjeta space-y-3 p-4">
        <p className="text-sm">Las preguntas salen de tus fuentes. Respondé hablando{hayDictado ? '' : ' (en este navegador no hay dictado: escribí)'}; si te falta algo, el examinador te repregunta una vez. La nota la calcula la app según los puntos clave que cubriste.</p>
        <div className="space-y-1"><p className="text-xs font-semibold texto-suave">¿De qué?</p><SelectorAlcance valor={alcance} alCambiar={setAlcance} /></div>
        <div className="space-y-1">
          <p className="text-xs font-semibold texto-suave">Preguntas</p>
          <div className="flex gap-2">
            {[3, 5, 8].map((n) => <button key={n} className={cantidad === n ? 'btn-primario' : 'btn-secundario'} onClick={() => setCantidad(n)}>{n}</button>)}
          </div>
        </div>
        <button className="btn-primario" disabled={creando} onClick={empezar}><Icono nombre="mic" /> {creando ? 'Preparando preguntas…' : 'Empezar el oral'}</button>
      </section>
      {error && <AvisoError texto={error} />}
      {anteriores.length > 0 && (
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-sm font-semibold">Orales anteriores</h2>
          <ul className="space-y-1.5 text-sm">
            {anteriores.slice(0, 10).map((x) => (
              <li key={x.id} className="flex items-center gap-2">
                <Link className="min-w-0 flex-1 truncate text-marca underline dark:text-marca-claro" to={`/oral/${x.id}`}>{x.titulo}</Link>
                <span className="texto-suave">{new Date(x.creado).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
                {x.nota !== undefined ? <b className={colorNota(x.nota)}>{formatoNota(x.nota)}</b> : <span className="text-xs texto-suave">sin terminar</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ───────────────────────── Examen ─────────────────────────

export function OralExamen() {
  const { id = '' } = useParams()
  const ex = useOral(id)
  const navegar = useNavigate()
  if (ex === undefined) return <p className="p-4 texto-suave">Cargando…</p>
  if (ex === null) return <p className="p-4">No encontré ese examen. <Link className="text-marca underline" to="/oral">Volver</Link></p>
  const borrar = async () => {
    if (!confirm('¿Borrar este examen oral?')) return
    await repoOrales.borrar(ex.id)
    navegar('/oral', { replace: true })
  }
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado
        volver titulo="Examen oral" subtitulo={ex.titulo}
        acciones={<button className="btn-fantasma" onClick={borrar} aria-label="Borrar examen"><Icono nombre="basura" /></button>}
      />
      {ex.terminado ? <Resultado ex={ex} /> : <PreguntaEnCurso key={ex.actual} ex={ex} />}
    </div>
  )
}

function PreguntaEnCurso({ ex }: { ex: ExamenOral }) {
  const p = ex.preguntas[ex.actual]
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState('')
  const [leerSolo, setLeerSolo] = useState(hayLectura)
  const dictado = useDictado((t) => setTexto((x) => (x ? x + ' ' : '') + t))
  const leido = useRef(-1)
  const fin = useRef<HTMLDivElement>(null)
  const ultimo = p.turnos[p.turnos.length - 1]
  const calificada = p.nota !== undefined

  // Lee en voz alta cada pregunta o repregunta nueva del examinador (una sola vez).
  useEffect(() => {
    if (leerSolo && !calificada && ultimo.rol === 'examinador' && leido.current !== p.turnos.length) {
      leido.current = p.turnos.length
      leerEnVozAlta(ultimo.texto)
    }
    fin.current?.scrollIntoView({ block: 'end' })
  }, [p.turnos.length, leerSolo, calificada, ultimo])
  useEffect(() => () => { callarVoz() }, [])

  const enviar = async (t: string, reintento = false) => {
    if (dictado.escuchando) dictado.alternar()
    callarVoz()
    setPensando(true); setError('')
    try { await responder(ex.id, t, { reintento }); setTexto('') } catch (e) { setError((e as Error).message) } finally { setPensando(false) }
  }
  const esperandoRespuesta = !calificada && ultimo.rol === 'examinador'
  const reintentar = !calificada && ultimo.rol === 'estudiante' && !pensando

  return (
    <>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">Pregunta {ex.actual + 1} de {ex.preguntas.length}</span>
        {hayLectura && <label className="flex items-center gap-2"><input type="checkbox" checked={leerSolo} onChange={(e) => setLeerSolo(e.target.checked)} />Leer las preguntas en voz alta</label>}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-black/10 dark:bg-white/10"><div className="h-full bg-marca" style={{ width: `${(ex.actual / ex.preguntas.length) * 100}%` }} /></div>

      <section className="space-y-3">
        {p.turnos.map((t, i) => t.rol === 'examinador'
          ? (
            <div key={i} className="tarjeta flex max-w-[92%] items-start gap-2 p-3">
              <div className="min-w-0 flex-1"><p className="mb-1 text-xs font-semibold texto-suave">{i === 0 ? 'Examinador' : 'Repregunta'}</p><p className="text-[15px]">{t.texto}</p></div>
              {hayLectura && <button className="btn-fantasma !p-1.5" onClick={() => leerEnVozAlta(t.texto)} aria-label="Escuchar de nuevo"><Icono nombre="parlante" className="h-4 w-4" /></button>}
            </div>
          )
          : <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-marca px-4 py-2 text-sm text-white">{t.texto}</div></div>)}
        {pensando && <p className="animate-pulse text-sm texto-suave">El examinador está evaluando tu respuesta…</p>}
        <div ref={fin} />
      </section>

      {error && <AvisoError texto={error} />}
      {reintentar && <button className="btn-secundario" onClick={() => enviar(ultimo.texto, true)}>Reintentar la evaluación</button>}

      {esperandoRespuesta && !pensando && (
        <section className="tarjeta space-y-3 p-4">
          {hayDictado && (
            <button
              className={`flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-semibold ${dictado.escuchando ? 'animate-pulse bg-red-600 text-white' : 'bg-marca text-white'}`}
              onClick={() => { callarVoz(); dictado.alternar() }}
            >
              <Icono nombre="mic" /> {dictado.escuchando ? 'Escuchando… tocá para pausar' : texto ? 'Seguir hablando' : 'Responder hablando'}
            </button>
          )}
          <textarea className="campo min-h-[6rem]" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={hayDictado ? 'Tu respuesta aparece acá (podés corregirla)…' : 'Escribí tu respuesta…'} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" disabled={!texto.trim()} onClick={() => enviar(texto)}><Icono nombre="enviar" /> Entregar respuesta</button>
            <button className="btn-fantasma" onClick={() => enviar('No sé.')}>No sé</button>
          </div>
        </section>
      )}

      {calificada && (
        <>
          <Devolucion p={p} />
          <button className="btn-primario" onClick={() => siguiente(ex.id)}>
            {ex.actual < ex.preguntas.length - 1 ? <>Siguiente pregunta <Icono nombre="der" /></> : 'Ver el resultado'}
          </button>
        </>
      )}
    </>
  )
}

function Devolucion({ p }: { p: PreguntaOral }) {
  return (
    <section className="tarjeta space-y-3 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Devolución</h2>
        <span className={`text-2xl font-bold ${colorNota(p.nota!)}`}>{formatoNota(p.nota!)}</span>
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold texto-suave">Puntos clave</p>
        <ul className="space-y-1 text-sm">
          {p.puntos.map((x, i) => {
            const ok = p.cubiertos.includes(i)
            const conAyuda = ok && !(p.cubiertosPrimera ?? []).includes(i)
            return (
              <li key={i} className="flex items-start gap-2">
                <span className={ok ? 'text-green-600' : 'text-red-600'}>{ok ? '✓' : '✗'}</span>
                <span className="flex-1">{x}{conAyuda && <span className="ml-1 text-xs texto-suave">(después de la repregunta)</span>}</span>
              </li>
            )
          })}
        </ul>
      </div>
      {p.errores.length > 0 && (
        <div className="rounded-xl bg-red-500/10 p-3 text-sm">
          <p className="mb-1 font-medium">Errores conceptuales</p>
          <ul className="list-disc space-y-1 pl-5">{p.errores.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
      <div className="space-y-2 text-[15px]">
        {(p.devolucion ?? []).map((s, i) => <p key={i}><Markdown texto={s.texto} enLinea />{s.citas.map((c, k) => <CitaSup key={k} cita={c} numero={c.n} />)}</p>)}
      </div>
      <p className="text-xs texto-suave">Nota: proporción de puntos clave cubiertos (los que salieron después de la repregunta valen 70 %), menos 1,5 por error conceptual.</p>
    </section>
  )
}

function Resultado({ ex }: { ex: ExamenOral }) {
  const navegar = useNavigate()
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const otro = async () => {
    setCreando(true); setError('')
    try { navegar(`/oral/${(await crearExamen(ex.alcance, ex.titulo, ex.preguntas.length)).id}`) } catch (e) { setError((e as Error).message) } finally { setCreando(false) }
  }
  return (
    <>
      <section className="tarjeta space-y-2 p-6 text-center">
        <p className="text-sm texto-suave">Nota final</p>
        <p className={`text-5xl font-bold ${colorNota(ex.nota ?? 0)}`}>{formatoNota(ex.nota ?? 0)}</p>
        <p className="text-sm">{(ex.nota ?? 0) >= APROBADO ? '¡Aprobado!' : 'Todavía no: repasá lo que faltó y volvé a intentarlo.'}</p>
      </section>
      <section className="tarjeta p-4">
        <ul className="space-y-3">
          {ex.preguntas.map((p, i) => (
            <li key={i}>
              <details>
                <summary className="flex cursor-pointer items-start gap-2 text-sm">
                  <span className="min-w-0 flex-1">{i + 1}. {p.enunciado}</span>
                  {p.nota !== undefined && <b className={colorNota(p.nota)}>{formatoNota(p.nota)}</b>}
                </summary>
                <div className="mt-2"><Devolucion p={p} /></div>
              </details>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" disabled={creando} onClick={otro}>{creando ? 'Preparando…' : 'Otro oral del mismo tema'}</button>
        <Link className="btn-secundario" to="/oral">Elegir otro tema</Link>
      </div>
      {error && <AvisoError texto={error} />}
    </>
  )
}
