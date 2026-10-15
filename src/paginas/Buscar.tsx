import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { buscarTexto } from '../busqueda/hibrida'
import { normalizar } from '../busqueda/normalizar'
import { useApp } from '../componentes/Contexto'
import { Icono } from '../componentes/Icono'
import { chats as repoChats, notas as repoNotas } from '../repositorio'
import type { Chat, Fragmento, Nota } from '../repositorio/tipos'
import { useFuentes } from '../repositorio/hooks'

/** Una sola barra de búsqueda sobre fuentes, notas y conversaciones (y tarjetas desde la Fase 2). */
export default function Buscar() {
  const [params, setParams] = useSearchParams()
  const [q, setQ] = useState(params.get('q') ?? '')
  const [res, setRes] = useState<{ frags: Fragmento[]; notas: Nota[]; chats: Chat[] } | null>(null)
  const fuentes = useFuentes() ?? []
  const { abrirVisor } = useApp()

  useEffect(() => {
    const consulta = q.trim()
    const t = setTimeout(async () => {
      setParams(consulta ? { q: consulta } : {}, { replace: true })
      if (consulta.length < 2) { setRes(null); return }
      const n = normalizar(consulta)
      const [frags, ns, cs] = await Promise.all([buscarTexto(consulta), repoNotas.todas(), repoChats.todos()])
      setRes({
        frags,
        notas: ns.filter((x) => normalizar(x.titulo + ' ' + x.markdown).includes(n)),
        chats: cs.filter((c) => normalizar(c.titulo + ' ' + c.mensajes.map((m) => m.texto).join(' ')).includes(n)),
      })
    }, 250)
    return () => clearTimeout(t)
  }, [q, setParams])

  const resaltar = (texto: string) => {
    const palabras = q.trim().split(/\s+/).filter((p) => p.length > 1)
    if (!palabras.length) return texto
    const n = normalizar(texto)
    const i = palabras.map((p) => n.indexOf(normalizar(p))).filter((x) => x >= 0).sort((a, b) => a - b)[0] ?? 0
    const ini = Math.max(0, i - 60)
    return (ini ? '…' : '') + texto.slice(ini, ini + 260) + '…'
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <div className="relative">
        <Icono nombre="buscar" className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 texto-suave" />
        <input autoFocus className="campo !py-3 !pl-10 text-base" placeholder="Buscar en fuentes, notas y conversaciones (fármacos, siglas, epónimos…)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {res && (
        <>
          <Grupo titulo={`En tus fuentes (${res.frags.length})`}>
            {res.frags.map((f) => (
              <button key={f.id} className="tarjeta block w-full p-3 text-left text-sm hover:shadow-md" onClick={() => abrirVisor({ fuenteId: f.fuenteId, pagina: f.pagina, objetivo: { frase: q.trim().length > 3 ? q.trim() : undefined, inicio: f.inicio, fin: f.fin } })}>
                <span className="mb-1 block text-xs font-semibold text-marca dark:text-marca-claro">{fuentes.find((x) => x.id === f.fuenteId)?.nombre}, pág. {f.pagina}{f.titulo ? ` · ${f.titulo}` : ''}</span>
                <span className="texto-suave">{resaltar(f.texto)}</span>
              </button>
            ))}
          </Grupo>
          <Grupo titulo={`Notas (${res.notas.length})`}>
            {res.notas.map((n) => <Link key={n.id} to={`/notas/${n.id}`} className="tarjeta block p-3 text-sm"><b>{n.titulo}</b><span className="block texto-suave">{resaltar(n.markdown)}</span></Link>)}
          </Grupo>
          <Grupo titulo={`Conversaciones (${res.chats.length})`}>
            {res.chats.map((c) => <Link key={c.id} to={`/chat/${c.id}`} className="tarjeta block p-3 text-sm"><b>{c.titulo}</b></Link>)}
          </Grupo>
        </>
      )}
    </div>
  )
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide texto-suave">{titulo}</h2>
      {children}
    </section>
  )
}
