import { lazy, Suspense, useEffect, useRef } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ProveedorApp } from './componentes/Contexto'
import { Icono } from './componentes/Icono'
import { marca } from './marca'
import { eventos } from './repositorio'
import { useAjustes } from './repositorio/hooks'
import Ajustes from './paginas/Ajustes'
import Bienvenida from './paginas/Bienvenida'
import Biblioteca from './paginas/Biblioteca'
import Buscar from './paginas/Buscar'
import Chat from './paginas/Chat'
import Creditos from './paginas/Creditos'
import Estadisticas from './paginas/Estadisticas'
import FuentePagina from './paginas/FuentePagina'
import Hoy from './paginas/Hoy'
import Mas from './paginas/Mas'
import Notas from './paginas/Notas'
import GenerarTarjetas from './paginas/GenerarTarjetas'
import Repaso from './paginas/Repaso'
import Tarjetas from './paginas/Tarjetas'
import UnidadPagina from './paginas/UnidadPagina'

// El atlas usa three.js (pesado): se carga recién al abrirlo.
const Atlas = lazy(() => import('./paginas/Atlas'))
const AtlasEscena = lazy(() => import('./paginas/AtlasEscena'))

const NAV = [
  { a: '/', nombre: 'Hoy', icono: 'hoy' },
  { a: '/biblioteca', nombre: 'Biblioteca', icono: 'biblioteca' },
  { a: '/chat', nombre: 'Preguntar', icono: 'chat' },
  { a: '/tarjetas', nombre: 'Tarjetas', icono: 'tarjetas' },
  { a: '/notas', nombre: 'Notas', icono: 'nota' },
]
const NAV_EXTRA = [
  { a: '/buscar', nombre: 'Buscar', icono: 'buscar' },
  { a: '/atlas', nombre: 'Atlas 3D', icono: 'cubo' },
  { a: '/estadisticas', nombre: 'Mis estadísticas', icono: 'grafico' },
  { a: '/ajustes', nombre: 'Ajustes', icono: 'ajustes' },
  { a: '/creditos', nombre: 'Créditos', icono: 'info' },
]

/** Estadísticas locales: tiempo de estudio (minutos con la app visible y en uso) y pantallas visitadas. */
function useSeguimientoUso() {
  const ubic = useLocation()
  const ultimaActividad = useRef(Date.now())
  useEffect(() => { eventos.registrar('pantalla', ubic.pathname.split('/')[1] || 'hoy') }, [ubic.pathname])
  useEffect(() => {
    const marcar = () => { ultimaActividad.current = Date.now() }
    const evs = ['pointerdown', 'keydown', 'scroll', 'touchstart']
    evs.forEach((e) => window.addEventListener(e, marcar, { passive: true }))
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && Date.now() - ultimaActividad.current < 3 * 60_000) eventos.registrar('estudio', undefined, 60)
    }, 60_000)
    return () => { clearInterval(id); evs.forEach((e) => window.removeEventListener(e, marcar)) }
  }, [])
}

function Marco() {
  const ajustes = useAjustes()
  const ubic = useLocation()
  const navegar = useNavigate()
  useSeguimientoUso()

  if (!ajustes) return null
  if (!ajustes.bienvenidaCompleta && ubic.pathname !== '/bienvenida') return <Navigate to="/bienvenida" replace />
  if (ubic.pathname === '/bienvenida') return <Bienvenida />

  return (
    <div className="flex h-full">
      {/* Barra lateral (computadora) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r p-3 borde lg:flex" style={{ background: 'var(--tarjeta)' }}>
        <div className="mb-4 flex items-center gap-2 px-2">
          <span className="h-8 w-8" dangerouslySetInnerHTML={{ __html: marca.logoSvg }} />
          <span className="font-bold">{marca.nombre}</span>
        </div>
        <button className="campo mb-3 flex items-center gap-2 text-left texto-suave" onClick={() => navegar('/buscar')}>
          <Icono nombre="buscar" className="h-4 w-4" /> Buscar en todo…
        </button>
        <nav className="flex flex-col gap-1">
          {[...NAV, ...NAV_EXTRA.slice(1)].map((n) => (
            <NavLink key={n.a} to={n.a} end={n.a === '/'} className={({ isActive }) => `flex items-center gap-3 rounded-xl px-3 py-2 text-sm ${isActive ? 'bg-marca/15 font-semibold text-marca dark:text-marca-claro' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}>
              <Icono nombre={n.icono} /> {n.nombre}
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="min-w-0 flex-1 overflow-y-auto pb-seguro">
        <Routes>
          <Route path="/" element={<Hoy />} />
          <Route path="/biblioteca" element={<Biblioteca />} />
          <Route path="/up/:id" element={<UnidadPagina />} />
          <Route path="/fuente/:id" element={<FuentePagina />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/chat/:id" element={<Chat />} />
          <Route path="/tarjetas" element={<Tarjetas />} />
          <Route path="/tarjetas/generar" element={<GenerarTarjetas />} />
          <Route path="/repaso" element={<Repaso />} />
          <Route path="/atlas" element={<Suspense fallback={<Cargando />}><Atlas /></Suspense>} />
          <Route path="/atlas/recorrido/:id" element={<Suspense fallback={<Cargando />}><AtlasEscena /></Suspense>} />
          <Route path="/atlas/:escena" element={<Suspense fallback={<Cargando />}><AtlasEscena /></Suspense>} />
          <Route path="/notas" element={<Notas />} />
          <Route path="/notas/:id" element={<Notas />} />
          <Route path="/buscar" element={<Buscar />} />
          <Route path="/ajustes" element={<Ajustes />} />
          <Route path="/estadisticas" element={<Estadisticas />} />
          <Route path="/creditos" element={<Creditos />} />
          <Route path="/mas" element={<Mas items={NAV_EXTRA} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {/* Barra inferior (celular) */}
      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t borde lg:hidden" style={{ background: 'var(--tarjeta)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {[...NAV, { a: '/mas', nombre: 'Más', icono: 'mas' }].map((n) => (
          <NavLink key={n.a} to={n.a} end={n.a === '/'} className={({ isActive }) => `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'font-semibold text-marca dark:text-marca-claro' : 'texto-suave'}`}>
            <Icono nombre={n.icono} className="h-6 w-6" /> {n.nombre}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

function Cargando() {
  return <p className="p-6 text-sm texto-suave">Cargando…</p>
}

export default function App() {
  return (
    <HashRouter>
      <ProveedorApp>
        <Marco />
      </ProveedorApp>
    </HashRouter>
  )
}
