import { useEffect, useMemo } from 'react'
import { useImagenTarjeta } from '../repositorio/hooks'
import type { Mascara, Tarjeta } from '../repositorio/tipos'
import { renderCloze } from '../tarjetas/fsrs'
import { Markdown } from './Markdown'

/** URL temporal de un Blob (se libera sola). */
export function useUrlBlob(b?: Blob) {
  const url = useMemo(() => (b ? URL.createObjectURL(b) : ''), [b])
  useEffect(() => () => { if (url) URL.revokeObjectURL(url) }, [url])
  return url
}

/**
 * Imagen con las máscaras de oclusión encima. La máscara activa se pinta en naranja
 * (lo que se pregunta); las demás, más claras. Al revelar, la activa se destapa con borde rojo.
 */
export function ImagenOclusion({ imagenId, mascaras, activa, revelar, className = '' }: {
  imagenId?: string; mascaras: Mascara[]; activa?: string; revelar?: boolean; className?: string
}) {
  const img = useImagenTarjeta(imagenId)
  const url = useUrlBlob(img?.archivo)
  if (!url) return <div className="h-40 animate-pulse rounded-xl bg-black/5 dark:bg-white/5" />
  return (
    <div className={`relative inline-block max-w-full ${className}`}>
      <img src={url} alt="" className="block max-h-[60vh] max-w-full rounded-lg" />
      {mascaras.map((m) => {
        const esta = m.id === activa
        const destapada = revelar && esta
        return (
          <div
            key={m.id}
            className={`absolute rounded-sm ${destapada ? 'border-[3px] border-red-600' : esta ? 'border border-amber-700 bg-amber-500' : 'border border-amber-400 bg-amber-200'}`}
            style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}
          />
        )
      })}
    </div>
  )
}

/** Contenido de una tarjeta: pregunta y, si `revelar`, la respuesta. */
export function ContenidoTarjeta({ t, revelar }: { t: Tarjeta; revelar: boolean }) {
  if (t.tipo === 'cloze') {
    const { partes } = renderCloze(t.cloze ?? '', t.clozeN ?? 1, revelar)
    return (
      <div className="space-y-3">
        <p className="text-lg leading-relaxed">
          {partes.map((p, i) => p.hueco
            ? <span key={i} className={`rounded px-1 font-semibold ${revelar ? 'bg-marca/15 text-marca dark:text-marca-claro' : 'bg-amber-500/20 text-amber-700 dark:text-amber-300'}`}>{p.t}</span>
            : <span key={i}>{p.t}</span>)}
        </p>
        {revelar && t.dorso && <div className="border-t pt-3 text-sm texto-suave borde"><Markdown texto={t.dorso} /></div>}
      </div>
    )
  }
  if (t.tipo === 'oclusion') {
    const m = t.mascaras?.find((x) => x.id === t.mascara)
    return (
      <div className="space-y-3 text-center">
        {t.frente && <p className="text-base font-medium">{t.frente}</p>}
        <ImagenOclusion imagenId={t.imagenId} mascaras={t.mascaras ?? []} activa={t.mascara} revelar={revelar} />
        {revelar && <p className="text-lg font-semibold text-marca dark:text-marca-claro">{m?.etiqueta}</p>}
        {revelar && t.dorso && <div className="text-sm texto-suave"><Markdown texto={t.dorso} /></div>}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      <div className="text-lg font-medium leading-relaxed"><Markdown texto={t.frente} /></div>
      {revelar && <div className="border-t pt-3 leading-relaxed borde"><Markdown texto={t.dorso} /></div>}
    </div>
  )
}

/** Resumen de una línea (listas). */
export function resumenTarjeta(t: Pick<Tarjeta, 'tipo' | 'frente' | 'cloze' | 'mascaras' | 'mascara'>) {
  if (t.tipo === 'cloze') return (t.cloze ?? '').replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/gs, '[$1]')
  if (t.tipo === 'oclusion') return `${t.frente || 'Oclusión de imagen'} · ${t.mascaras?.find((m) => m.id === t.mascara)?.etiqueta ?? `${t.mascaras?.length ?? 0} máscaras`}`
  return t.frente
}
