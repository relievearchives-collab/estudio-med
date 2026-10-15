import { useEffect, useRef, useState } from 'react'
import { fragmentos as repoFragmentos, fuentes as repoFuentes } from '../repositorio'
import type { CitaVerificada, Fragmento } from '../repositorio/tipos'
import { useApp } from './Contexto'

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'
export const superindice = (n: number) => String(n).split('').map((d) => SUP[Number(d)]).join('')

const cacheFrag = new Map<string, Promise<{ f?: Fragmento; fuente?: string }>>()
function cargar(id: string) {
  if (!cacheFrag.has(id)) {
    cacheFrag.set(id, repoFragmentos.obtener(id).then(async (f) => ({ f, fuente: f ? (await repoFuentes.obtener(f.fuenteId))?.nombre : undefined })))
  }
  return cacheFrag.get(id)!
}

/**
 * Número de cita chiquito. Al pasar el mouse o mantener el dedo: vista previa del fragmento.
 * Al tocar: abre la fuente en esa página con la frase resaltada en amarillo.
 */
export function CitaSup({ cita, numero }: { cita: CitaVerificada; numero: number }) {
  const { abrirVisor } = useApp()
  const [preview, setPreview] = useState<{ f?: Fragmento; fuente?: string } | null>(null)
  const [visible, setVisible] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout>>(undefined)
  const ref = useRef<HTMLSpanElement>(null)
  const [arriba, setArriba] = useState(true)

  useEffect(() => () => clearTimeout(t.current), [])

  const mostrar = () => {
    if (!cita.fragmentoId) return
    clearTimeout(t.current)
    t.current = setTimeout(async () => {
      setPreview(await cargar(cita.fragmentoId!))
      setArriba((ref.current?.getBoundingClientRect().top ?? 400) > 260)
      setVisible(true)
    }, 180)
  }
  const ocultar = () => { clearTimeout(t.current); setVisible(false) }

  const abrir = async () => {
    ocultar()
    if (!cita.fragmentoId) return
    const { f } = await cargar(cita.fragmentoId)
    if (f) abrirVisor({ fuenteId: f.fuenteId, pagina: f.pagina, objetivo: { frase: cita.verificada ? cita.frase : undefined, inicio: f.inicio, fin: f.fin } })
  }

  return (
    <span ref={ref} className="relative inline-block" onMouseEnter={mostrar} onMouseLeave={ocultar}>
      <button
        type="button"
        className={`cita ${cita.verificada ? '' : 'cita-gris'}`}
        onClick={abrir}
        onTouchStart={mostrar}
        aria-label={`Cita ${numero}${cita.verificada ? '' : ' (no verificada)'}`}
        title={cita.verificada ? undefined : 'Cita no verificada: la frase no aparece textual en el fragmento'}
      >
        {superindice(numero)}
      </button>
      {visible && preview?.f && (
        <span
          role="tooltip"
          className={`absolute left-1/2 z-30 block w-72 -translate-x-1/2 rounded-xl border p-3 text-left text-xs font-normal leading-snug shadow-xl borde ${arriba ? 'bottom-full mb-2' : 'top-full mt-2'}`}
          style={{ background: 'var(--tarjeta)', color: 'var(--texto)' }}
        >
          <span className="mb-1 block font-semibold">{preview.fuente}, pág. {preview.f.pagina}{cita.verificada ? '' : ' · no verificada'}</span>
          <span className="block max-h-40 overflow-hidden">{fragmentoConFrase(preview.f.texto, cita.frase)}</span>
          <span className="mt-1 block text-marca dark:text-marca-claro">Tocá para abrir en la página →</span>
        </span>
      )}
    </span>
  )
}

/** Recorta el fragmento alrededor de la frase citada. */
function fragmentoConFrase(texto: string, frase: string) {
  const i = texto.toLowerCase().indexOf(frase.slice(0, 30).toLowerCase())
  if (i < 0) return texto.slice(0, 320) + (texto.length > 320 ? '…' : '')
  const ini = Math.max(0, i - 80)
  return (ini > 0 ? '…' : '') + texto.slice(ini, i) + '«' + texto.slice(i, i + frase.length) + '»' + texto.slice(i + frase.length, i + frase.length + 120) + '…'
}
