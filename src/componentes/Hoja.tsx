import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icono } from './Icono'

/**
 * Panel deslizable: en celular sube desde abajo (se puede arrastrar para cerrar);
 * en pantallas grandes aparece como panel lateral derecho.
 */
export function Hoja({ abierta, alCerrar, titulo, children, ancho = 'lg:w-[min(720px,55vw)]', alto = 'h-[88vh]' }: {
  abierta: boolean
  alCerrar: () => void
  titulo?: ReactNode
  children: ReactNode
  ancho?: string
  /** Alto en celular (ej. 'h-[55vh]' para dejar ver lo que hay detrás). */
  alto?: string
}) {
  const [arrastre, setArrastre] = useState(0)
  const inicio = useRef<number | null>(null)

  useEffect(() => {
    if (!abierta) return
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && alCerrar()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [abierta, alCerrar])

  if (!abierta) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end lg:items-stretch lg:justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={alCerrar} />
      <div
        className={`relative flex ${alto} w-full flex-col rounded-t-2xl shadow-2xl lg:h-full lg:max-h-none lg:rounded-none lg:rounded-l-2xl ${ancho}`}
        style={{ background: 'var(--tarjeta)', transform: `translateY(${arrastre}px)` }}
      >
        <div
          className="flex shrink-0 cursor-grab items-center gap-2 border-b px-4 py-2 borde touch-none"
          onPointerDown={(e) => { if (window.innerWidth < 1024) { inicio.current = e.clientY; (e.target as HTMLElement).setPointerCapture(e.pointerId) } }}
          onPointerMove={(e) => { if (inicio.current !== null) setArrastre(Math.max(0, e.clientY - inicio.current)) }}
          onPointerUp={() => { if (arrastre > 120) alCerrar(); setArrastre(0); inicio.current = null }}
        >
          <div className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-gray-400/60 lg:hidden" />
          <div className="min-w-0 flex-1 truncate pt-1 text-sm font-semibold">{titulo}</div>
          <button className="btn-fantasma !p-2" onClick={alCerrar} aria-label="Cerrar"><Icono nombre="cerrar" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  )
}
