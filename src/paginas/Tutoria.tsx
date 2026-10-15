import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CitaSup } from '../componentes/Citas'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { Markdown } from '../componentes/Markdown'
import { hayDictado, useDictado } from '../componentes/voz'
import { colorDisciplina, paqueteActivo, unidadPorId } from '../contenido'
import { tutorias as repoTutorias } from '../repositorio'
import { useContenidoGuia, useFuentes, useTemas, useTutoria, useTutorias } from '../repositorio/hooks'
import type { EtapaTutoria, Segmento, Tutoria } from '../repositorio/tipos'
import { separarItems, temasSinCubrir } from '../tutoria/cobertura'
import { analizarPreguntas, cerrarTutoria, guardarSugeridas, nombreDisciplina, responderTutor } from '../tutoria/tutor'

const PASOS: { id: EtapaTutoria; nombre: string }[] = [
  { id: 'situacion', nombre: 'Situación' },
  { id: 'ideas', nombre: 'Lluvia de ideas' },
  { id: 'tutor', nombre: 'Tutor' },
  { id: 'preguntas', nombre: 'Preguntas de aprendizaje' },
  { id: 'cierre', nombre: 'Cierre' },
]

const ETIQUETA_ETAPA: Record<EtapaTutoria, string> = {
  situacion: 'Recién empezada', ideas: 'En lluvia de ideas', tutor: 'Con el tutor', preguntas: 'Preguntas de aprendizaje', cierre: 'En el cierre',
}

const fecha = (ms: number) => new Date(ms).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })

// ───────────────────────── Índice ─────────────────────────

export function TutoriaIndice() {
  const todas = useTutorias() ?? []
  const navegar = useNavigate()
  const empezar = async (unidadId: string) => navegar(`/tutoria/${(await repoTutorias.crear(unidadId)).id}`)

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Tutoría ABP" subtitulo="Como en la tutoría: situación, lluvia de ideas, preguntas de aprendizaje y cierre integrador" />
      <p className="text-sm texto-suave">El tutor no te da respuestas: te hace preguntas para que descubras los temas de cada disciplina. Al final compara tus preguntas con los contenidos de la unidad en la guía.</p>
      <div className="space-y-3">
        {paqueteActivo.unidades.map((u) => {
          const deUP = todas.filter((t) => t.unidadId === u.id)
          const ultima = deUP[0]
          return (
            <div key={u.id} className="tarjeta p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="font-semibold">{u.sigla} · {u.titulo}</h2>
                  <p className="mt-1 line-clamp-2 text-sm texto-suave">{u.resumenSituacion}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {ultima && !ultima.terminada && <Link className="btn-primario" to={`/tutoria/${ultima.id}`}>Seguir</Link>}
                  <button className={ultima && !ultima.terminada ? 'btn-secundario' : 'btn-primario'} onClick={() => empezar(u.id)}>{deUP.length ? 'Nueva' : 'Empezar'}</button>
                </div>
              </div>
              {deUP.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {deUP.slice(0, 3).map((t) => (
                    <li key={t.id}>
                      <Link className="text-marca underline dark:text-marca-claro" to={`/tutoria/${t.id}`}>{fecha(t.creada)}</Link>
                      <span className="texto-suave"> · {t.terminada ? 'Terminada' : ETIQUETA_ETAPA[t.etapa]} · {t.preguntas.length} preguntas</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ───────────────────────── Tutoría ─────────────────────────

export function TutoriaPagina() {
  const { id = '' } = useParams()
  const t = useTutoria(id)
  const navegar = useNavigate()
  if (t === undefined) return <p className="p-4 texto-suave">Cargando…</p>
  if (t === null) return <p className="p-4">No encontré esa tutoría. <Link className="text-marca underline" to="/tutoria">Ver tutorías</Link></p>
  const u = unidadPorId(t.unidadId)
  const ir = (etapa: EtapaTutoria) => repoTutorias.actualizar(t.id, { etapa })
  const borrar = async () => {
    if (!confirm('¿Borrar esta tutoría? Se pierden tus ideas, preguntas y la conversación con el tutor.')) return
    await repoTutorias.borrar(t.id)
    navegar('/tutoria', { replace: true })
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado
        volver
        titulo={<>Tutoría ABP · {u?.sigla}</>}
        subtitulo={u?.titulo}
        acciones={<button className="btn-fantasma" onClick={borrar} aria-label="Borrar tutoría"><Icono nombre="basura" /></button>}
      />
      <nav className="flex gap-1 overflow-x-auto pb-1" aria-label="Pasos">
        {PASOS.map((p, i) => (
          <button
            key={p.id}
            ref={(el) => { if (el && t.etapa === p.id) el.scrollIntoView({ block: 'nearest', inline: 'nearest' }) }}
            onClick={() => ir(p.id)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs ${t.etapa === p.id ? 'bg-marca font-semibold text-white' : 'bg-black/5 dark:bg-white/10'}`}
            aria-current={t.etapa === p.id ? 'step' : undefined}
          >
            {i + 1}. {p.nombre}
          </button>
        ))}
      </nav>
      {t.etapa === 'situacion' && <PasoSituacion t={t} siguiente={() => ir('ideas')} />}
      {t.etapa === 'ideas' && <PasoIdeas t={t} siguiente={() => ir('tutor')} />}
      {t.etapa === 'tutor' && <PasoTutor t={t} siguiente={() => ir('preguntas')} />}
      {t.etapa === 'preguntas' && <PasoPreguntas t={t} siguiente={() => ir('cierre')} />}
      {t.etapa === 'cierre' && <PasoCierre t={t} />}
    </div>
  )
}

function AvisoError({ texto }: { texto: string }) {
  return <p className="flex items-start gap-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300"><Icono nombre="alerta" className="mt-0.5 h-4 w-4 shrink-0" />{texto}</p>
}

function BotonDictado({ alTexto }: { alTexto: (t: string) => void }) {
  const dictado = useDictado(alTexto)
  if (!hayDictado) return null
  return (
    <button type="button" className={`btn-secundario !p-2.5 ${dictado.escuchando ? 'animate-pulse text-red-600' : ''}`} onClick={dictado.alternar} aria-label="Dictar">
      <Icono nombre="mic" />
    </button>
  )
}

function PasoSituacion({ t, siguiente }: { t: Tutoria; siguiente: () => void }) {
  const u = unidadPorId(t.unidadId)
  const contenido = (useContenidoGuia() ?? []).find((c) => c.unidadId === t.unidadId)
  const guia = (useFuentes() ?? []).find((f) => f.esGuia)
  const { abrirVisor } = useApp()
  if (!u) return null
  return (
    <section className="tarjeta space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Situación problemática</h2>
        {guia && <button className="text-xs text-marca underline dark:text-marca-claro" onClick={() => abrirVisor({ fuenteId: guia.id, pagina: u.paginaSituacion, objetivo: contenido ? { frase: contenido.situacion.slice(0, 120) } : undefined })}>Ver en la guía, pág. {u.paginaSituacion}</button>}
      </div>
      {contenido?.situacion
        ? <p className="whitespace-pre-line leading-relaxed">{contenido.situacion}</p>
        : <p className="leading-relaxed">{u.resumenSituacion} <span className="block pt-2 text-xs texto-suave">(Resumen. Importá la guía para leer el texto oficial.)</span></p>}
      <p className="text-sm texto-suave">Leela con calma. En el paso siguiente anotás todo lo que se te ocurra: ideas, palabras que no conocés, lo que creés que está pasando.</p>
      <button className="btn-primario" onClick={siguiente}>Empezar la lluvia de ideas <Icono nombre="der" /></button>
    </section>
  )
}

/** Lista de ítems editable: escribir o dictar, Enter agrega (si pegás varios renglones, se separan solos). */
function ListaEditable({ items, alCambiar, placeholder }: { items: string[]; alCambiar: (items: string[]) => void; placeholder: string }) {
  const [texto, setTexto] = useState('')
  const agregar = () => {
    const nuevos = separarItems(texto).filter((x) => !items.includes(x))
    if (nuevos.length) alCambiar([...items, ...nuevos])
    setTexto('')
  }
  return (
    <div className="space-y-2">
      {items.length > 0 && (
        <ul className="space-y-1">
          {items.map((x, i) => (
            <li key={x} className="flex items-start gap-2 rounded-lg bg-black/5 px-3 py-1.5 text-sm dark:bg-white/5">
              <span className="flex-1">{x}</span>
              <button className="texto-suave hover:text-red-600" onClick={() => alCambiar(items.filter((_, k) => k !== i))} aria-label={`Quitar "${x}"`}><Icono nombre="cerrar" className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); agregar() }}>
        <textarea
          className="campo min-h-[2.75rem] resize-none" rows={1} placeholder={placeholder} value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); agregar() } }}
        />
        <BotonDictado alTexto={(d) => setTexto((x) => (x ? x + ' ' : '') + d)} />
        <button className="btn-secundario !p-2.5" disabled={!texto.trim()} aria-label="Agregar"><Icono nombre="mas2" /></button>
      </form>
    </div>
  )
}

function PasoIdeas({ t, siguiente }: { t: Tutoria; siguiente: () => void }) {
  return (
    <section className="space-y-4">
      <div className="tarjeta space-y-2 p-4">
        <h2 className="font-semibold">Ideas</h2>
        <p className="text-sm texto-suave">Todo lo que te sugiere la situación: conceptos, términos desconocidos, sospechas. Sin filtro.</p>
        <ListaEditable items={t.ideas} alCambiar={(ideas) => repoTutorias.actualizar(t.id, { ideas })} placeholder="Escribí una idea y apretá Enter…" />
      </div>
      <div className="tarjeta space-y-2 p-4">
        <h2 className="font-semibold">Hipótesis</h2>
        <p className="text-sm texto-suave">¿Qué creés que está pasando y por qué?</p>
        <ListaEditable items={t.hipotesis} alCambiar={(hipotesis) => repoTutorias.actualizar(t.id, { hipotesis })} placeholder="Escribí una hipótesis…" />
      </div>
      <button className="btn-primario" disabled={!t.ideas.length && !t.hipotesis.length} onClick={siguiente}>Pasar al tutor <Icono nombre="der" /></button>
    </section>
  )
}

function PasoTutor({ t, siguiente }: { t: Tutoria; siguiente: () => void }) {
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [error, setError] = useState('')
  const fin = useRef<HTMLDivElement>(null)
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end' }) }, [t.mensajes.length, pensando])

  const enviar = async (mensaje?: string) => {
    setPensando(true); setError('')
    try {
      await responderTutor(t.id, mensaje)
      setTexto('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setPensando(false)
    }
  }
  const esperandoTutor = t.mensajes.length > 0 && t.mensajes[t.mensajes.length - 1].rol === 'estudiante'

  return (
    <section className="space-y-3">
      <p className="text-sm texto-suave">El tutor no te va a dar respuestas: te pregunta para que llegues vos a los temas de cada disciplina. Lo que no sepas, anotalo como pregunta de aprendizaje.</p>
      <div className="space-y-3">
        {t.mensajes.map((m, i) => m.rol === 'tutor'
          ? <div key={i} className="tarjeta max-w-[90%] p-3 text-[15px]"><p className="mb-1 text-xs font-semibold texto-suave">Tutor</p><Markdown texto={m.texto} /></div>
          : <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-br-sm bg-marca px-4 py-2 text-sm text-white">{m.texto}</div></div>)}
        {pensando && <p className="text-sm texto-suave animate-pulse">El tutor está pensando…</p>}
        <div ref={fin} />
      </div>
      {error && <AvisoError texto={error} />}
      {!t.mensajes.length
        ? <button className="btn-primario" disabled={pensando} onClick={() => enviar()}><Icono nombre="chat" /> Empezar con el tutor</button>
        : (
          <>
            {esperandoTutor && !pensando && <button className="btn-secundario" onClick={() => enviar()}>Reintentar respuesta del tutor</button>}
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); if (texto.trim()) enviar(texto) }}>
              <textarea
                className="campo max-h-40 min-h-[2.75rem] resize-none" rows={2} placeholder="Respondele al tutor…" value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (texto.trim() && !pensando) enviar(texto) } }}
              />
              <BotonDictado alTexto={(d) => setTexto((x) => (x ? x + ' ' : '') + d)} />
              <button className="btn-primario !p-2.5" disabled={!texto.trim() || pensando} aria-label="Enviar"><Icono nombre="enviar" /></button>
            </form>
          </>
        )}
      <button className="btn-secundario" onClick={siguiente}>Pasar a las preguntas de aprendizaje <Icono nombre="der" /></button>
    </section>
  )
}

function Segmentos({ segmentos }: { segmentos: Segmento[] }) {
  return (
    <div className="space-y-2 text-[15px]">
      {segmentos.map((s, i) => (
        <div key={i}>
          <p><Markdown texto={s.texto} enLinea />{s.citas.map((c, k) => <CitaSup key={k} cita={c} numero={c.n} />)}</p>
          {s.cifraSinCita && <p className="mt-1 flex items-center gap-1 text-xs text-amber-600"><Icono nombre="alerta" className="h-3.5 w-3.5" />Cifra sin cita verificada: confirmala en tus fuentes.</p>}
        </div>
      ))}
    </div>
  )
}

function ChipDisciplina({ id }: { id: string }) {
  return <span className="rounded-full px-2 py-0.5 text-xs font-medium text-white" style={{ background: colorDisciplina(id) }}>{nombreDisciplina(id)}</span>
}

function PasoPreguntas({ t, siguiente }: { t: Tutoria; siguiente: () => void }) {
  const temas = (useTemas() ?? []).filter((x) => x.unidadId === t.unidadId)
  const [analizando, setAnalizando] = useState(false)
  const [error, setError] = useState('')
  const analizado = t.faltantes !== undefined
  const nombreTema = (id: string) => temas.find((x) => x.id === id)?.nombre ?? id

  // Editar las preguntas invalida la comparación anterior.
  const cambiar = (textos: string[]) => repoTutorias.actualizar(t.id, {
    preguntas: textos.map((texto) => t.preguntas.find((p) => p.texto === texto) ?? { texto, temaIds: [] }), faltantes: undefined,
  })
  const comparar = async () => {
    setAnalizando(true); setError('')
    try { await analizarPreguntas(t.id, t.preguntas.map((p) => p.texto)) } catch (e) { setError((e as Error).message) } finally { setAnalizando(false) }
  }
  const cubiertos = temas.length - temasSinCubrir(temas, t.preguntas).length

  return (
    <section className="space-y-4">
      <div className="tarjeta space-y-2 p-4">
        <h2 className="font-semibold">Tus preguntas de aprendizaje</h2>
        <p className="text-sm texto-suave">¿Qué tenés que estudiar para explicar la situación? Una pregunta por renglón.</p>
        <ListaEditable items={t.preguntas.map((p) => p.texto)} alCambiar={cambiar} placeholder="¿Qué…? ¿Cómo…? ¿Por qué…?" />
        <button className="btn-primario" disabled={!t.preguntas.length || analizando} onClick={comparar}>
          {analizando ? 'Comparando con la guía…' : analizado ? 'Volver a comparar' : 'Comparar con la guía'}
        </button>
      </div>
      {error && <AvisoError texto={error} />}
      {analizado && (
        <>
          <div className="tarjeta space-y-3 p-4">
            <h2 className="font-semibold">Qué cubren tus preguntas</h2>
            <p className="text-sm">Cubriste <b>{cubiertos}</b> de <b>{temas.length}</b> temas de la unidad.</p>
            <ul className="space-y-2">
              {t.preguntas.map((p) => (
                <li key={p.texto} className="text-sm">
                  <p>{p.texto}</p>
                  <p className="mt-1 flex flex-wrap gap-1">
                    {p.temaIds.length
                      ? p.temaIds.map((id) => <span key={id} className="rounded-full bg-black/5 px-2 py-0.5 text-xs dark:bg-white/10">{nombreTema(id)}</span>)
                      : <span className="text-xs texto-suave">No apunta a ningún tema de la unidad</span>}
                  </p>
                </li>
              ))}
            </ul>
          </div>
          <div className="tarjeta space-y-3 p-4">
            <h2 className="font-semibold">Te faltó pensar en…</h2>
            {!t.faltantes!.length
              ? <p className="text-sm">¡Tus preguntas cubren todos los temas de la unidad!</p>
              : t.faltantes!.map((f) => (
                <div key={f.temaId} className="space-y-1 border-l-4 pl-3" style={{ borderColor: colorDisciplina(f.disciplinaId) }}>
                  <p className="flex flex-wrap items-center gap-2"><ChipDisciplina id={f.disciplinaId} /><span className="text-sm font-medium">{nombreTema(f.temaId)}</span></p>
                  <p className="text-sm">{f.texto}{f.cita && <CitaSup cita={f.cita} numero={f.cita.n} />}</p>
                  {!f.cita && <p className="text-xs texto-suave">No encontré este tema en tus fuentes procesadas.</p>}
                </div>
              ))}
            {temasSinCubrir(temas, t.preguntas).length > t.faltantes!.length && (
              <p className="text-xs texto-suave">Te muestro los más importantes repartidos entre disciplinas; cuando agregues preguntas, volvé a comparar.</p>
            )}
          </div>
        </>
      )}
      <button className="btn-secundario" onClick={siguiente}>Ir al cierre <Icono nombre="der" /></button>
    </section>
  )
}

function PasoCierre({ t }: { t: Tutoria }) {
  const [texto, setTexto] = useState(t.explicacion ?? '')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const [elegidas, setElegidas] = useState<Set<number>>(new Set())
  const [guardadas, setGuardadas] = useState(0)
  const d = t.devolucion

  const pedir = async () => {
    setEnviando(true); setError('')
    try {
      const r = await cerrarTutoria(t.id, texto)
      setElegidas(new Set((r.devolucion?.tarjetas ?? []).map((_, i) => i)))
      setGuardadas(0)
    } catch (e) { setError((e as Error).message) } finally { setEnviando(false) }
  }
  const guardar = async () => setGuardadas(await guardarSugeridas(t.id, [...elegidas]))
  const alternar = (i: number) => setElegidas((s) => { const n = new Set(s); if (n.has(i)) n.delete(i); else n.add(i); return n })

  return (
    <section className="space-y-4">
      <div className="tarjeta space-y-2 p-4">
        <h2 className="font-semibold">Explicá la situación integrando todas las disciplinas</h2>
        <p className="text-sm texto-suave">Como en el cierre de la tutoría: qué le pasa a la persona y por qué, juntando anatomía, fisiología, histología, bioquímica y lo que corresponda a esta unidad.</p>
        <div className="flex items-end gap-2">
          <textarea className="campo min-h-[10rem]" value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Escribí o dictá tu explicación…" />
          <BotonDictado alTexto={(x) => setTexto((v) => (v ? v + ' ' : '') + x)} />
        </div>
        <button className="btn-primario" disabled={enviando || !texto.trim()} onClick={pedir}>{enviando ? 'Leyendo tu explicación…' : d ? 'Pedir otra devolución' : 'Pedir devolución'}</button>
      </div>
      {error && <AvisoError texto={error} />}
      {d && (
        <>
          <div className="tarjeta space-y-3 p-4">
            <h2 className="font-semibold">Devolución del tutor</h2>
            <Segmentos segmentos={d.segmentos} />
            {d.disciplinasFaltantes.length > 0 && (
              <div className="space-y-1 rounded-xl bg-amber-500/10 p-3">
                <p className="text-sm font-medium">Disciplinas que tu explicación no integró:</p>
                <p className="flex flex-wrap gap-1">{d.disciplinasFaltantes.map((x) => <ChipDisciplina key={x} id={x} />)}</p>
              </div>
            )}
          </div>
          {d.tarjetas.length > 0 && (
            <div className="tarjeta space-y-3 p-4">
              <h2 className="font-semibold">Tarjetas sugeridas</h2>
              <ul className="space-y-2">
                {d.tarjetas.map((s, i) => (
                  <li key={i}>
                    <label className="flex items-start gap-2 text-sm">
                      <input type="checkbox" className="mt-1" disabled={s.guardada} checked={s.guardada || elegidas.has(i)} onChange={() => alternar(i)} />
                      <span className="flex-1">
                        {s.tipo === 'cloze' ? <Markdown texto={(s.cloze ?? '').replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/g, '[$1]')} enLinea /> : <><b>{s.frente}</b> — {s.dorso}</>}
                        {!s.verificada && <span className="ml-1 text-xs text-amber-600">(respaldo sin verificar)</span>}
                        {s.guardada && <span className="ml-1 text-xs text-green-700 dark:text-green-400">Guardada</span>}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-center gap-2">
                <button className="btn-primario" disabled={![...elegidas].some((i) => !d.tarjetas[i]?.guardada)} onClick={guardar}><Icono nombre="tarjetas" /> Guardar en mis tarjetas</button>
                {guardadas > 0 && <span className="text-sm">Listo: {guardadas} tarjeta{guardadas > 1 ? 's' : ''} al mazo. <Link className="text-marca underline dark:text-marca-claro" to={`/repaso?unidad=${t.unidadId}`}>Repasar</Link></span>}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  )
}
