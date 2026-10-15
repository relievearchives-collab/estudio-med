import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Encabezado } from '../componentes/Encabezado'
import { lazy, Suspense } from 'react'
import { accionesVisor } from '../componentes/accionesVisor'
import { useFuente } from '../repositorio/hooks'

const VisorFuente = lazy(() => import('../componentes/VisorFuente').then((m) => ({ default: m.VisorFuente })))

export default function FuentePagina() {
  const { id = '' } = useParams()
  const [params] = useSearchParams()
  const f = useFuente(id)
  const navegar = useNavigate()
  const pagina = Number(params.get('p') ?? 1)
  const frase = params.get('frase') ?? undefined
  return (
    <div className="flex h-full flex-col">
      <div className="p-4 pb-2"><Encabezado volver titulo={f?.nombre ?? 'Fuente'} subtitulo={f ? `${f.paginas} páginas` : undefined} /></div>
      <div className="min-h-0 flex-1">
        <Suspense fallback={<p className="p-6 text-sm texto-suave">Abriendo…</p>}>
        <VisorFuente
          fuenteId={id} pagina={pagina} objetivo={frase ? { frase } : undefined}
          acciones={accionesVisor(navegar)}
        />
        </Suspense>
      </div>
    </div>
  )
}
