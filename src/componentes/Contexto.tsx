import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useFuente } from '../repositorio/hooks'
import { accionesVisor } from './accionesVisor'
import { Hoja } from './Hoja'
import type { AccionesSeleccion, ObjetivoVisor } from './VisorFuente'

// pdf.js pesa: el visor se carga recién cuando se abre una cita.
const VisorFuente = lazy(() => import('./VisorFuente').then((m) => ({ default: m.VisorFuente })))

interface PedidoVisor { fuenteId: string; pagina: number; objetivo?: ObjetivoVisor }

interface ContextoApp {
  abrirVisor: (p: PedidoVisor) => void
  avisar: (mensaje: string, tipo?: 'ok' | 'error' | 'info') => void
}

const Ctx = createContext<ContextoApp>({ abrirVisor: () => {}, avisar: () => {} })
export const useApp = () => useContext(Ctx)

export function ProveedorApp({ children }: { children: ReactNode }) {
  const [visor, setVisor] = useState<PedidoVisor | null>(null)
  const [avisos, setAvisos] = useState<{ id: number; mensaje: string; tipo: string }[]>([])
  const navegar = useNavigate()
  const { pathname } = useLocation()
  // Al cambiar de pantalla se cierra el visor.
  useEffect(() => { setVisor(null) }, [pathname])

  const avisar = useCallback((mensaje: string, tipo: 'ok' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random()
    setAvisos((a) => [...a, { id, mensaje, tipo }])
    setTimeout(() => setAvisos((a) => a.filter((x) => x.id !== id)), tipo === 'error' ? 7000 : 3500)
  }, [])

  return (
    <Ctx.Provider value={{ abrirVisor: setVisor, avisar }}>
      {children}
      {visor && (
        <HojaVisor pedido={visor} alCerrar={() => setVisor(null)} acciones={accionesVisor(navegar, () => setVisor(null))} />
      )}
      <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {avisos.map((a) => (
          <div key={a.id} role="status" className={`pointer-events-auto max-w-md rounded-xl px-4 py-2 text-sm text-white shadow-lg ${a.tipo === 'error' ? 'bg-red-600' : a.tipo === 'ok' ? 'bg-emerald-600' : 'bg-slate-800'}`}>
            {a.mensaje}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

function HojaVisor({ pedido, alCerrar, acciones }: { pedido: PedidoVisor; alCerrar: () => void; acciones: AccionesSeleccion }) {
  const fuente = useFuente(pedido.fuenteId)
  return (
    <Hoja abierta alCerrar={alCerrar} titulo={<>{fuente?.nombre ?? 'Fuente'} <span className="font-normal texto-suave">· pág. {pedido.pagina}</span></>}>
      <Suspense fallback={<p className="p-6 text-sm texto-suave">Abriendo…</p>}>
        <VisorFuente fuenteId={pedido.fuenteId} pagina={pedido.pagina} objetivo={pedido.objetivo} acciones={acciones} />
      </Suspense>
    </Hoja>
  )
}
