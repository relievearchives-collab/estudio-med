import { useRef, useState } from 'react'
import { nombreDisciplina, paqueteActivo } from '../contenido'
import { nuevoId } from '../repositorio'
import { useImagenTarjeta, useTemas } from '../repositorio/hooks'
import type { Mascara } from '../repositorio/tipos'
import type { BorradorTarjeta } from '../tarjetas/crear'
import { numerosCloze } from '../tarjetas/fsrs'
import { Icono } from './Icono'
import { useUrlBlob } from './TarjetaVista'

/** Formulario de una tarjeta (controlado). La oclusión usa su propio editor de máscaras. */
export function EditorTarjeta({ b, alCambiar, compacto }: { b: BorradorTarjeta; alCambiar: (b: BorradorTarjeta) => void; compacto?: boolean }) {
  const set = (c: Partial<BorradorTarjeta>) => alCambiar({ ...b, ...c })
  const cambiarTipo = (tipo: BorradorTarjeta['tipo']) => {
    if (tipo === b.tipo) return
    // Pasar de básica a cloze: arma un cloze con la respuesta como hueco; y al revés.
    if (tipo === 'cloze') set({ tipo, cloze: b.cloze || (b.frente && b.dorso ? `${b.frente} {{c1::${b.dorso}}}` : ''), dorso: '' })
    else if (tipo === 'basica') {
      const m = /\{\{c\d+::(.*?)(?:::.*?)?\}\}/s.exec(b.cloze ?? '')
      set({ tipo, frente: b.frente || (b.cloze ?? '').replace(/\{\{c\d+::(.*?)(?:::.*?)?\}\}/gs, '___'), dorso: b.dorso || m?.[1] || '' })
    }
  }
  const areaCloze = useRef<HTMLTextAreaElement>(null)
  const envolverCloze = () => {
    const el = areaCloze.current
    const texto = b.cloze ?? ''
    if (!el || el.selectionStart === el.selectionEnd) return
    const n = Math.max(0, ...numerosCloze(texto)) + 1
    const nuevo = `${texto.slice(0, el.selectionStart)}{{c${n}::${texto.slice(el.selectionStart, el.selectionEnd)}}}${texto.slice(el.selectionEnd)}`
    set({ cloze: nuevo })
  }

  return (
    <div className="space-y-2">
      {b.tipo !== 'oclusion' && (
        <div className="flex gap-1">
          {(['basica', 'cloze'] as const).map((t) => (
            <button key={t} type="button" className={b.tipo === t ? 'chip-activo' : 'chip'} onClick={() => cambiarTipo(t)}>{t === 'basica' ? 'Pregunta / respuesta' : 'Completar (cloze)'}</button>
          ))}
        </div>
      )}
      {b.tipo === 'basica' && (
        <>
          <textarea className="campo min-h-[3rem]" rows={compacto ? 2 : 3} placeholder="Frente (pregunta)" value={b.frente} onChange={(e) => set({ frente: e.target.value })} />
          <textarea className="campo min-h-[3rem]" rows={compacto ? 2 : 3} placeholder="Dorso (respuesta)" value={b.dorso} onChange={(e) => set({ dorso: e.target.value })} />
        </>
      )}
      {b.tipo === 'cloze' && (
        <>
          <textarea ref={areaCloze} className="campo min-h-[3rem] font-mono text-[13px]" rows={compacto ? 2 : 3} placeholder="La {{c1::mácula densa}} detecta el NaCl…" value={b.cloze ?? ''} onChange={(e) => set({ cloze: e.target.value })} />
          <div className="flex flex-wrap items-center gap-2 text-xs texto-suave">
            <button type="button" className="btn-secundario !px-2 !py-1 text-xs" onMouseDown={(e) => e.preventDefault()} onClick={envolverCloze}>[…] Ocultar lo seleccionado</button>
            <span>{numerosCloze(b.cloze ?? '').length || 'Sin'} hueco(s): cada número es una tarjeta.</span>
          </div>
          <input className="campo" placeholder="Extra (opcional, se muestra al revelar)" value={b.dorso} onChange={(e) => set({ dorso: e.target.value })} />
        </>
      )}
      {b.tipo === 'oclusion' && (
        <>
          <input className="campo" placeholder="Consigna (opcional): ej. ¿Qué estructura es?" value={b.frente} onChange={(e) => set({ frente: e.target.value })} />
          <EditorOclusion imagenId={b.imagenId} mascaras={b.mascaras ?? []} alCambiar={(mascaras) => set({ mascaras })} />
          <input className="campo" placeholder="Extra (opcional, se muestra al revelar)" value={b.dorso} onChange={(e) => set({ dorso: e.target.value })} />
        </>
      )}
      {!compacto && <SelectorTemaTarjeta b={b} alCambiar={alCambiar} />}
    </div>
  )
}

/** Unidad y tema de la tarjeta (sirve para filtrar, para "temas flojos" y para el mazo de Anki). */
export function SelectorTemaTarjeta({ b, alCambiar }: { b: BorradorTarjeta; alCambiar: (b: BorradorTarjeta) => void }) {
  const temas = useTemas() ?? []
  return (
    <div className="flex flex-wrap gap-2 text-sm">
      <select className="campo !w-auto !py-1.5" value={b.unidadId ?? ''} aria-label="Unidad" onChange={(e) => alCambiar({ ...b, unidadId: e.target.value || undefined, temaId: undefined, disciplinaId: undefined })}>
        <option value="">Sin unidad</option>
        {paqueteActivo.unidades.map((u) => <option key={u.id} value={u.id}>{u.sigla} · {u.titulo}</option>)}
      </select>
      <select className="campo !w-auto max-w-[18rem] !py-1.5" value={b.temaId ?? ''} aria-label="Tema" onChange={(e) => {
        const t = temas.find((x) => x.id === e.target.value)
        alCambiar({ ...b, temaId: t?.id, unidadId: t?.unidadId ?? b.unidadId, disciplinaId: t?.disciplinaId })
      }}>
        <option value="">Sin tema</option>
        {temas.filter((t) => !b.unidadId || t.unidadId === b.unidadId).map((t) => <option key={t.id} value={t.id}>{nombreDisciplina(t.disciplinaId)}: {t.nombre}</option>)}
      </select>
    </div>
  )
}

/** Dibujar rectángulos sobre la imagen arrastrando; cada uno pide su etiqueta. */
export function EditorOclusion({ imagenId, mascaras, alCambiar }: { imagenId?: string; mascaras: Mascara[]; alCambiar: (m: Mascara[]) => void }) {
  const img = useImagenTarjeta(imagenId)
  const url = useUrlBlob(img?.archivo)
  const caja = useRef<HTMLDivElement>(null)
  const [dibujo, setDibujo] = useState<{ x0: number; y0: number; x: number; y: number } | null>(null)
  const [elegida, setElegida] = useState<string | null>(null)
  /** Máscara recién dibujada: su etiqueta toma el foco sin mover la página. */
  const enfocar = useRef<string | null>(null)
  const pos = (e: React.PointerEvent) => {
    const r = caja.current!.getBoundingClientRect()
    return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }
  }
  const rect = (d: NonNullable<typeof dibujo>) => ({ x: Math.min(d.x0, d.x), y: Math.min(d.y0, d.y), w: Math.abs(d.x - d.x0), h: Math.abs(d.y - d.y0) })
  if (!url) return <p className="text-sm texto-suave">Cargando imagen…</p>

  return (
    <div className="space-y-2">
      <p className="text-xs texto-suave">Arrastrá sobre la imagen para tapar cada estructura y escribí qué es. Cada máscara es una tarjeta.</p>
      <div
        ref={caja} className="relative inline-block max-w-full cursor-crosshair touch-none select-none"
        onPointerDown={(e) => { if ((e.target as HTMLElement).dataset.mascara) return; const p = pos(e); setDibujo({ x0: p.x, y0: p.y, ...p }); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
        onPointerMove={(e) => { if (dibujo) setDibujo({ ...dibujo, ...pos(e) }) }}
        onPointerUp={() => {
          if (!dibujo) return
          const r = rect(dibujo)
          setDibujo(null)
          if (r.w < 0.015 || r.h < 0.015) return
          const m: Mascara = { id: nuevoId('m-').slice(0, 12), ...r, etiqueta: '' }
          alCambiar([...mascaras, m])
          setElegida(m.id)
          enfocar.current = m.id
        }}
      >
        <img src={url} alt="" draggable={false} className="block max-h-[65vh] max-w-full rounded-lg" />
        {mascaras.map((m, i) => (
          <div
            key={m.id} data-mascara="1" onClick={() => setElegida(m.id)}
            className={`absolute flex items-center justify-center rounded-sm border text-[11px] font-bold text-amber-950 ${elegida === m.id ? 'border-2 border-red-600 bg-amber-400' : 'border-amber-700 bg-amber-400/90'}`}
            style={{ left: `${m.x * 100}%`, top: `${m.y * 100}%`, width: `${m.w * 100}%`, height: `${m.h * 100}%` }}
          >{i + 1}</div>
        ))}
        {dibujo && (() => { const r = rect(dibujo); return <div className="absolute border-2 border-dashed border-red-600 bg-amber-300/50" style={{ left: `${r.x * 100}%`, top: `${r.y * 100}%`, width: `${r.w * 100}%`, height: `${r.h * 100}%` }} /> })()}
      </div>
      <ol className="space-y-1">
        {mascaras.map((m, i) => (
          <li key={m.id} className="flex items-center gap-2 text-sm">
            <span className="w-5 text-right font-bold texto-suave">{i + 1}</span>
            <input
              className={`campo !py-1 ${elegida === m.id ? 'ring-2 ring-marca/40' : ''}`} placeholder="¿Qué hay debajo? (ej. Pelvis renal)" value={m.etiqueta}
              ref={(el) => { if (el && enfocar.current === m.id) { enfocar.current = null; el.focus({ preventScroll: true }) } }}
              onFocus={() => setElegida(m.id)}
              onChange={(e) => alCambiar(mascaras.map((x) => (x.id === m.id ? { ...x, etiqueta: e.target.value } : x)))}
            />
            <button type="button" className="btn-fantasma !p-1" aria-label="Quitar máscara" onClick={() => alCambiar(mascaras.filter((x) => x.id !== m.id))}><Icono nombre="basura" className="h-4 w-4" /></button>
          </li>
        ))}
      </ol>
    </div>
  )
}
