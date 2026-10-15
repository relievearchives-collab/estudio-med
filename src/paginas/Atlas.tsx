import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { escenasDelArea } from '../atlas/datos'
import { recorridos } from '../atlas/recorridos'
import { Encabezado } from '../componentes/Encabezado'
import { Icono } from '../componentes/Icono'
import { unidadPorId } from '../contenido'
import { useEstadosAtlas } from '../repositorio/hooks'

/** Índice del atlas 3D: escenas por unidad, recorridos guiados y repaso de estructuras (Modo Museo). */
export default function Atlas() {
  const estados = useEstadosAtlas() ?? []
  const navegar = useNavigate()
  const escenas = escenasDelArea()
  const [ahora] = useState(() => Date.now())
  const vencidas = estados.filter((e) => e.vence <= ahora)
  const porEscena = new Map<string, number>()
  for (const e of vencidas) porEscena.set(e.escena, (porEscena.get(e.escena) ?? 0) + 1)
  const escenaMasVencida = [...porEscena.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Atlas 3D" subtitulo="Girá, desarmá, cortá y autoevaluate. Modelos de BodyParts3D y esquemas propios." />

      {vencidas.length > 0 && escenaMasVencida && (
        <button className="tarjeta flex w-full items-center gap-4 p-4 text-left transition hover:shadow-md" onClick={() => navegar(`/atlas/${escenaMasVencida}?modo=museo`)}>
          <span className="text-3xl font-bold text-marca dark:text-marca-claro">{vencidas.length}</span>
          <span className="flex-1"><b className="block">Estructuras para repasar</b><span className="text-xs texto-suave">Las que fallaste vuelven más seguido (FSRS). Empezá por el Modo Museo.</span></span>
          <Icono nombre="der" />
        </button>
      )}

      <section className="grid gap-3 sm:grid-cols-2">
        {escenas.map((e) => {
          const u = unidadPorId(e.unidadId)
          const vistas = estados.filter((x) => x.escena === e.escena).length
          return (
            <Link key={e.escena} to={`/atlas/${e.escena}`} className="tarjeta flex gap-3 p-4 transition hover:shadow-md">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300"><Icono nombre="cubo" className="h-7 w-7" /></span>
              <span className="min-w-0">
                <span className="block font-semibold leading-tight">{e.datos.titulo}</span>
                <span className="mt-0.5 block text-xs texto-suave">
                  {u?.sigla} · {e.datos.tipo === 'esquema' ? 'Esquema' : 'Modelo 3D'} · {e.datos.piezas.length} estructuras
                  {porEscena.get(e.escena) ? <b className="text-red-600"> · {porEscena.get(e.escena)} para repasar</b> : vistas ? ` · ${vistas} practicadas` : ''}
                </span>
              </span>
            </Link>
          )
        })}
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Recorridos guiados</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {recorridos.map((r) => (
            <Link key={r.id} to={`/atlas/recorrido/${r.id}`} className="tarjeta block p-4 transition hover:shadow-md">
              <b className="block">{r.titulo}</b>
              <span className="text-xs texto-suave">{r.descripcion} {r.pasos.length} pasos.</span>
            </Link>
          ))}
        </div>
      </section>

      <p className="text-xs texto-suave">
        Modelos: BodyParts3D, © The Database Center for Life Science (CC BY 4.0). Los esquemas (riñón por dentro, nefrona, plexos) no están a escala.
        Las fichas son texto generado: verificalas con Rouvière y marcalas como revisadas.
      </p>
    </div>
  )
}
