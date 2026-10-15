import { useState } from 'react'
import { fmt } from '../ejercicios'
import { basesBuffer, excesoBases, hco3HH, hco3LineaBuffer, interpretarGasometria, pco2HH, phHH, type Interpretacion } from '../formulas/acidobase'
import { CitasGuia, Dato, Deslizador, EjercicioSim, Panel } from '../ui'

const PH_MIN = 6.9, PH_MAX = 7.8, HCO3_MAX = 50

/** Diagrama de Davenport: HCO3− vs pH, con isóbaras de pCO2, línea buffer normal, punto del paciente y banda de compensación. */
function Davenport({ ph, hco3, interp }: { ph: number; hco3: number; interp?: Interpretacion }) {
  const W = 520, H = 320, x0 = 40, y0 = H - 30
  const X = (p: number) => x0 + ((p - PH_MIN) / (PH_MAX - PH_MIN)) * (W - x0 - 12)
  const Y = (h: number) => y0 - (h / HCO3_MAX) * (y0 - 12)
  const phs = Array.from({ length: 46 }, (_, k) => PH_MIN + (k * (PH_MAX - PH_MIN)) / 45)
  const isobara = (pco2: number) => phs.map((p) => [p, hco3HH(p, pco2)] as const).filter(([, h]) => h <= HCO3_MAX)
  // Banda de compensación esperada: el segmento de la isóbara (metabólicos: rango de pCO2) o de la recta (respiratorios: rango de HCO3−)
  let banda: [number, number][] = []
  if (interp?.esperado) {
    const { variable, min, max } = interp.esperado
    if (variable === 'pCO2') {
      banda = [[phHH(hco3, min), hco3], [phHH(hco3, max), hco3]]
    } else {
      const pco2 = pco2HH(ph, hco3)
      banda = [[phHH(min, pco2), min], [phHH(max, pco2), max]]
    }
  }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Diagrama de Davenport">
      <rect x={X(7.35)} y={Y(26)} width={X(7.45) - X(7.35)} height={Y(22) - Y(26)} fill="#10b981" opacity={0.15} />
      <line x1={x0} y1={y0} x2={W - 10} y2={y0} stroke="currentColor" opacity={0.4} />
      <line x1={x0} y1={y0} x2={x0} y2={10} stroke="currentColor" opacity={0.4} />
      {[7.0, 7.2, 7.4, 7.6, 7.8].map((p) => <text key={p} x={X(p)} y={y0 + 13} fontSize="12" textAnchor="middle" fill="currentColor" opacity={0.6}>{fmt(p, 1)}</text>)}
      {[10, 20, 30, 40, 50].map((h) => <text key={h} x={x0 - 5} y={Y(h) + 3} fontSize="12" textAnchor="end" fill="currentColor" opacity={0.6}>{h}</text>)}
      <text x={(W + x0) / 2} y={H - 4} fontSize="12" textAnchor="middle" fill="currentColor" opacity={0.7}>pH</text>
      <text x={8} y={12} fontSize="12" fill="currentColor" opacity={0.7}>HCO3− (mEq/L)</text>
      {[20, 30, 40, 60, 80].map((pc) => {
        const pts = isobara(pc)
        const fin = pts[0]
        return (
          <g key={pc}>
            <polyline points={pts.map(([p, h]) => `${X(p)},${Y(h)}`).join(' ')} fill="none" stroke="#64748b" strokeWidth={pc === 40 ? 1.8 : 1} opacity={pc === 40 ? 0.9 : 0.6} />
            {fin && <text x={X(fin[0]) + 3} y={Y(fin[1]) - 3} fontSize="12" fill="#64748b">{pc}</text>}
          </g>
        )
      })}
      <line x1={X(7.0)} y1={Y(hco3LineaBuffer(7.0))} x2={X(7.8)} y2={Y(hco3LineaBuffer(7.8))} stroke="#8b5cf6" strokeWidth={1.5} strokeDasharray="5 3" />
      {banda.length === 2 && <line x1={X(banda[0][0])} y1={Y(banda[0][1])} x2={X(banda[1][0])} y2={Y(banda[1][1])} stroke="#f59e0b" strokeWidth={8} strokeLinecap="round" opacity={0.6} />}
      <circle cx={X(7.4)} cy={Y(24)} r={4} fill="#10b981" />
      {ph >= PH_MIN && ph <= PH_MAX && hco3 <= HCO3_MAX && <circle cx={X(ph)} cy={Y(hco3)} r={6} fill="#ef4444" stroke="white" strokeWidth={1.5} />}
      <text x={W - 12} y={24} fontSize="12" textAnchor="end" fill="#64748b">isóbaras de pCO2 (mmHg)</text>
      <text x={W - 12} y={40} fontSize="12" textAnchor="end" fill="#8b5cf6">línea buffer normal</text>
      {banda.length === 2 && <text x={W - 12} y={56} fontSize="12" textAnchor="end" fill="#f59e0b">banda de compensación esperada</text>}
    </svg>
  )
}

export default function AcidoBase() {
  const [pco2, setPco2] = useState(40)
  const [hco3, setHco3] = useState(24)
  const ph = phHH(hco3, pco2)

  const [g, setG] = useState({ ph: '7,25', pco2: '28', hco3: '12', na: '140', cl: '104', albumina: '', cronica: false })
  const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : undefined)
  const datos = { ph: num(g.ph), pco2: num(g.pco2), hco3: num(g.hco3) }
  const valido = datos.ph !== undefined && datos.pco2 !== undefined && datos.hco3 !== undefined && [datos.ph, datos.pco2, datos.hco3].every((x) => Number.isFinite(x) && (x as number) > 0)
  const interp = valido ? interpretarGasometria({ ph: datos.ph!, pco2: datos.pco2!, hco3: datos.hco3!, na: num(g.na), cl: num(g.cl), albumina: num(g.albumina), cronica: g.cronica }) : undefined

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          El pH de la sangre depende del cociente HCO3− / CO2 disuelto (Henderson-Hasselbalch: pH = 6,1 + log(HCO3− / 0,03 × pCO2)). En el
          diagrama de Davenport cada curva es una pCO2 constante (isóbara); los cambios respiratorios agudos se mueven sobre la línea buffer y los
          metabólicos sobre una isóbara. El exceso de bases cuantifica el componente metabólico.
        </p>
        <CitasGuia simulador="acidobase" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel titulo="Henderson-Hasselbalch">
          <Deslizador etiqueta="pCO2" valor={pco2} min={10} max={100} unidad="mmHg" alCambiar={setPco2} />
          <Deslizador etiqueta="HCO3−" valor={hco3} min={4} max={50} paso={0.5} decimales={1} unidad="mEq/L" alCambiar={setHco3} />
          <div className="grid grid-cols-2 gap-2">
            <Dato etiqueta="pH" valor={ph} decimales={2} tono={ph < 7.35 || ph > 7.45 ? 'mal' : 'bien'} />
            <Dato etiqueta="CO2 disuelto" valor={0.03 * pco2} unidad="mmol/L" decimales={2} />
            <Dato etiqueta="Exceso de bases" valor={excesoBases(ph, hco3)} unidad="mEq/L" />
            <Dato etiqueta="Bases buffer" valor={basesBuffer(ph, hco3)} unidad="mEq/L" />
          </div>
          <p className="text-xs texto-suave">Cociente HCO3− / CO2 = {fmt(hco3 / (0.03 * pco2))} (normal 20).</p>
        </Panel>
        <Panel titulo="Diagrama de Davenport">
          <Davenport ph={ph} hco3={hco3} />
        </Panel>
      </div>
      <Panel titulo="Intérprete de gasometrías paso a paso">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {([['ph', 'pH'], ['pco2', 'pCO2 (mmHg)'], ['hco3', 'HCO3− (mEq/L)'], ['na', 'Na⁺ (opcional)'], ['cl', 'Cl⁻ (opcional)'], ['albumina', 'Albúmina g/dL (opc.)']] as const).map(([k, n]) => (
            <label key={k} className="text-xs">{n}<input className="campo mt-1" inputMode="decimal" value={g[k]} onChange={(e) => setG({ ...g, [k]: e.target.value })} /></label>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={g.cronica} onChange={(e) => setG({ ...g, cronica: e.target.checked })} /> Cuadro respiratorio de más de 2–3 días (crónico)</label>
        {interp ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-base font-semibold">{interp.primario === 'normal' ? 'Sin trastorno ácido-base' : `${interp.primario}${interp.compensacion === 'adecuada' ? ', compensación adecuada' : ''}${interp.agregado ? ` + ${interp.agregado}` : ''}`}</p>
              <ol className="space-y-1.5 text-sm">{interp.pasos.map((p, i) => <li key={i} className={!interp.coherente && i === 0 ? 'text-red-600' : ''}>{p}</li>)}</ol>
            </div>
            <Davenport ph={datos.ph!} hco3={datos.hco3!} interp={interp} />
          </div>
        ) : <p className="text-sm texto-suave">Cargá pH, pCO2 y HCO3−.</p>}
        <p className="text-xs texto-suave">Reglas de compensación: Winter (pCO2 = 1,5 × HCO3− + 8 ± 2); alcalosis metabólica pCO2 = 0,7 × HCO3− + 21 ± 2; respiratorias: HCO3− cambia 1 (aguda) o 3,5 (crónica) por cada 10 mmHg en la acidosis, y 2 o 5 en la alcalosis.</p>
      </Panel>
      <EjercicioSim simulador="acidobase" />
    </div>
  )
}
