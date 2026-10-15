import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { preguntar } from '../chat/preguntar'
import { CitaSup } from '../componentes/Citas'
import { useApp } from '../componentes/Contexto'
import { Icono } from '../componentes/Icono'
import { Markdown } from '../componentes/Markdown'
import { describirAlcance, SelectorAlcance } from '../componentes/SelectorAlcance'
import { callarVoz, hayDictado, hayLectura, leerEnVozAlta, useDictado } from '../componentes/voz'
import { MODOS_CHAT, type ModoChat } from '../ia/prompts/chatConCitas'
import { chats as repoChats, fragmentos as repoFragmentos, notas } from '../repositorio'
import type { Alcance, Chat as TChat, Fragmento, MensajeChat } from '../repositorio/tipos'
import { useAjustes, useChat, useChats, useFuentes, useTemas } from '../repositorio/hooks'
import { useLiveQuery } from 'dexie-react-hooks'

function alcanceDeParams(p: URLSearchParams): Alcance {
  const tipo = p.get('alcance')
  const id = p.get('id') ?? undefined
  if (tipo === 'unidad') return { tipo, unidadId: id }
  if (tipo === 'disciplina') return { tipo, disciplinaId: id }
  if (tipo === 'tema') return { tipo, temaId: id }
  if (tipo === 'fuentes') return { tipo, fuenteIds: id?.split(',') }
  return { tipo: 'todo' }
}

export default function Chat() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
  const navegar = useNavigate()
  const lista = useChats() ?? []
  const chat = useChat(id)
  const ajustes = useAjustes()
  const temas = useTemas() ?? []
  const fuentes = useFuentes() ?? []
  const nombresTemas = useMemo(() => new Map(temas.map((t) => [t.id, t.nombre])), [temas])
  const nombresFuentes = useMemo(() => new Map(fuentes.map((f) => [f.id, f.nombre])), [fuentes])
  const [alcanceNuevo, setAlcanceNuevo] = useState<Alcance>(() => alcanceDeParams(params))
  const [modo, setModo] = useState<ModoChat>('normal')
  const [texto, setTexto] = useState('')
  const [pensando, setPensando] = useState(false)
  const [verLista, setVerLista] = useState(false)
  const [filtro, setFiltro] = useState('')
  const { avisar } = useApp()
  const fin = useRef<HTMLDivElement>(null)
  const dictado = useDictado((t) => setTexto((x) => (x ? x + ' ' : '') + t))


  const enviar = async (pregunta: string) => {
    const q = pregunta.trim()
    if (!q || pensando) return
    setPensando(true)
    setTexto('')
    try {
      let chatId = chat?.id
      if (!chatId) {
        const c = await repoChats.crear(alcanceNuevo)
        chatId = c.id
        navegar(`/chat/${c.id}`, { replace: !!params.get('q') })
      }
      await preguntar(chatId, q, modo)
    } catch (e) {
      avisar((e as Error).message, 'error')
    }
    setPensando(false)
  }

  // Pregunta que llega por URL (desde el visor, una UP o un tema)
  const yaEnviada = useRef(false)
  useEffect(() => {
    const q = params.get('q')
    if (q && !yaEnviada.current && !id) {
      yaEnviada.current = true
      setParams({}, { replace: true })
      enviar(q)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, id])

  useEffect(() => { fin.current?.scrollIntoView({ behavior: 'smooth' }) }, [chat?.mensajes.length, pensando])

  const listaFiltrada = lista.filter((c) => !filtro || (c.titulo + ' ' + c.mensajes.map((m) => m.texto).join(' ')).toLowerCase().includes(filtro.toLowerCase()))
  const sinClave = ajustes && !ajustes.claveIA && ajustes.proveedorIA === 'gemini'

  return (
    <div className="flex h-full">
      {/* Conversaciones guardadas */}
      <aside className={`${verLista ? 'fixed inset-0 z-40 flex' : 'hidden'} w-full flex-col border-r borde md:static md:flex md:w-72`} style={{ background: 'var(--tarjeta)' }}>
        <div className="flex items-center gap-2 border-b p-3 borde">
          <input className="campo !py-1.5" placeholder="Buscar conversaciones…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
          <button className="btn-fantasma !p-2 md:hidden" onClick={() => setVerLista(false)} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
        </div>
        <div className="p-2"><Link to="/chat" onClick={() => setVerLista(false)} className="btn-primario w-full"><Icono nombre="mas2" /> Nueva conversación</Link></div>
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-20">
          {listaFiltrada.map((c) => (
            <li key={c.id} className="group flex items-center">
              <Link to={`/chat/${c.id}`} onClick={() => setVerLista(false)} className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-sm ${c.id === id ? 'bg-marca/15 font-medium' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
                <span className="block truncate">{c.titulo}</span>
                <span className="block truncate text-xs texto-suave">{describirAlcance(c.alcance, nombresTemas, nombresFuentes)} · {new Date(c.actualizado).toLocaleDateString('es-AR')}</span>
              </Link>
              <button className="btn-fantasma !p-1 opacity-0 group-hover:opacity-100" aria-label="Borrar conversación" onClick={async () => { if (confirm('¿Borrar esta conversación?')) { await repoChats.borrar(c.id); if (c.id === id) navegar('/chat') } }}>
                <Icono nombre="basura" className="h-4 w-4" />
              </button>
            </li>
          ))}
          {!listaFiltrada.length && <li className="p-3 text-center text-xs texto-suave">Sin conversaciones.</li>}
        </ul>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 borde">
          <button className="btn-fantasma !p-2 md:hidden" onClick={() => setVerLista(true)} aria-label="Conversaciones"><Icono nombre="chat" /></button>
          <span className="text-xs font-medium texto-suave">Buscar en:</span>
          {chat ? <span className="chip">{describirAlcance(chat.alcance, nombresTemas, nombresFuentes)}</span> : <SelectorAlcance valor={alcanceNuevo} alCambiar={setAlcanceNuevo} />}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
          <div className="mx-auto max-w-3xl space-y-5">
            {!chat?.mensajes.length && !pensando && (
              <div className="py-8 text-center">
                <Icono nombre="chat" className="mx-auto mb-3 h-10 w-10 text-marca dark:text-marca-claro" />
                <h2 className="text-lg font-semibold">Preguntale a tus fuentes</h2>
                <p className="mx-auto mt-1 max-w-md text-sm texto-suave">Cada afirmación viene con su número de cita. Tocalo y se abre la página con la frase resaltada.</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['¿Qué factores determinan la tasa de filtrado glomerular?', '¿Cómo se usa el diagrama de Darrow-Yannet?', '¿Qué es el exceso de bases?'].map((s) => (
                    <button key={s} className="chip hover:bg-black/5 dark:hover:bg-white/5" onClick={() => enviar(s)}>{s}</button>
                  ))}
                </div>
                {sinClave && <p className="mt-4 text-sm text-amber-600">Para responder hace falta tu clave gratuita de Gemini: <Link className="underline" to="/ajustes">cargala en Ajustes</Link>.</p>}
              </div>
            )}
            {chat?.mensajes.map((m, i) => m.rol === 'usuario'
              ? <BurbujaUsuario key={m.id} m={m} />
              : <RespuestaIA key={m.id} m={m} chat={chat} pregunta={chat.mensajes[i - 1]?.texto ?? ''} reintentar={() => enviar(chat.mensajes[i - 1]?.texto ?? '')} />)}
            {pensando && (
              <div className="flex items-center gap-2 text-sm texto-suave">
                <span className="inline-flex gap-1"><span className="h-2 w-2 animate-bounce rounded-full bg-marca" /><span className="h-2 w-2 animate-bounce rounded-full bg-marca [animation-delay:.15s]" /><span className="h-2 w-2 animate-bounce rounded-full bg-marca [animation-delay:.3s]" /></span>
                Buscando en tus fuentes y verificando citas…
              </div>
            )}
            <div ref={fin} />
          </div>
        </div>

        <div className="border-t px-3 py-2 borde" style={{ background: 'var(--tarjeta)' }}>
          <div className="mx-auto max-w-3xl space-y-2">
            <div className="flex gap-1 overflow-x-auto pb-1">
              {(Object.keys(MODOS_CHAT) as ModoChat[]).map((k) => (
                <button key={k} className={modo === k ? 'chip-activo' : 'chip'} onClick={() => setModo(k)}>{MODOS_CHAT[k].etiqueta}</button>
              ))}
            </div>
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); enviar(texto) }}>
              <textarea
                className="campo max-h-40 min-h-[2.75rem] resize-none" rows={1} placeholder="Escribí tu pregunta…" value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }}
              />
              {hayDictado && (
                <button type="button" className={`btn-secundario !p-2.5 ${dictado.escuchando ? 'animate-pulse text-red-600' : ''}`} onClick={dictado.alternar} aria-label="Dictar">
                  <Icono nombre="mic" />
                </button>
              )}
              <button className="btn-primario !p-2.5" disabled={!texto.trim() || pensando} aria-label="Enviar"><Icono nombre="enviar" /></button>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}

function BurbujaUsuario({ m }: { m: MensajeChat }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-marca px-4 py-2 text-sm text-white">{m.texto}</div>
    </div>
  )
}

function RespuestaIA({ m, chat, pregunta, reintentar }: { m: MensajeChat; chat: TChat; pregunta: string; reintentar: () => void }) {
  const { abrirVisor, avisar } = useApp()
  const navegar = useNavigate()
  const fuentes = useFuentes() ?? []
  // Numeración de citas por orden de aparición del fragmento
  const numeros = useMemo(() => {
    const mapa = new Map<string, number>()
    for (const s of m.segmentos ?? []) for (const c of s.citas) if (c.fragmentoId && !mapa.has(c.fragmentoId)) mapa.set(c.fragmentoId, mapa.size + 1)
    return mapa
  }, [m.segmentos])
  const usados = useLiveQuery(() => repoFragmentos.varios([...numeros.keys()]), [numeros]) ?? []
  const ordenados = [...usados].sort((a, b) => (numeros.get(a.id) ?? 0) - (numeros.get(b.id) ?? 0))
  const nombreFuente = (f: Fragmento) => fuentes.find((x) => x.id === f.fuenteId)?.nombre ?? 'Fuente'

  if (m.error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm">
        <p>{m.error}</p>
        <button className="btn-secundario mt-2" onClick={reintentar}>Reintentar</button>
      </div>
    )
  }

  const guardarNota = async () => {
    const md = (m.segmentos ?? []).map((s) => {
      const refs = s.citas.filter((c) => c.verificada && c.fragmentoId).map((c) => {
        const f = usados.find((x) => x.id === c.fragmentoId)
        return f ? `(${nombreFuente(f)}, pág. ${f.pagina})` : ''
      })
      return `${s.texto} ${[...new Set(refs)].join(' ')}`.trim()
    }).join('\n\n')
    const n = await notas.crear({
      titulo: pregunta.slice(0, 80) || chat.titulo, markdown: `## ${pregunta}\n\n${md}${m.fueraDeFuentes ? `\n\n> **No está en tus apuntes:** ${m.fueraDeFuentes}` : ''}`,
      fragmentoIds: [...numeros.keys()], temaIds: chat.alcance.temaId ? [chat.alcance.temaId] : [], origen: 'chat',
    })
    avisar('Guardado como nota', 'ok')
    navegar(`/notas/${n.id}`)
  }

  return (
    <div className="space-y-2">
      <div className="tarjeta space-y-2 p-4 text-[15px]">
        {(m.segmentos ?? []).map((s, i) => {
          const bloque = /\n|^\s*[-*|]|^\s*\d+\./.test(s.texto)
          const citas = s.citas.map((c, k) => <CitaSup key={k} cita={c} numero={c.fragmentoId ? numeros.get(c.fragmentoId)! : c.n} />)
          return (
            <div key={i} className={m.sinInformacion && !s.citas.length ? 'texto-suave' : ''}>
              {bloque ? <><Markdown texto={s.texto} /><div className="-mt-1">{citas}</div></> : <p><Markdown texto={s.texto} enLinea />{citas}</p>}
              {s.cifraSinCita && <p className="mt-1 flex items-center gap-1 text-xs text-amber-600"><Icono nombre="alerta" className="h-3.5 w-3.5" />Cifra sin cita verificada: confirmala en tus fuentes.</p>}
            </div>
          )
        })}
        {m.fueraDeFuentes && (
          <div className="rounded-xl border border-dashed border-amber-500/60 bg-amber-500/5 p-3 text-sm">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">No está en tus apuntes</p>
            <Markdown texto={m.fueraDeFuentes} />
          </div>
        )}
      </div>
      {ordenados.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="texto-suave">Fuentes usadas:</span>
          {ordenados.map((f) => (
            <button key={f.id} className="chip hover:bg-black/5 dark:hover:bg-white/5" onClick={() => abrirVisor({ fuenteId: f.fuenteId, pagina: f.pagina, objetivo: { inicio: f.inicio, fin: f.fin } })}>
              {numeros.get(f.id)}. {nombreFuente(f)}, pág. {f.pagina}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button className="btn-secundario !py-1.5 text-xs" onClick={guardarNota}><Icono nombre="nota" className="h-4 w-4" />Guardar como nota</button>
        <button className="btn-secundario !py-1.5 text-xs" disabled={!m.fragmentoIds?.length} onClick={() => navegar(`/tarjetas/generar?origen=chat&chat=${chat.id}&m=${m.id}`)}><Icono nombre="tarjetas" className="h-4 w-4" />Hacer tarjetas</button>
        <button className="btn-secundario !py-1.5 text-xs" disabled title="Llega en la Fase 4 (preguntas tipo parcial)"><Icono nombre="check" className="h-4 w-4" />Hacer preguntas</button>
        {hayLectura && <button className="btn-fantasma !py-1.5 text-xs" onClick={() => leerEnVozAlta(m.texto)} onDoubleClick={callarVoz}><Icono nombre="parlante" className="h-4 w-4" />Escuchar</button>}
      </div>
    </div>
  )
}
