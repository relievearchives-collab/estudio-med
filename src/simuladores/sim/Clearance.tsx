import { useState } from 'react'
import { fmt } from '../ejercicios'
import { cargas, ckdEpi2021, clearance, cockcroftGault, estadioERC, mdrd } from '../formulas/renal'
import { CitasGuia, Dato, Deslizador, EjercicioSim, Panel } from '../ui'

export default function Clearance() {
  const [edad, setEdad] = useState(50)
  const [sexo, setSexo] = useState<'hombre' | 'mujer'>('hombre')
  const [peso, setPeso] = useState(70)
  const [cr, setCr] = useState(1)
  const cg = cockcroftGault(edad, peso, cr, sexo)
  const md = mdrd(edad, cr, sexo)
  const ckd = ckdEpi2021(edad, cr, sexo)

  const [u, setU] = useState(100)
  const [v, setV] = useState(1)
  const [p, setP] = useState(1)
  const [tfg, setTfg] = useState(125)
  const cl = clearance(u, v, p)
  const ca = cargas(tfg, p, u, v)
  const manejo = Math.abs(cl - tfg) / tfg < 0.05 ? 'solo se filtra (como la inulina): clearance = TFG' : cl < tfg ? 'se filtra y se reabsorbe en forma neta: clearance < TFG' : 'se filtra y además se secreta en forma neta: clearance > TFG'

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          El clearance es el volumen de plasma que queda libre de una sustancia por minuto: C = U × V / P. Si una sustancia solo se filtra, su
          clearance es la TFG. En la clínica se estima la TFG con la creatinina plasmática y fórmulas que corrigen por edad, sexo y (en
          Cockcroft-Gault) peso.
        </p>
        <p className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-800 dark:text-amber-300">
          La guía nombra Cockcroft-Gault, MDRD y CKD-EPI sin indicar la versión: acá se usa <b>CKD-EPI 2021</b> (sin raza) y MDRD de 4 variables con
          creatinina estandarizada (IDMS). Si tu cátedra usa otra versión, el resultado puede diferir un poco.
        </p>
        <CitasGuia simulador="clearance" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel titulo="TFG estimada por creatinina">
          <div className="flex gap-1">{(['hombre', 'mujer'] as const).map((s) => <button key={s} className={sexo === s ? 'chip-activo' : 'chip'} onClick={() => setSexo(s)}>{s === 'hombre' ? 'Hombre' : 'Mujer'}</button>)}</div>
          <Deslizador etiqueta="Edad" valor={edad} min={18} max={95} unidad="años" alCambiar={setEdad} />
          <Deslizador etiqueta="Peso" valor={peso} min={35} max={150} unidad="kg" alCambiar={setPeso} ayuda="solo lo usa Cockcroft-Gault" />
          <Deslizador etiqueta="Creatinina plasmática" valor={cr} min={0.3} max={8} paso={0.05} decimales={2} unidad="mg/dL" alCambiar={setCr} />
          <div className="grid grid-cols-3 gap-2">
            <Dato etiqueta="Cockcroft-Gault" valor={cg} unidad="mL/min" decimales={0} />
            <Dato etiqueta="MDRD-4" valor={md} unidad="mL/min/1,73m²" decimales={0} />
            <Dato etiqueta="CKD-EPI 2021" valor={ckd} unidad="mL/min/1,73m²" decimales={0} tono={ckd < 60 ? 'alerta' : undefined} />
          </div>
          <p className="text-sm">Estadio KDIGO según CKD-EPI: <b>{estadioERC(ckd)}</b>.</p>
          <p className="text-xs texto-suave">Cockcroft-Gault estima el clearance de creatinina (no normalizado por superficie) y sobreestima la TFG porque la creatinina también se secreta.</p>
        </Panel>
        <Panel titulo="Clearance de una sustancia y cargas">
          <Deslizador etiqueta="Concentración urinaria (U)" valor={u} min={0} max={500} unidad="mg/dL" alCambiar={setU} />
          <Deslizador etiqueta="Volumen minuto (V)" valor={v} min={0.3} max={15} paso={0.1} decimales={1} unidad="mL/min" alCambiar={setV} />
          <Deslizador etiqueta="Concentración plasmática (P)" valor={p} min={0.1} max={20} paso={0.1} decimales={1} unidad="mg/dL" alCambiar={setP} />
          <Deslizador etiqueta="TFG" valor={tfg} min={20} max={180} unidad="mL/min" alCambiar={setTfg} />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Dato etiqueta="Clearance" valor={cl} unidad="mL/min" />
            <Dato etiqueta="Carga filtrada" valor={ca.filtrada} unidad="mg/min" decimales={2} />
            <Dato etiqueta="Carga excretada" valor={ca.excretada} unidad="mg/min" decimales={2} />
            <Dato etiqueta={ca.transporteNeto >= 0 ? 'Reabsorbida' : 'Secretada'} valor={Math.abs(ca.transporteNeto)} unidad="mg/min" decimales={2} />
            <Dato etiqueta="Fracción excretada" valor={ca.fraccionExcretada * 100} unidad="%" />
          </div>
          <p className="text-sm">La sustancia <b>{manejo}</b>.</p>
          <p className="text-xs texto-suave">Carga filtrada = TFG × P; excretada = U × V ({fmt(u)} × {fmt(v)} / 100 = {fmt(ca.excretada, 2)} mg/min).</p>
        </Panel>
      </div>
      <EjercicioSim simulador="clearance" />
    </div>
  )
}
