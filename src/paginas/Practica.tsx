import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { describirAlcance, SelectorAlcance } from '../componentes/SelectorAlcance'
import { nombreDisciplina, paqueteActivo, unidadPorId } from '../contenido'
import { mezclar } from '../atlas/museo'
import { generarPreguntas, regenerarPregunta } from '../practica/generar'
import { ItemPractica } from '../practica/ItemPractica'
import { armarSimulacro, enunciadoDe, esCorrecta, itemEjercicio, itemPregunta, mapaDeCalor, resultadoSimulacro, temasFlojosPractica, type Item } from '../practica/sesion'
import { intentos as repoIntentos, nuevoId, preguntas as repoPreguntas } from '../repositorio'
import { useAjustes, useFuentes, useTemas } from '../repositorio/hooks'
import type { Alcance, Pregunta } from '../repositorio/tipos'

const usePreguntas = () => useLiveQuery(() => repoPreguntas.todas(), [])
const useIntentos = () => useLiveQuery(() => repoIntentos.todos(), [])

function ElegirUnidades({ valor, alCambiar }: { valor: string[]; alCambiar: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {paqueteActivo.unidades.map((u) => {
        const activa = valor.includes(u.id)
        return <button key={u.id} className={activa ? 'chip-activo' : 'chip'} onClick={() => alCambiar(activa ? valor.filter((x) => x !== u.id) : [...valor, u.id])}>{u.sigla}</button>
      })}
    </div>
  )
}

// ───────────────────────── Inicio ─────────────────────────

export function PracticaInicio() {
  const banco = usePreguntas() ?? []
  const intentos = useIntentos() ?? []
  const [ups, setUps] = useState<string[]>(['up3'])
  const navegar = useNavigate()
  const reportadas = banco.filter((p) => p.reportada).length
  const bien = intentos.filter((i) => i.correcta).length

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Práctica de parcial" subtitulo="Preguntas tipo parcial, ejercicios numéricos corregidos por la app y simulacros cronometrados." />
      <section className="tarjeta space-y-3 p-4">
        <h2 className="font-semibold">Practicar</h2>
        <p className="text-sm texto-suave">De a una pregunta, con la corrección y la explicación al toque. Mezcla tu banco de preguntas con ejercicios numéricos.</p>
        <ElegirUnidades valor={ups} alCambiar={setUps} />
        <button className="btn-primario" disabled={!ups.length} onClick={() => navegar(`/practica/sesion?ups=${ups.join(',')}`)}>Empezar</button>
      </section>
      <section className="tarjeta space-y-3 p-4">
        <h2 className="font-semibold">Simulacro de parcial</h2>
        <p className="text-sm texto-suave">Cronometrado y sin ver las respuestas hasta el final, con nota de 0 a 10 y resultado por UP.</p>
        <div className="flex flex-wrap gap-2">
          {paqueteActivo.parciales.map((p) => <Link key={p.id} className="btn-secundario" to={`/practica/simulacro?ups=${p.unidadesSugeridas.join(',')}`}>{p.nombre} ({p.unidadesSugeridas.map((u) => unidadPorId(u)?.sigla).join(', ')})</Link>)}
          <Link className="btn-fantasma" to="/practica/simulacro">Elegir UP…</Link>
        </div>
      </section>
      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/practica/banco" className="tarjeta block p-4 transition hover:shadow-md">
          <b className="block">Banco de preguntas</b>
          <span className="text-sm texto-suave">{banco.length} preguntas{reportadas ? ` · ${reportadas} reportadas` : ''}. Generalas con IA desde una UP, un tema o el chat.</span>
        </Link>
        <Link to="/practica/mapa" className="tarjeta block p-4 transition hover:shadow-md">
          <b className="block">Mapa de calor</b>
          <span className="text-sm texto-suave">{intentos.length ? `${intentos.length} respuestas · ${Math.round((bien / intentos.length) * 100)} % de aciertos` : 'Todavía no respondiste nada.'} Aciertos por UP y disciplina, y temas flojos.</span>
        </Link>
      </div>
      <Link to="/simuladores" className="tarjeta flex items-center gap-3 p-4 text-sm">
        <Icono nombre="grafico" className="h-6 w-6 text-sky-600" />
        <span className="flex-1"><b>Simuladores de fisiología</b><span className="block text-xs texto-suave">Darrow-Yannet, Starling, clearance, ácido-base y más.</span></span>
        <Icono nombre="der" />
      </Link>
    </div>
  )
}

// ───────────────────────── Práctica libre ─────────────────────────

export function PracticaSesion() {
  const [params] = useSearchParams()
  const ups = (params.get('ups') ?? 'up3').split(',').filter(Boolean)
  const banco = usePreguntas()
  const intentos = useIntentos()
  const [item, setItem] = useState<Item | null>(null)
  const [respuesta, setRespuesta] = useState<string | number | undefined>()
  const [corregido, setCorregido] = useState(false)
  const [cuenta, setCuenta] = useState({ bien: 0, total: 0 })
  const inicio = useRef(0)

  const siguiente = () => {
    const disponibles = (banco ?? []).filter((p) => p.unidadId && ups.includes(p.unidadId) && !p.reportada)
    const sims = paqueteActivo.simuladores.filter((s) => s.unidadIds.some((u) => ups.includes(u)))
    const vecesRespondida = new Map<string, number>()
    for (const i of intentos ?? []) if (i.preguntaId) vecesRespondida.set(i.preguntaId, (vecesRespondida.get(i.preguntaId) ?? 0) + 1)
    let nuevo: Item | null = null
    if (disponibles.length && (!sims.length || Math.random() < 0.65)) {
      // Primero las menos practicadas
      const orden = mezclar(disponibles).sort((a, b) => (vecesRespondida.get(a.id) ?? 0) - (vecesRespondida.get(b.id) ?? 0))
      nuevo = itemPregunta(orden[0])
    } else if (sims.length) {
      const s = sims[Math.floor(Math.random() * sims.length)]
      nuevo = itemEjercicio(s, Math.random, s.unidadIds.find((u) => ups.includes(u)))
    }
    setItem(nuevo); setRespuesta(undefined); setCorregido(false); inicio.current = Date.now()
  }
  useEffect(() => { if (banco && intentos && !item) siguiente() })

  const responder = async (r: string | number) => {
    if (!item || corregido) return
    setRespuesta(r); setCorregido(true)
    const ok = esCorrecta(item, r)
    setCuenta((c) => ({ bien: c.bien + (ok ? 1 : 0), total: c.total + 1 }))
    await repoIntentos.registrar([{
      origen: item.tipo === 'pregunta' ? 'pregunta' : 'ejercicio', preguntaId: item.tipo === 'pregunta' ? item.pregunta.id : undefined,
      simulador: item.tipo === 'ejercicio' ? item.ejercicio.simulador : undefined, enunciado: enunciadoDe(item), respuesta: String(r), correcta: ok,
      unidadId: item.unidadId, disciplinaId: item.disciplinaId, temaId: item.temaId, duracion: Math.round((Date.now() - inicio.current) / 1000),
    }])
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Encabezado volver titulo="Práctica" subtitulo={`${ups.map((u) => unidadPorId(u)?.sigla).join(', ')} · ${cuenta.bien}/${cuenta.total} bien`} />
      {item ? (
        <section className="tarjeta p-4">
          <ItemPractica key={item.tipo === 'pregunta' ? item.pregunta.id + cuenta.total : item.ejercicio.id} item={item} respuesta={respuesta} alResponder={responder} corregido={corregido} />
          {corregido && <button className="btn-primario mt-4 w-full" onClick={siguiente}>Siguiente</button>}
        </section>
      ) : (
        <p className="text-sm texto-suave">{banco ? 'No hay preguntas ni ejercicios para esas UP. Generá preguntas en el banco.' : 'Cargando…'}</p>
      )}
      {(banco ?? []).filter((p) => p.unidadId && ups.includes(p.unidadId)).length === 0 && banco && (
        <p className="text-sm texto-suave">Tu banco no tiene preguntas de estas UP todavía: por ahora te tocan ejercicios numéricos. <Link className="underline" to="/practica/banco">Generá preguntas</Link>.</p>
      )}
    </div>
  )
}

// ───────────────────────── Simulacro ─────────────────────────

export function PracticaSimulacro() {
  const [params] = useSearchParams()
  const banco = usePreguntas()
  const [ups, setUps] = useState<string[]>(() => (params.get('ups') ?? '').split(',').filter(Boolean))
  const [cantidad, setCantidad] = useState(20)
  const [minutos, setMinutos] = useState(40)
  const [estado, setEstado] = useState<{ items: Item[]; respuestas: (string | number | undefined)[]; fin: number; id: string; terminado: boolean } | null>(null)
  const [actual, setActual] = useState(0)
  const [ahora, setAhora] = useState(0)
  const { avisar } = useApp()

  useEffect(() => {
    if (!estado || estado.terminado) return
    const id = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(id)
  }, [estado])
  const restante = estado ? Math.max(0, estado.fin - ahora) : 0

  const empezar = () => {
    const items = armarSimulacro({ unidadIds: ups, cantidad, banco: banco ?? [], simuladores: paqueteActivo.simuladores })
    if (!items.length) return avisar('No hay preguntas ni ejercicios para esas UP.', 'error')
    const t = Date.now()
    setEstado({ items, respuestas: items.map(() => undefined), fin: t + minutos * 60_000, id: nuevoId('sim-'), terminado: false })
    setActual(0); setAhora(t)
  }
  const entregar = async (porTiempo = false) => {
    if (!estado || estado.terminado) return
    if (!porTiempo && estado.respuestas.some((r) => r === undefined || r === '') && !confirm('Hay preguntas sin responder. ¿Entregar igual?')) return
    setEstado({ ...estado, terminado: true })
    await repoIntentos.registrar(estado.items.map((it, i) => ({
      origen: it.tipo === 'pregunta' ? 'pregunta' : 'ejercicio', preguntaId: it.tipo === 'pregunta' ? it.pregunta.id : undefined,
      simulador: it.tipo === 'ejercicio' ? it.ejercicio.simulador : undefined, enunciado: enunciadoDe(it),
      respuesta: estado.respuestas[i] === undefined ? undefined : String(estado.respuestas[i]), correcta: esCorrecta(it, estado.respuestas[i]),
      unidadId: it.unidadId, disciplinaId: it.disciplinaId, temaId: it.temaId, simulacroId: estado.id,
    })))
    if (porTiempo) avisar('Se terminó el tiempo: el simulacro se entregó solo', 'info')
  }
  // Al llegar a 0 se entrega solo.
  useEffect(() => { if (estado && !estado.terminado && ahora && restante === 0) entregar(true) })

  if (!estado) {
    const enBanco = (banco ?? []).filter((p) => p.unidadId && ups.includes(p.unidadId) && !p.reportada).length
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <Encabezado volver titulo="Simulacro de parcial" />
        <section className="tarjeta space-y-3 p-4">
          <p className="text-sm font-medium">Unidades</p>
          <ElegirUnidades valor={ups} alCambiar={setUps} />
          <div className="flex flex-wrap gap-4">
            <label className="text-sm">Preguntas<input type="number" min={5} max={60} className="campo mt-1 !w-24" value={cantidad} onChange={(e) => setCantidad(Math.max(5, Math.min(60, Number(e.target.value) || 5)))} /></label>
            <label className="text-sm">Minutos<input type="number" min={5} max={180} className="campo mt-1 !w-24" value={minutos} onChange={(e) => setMinutos(Math.max(5, Math.min(180, Number(e.target.value) || 5)))} /></label>
          </div>
          <p className="text-xs texto-suave">Tu banco tiene {enBanco} preguntas de estas UP; el resto se completa con ejercicios numéricos (≈ 30 % siempre son numéricos).</p>
          <button className="btn-primario" disabled={!ups.length} onClick={empezar}>Empezar simulacro</button>
        </section>
      </div>
    )
  }

  const it = estado.items[actual]
  const res = estado.terminado ? resultadoSimulacro(estado.items, estado.respuestas) : null
  const mmss = `${Math.floor(restante / 60000)}:${String(Math.floor((restante % 60000) / 1000)).padStart(2, '0')}`
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Simulacro" subtitulo={estado.terminado ? 'Entregado' : `${estado.respuestas.filter((r) => r !== undefined && r !== '').length}/${estado.items.length} respondidas`}
        acciones={!estado.terminado && <span className={`rounded-xl px-3 py-1.5 font-mono text-lg tabular-nums ${restante < 60_000 ? 'bg-red-500/15 text-red-600' : 'bg-black/5 dark:bg-white/10'}`}>{mmss}</span>} />
      {res && (
        <section className="tarjeta space-y-2 p-4">
          <p className="text-2xl font-bold">Nota: {res.nota.toLocaleString('es-AR')} <span className="text-base font-normal texto-suave">({res.bien}/{res.total})</span></p>
          <div className="flex flex-wrap gap-2 text-sm">{[...res.porUnidad.entries()].map(([u, x]) => <span key={u} className="chip">{unidadPorId(u)?.sigla ?? u}: {x.bien}/{x.total}</span>)}</div>
          <p className="text-xs texto-suave">Revisá cada pregunta abajo: las falladas se pueden convertir en tarjetas. Los resultados ya cuentan en tu mapa de calor.</p>
        </section>
      )}
      <div className="flex flex-wrap gap-1">
        {estado.items.map((x, i) => {
          const resp = estado.respuestas[i]
          const color = estado.terminado ? (esCorrecta(x, resp) ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white') : resp !== undefined && resp !== '' ? 'bg-marca text-white' : ''
          return <button key={i} className={`h-8 w-8 rounded-lg border text-xs borde ${color} ${i === actual ? 'ring-2 ring-marca' : ''}`} onClick={() => setActual(i)}>{i + 1}</button>
        })}
      </div>
      <section className="tarjeta p-4">
        <ItemPractica key={`${estado.id}-${actual}-${estado.terminado}`} item={it} numero={actual + 1} modo="examen" respuesta={estado.respuestas[actual]} corregido={estado.terminado}
          alResponder={(r) => setEstado({ ...estado, respuestas: estado.respuestas.map((x, i) => (i === actual ? r : x)) })} />
        <div className="mt-4 flex gap-2">
          <button className="btn-secundario" disabled={actual === 0} onClick={() => setActual(actual - 1)}><Icono nombre="izq" className="h-4 w-4" />Anterior</button>
          <div className="flex-1" />
          {actual < estado.items.length - 1 && <button className="btn-secundario" onClick={() => setActual(actual + 1)}>Siguiente<Icono nombre="der" className="h-4 w-4" /></button>}
          {!estado.terminado && <button className="btn-primario" onClick={() => entregar()}>Entregar</button>}
          {estado.terminado && <button className="btn-primario" onClick={() => setEstado(null)}>Otro simulacro</button>}
        </div>
      </section>
    </div>
  )
}

// ───────────────────────── Banco de preguntas ─────────────────────────

function EditorPregunta({ p, alCerrar }: { p: Pregunta; alCerrar: () => void }) {
  const [b, setB] = useState(p)
  const [ocupado, setOcupado] = useState(false)
  const { avisar } = useApp()
  const setOpcion = (i: number, campo: 'texto' | 'explicacion', v: string) => setB({ ...b, opciones: b.opciones.map((o, k) => (k === i ? { ...o, [campo]: v } : o)) })
  return (
    <div className="space-y-2 rounded-xl border p-3 borde">
      {p.reportada && <p className="rounded-lg bg-amber-500/10 px-2 py-1 text-xs text-amber-800 dark:text-amber-300">Reportada: “{p.reportada}”</p>}
      <textarea className="campo min-h-[4rem]" value={b.enunciado} onChange={(e) => setB({ ...b, enunciado: e.target.value })} aria-label="Enunciado" />
      {b.opciones.map((o, i) => (
        <div key={i} className="flex items-start gap-2">
          <input type="radio" className="mt-3" checked={b.correcta === i} onChange={() => setB({ ...b, correcta: i })} aria-label={`Opción ${i + 1} correcta`} />
          <div className="flex-1 space-y-1">
            <input className="campo" value={o.texto} onChange={(e) => setOpcion(i, 'texto', e.target.value)} aria-label={`Opción ${i + 1}`} />
            <input className="campo !py-1 text-xs" placeholder="Por qué es correcta o incorrecta" value={o.explicacion} onChange={(e) => setOpcion(i, 'explicacion', e.target.value)} />
          </div>
        </div>
      ))}
      <textarea className="campo text-sm" placeholder="Explicación general" value={b.explicacion} onChange={(e) => setB({ ...b, explicacion: e.target.value })} />
      <div className="flex flex-wrap gap-2">
        <button className="btn-primario" onClick={async () => { await repoPreguntas.guardar({ ...b, reportada: undefined }); avisar('Pregunta guardada', 'ok'); alCerrar() }}>Guardar</button>
        {p.fragmentoId && <button className="btn-secundario" disabled={ocupado} onClick={async () => {
          setOcupado(true)
          try { const n = await regenerarPregunta(p); if (n) { avisar('Pregunta regenerada', 'ok'); alCerrar() } else avisar('La IA no devolvió una pregunta válida. Probá de nuevo.', 'error') } catch (e) { avisar((e as Error).message, 'error') }
          setOcupado(false)
        }}>{ocupado ? 'Regenerando…' : 'Regenerar con IA'}</button>}
        <button className="btn-fantasma text-red-600" onClick={async () => { if (confirm('¿Borrar esta pregunta?')) { await repoPreguntas.borrar(p.id); alCerrar() } }}>Borrar</button>
        <button className="btn-fantasma" onClick={alCerrar}>Cancelar</button>
      </div>
    </div>
  )
}

export function PracticaBanco() {
  const [params, setParams] = useSearchParams()
  const banco = usePreguntas()
  const temas = useTemas() ?? []
  const fuentes = useFuentes() ?? []
  const ajustes = useAjustes()
  const [alcance, setAlcance] = useState<Alcance>({ tipo: 'unidad', unidadId: 'up3' })
  const [cantidad, setCantidad] = useState(10)
  const [estado, setEstado] = useState('')
  const [filtro, setFiltro] = useState<'todas' | 'reportadas' | 'sin-verificar'>('todas')
  const [editando, setEditando] = useState<string | null>(params.get('editar'))
  const { avisar } = useApp()
  const nombresTemas = new Map(temas.map((t) => [t.id, t.nombre]))
  const nombresFuentes = new Map(fuentes.map((f) => [f.id, f.nombre]))

  const generar = async (origen: Parameters<typeof generarPreguntas>[0], n: number) => {
    setEstado('Generando preguntas…')
    try {
      const ps = await generarPreguntas(origen, n, (h, t) => t > 1 && setEstado(`Generando… lote ${Math.min(h + 1, t)} de ${t}`))
      avisar(ps.length ? `${ps.length} preguntas nuevas en tu banco` : 'La IA no devolvió preguntas válidas. Probá de nuevo.', ps.length ? 'ok' : 'error')
    } catch (e) { avisar((e as Error).message, 'error') }
    setEstado('')
  }
  // Desde el chat ("Hacer preguntas"): se generan al entrar.
  const auto = useRef(false)
  useEffect(() => {
    const chat = params.get('chat'), m = params.get('m')
    if (!auto.current && params.get('origen') === 'chat' && chat && m) {
      auto.current = true
      setParams({}, { replace: true })
      generar({ tipo: 'chat', chatId: chat, mensajeId: m }, 5)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lista = (banco ?? []).filter((p) => filtro === 'todas' || (filtro === 'reportadas' ? p.reportada : !p.verificada))
  const sinClave = ajustes && ajustes.proveedorIA === 'gemini' && !ajustes.claveIA
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado volver titulo="Banco de preguntas" subtitulo={`${banco?.length ?? 0} preguntas`} />
      <section className="tarjeta space-y-3 p-4">
        <h2 className="font-semibold">Generar con IA</h2>
        <SelectorAlcance valor={alcance} alCambiar={setAlcance} />
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">Cantidad<input type="number" min={1} max={40} className="campo mt-1 !w-24" value={cantidad} onChange={(e) => setCantidad(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} /></label>
          <button className="btn-primario" disabled={!!estado || !!sinClave} onClick={() => generar({ tipo: 'alcance', alcance }, cantidad)}><Icono nombre="estrella" />{estado || 'Generar'}</button>
        </div>
        <p className="text-xs texto-suave">Modelo liviano en lotes de 8 ({Math.ceil(cantidad / 8)} llamada/s). De {describirAlcance(alcance, nombresTemas, nombresFuentes)}. Cada pregunta queda enlazada a la página de donde salió.</p>
        {sinClave && <p className="text-sm text-amber-600">Necesitás tu clave gratuita de Gemini: <Link className="underline" to="/ajustes">cargala en Ajustes</Link>.</p>}
      </section>
      <div className="flex flex-wrap gap-1">
        {([['todas', 'Todas'], ['reportadas', 'Reportadas'], ['sin-verificar', 'Respaldo sin verificar']] as const).map(([v, n]) => <button key={v} className={filtro === v ? 'chip-activo' : 'chip'} onClick={() => setFiltro(v)}>{n}</button>)}
      </div>
      <ul className="space-y-2">
        {lista.map((p) => (
          <li key={p.id} className="tarjeta p-3">
            {editando === p.id ? <EditorPregunta p={p} alCerrar={() => setEditando(null)} /> : (
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{p.enunciado}</p>
                  <p className="mt-1 flex flex-wrap gap-x-2 text-xs texto-suave">
                    <span className="text-emerald-700 dark:text-emerald-400">✓ {p.opciones[p.correcta]?.texto}</span>
                    {p.unidadId && <span>· {unidadPorId(p.unidadId)?.sigla}{p.temaId ? ` · ${nombresTemas.get(p.temaId)}` : p.disciplinaId ? ` · ${nombreDisciplina(p.disciplinaId)}` : ''}</span>}
                    {p.pagina && <span>· pág. {p.pagina}</span>}
                    {!p.verificada && <span className="text-amber-600">· respaldo sin verificar</span>}
                    {p.reportada && <span className="text-red-600">· reportada: {p.reportada}</span>}
                  </p>
                </div>
                <button className="btn-fantasma !p-1.5" aria-label="Editar" onClick={() => setEditando(p.id)}><Icono nombre="lapiz" className="h-4 w-4" /></button>
              </div>
            )}
          </li>
        ))}
        {!lista.length && <li className="text-center text-sm texto-suave">No hay preguntas{filtro !== 'todas' ? ' con ese filtro' : ''}.</li>}
      </ul>
    </div>
  )
}

// ───────────────────────── Mapa de calor ─────────────────────────

export function PracticaMapa() {
  const intentos = useIntentos() ?? []
  const temas = useTemas() ?? []
  const disciplinas = paqueteActivo.disciplinas.filter((d) => intentos.some((i) => i.disciplinaId === d.id) || ['anatomia', 'fisiologia', 'fisica'].includes(d.id))
  const celdas = mapaDeCalor(intentos, paqueteActivo.unidades.map((u) => u.id), disciplinas.map((d) => d.id))
  const flojos = temasFlojosPractica(intentos)
  const color = (bien: number, total: number) => {
    if (!total) return 'transparent'
    const t = bien / total
    return `hsl(${Math.round(t * 120)}, 70%, ${45 + (1 - Math.min(total, 10) / 10) * 15}%)`
  }
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Encabezado volver titulo="Mapa de calor" subtitulo="Aciertos por unidad y disciplina (práctica, simulacros y ejercicios de los simuladores)." />
      <section className="tarjeta overflow-x-auto p-4">
        <table className="w-full min-w-[480px] border-separate border-spacing-1 text-center text-sm">
          <thead><tr><th />{disciplinas.map((d) => <th key={d.id} className="text-xs font-medium texto-suave">{d.nombre}</th>)}</tr></thead>
          <tbody>
            {paqueteActivo.unidades.map((u) => (
              <tr key={u.id}>
                <th className="pr-2 text-left text-xs font-semibold"><Link className="hover:underline" to={`/practica/sesion?ups=${u.id}`}>{u.sigla}</Link></th>
                {disciplinas.map((d) => {
                  const c = celdas.find((x) => x.unidadId === u.id && x.disciplinaId === d.id)!
                  return (
                    <td key={d.id} className="h-12 rounded-lg border borde" style={{ background: color(c.bien, c.total) }} title={c.total ? `${c.bien}/${c.total}` : 'sin respuestas'}>
                      {c.total ? <span className="font-semibold text-white drop-shadow">{Math.round((c.bien / c.total) * 100)} %<span className="block text-[10px] font-normal">{c.bien}/{c.total}</span></span> : <span className="text-xs texto-suave">—</span>}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs texto-suave">Rojo: pocos aciertos; verde: muchos. Más claro = pocas respuestas todavía. Tocá una UP para practicarla.</p>
      </section>
      <section className="tarjeta p-4">
        <h2 className="mb-2 text-sm font-semibold">Temas flojos</h2>
        {flojos.length ? (
          <ul className="space-y-2 text-sm">
            {flojos.map((f) => {
              const t = temas.find((x) => x.id === f.temaId)
              return (
                <li key={f.temaId} className="flex flex-wrap items-center gap-2">
                  <span className="flex-1"><b>{t?.nombre ?? f.temaId}</b> <span className="texto-suave">· {Math.round(f.tasa * 100)} % ({f.bien}/{f.total})</span></span>
                  {t && <Link className="btn-fantasma !py-1 text-xs" to={`/practica/sesion?ups=${t.unidadId}`}>Practicar {unidadPorId(t.unidadId)?.sigla}</Link>}
                  {t && <Link className="btn-fantasma !py-1 text-xs" to={`/chat?alcance=tema&id=${t.id}`}>Preguntar</Link>}
                </li>
              )
            })}
          </ul>
        ) : <p className="text-sm texto-suave">Todavía no hay temas con menos de 70 % de aciertos (con al menos 3 respuestas).</p>}
      </section>
    </div>
  )
}
