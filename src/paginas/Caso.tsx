import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { CitaSup } from '../componentes/Citas'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { Markdown } from '../componentes/Markdown'
import { hayDictado, useDictado } from '../componentes/voz'
import { paqueteActivo, unidadPorId } from '../contenido'
import { crearCaso, derivadosPedidos, interpretar, proceso, revelar } from '../caso/caso'
import { APROBADO } from '../oral/examen'
import { casos as repoCasos } from '../repositorio'
import { useCaso, useCasos } from '../repositorio/hooks'
import type { CasoEnCurso, EtapaCaso } from '../repositorio/tipos'

const PASOS: { id: EtapaCaso; nombre: string }[] = [
  { id: 'interrogatorio', nombre: 'Interrogatorio' },
  { id: 'examen', nombre: 'Examen físico' },
  { id: 'estudios', nombre: 'Estudios' },
  { id: 'interpretacion', nombre: 'Interpretación' },
  { id: 'devolucion', nombre: 'Devolución' },
]

const colorNota = (n: number) => (n >= 8 ? 'text-green-700 dark:text-green-400' : n >= APROBADO ? 'text-marca dark:text-marca-claro' : 'text-red-600 dark:text-red-400')
const formatoNota = (n: number) => String(n).replace('.', ',')

function AvisoError({ texto }: { texto: string }) {
  return <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />{texto}</p>
}

function useNuevoCaso() {
  const [creando, setCreando] = useState(false)
  const [error, setError] = useState('')
  const navegar = useNavigate()
  const crear = async (unidadId: string) => {
    setCreando(true); setError('')
    try { navegar(`/caso/${(await crearCaso(unidadId)).id}`) } catch (e) { setError((e as Error).message) } finally { setCreando(false) }
  }
  return { creando, error, crear }
}

// ───────────────────────── Inicio ─────────────────────────

export function CasoInicio() {
  const [params] = useSearchParams()
  const [unidadId, setUnidadId] = useState(params.get('up') ?? paqueteActivo.unidades[0].id)
  const anteriores = useCasos() ?? []
  const { creando, error, crear } = useNuevoCaso()
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Caso clínico" subtitulo="Interrogatorio, examen físico, estudios e interpretación, paso a paso" />
      <section className="tarjeta space-y-3 p-4">
        <p className="text-sm">Un paciente ficticio basado en la situación problemática de la unidad. Elegís qué preguntarle, qué examinar y qué estudios pedir; al final interpretás. Los valores calculados (osmolaridad, anión gap, TFG, FENa, gases) los calcula la app con las fórmulas de los simuladores.</p>
        <select className="campo" value={unidadId} onChange={(e) => setUnidadId(e.target.value)} aria-label="Unidad">
          {paqueteActivo.unidades.map((u) => <option key={u.id} value={u.id}>{u.sigla} · {u.titulo}</option>)}
        </select>
        <button className="btn-primario" disabled={creando} onClick={() => crear(unidadId)}><Icono nombre="check" /> {creando ? 'Armando el caso…' : 'Nuevo caso'}</button>
      </section>
      {error && <AvisoError texto={error} />}
      {anteriores.length > 0 && (
        <section className="tarjeta p-4">
          <h2 className="mb-2 text-sm font-semibold">Casos anteriores</h2>
          <ul className="space-y-1.5 text-sm">
            {anteriores.slice(0, 10).map((c) => (
              <li key={c.id} className="flex items-center gap-2">
                <Link className="min-w-0 flex-1 truncate text-marca underline dark:text-marca-claro" to={`/caso/${c.id}`}>{unidadPorId(c.unidadId)?.sigla} · {c.caso.titulo}</Link>
                {c.evaluacion ? <b className={colorNota(c.evaluacion.nota)}>{formatoNota(c.evaluacion.nota)}</b> : <span className="text-xs texto-suave">en curso</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ───────────────────────── Caso ─────────────────────────

export function CasoPagina() {
  const { id = '' } = useParams()
  const c = useCaso(id)
  const navegar = useNavigate()
  if (c === undefined) return <p className="p-4 texto-suave">Cargando…</p>
  if (c === null) return <p className="p-4">No encontré ese caso. <Link className="text-marca underline" to="/caso">Volver</Link></p>
  const { caso } = c
  const ir = (etapa: EtapaCaso) => repoCasos.actualizar(c.id, { etapa })
  const borrar = async () => {
    if (!confirm('¿Borrar este caso?')) return
    await repoCasos.borrar(c.id)
    navegar('/caso', { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado
        volver titulo={caso.titulo} subtitulo={`Caso clínico · ${unidadPorId(c.unidadId)?.sigla ?? ''}`}
        acciones={<button className="btn-fantasma" onClick={borrar} aria-label="Borrar caso"><Icono nombre="basura" /></button>}
      />
      <section className="tarjeta space-y-1 p-4 text-[15px]">
        <p className="text-xs font-semibold texto-suave">Paciente</p>
        <p><b>{caso.paciente.sexo === 'mujer' ? 'Mujer' : 'Hombre'}, {caso.paciente.edad} años.</b> {caso.paciente.descripcion}</p>
        <p><b>Motivo de consulta:</b> {caso.motivo}</p>
        <p className="pt-1 text-xs texto-suave">Paciente ficticio, solo para estudiar.</p>
      </section>
      <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Pasos">
        {PASOS.filter((p) => p.id !== 'devolucion' || c.evaluacion).map((p, i) => (
          <button
            key={p.id} onClick={() => ir(p.id)} aria-current={c.etapa === p.id ? 'step' : undefined}
            ref={(el) => { if (el && c.etapa === p.id) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${c.etapa === p.id ? 'bg-marca font-semibold text-white' : 'bg-black/5 dark:bg-white/10'}`}
          >
            {i + 1}. {p.nombre}
          </button>
        ))}
      </nav>
      {c.etapa === 'interrogatorio' && <PasoInterrogatorio c={c} siguiente={() => ir('examen')} />}
      {c.etapa === 'examen' && <PasoExamen c={c} siguiente={() => ir('estudios')} />}
      {c.etapa === 'estudios' && <PasoEstudios c={c} siguiente={() => ir('interpretacion')} />}
      {c.etapa === 'interpretacion' && <PasoInterpretacion c={c} />}
      {c.etapa === 'devolucion' && c.evaluacion && <PasoDevolucion c={c} />}
    </div>
  )
}

function Revelable({ titulo, contenido, revelado, alRevelar, accion }: { titulo: string; contenido: ReactNode; revelado: boolean; alRevelar: () => void; accion: string }) {
  return (
    <li className="rounded-xl border border-black/10 p-3 text-sm dark:border-white/10">
      <div className="flex items-start gap-2">
        <span className="flex-1 font-medium">{titulo}</span>
        {!revelado && <button className="btn-secundario !py-1 text-xs" onClick={alRevelar}>{accion}</button>}
      </div>
      {revelado && <div className="mt-1.5">{contenido}</div>}
    </li>
  )
}

function PasoInterrogatorio({ c, siguiente }: { c: CasoEnCurso; siguiente: () => void }) {
  return (
    <section className="space-y-3">
      <p className="text-sm texto-suave">¿Qué le preguntarías? Elegí solo lo que te sirve para razonar: al final se compara con lo que era relevante.</p>
      <ul className="space-y-2">
        {c.caso.interrogatorio.map((x, i) => (
          <Revelable key={i} titulo={x.pregunta} accion="Preguntar" revelado={c.preguntados.includes(i)} alRevelar={() => revelar(c.id, 'preguntados', i)}
            contenido={<p className="italic">“{x.respuesta}”</p>} />
        ))}
      </ul>
      <button className="btn-primario" onClick={siguiente}>Seguir al examen físico <Icono nombre="der" /></button>
    </section>
  )
}

function PasoExamen({ c, siguiente }: { c: CasoEnCurso; siguiente: () => void }) {
  return (
    <section className="space-y-3">
      <p className="text-sm texto-suave">¿Qué examinás?</p>
      <ul className="space-y-2">
        {c.caso.examen.map((x, i) => (
          <Revelable key={i} titulo={x.sistema} accion="Examinar" revelado={c.examinados.includes(i)} alRevelar={() => revelar(c.id, 'examinados', i)} contenido={<p>{x.hallazgo}</p>} />
        ))}
      </ul>
      <button className="btn-primario" onClick={siguiente}>Seguir a los estudios <Icono nombre="der" /></button>
    </section>
  )
}

function PasoEstudios({ c, siguiente }: { c: CasoEnCurso; siguiente: () => void }) {
  const derivados = derivadosPedidos(c)
  return (
    <section className="space-y-3">
      <p className="text-sm texto-suave">¿Qué estudios pedís? No pidas todo: también cuenta no pedir lo que no hace falta.</p>
      <ul className="space-y-2">
        {c.caso.estudios.map((x, i) => (
          <Revelable key={i} titulo={x.nombre} accion="Pedir" revelado={c.pedidos.includes(i)} alRevelar={() => revelar(c.id, 'pedidos', i)}
            contenido={<><p>{x.resultado}</p>{x.ajustado && <p className="mt-1 text-xs texto-suave">{x.ajustado}</p>}</>} />
        ))}
      </ul>
      {derivados.length > 0 && (
        <div className="tarjeta space-y-2 p-4">
          <h2 className="text-sm font-semibold">Valores calculados por la app</h2>
          <ul className="space-y-2 text-sm">
            {derivados.map((d) => (
              <li key={d.nombre}>
                <p><b>{d.nombre}:</b> {d.valor}{d.lectura && <span className="texto-suave"> · {d.lectura}</span>}</p>
                <p className="text-xs texto-suave">{d.formula}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button className="btn-primario" onClick={siguiente}>Ir a la interpretación <Icono nombre="der" /></button>
    </section>
  )
}

function DatosRevelados({ c }: { c: CasoEnCurso }) {
  const derivados = derivadosPedidos(c)
  return (
    <ul className="space-y-1 text-sm">
      {c.preguntados.map((i) => <li key={`p${i}`}><b>{c.caso.interrogatorio[i].pregunta}</b> “{c.caso.interrogatorio[i].respuesta}”</li>)}
      {c.examinados.map((i) => <li key={`e${i}`}><b>{c.caso.examen[i].sistema}:</b> {c.caso.examen[i].hallazgo}</li>)}
      {c.pedidos.map((i) => <li key={`s${i}`}><b>{c.caso.estudios[i].nombre}:</b> {c.caso.estudios[i].resultado}</li>)}
      {derivados.map((d) => <li key={d.nombre}><b>{d.nombre}:</b> {d.valor}</li>)}
      {!c.preguntados.length && !c.examinados.length && !c.pedidos.length && <li className="texto-suave">Todavía no relevaste ningún dato.</li>}
    </ul>
  )
}

function PasoInterpretacion({ c }: { c: CasoEnCurso }) {
  const [texto, setTexto] = useState(c.interpretacion ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const dictado = useDictado((t) => setTexto((x) => (x ? x + ' ' : '') + t))
  const entregar = async () => {
    if (dictado.escuchando) dictado.alternar()
    setEnviando(true); setError('')
    try { await interpretar(c.id, texto) } catch (e) { setError((e as Error).message) } finally { setEnviando(false) }
  }
  return (
    <section className="space-y-3">
      <details className="tarjeta p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">Lo que relevaste</summary>
        <div className="mt-2"><DatosRevelados c={c} /></div>
      </details>
      <div className="tarjeta space-y-2 p-4">
        <h2 className="font-semibold">{c.caso.consigna}</h2>
        <div className="flex items-end gap-2">
          <textarea className="campo min-h-[9rem]" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Explicá qué le pasa y por qué, usando los datos…" />
          {hayDictado && <button type="button" className={`btn-secundario !p-2.5 ${dictado.escuchando ? 'animate-pulse text-red-600' : ''}`} onClick={dictado.alternar} aria-label="Dictar"><Icono nombre="mic" /></button>}
        </div>
        <button className="btn-primario" disabled={enviando || !texto.trim()} onClick={entregar}>{enviando ? 'Corrigiendo…' : 'Entregar interpretación'}</button>
      </div>
      {error && <AvisoError texto={error} />}
    </section>
  )
}

function LineaProceso({ nombre, m }: { nombre: string; m: ReturnType<typeof proceso>['interrogatorio'] }) {
  return (
    <li>
      <b>{nombre}:</b> {m.relevantes} de {m.totalRelevantes} relevantes{m.innecesarios ? ` · ${m.innecesarios} que no ${m.innecesarios === 1 ? 'hacía' : 'hacían'} falta` : ''}
      {m.faltaron.length > 0 && <span className="block text-xs texto-suave">Faltó: {m.faltaron.join(' · ')}</span>}
    </li>
  )
}

function PasoDevolucion({ c }: { c: CasoEnCurso }) {
  const ev = c.evaluacion!
  const p = proceso(c)
  const { creando, error, crear } = useNuevoCaso()
  return (
    <section className="space-y-4">
      <div className="tarjeta space-y-3 p-4">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-semibold">Tu interpretación</h2>
          <span className={`text-3xl font-bold ${colorNota(ev.nota)}`}>{formatoNota(ev.nota)}</span>
        </div>
        <ul className="space-y-1 text-sm">
          {c.caso.puntos.map((x, i) => (
            <li key={i} className="flex items-start gap-2"><span className={ev.cubiertos.includes(i) ? 'text-green-600' : 'text-red-600'}>{ev.cubiertos.includes(i) ? '✓' : '✗'}</span><span className="flex-1">{x}</span></li>
          ))}
        </ul>
        {ev.errores.length > 0 && (
          <div className="rounded-xl bg-red-500/10 p-3 text-sm"><p className="mb-1 font-medium">Errores conceptuales</p><ul className="list-disc space-y-1 pl-5">{ev.errores.map((e, i) => <li key={i}>{e}</li>)}</ul></div>
        )}
        <div className="space-y-2 text-[15px]">{ev.devolucion.map((s, i) => <p key={i}><Markdown texto={s.texto} enLinea />{s.citas.map((x, k) => <CitaSup key={k} cita={x} numero={x.n} />)}</p>)}</div>
        <p className="text-xs texto-suave">Nota: proporción de puntos esperados que explicaste, menos 1,5 por error conceptual.</p>
      </div>
      <div className="tarjeta space-y-2 p-4">
        <h2 className="font-semibold">Cómo relevaste los datos</h2>
        <ul className="space-y-2 text-sm">
          <LineaProceso nombre="Interrogatorio" m={p.interrogatorio} />
          <LineaProceso nombre="Examen físico" m={p.examen} />
          <LineaProceso nombre="Estudios" m={p.estudios} />
        </ul>
      </div>
      <details className="tarjeta p-4">
        <summary className="cursor-pointer text-sm font-semibold">Ver el caso completo</summary>
        <div className="mt-2"><DatosRevelados c={{ ...c, preguntados: c.caso.interrogatorio.map((_, i) => i), examinados: c.caso.examen.map((_, i) => i), pedidos: c.caso.estudios.map((_, i) => i) }} /></div>
      </details>
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" disabled={creando} onClick={() => crear(c.unidadId)}>{creando ? 'Armando…' : 'Otro caso de la unidad'}</button>
        <Link className="btn-secundario" to={`/up/${c.unidadId}`}>Volver a la unidad</Link>
      </div>
      {error && <AvisoError texto={error} />}
    </section>
  )
}
