import { useState } from 'react'
import { fmt } from '../ejercicios'
import { glucosaRenal, pahRenal, umbralRenalGlucosa, umbralTeoricoGlucosa } from '../formulas/renal'
import { CitasGuia, Dato, Deslizador, EjercicioSim, Panel } from '../ui'

/** Gráfico de líneas en SVG con varias series y un marcador vertical. */
function Curvas({ series, xMax, yMax, marcador, etiquetaX, etiquetaY }: {
  series: { nombre: string; color: string; puntos: [number, number][] }[]
  xMax: number; yMax: number; marcador?: number; etiquetaX: string; etiquetaY: string
}) {
  const W = 520, H = 240, x0 = 44, y0 = H - 30
  const X = (x: number) => x0 + (x / xMax) * (W - x0 - 10)
  const Y = (y: number) => y0 - (y / yMax) * (y0 - 12)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Curvas de ${etiquetaY}`}>
      <line x1={x0} y1={y0} x2={W - 10} y2={y0} stroke="currentColor" opacity={0.4} />
      <line x1={x0} y1={y0} x2={x0} y2={10} stroke="currentColor" opacity={0.4} />
      {[0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={x0 - 4} y={Y(yMax * f) + 3} fontSize="12" textAnchor="end" fill="currentColor" opacity={0.6}>{fmt(yMax * f, 0)}</text>)}
      {[0.25, 0.5, 0.75, 1].map((f) => <text key={f} x={X(xMax * f)} y={y0 + 12} fontSize="12" textAnchor="middle" fill="currentColor" opacity={0.6}>{fmt(xMax * f, 0)}</text>)}
      <text x={(W + x0) / 2} y={H - 4} fontSize="12" textAnchor="middle" fill="currentColor" opacity={0.7}>{etiquetaX}</text>
      <text x={12} y={12} fontSize="12" fill="currentColor" opacity={0.7}>{etiquetaY}</text>
      {series.map((s) => <polyline key={s.nombre} points={s.puntos.map(([x, y]) => `${X(x)},${Y(Math.min(y, yMax))}`).join(' ')} fill="none" stroke={s.color} strokeWidth={2.5} />)}
      {marcador !== undefined && <line x1={X(marcador)} y1={y0} x2={X(marcador)} y2={12} stroke="currentColor" strokeDasharray="4 3" opacity={0.6} />}
      {series.map((s, i) => <g key={s.nombre} transform={`translate(${x0 + 10 + i * 150}, 18)`}><rect width="10" height="10" fill={s.color} /><text x="14" y="9" fontSize="12" fill="currentColor">{s.nombre}</text></g>)}
    </svg>
  )
}

export default function TmPah() {
  const [glu, setGlu] = useState(100)
  const [tfg, setTfg] = useState(125)
  const [tm, setTm] = useState(375)
  const [splay, setSplay] = useState(true)
  const cv = splay ? 0.15 : 0
  const g = glucosaRenal(glu, tfg, tm, cv)
  const xs = Array.from({ length: 61 }, (_, k) => k * 10)
  const curvas = xs.map((x) => [x, glucosaRenal(x, tfg, tm, cv)] as const)

  const [pah, setPah] = useState(2)
  const [fpr, setFpr] = useState(650)
  const p = pahRenal(pah, fpr, tfg)
  const pahs = Array.from({ length: 41 }, (_, k) => 0.5 + k * 2)

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          La glucosa se filtra y se reabsorbe en el túbulo proximal por transportadores saturables (SGLT): hasta un transporte máximo (Tm ≈ 375
          mg/min) se reabsorbe toda. Como las nefronas no tienen todas el mismo Tm, la glucosuria empieza antes del umbral teórico ("splay").
          El PAH se filtra y se secreta casi por completo: su clearance estima el flujo plasmático renal efectivo, hasta que la secreción se satura.
        </p>
        <CitasGuia simulador="tm-pah" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel titulo="Glucosa">
          <Deslizador etiqueta="Glucemia" valor={glu} min={0} max={600} paso={5} unidad="mg/dL" alCambiar={setGlu} />
          <Deslizador etiqueta="TFG" valor={tfg} min={40} max={180} unidad="mL/min" alCambiar={setTfg} />
          <Deslizador etiqueta="Tm de glucosa" valor={tm} min={150} max={500} paso={5} unidad="mg/min" alCambiar={setTm} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={splay} onChange={(e) => setSplay(e.target.checked)} /> Heterogeneidad entre nefronas (splay)</label>
          <div className="grid grid-cols-3 gap-2">
            <Dato etiqueta="Filtrada" valor={g.filtrada} unidad="mg/min" decimales={0} />
            <Dato etiqueta="Reabsorbida" valor={g.reabsorbida} unidad="mg/min" decimales={0} />
            <Dato etiqueta="Excretada" valor={g.excretada} unidad="mg/min" decimales={0} tono={g.excretada > 1 ? 'alerta' : undefined} />
          </div>
          <p className="text-sm">Umbral teórico: <b>{fmt(umbralTeoricoGlucosa(tfg, tm), 0)} mg/dL</b>{splay && <> · umbral real: <b>{fmt(umbralRenalGlucosa(tfg, tm, cv), 0)} mg/dL</b></>}.</p>
        </Panel>
        <Panel titulo="Curva de titulación de la glucosa">
          <Curvas
            xMax={600} yMax={Math.max(800, (tfg * 600) / 100)} marcador={glu} etiquetaX="glucemia (mg/dL)" etiquetaY="mg/min"
            series={[
              { nombre: 'Filtrada', color: '#0ea5e9', puntos: curvas.map(([x, c]) => [x, c.filtrada]) },
              { nombre: 'Reabsorbida', color: '#10b981', puntos: curvas.map(([x, c]) => [x, c.reabsorbida]) },
              { nombre: 'Excretada', color: '#f59e0b', puntos: curvas.map(([x, c]) => [x, c.excretada]) },
            ]}
          />
        </Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel titulo="PAH (ácido paraaminohipúrico)">
          <Deslizador etiqueta="PAH plasmático" valor={pah} min={0.5} max={80} paso={0.5} decimales={1} unidad="mg/dL" alCambiar={setPah} />
          <Deslizador etiqueta="Flujo plasmático renal real" valor={fpr} min={300} max={900} paso={10} unidad="mL/min" alCambiar={setFpr} />
          <div className="grid grid-cols-2 gap-2">
            <Dato etiqueta="Filtrado" valor={p.filtrada} unidad="mg/min" decimales={0} />
            <Dato etiqueta="Secretado" valor={p.secretada} unidad="mg/min" decimales={0} nota={p.secretada >= 79.9 ? 'saturado (Tm)' : undefined} />
            <Dato etiqueta="Excretado" valor={p.excretada} unidad="mg/min" decimales={0} />
            <Dato etiqueta="Clearance de PAH" valor={p.clearance} unidad="mL/min" decimales={0} nota={`FPR efectivo ≈ ${fmt(fpr * 0.9, 0)}`} />
          </div>
        </Panel>
        <Panel titulo="Clearance de PAH según su concentración">
          <Curvas
            xMax={80} yMax={Math.max(700, fpr)} marcador={pah} etiquetaX="PAH plasmático (mg/dL)" etiquetaY="mL/min"
            series={[
              { nombre: 'Clearance PAH', color: '#8b5cf6', puntos: pahs.map((x) => [x, pahRenal(x, fpr, tfg).clearance]) },
              { nombre: 'TFG', color: '#94a3b8', puntos: [[0, tfg], [80, tfg]] },
            ]}
          />
          <p className="text-xs texto-suave">A concentraciones bajas el clearance de PAH ≈ FPR efectivo (extracción ≈ 90 %); al saturarse la secreción (Tm ≈ 80 mg/min) tiende a la TFG.</p>
        </Panel>
      </div>
      <EjercicioSim simulador="tm-pah" />
    </div>
  )
}
