import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { Markdown } from '../componentes/Markdown'
import { nombreDisciplina, unidadPorId } from '../contenido'
import { fragmentos as repoFragmentos, notas as repoNotas } from '../repositorio'
import type { Nota } from '../repositorio/tipos'
import { useFuentes, useNotas, useTemas } from '../repositorio/hooks'

export default function Notas() {
  const { id } = useParams()
  const lista = useNotas() ?? []
  const navegar = useNavigate()
  const [filtro, setFiltro] = useState('')
  const nota = lista.find((n) => n.id === id)
  const filtradas = lista.filter((n) => !filtro || (n.titulo + ' ' + n.markdown).toLowerCase().includes(filtro.toLowerCase()))

  if (id && nota) return <EditorNota key={nota.id} nota={nota} />
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Notas" subtitulo="En Markdown, enlazadas a tus fuentes y temas" acciones={
        <button className="btn-primario" onClick={async () => { const n = await repoNotas.crear({ titulo: 'Nota nueva', markdown: '' }); navegar(`/notas/${n.id}`) }}>
          <Icono nombre="mas2" /> Nueva
        </button>
      } />
      <input className="campo" placeholder="Buscar en notas…" value={filtro} onChange={(e) => setFiltro(e.target.value)} />
      <ul className="space-y-2">
        {filtradas.map((n) => (
          <li key={n.id}>
            <Link to={`/notas/${n.id}`} className="tarjeta block p-4 hover:shadow-md">
              <p className="font-medium">{n.titulo || 'Sin título'}</p>
              <p className="line-clamp-2 text-sm texto-suave">{n.markdown.replace(/[#>*_`]/g, '').slice(0, 200)}</p>
              <p className="mt-1 text-xs texto-suave">{new Date(n.actualizada).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}{n.fragmentoIds.length ? ` · ${n.fragmentoIds.length} fragmentos enlazados` : ''}</p>
            </Link>
          </li>
        ))}
      </ul>
      {!filtradas.length && <p className="py-8 text-center text-sm texto-suave">Todavía no hay notas. Guardá una respuesta del chat o seleccioná texto en el visor.</p>}
    </div>
  )
}

function EditorNota({ nota }: { nota: Nota }) {
  const [titulo, setTitulo] = useState(nota.titulo)
  const [md, setMd] = useState(nota.markdown)
  const [temaIds, setTemaIds] = useState(nota.temaIds)
  const [vista, setVista] = useState<'editar' | 'ver'>(nota.markdown ? 'ver' : 'editar')
  const temas = useTemas() ?? []
  const fuentes = useFuentes() ?? []
  const { abrirVisor, avisar } = useApp()
  const navegar = useNavigate()
  const enlazados = useLiveQuery(() => repoFragmentos.varios(nota.fragmentoIds), [nota.fragmentoIds]) ?? []

  // Guardado automático
  useEffect(() => {
    const t = setTimeout(() => {
      if (titulo !== nota.titulo || md !== nota.markdown || temaIds.join() !== nota.temaIds.join()) repoNotas.guardar({ ...nota, titulo, markdown: md, temaIds })
    }, 600)
    return () => clearTimeout(t)
  }, [titulo, md, temaIds, nota])

  const temasPorId = useMemo(() => new Map(temas.map((t) => [t.id, t])), [temas])
  return (
    <div className="mx-auto max-w-3xl space-y-3 p-4">
      <div className="flex items-center gap-2">
        <button className="btn-fantasma -ml-2 !p-2" onClick={() => navegar('/notas')} aria-label="Volver"><Icono nombre="izq" /></button>
        <input className="min-w-0 flex-1 bg-transparent text-xl font-bold outline-none" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título" />
        <button className="btn-fantasma !p-2" aria-label="Borrar nota" onClick={async () => { if (confirm('¿Borrar esta nota?')) { await repoNotas.borrar(nota.id); avisar('Nota borrada'); navegar('/notas') } }}>
          <Icono nombre="basura" />
        </button>
      </div>
      <div className="flex gap-2">
        <button className={vista === 'editar' ? 'chip-activo' : 'chip'} onClick={() => setVista('editar')}>Editar</button>
        <button className={vista === 'ver' ? 'chip-activo' : 'chip'} onClick={() => setVista('ver')}>Vista previa</button>
      </div>
      {vista === 'editar'
        ? <textarea className="campo min-h-[50vh] font-mono text-sm" value={md} onChange={(e) => setMd(e.target.value)} placeholder="Escribí en Markdown: **negrita**, - listas, | tablas |…" />
        : <div className="tarjeta min-h-[30vh] p-4"><Markdown texto={md || '_Nota vacía_'} /></div>}

      <section className="tarjeta space-y-2 p-4">
        <h2 className="text-sm font-semibold">Temas</h2>
        <div className="flex flex-wrap gap-1">
          {temaIds.map((tid) => {
            const t = temasPorId.get(tid)
            return t ? <button key={tid} className="chip-activo" onClick={() => setTemaIds(temaIds.filter((x) => x !== tid))}>{unidadPorId(t.unidadId)?.sigla} · {t.nombre} ✕</button> : null
          })}
          <select className="campo !w-auto !py-1 text-xs" value="" onChange={(e) => e.target.value && setTemaIds([...new Set([...temaIds, e.target.value])])}>
            <option value="">+ Enlazar tema…</option>
            {temas.map((t) => <option key={t.id} value={t.id}>{unidadPorId(t.unidadId)?.sigla} · {nombreDisciplina(t.disciplinaId)}: {t.nombre}</option>)}
          </select>
        </div>
        {enlazados.length > 0 && (
          <>
            <h2 className="pt-2 text-sm font-semibold">Fragmentos enlazados</h2>
            <div className="flex flex-wrap gap-1">
              {enlazados.map((f) => (
                <button key={f.id} className="chip" onClick={() => abrirVisor({ fuenteId: f.fuenteId, pagina: f.pagina, objetivo: { inicio: f.inicio, fin: f.fin } })}>
                  {fuentes.find((x) => x.id === f.fuenteId)?.nombre}, pág. {f.pagina}
                </button>
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}
