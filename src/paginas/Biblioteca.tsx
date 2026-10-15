
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AgregarApuntes, BotonArchivo } from '../componentes/Archivos'
import { useApp } from '../componentes/Contexto'
import { Encabezado } from '../componentes/Encabezado'
import { EstadoFuente } from '../componentes/EstadoFuente'
import { Icono } from '../componentes/Icono'
import { colorDisciplina, paqueteActivo, unidadPorId } from '../contenido'
import { invalidarIndice } from '../busqueda/hibrida'
import { importarArchivos } from '../procesamiento/importar'
import { fuentes as repoFuentes } from '../repositorio'
import { useContenidoGuia, useFragmentosPorUnidad, useFuentes, useTemas } from '../repositorio/hooks'

type Vista = 'unidades' | 'disciplinas' | 'fuentes'

export default function Biblioteca() {
  const [params, setParams] = useSearchParams()
  const vista = (params.get('v') as Vista) ?? 'unidades'
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4">
      <Encabezado titulo="Biblioteca" subtitulo={`${paqueteActivo.area} · ${paqueteActivo.facultad}, ${paqueteActivo.universidad.replace('Universidad Nacional de ', 'UN ')}`} />
      <div className="flex gap-2 overflow-x-auto">
        {([['unidades', 'Por unidad'], ['disciplinas', 'Por disciplina'], ['fuentes', 'Fuentes']] as const).map(([v, n]) => (
          <button key={v} className={vista === v ? 'chip-activo' : 'chip'} onClick={() => setParams({ v })}>{n}</button>
        ))}
      </div>
      {vista === 'unidades' && <VistaUnidades />}
      {vista === 'disciplinas' && <VistaDisciplinas />}
      {vista === 'fuentes' && <VistaFuentes />}
    </div>
  )
}

function VistaUnidades() {
  const contenido = useContenidoGuia() ?? []
  const conteo = useFragmentosPorUnidad() ?? {}
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {paqueteActivo.unidades.map((u) => {
        const c = contenido.find((x) => x.unidadId === u.id)
        return (
          <Link key={u.id} to={`/up/${u.id}`} className="tarjeta flex flex-col gap-2 p-4 transition hover:shadow-md">
            <div className="flex items-center gap-2">
              <span className="rounded-lg bg-marca/15 px-2 py-0.5 text-sm font-bold text-marca dark:text-marca-claro">{u.sigla}</span>
              <span className="text-xs texto-suave">Módulo {u.modulo} · pág. {u.paginas[0]}–{u.paginas[1]}</span>
            </div>
            <h2 className="font-semibold">{u.titulo}</h2>
            <p className="line-clamp-3 text-sm texto-suave">{c?.situacion || u.resumenSituacion}</p>
            <p className="text-xs texto-suave">{conteo[u.id] ?? 0} fragmentos de tus fuentes</p>
          </Link>
        )
      })}
    </div>
  )
}

function VistaDisciplinas() {
  const temas = useTemas() ?? []
  const navegar = useNavigate()
  return (
    <div className="space-y-3">
      {paqueteActivo.disciplinas.map((d) => {
        const ts = temas.filter((t) => t.disciplinaId === d.id)
        if (!ts.length) return null
        return (
          <details key={d.id} className="tarjeta p-4" open={d.id === 'fisiologia'}>
            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
              <span className="h-3 w-3 rounded-full" style={{ background: colorDisciplina(d.id) }} />
              <span className="flex-1">{d.nombre}</span>
              <span className="text-xs font-normal texto-suave">{ts.length} temas</span>
            </summary>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="chip" onClick={() => navegar(`/chat?alcance=disciplina&id=${d.id}`)}><Icono nombre="chat" className="h-3.5 w-3.5" /> Preguntar sobre toda la {d.nombre}</button>
            </div>
            <ul className="mt-3 space-y-1">
              {ts.map((t) => (
                <li key={t.id} className="flex items-center gap-2 text-sm">
                  <Link to={`/up/${t.unidadId}`} className="rounded bg-black/5 px-1.5 text-xs dark:bg-white/10">{unidadPorId(t.unidadId)?.sigla}</Link>
                  <span className="flex-1">{t.nombre}</span>
                  <button className="text-xs text-marca underline dark:text-marca-claro" onClick={() => navegar(`/chat?alcance=tema&id=${t.id}`)}>Preguntar</button>
                </li>
              ))}
            </ul>
          </details>
        )
      })}
    </div>
  )
}

function VistaFuentes() {
  const lista = useFuentes() ?? []
  const { avisar } = useApp()
  const guia = lista.find((f) => f.esGuia)
  return (
    <div className="space-y-4">
      {!guia && (
        <div className="tarjeta flex flex-wrap items-center gap-3 p-4">
          <p className="flex-1 text-sm"><b>Guía del área:</b> todavía no la importaste.</p>
          <BotonArchivo className="btn-primario" aceptar="application/pdf,.pdf" alElegir={async (fs) => { await importarArchivos(fs.slice(0, 1), { esGuia: true }); avisar('Guía en proceso', 'ok') }}>
            <Icono nombre="pdf" /> Importar guía
          </BotonArchivo>
        </div>
      )}
      <div className="tarjeta p-4">
        <h2 className="mb-3 font-semibold">Agregar apuntes</h2>
        <AgregarApuntes />
      </div>
      <ul className="space-y-2">
        {lista.map((f) => (
          <li key={f.id} className="tarjeta flex items-start gap-3 p-3">
            <Icono nombre={f.tipo === 'pdf' ? 'pdf' : f.tipo === 'imagen' ? 'camara' : 'texto'} className="mt-0.5 h-5 w-5 shrink-0 texto-suave" />
            <div className="min-w-0 flex-1">
              <Link to={`/fuente/${f.id}`} className="font-medium hover:underline">{f.nombre}</Link>
              <p className="mb-1 text-xs texto-suave">
                {f.esGuia ? 'Guía oficial · ' : ''}{f.paginas ? `${f.paginas} pág. · ` : ''}agregada el {new Date(f.creada).toLocaleDateString('es-AR')}
                {f.unidadIds.length ? ` · ${f.unidadIds.map((u) => unidadPorId(u)?.sigla).join(', ')}` : ''}
              </p>
              <EstadoFuente f={f} />
            </div>
            <div className="flex shrink-0 gap-1">
              {f.estado === 'listo' && <Link className="btn-fantasma !p-2" aria-label="Hacer tarjetas de esta fuente" title="Hacer tarjetas de esta fuente" to={`/tarjetas/generar?alcance=fuentes&id=${f.id}&n=20`}><Icono nombre="tarjetas" className="h-4 w-4" /></Link>}
              <button className="btn-fantasma !p-2" aria-label="Renombrar" onClick={() => { const n = prompt('Nuevo nombre', f.nombre); if (n?.trim()) repoFuentes.renombrar(f.id, n.trim()) }}><Icono nombre="lapiz" className="h-4 w-4" /></button>
              <button className="btn-fantasma !p-2" aria-label="Borrar" onClick={async () => {
                if (!confirm(`¿Borrar "${f.nombre}" y todos sus fragmentos y resaltados?`)) return
                await repoFuentes.borrar(f.id); invalidarIndice(); avisar('Fuente borrada')
              }}><Icono nombre="basura" className="h-4 w-4" /></button>
            </div>
          </li>
        ))}
      </ul>
      {!lista.length && <p className="text-center text-sm texto-suave">Todavía no hay fuentes.</p>}
    </div>
  )
}
