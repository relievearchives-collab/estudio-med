import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icono } from './Icono'

export function Encabezado({ titulo, subtitulo, volver, acciones }: { titulo: ReactNode; subtitulo?: ReactNode; volver?: boolean; acciones?: ReactNode }) {
  const navegar = useNavigate()
  return (
    <header className="flex items-start gap-2">
      {volver && <button className="btn-fantasma -ml-2 !p-2" onClick={() => navegar(-1)} aria-label="Volver"><Icono nombre="izq" /></button>}
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-bold leading-tight">{titulo}</h1>
        {subtitulo && <div className="mt-0.5 text-sm texto-suave">{subtitulo}</div>}
      </div>
      {acciones}
    </header>
  )
}
