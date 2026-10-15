import { useState } from 'react'
import { fmt } from '../ejercicios'
import { circulacionGlomerular, CIRCULACION_BASAL } from '../formulas/renal'
import { Barra, CitasGuia, Dato, Deslizador, EjercicioSim, Panel } from '../ui'

export default function Starling() {
  const [c, setC] = useState(CIRCULACION_BASAL)
  const r = circulacionGlomerular(c)
  const b = circulacionGlomerular(CIRCULACION_BASAL)
  const set = (k: keyof typeof c) => (v: number) => setC({ ...c, [k]: v })
  const flecha = (x: number, y: number) => (Math.abs(x - y) / y < 0.02 ? '=' : x > y ? '↑' : '↓')

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          La TFG = Kf × presión neta de filtración, con PNF = (PCG − PBowman) − (πCG − πBowman). La presión hidrostática del capilar glomerular
          (PCG) depende de las resistencias de las dos arteriolas: contraer la <b>aferente</b> baja la PCG y el flujo; contraer la
          <b> eferente</b> sube la PCG pero baja el flujo plasmático, y la fracción de filtración (TFG/FPR) aumenta. A medida que se filtra, la
          presión oncótica del capilar sube a lo largo del glomérulo.
        </p>
        <CitasGuia simulador="starling" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel titulo="Controles">
          <Deslizador etiqueta="Presión arterial media" valor={c.pam} min={60} max={160} unidad="mmHg" alCambiar={set('pam')} />
          <Deslizador etiqueta="Resistencia aferente" valor={c.aferente} min={0.5} max={2.5} paso={0.05} decimales={2} unidad="× basal" alCambiar={set('aferente')} ayuda="> 1 = vasoconstricción (simpático, AINEs al quitar prostaglandinas)" />
          <Deslizador etiqueta="Resistencia eferente" valor={c.eferente} min={0.5} max={2.5} paso={0.05} decimales={2} unidad="× basal" alCambiar={set('eferente')} ayuda="> 1 = vasoconstricción (angiotensina II); < 1 = IECA/ARA II" />
          <Deslizador etiqueta="Kf" valor={c.kf} min={4} max={20} paso={0.5} decimales={1} unidad="mL/min/mmHg" alCambiar={set('kf')} />
          <Deslizador etiqueta="Presión en Bowman" valor={c.pcb} min={5} max={50} unidad="mmHg" alCambiar={set('pcb')} ayuda="sube si hay obstrucción urinaria" />
          <Deslizador etiqueta="π del plasma que entra" valor={c.piPlasma} min={15} max={40} unidad="mmHg" alCambiar={set('piPlasma')} ayuda="baja con hipoproteinemia" />
          <button className="btn-secundario" onClick={() => setC(CIRCULACION_BASAL)}>Volver al basal</button>
        </Panel>
        <Panel titulo="Resultados">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Dato etiqueta={`TFG ${flecha(r.tfg, b.tfg)}`} valor={r.tfg} unidad="mL/min" tono={r.tfg < 90 ? 'alerta' : undefined} />
            <Dato etiqueta={`FPR ${flecha(r.fpr, b.fpr)}`} valor={r.fpr} unidad="mL/min" decimales={0} />
            <Dato etiqueta={`Fracción de filtración ${flecha(r.ff, b.ff)}`} valor={r.ff * 100} unidad="%" />
            <Dato etiqueta={`PCG ${flecha(r.pcg, b.pcg)}`} valor={r.pcg} unidad="mmHg" />
            <Dato etiqueta="π capilar media" valor={r.piMedia} unidad="mmHg" />
            <Dato etiqueta="PNF" valor={r.pnf} unidad="mmHg" tono={r.pnf <= 0 ? 'mal' : undefined} />
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide texto-suave">Fuerzas (mmHg)</p>
            <Barra etiqueta="A favor: PCG" valor={r.pcg} maximo={120} color="bg-emerald-500" texto={fmt(r.pcg)} />
            <Barra etiqueta="En contra: P Bowman" valor={c.pcb} maximo={120} color="bg-red-500" texto={fmt(c.pcb)} />
            <Barra etiqueta="En contra: π capilar media" valor={r.piMedia} maximo={120} color="bg-amber-500" texto={fmt(r.piMedia)} />
            <Barra etiqueta="Neta (PNF)" valor={Math.max(0, r.pnf)} maximo={120} color="bg-marca" texto={fmt(r.pnf)} />
          </div>
          <p className="text-xs texto-suave">Modelo didáctico (arteriolas en serie, π que sube a lo largo del capilar); valores basales: PAM 100, PCG 60, FSR ≈ 1100 mL/min, TFG ≈ 125 mL/min. No modela la autorregulación.</p>
        </Panel>
      </div>
      <EjercicioSim simulador="starling" />
    </div>
  )
}
