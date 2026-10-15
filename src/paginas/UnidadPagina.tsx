import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { Markdown } from '../componentes/Markdown'
import { colorDisciplina, paqueteActivo, unidadPorId } from '../contenido'
import { temas as repoTemas, tutorias as repoTutorias } from '../repositorio'
import escenasAtlas from '../atlas/escenas.json'
import { simuladorPorId } from '../simuladores/catalogo'

const nombreEscena = (id: string) => escenasAtlas.escenas.find((e) => e.id === id)?.titulo ?? id
import { useContenidoGuia, useFuentes, useTemas } from '../repositorio/hooks'

export default function UnidadPagina() {
  const { id = '' } = useParams()
  const u = unidadPorId(id)
  const contenido = (useContenidoGuia() ?? []).find((c) => c.unidadId === id)
  const guia = (useFuentes() ?? []).find((f) => f.esGuia)
  const temas = (useTemas() ?? []).filter((t) => t.unidadId === id)
  const { abrirVisor } = useApp()
  const navegar = useNavigate()
  const [editando, setEditando] = useState(false)
  if (!u) return <p className="p-4">Unidad no encontrada.</p>

  const disciplinas = paqueteActivo.disciplinas.filter((d) => temas.some((t) => t.disciplinaId === d.id))
  const verEnGuia = (pagina: number, frase?: string) => guia && abrirVisor({ fuenteId: guia.id, pagina, objetivo: frase ? { frase } : undefined })
  const idx = paqueteActivo.unidades.findIndex((x) => x.id === id)
  // Escenas del atlas 3D de esta unidad y de cada tema
  const escenasUP = paqueteActivo.atlas.filter((a) => a.unidadId === id)
  const escenaDeTema = (temaId: string) => paqueteActivo.atlas.find((a) => a.temaIds.includes(temaId))

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado
        volver
        titulo={<>{u.sigla} · {u.titulo}</>}
        subtitulo={`Módulo ${u.modulo} · guía pág. ${u.paginas[0]}–${u.paginas[1]}`}
      />

      <section className="tarjeta p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="font-semibold">Situación problemática</h2>
          {guia && <button className="text-xs text-marca underline dark:text-marca-claro" onClick={() => verEnGuia(u.paginaSituacion, contenido?.situacion.slice(0, 120))}>Ver en la guía, pág. {u.paginaSituacion}</button>}
        </div>
        {contenido?.situacion
          ? <p className="leading-relaxed">{contenido.situacion}</p>
          : <p className="leading-relaxed">{u.resumenSituacion} <span className="block pt-2 text-xs texto-suave">(Resumen. Importá la guía para ver el texto oficial.)</span></p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primario" onClick={() => navegar(`/chat?alcance=unidad&id=${u.id}`)}><Icono nombre="chat" /> Preguntar sobre la {u.sigla}</button>
          <button className="btn-secundario" onClick={async () => navegar(`/tutoria/${(await repoTutorias.crear(u.id)).id}`)}><Icono nombre="chat" /> Tutoría ABP</button>
          <button className="btn-secundario" onClick={() => navegar(`/tarjetas/generar?alcance=unidad&id=${u.id}&n=30`)}><Icono nombre="tarjetas" /> Hacer tarjetas de la {u.sigla}</button>
          <button className="btn-secundario" onClick={() => navegar(`/repaso?unidad=${u.id}`)}>Repasar la {u.sigla}</button>
          {paqueteActivo.simuladores.filter((x) => x.unidadIds.includes(u.id)).map((x) => (
            <button key={x.simulador} className="btn-secundario" onClick={() => navegar(`/simuladores/${x.simulador}`)}><Icono nombre="grafico" /> {simuladorPorId(x.simulador)?.titulo}</button>
          ))}
          <button className="btn-secundario" onClick={() => navegar(`/practica/sesion?ups=${u.id}`)}><Icono nombre="check" /> Practicar la {u.sigla}</button>
          {escenasUP.map((a) => (
            <button key={a.escena} className="btn-secundario" onClick={() => navegar(`/atlas/${a.escena}`)}><Icono nombre="cubo" /> {nombreEscena(a.escena)} en 3D</button>
          ))}
        </div>
      </section>

      {contenido?.objetivos && (
        <details className="tarjeta p-4">
          <summary className="cursor-pointer font-semibold">Objetivos <span className="text-xs font-normal texto-suave">(guía, pág. {contenido.paginaObjetivos})</span></summary>
          <Markdown texto={contenido.objetivos} className="mt-2 text-sm" />
        </details>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Disciplinas y temas</h2>
          <button className="btn-fantasma text-sm" onClick={() => setEditando((v) => !v)}><Icono nombre="lapiz" className="h-4 w-4" />{editando ? 'Listo' : 'Editar'}</button>
        </div>
        {(editando ? paqueteActivo.disciplinas : disciplinas).map((d) => {
          const ts = temas.filter((t) => t.disciplinaId === d.id)
          if (!ts.length && !editando) return null
          return (
            <div key={d.id} className="tarjeta p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="h-3 w-3 rounded-full" style={{ background: colorDisciplina(d.id) }} />
                <h3 className="flex-1 font-medium">{d.nombre}</h3>
                {!editando && ts.length > 0 && <button className="text-xs text-marca underline dark:text-marca-claro" onClick={() => navegar(`/chat?alcance=disciplina&id=${d.id}`)}>Toda la {d.nombre} del área</button>}
              </div>
              <ul className="space-y-1">
                {ts.map((t) => (
                  <li key={t.id} className="group flex items-center gap-2 text-sm">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
                    {editando ? (
                      <>
                        <input className="campo !py-1" defaultValue={t.nombre} onBlur={(e) => e.target.value.trim() && repoTemas.renombrar(t.id, e.target.value.trim())} />
                        <button className="btn-fantasma !p-1" aria-label="Borrar tema" onClick={() => repoTemas.borrar(t.id)}><Icono nombre="basura" className="h-4 w-4" /></button>
                      </>
                    ) : (
                      <>
                        <span className="flex-1">{t.nombre}</span>
                        <button className="text-xs text-marca opacity-70 hover:opacity-100 dark:text-marca-claro" onClick={() => navegar(`/chat?alcance=tema&id=${t.id}`)}>Preguntar</button>
                        <button className="text-xs text-marca opacity-70 hover:opacity-100 dark:text-marca-claro" onClick={() => navegar(`/tarjetas/generar?alcance=tema&id=${t.id}&n=10`)}>Tarjetas</button>
                        {escenaDeTema(t.id) && <button className="text-xs text-cyan-600 opacity-80 hover:opacity-100 dark:text-cyan-300" onClick={() => navegar(`/atlas/${escenaDeTema(t.id)!.escena}`)}>3D</button>}
                      </>
                    )}
                  </li>
                ))}
              </ul>
              {editando && <NuevoTema unidadId={u.id} disciplinaId={d.id} />}
            </div>
          )
        })}
      </section>

      <nav className="flex justify-between pt-2 text-sm">
        {idx > 0 ? <Link className="btn-fantasma" to={`/up/${paqueteActivo.unidades[idx - 1].id}`}><Icono nombre="izq" />{paqueteActivo.unidades[idx - 1].sigla}</Link> : <span />}
        {idx < paqueteActivo.unidades.length - 1 && <Link className="btn-fantasma" to={`/up/${paqueteActivo.unidades[idx + 1].id}`}>{paqueteActivo.unidades[idx + 1].sigla}<Icono nombre="der" /></Link>}
      </nav>
    </div>
  )
}

function NuevoTema({ unidadId, disciplinaId }: { unidadId: string; disciplinaId: string }) {
  const [t, setT] = useState('')
  return (
    <form className="mt-2 flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (t.trim()) { await repoTemas.crear(unidadId, disciplinaId, t.trim()); setT('') } }}>
      <input className="campo !py-1" placeholder="Agregar tema…" value={t} onChange={(e) => setT(e.target.value)} />
      <button className="btn-secundario !py-1" disabled={!t.trim()}><Icono nombre="mas2" className="h-4 w-4" /></button>
    </form>
  )
}
