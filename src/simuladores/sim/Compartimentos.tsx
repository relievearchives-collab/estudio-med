import { useState } from 'react'
import { fmt } from '../ejercicios'
import { aplicarEvento, clasificarCambio, compartimentosIniciales, type Compartimentos as C, type Sexo } from '../formulas/liquidos'
import { CitasGuia, Dato, Deslizador, EjercicioSim, Panel } from '../ui'

const LIQUIDOS = [
  { id: 'agua', nombre: 'Agua pura (o dextrosa 5 %)', osm: 0 },
  { id: 'iso', nombre: 'Isotónica (NaCl 0,9 %)', osm: 290 },
  { id: 'hiper', nombre: 'Hipertónica (NaCl 3 %)', osm: 1026 },
  { id: 'hipo', nombre: 'Hipotónica (NaCl 0,45 %)', osm: 154 },
]

/** Diagrama de Darrow-Yannet: ancho = volumen (LIC a la izquierda, LEC a la derecha), alto = osmolaridad. */
function Diagrama({ antes, despues }: { antes: C; despues: C }) {
  const W = 520, H = 220, x0 = 30, base = H - 25
  const escalaV = (W - 60) / Math.max(antes.act, despues.act) / 1.05
  const escalaO = (H - 50) / 400
  const rect = (x: number, ancho: number, osm: number) => ({ x, y: base - osm * escalaO, w: ancho * escalaV, h: osm * escalaO })
  const licA = rect(x0, antes.lic, antes.osm), lecA = rect(x0 + antes.lic * escalaV, antes.lec, antes.osm)
  const licD = rect(x0, despues.lic, despues.osm), lecD = rect(x0 + despues.lic * escalaV, despues.lec, despues.osm)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Diagrama de Darrow-Yannet">
      <line x1={x0} y1={base} x2={W - 10} y2={base} stroke="currentColor" opacity={0.4} />
      <line x1={x0} y1={base} x2={x0} y2={15} stroke="currentColor" opacity={0.4} />
      <text x={x0 - 4} y={14} fontSize="12" textAnchor="end" fill="currentColor" opacity={0.6}>mOsm</text>
      {[100, 200, 300].map((o) => <text key={o} x={x0 - 4} y={base - o * escalaO + 3} fontSize="12" textAnchor="end" fill="currentColor" opacity={0.5}>{o}</text>)}
      <rect {...{ x: licD.x, y: licD.y, width: licD.w, height: licD.h }} fill="#0ea5e9" opacity={0.35} />
      <rect {...{ x: lecD.x, y: lecD.y, width: lecD.w, height: lecD.h }} fill="#f59e0b" opacity={0.35} />
      <rect {...{ x: licA.x, y: licA.y, width: licA.w, height: licA.h }} fill="none" stroke="#0ea5e9" strokeDasharray="4 3" strokeWidth={1.5} />
      <rect {...{ x: lecA.x, y: lecA.y, width: lecA.w, height: lecA.h }} fill="none" stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
      <text x={licD.x + licD.w / 2} y={base + 14} fontSize="13" textAnchor="middle" fill="currentColor">LIC {fmt(despues.lic)} L</text>
      <text x={lecD.x + lecD.w / 2} y={base + 14} fontSize="13" textAnchor="middle" fill="currentColor">LEC {fmt(despues.lec)} L</text>
      <text x={W - 6} y={Math.min(licD.y, lecD.y) - 6} fontSize="13" textAnchor="end" fill="currentColor">{fmt(despues.osm)} mOsm/L</text>
    </svg>
  )
}

export default function Compartimentos() {
  const [peso, setPeso] = useState(70)
  const [sexo, setSexo] = useState<Sexo>('hombre')
  const [liquido, setLiquido] = useState('agua')
  const [sentido, setSentido] = useState<'ganancia' | 'perdida'>('ganancia')
  const [volumen, setVolumen] = useState(2)
  const antes = compartimentosIniciales(peso, sexo, 290)
  const l = LIQUIDOS.find((x) => x.id === liquido)!
  let despues: C = antes
  let error = ''
  try { despues = aplicarEvento(antes, sentido === 'ganancia' ? volumen : -volumen, l.osm) } catch (e) { error = (e as Error).message }

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          El agua corporal total (60 % del peso en el hombre adulto, 50 % en la mujer) se reparte en LIC (2/3) y LEC (1/3). El agua atraviesa
          libremente las membranas hasta igualar la osmolaridad; el Na⁺ queda en el LEC. Por eso un cambio de agua se reparte entre ambos
          compartimentos, y uno isotónico solo modifica el LEC.
        </p>
        <CitasGuia simulador="compartimentos" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel titulo="Paciente y evento">
          <Deslizador etiqueta="Peso" valor={peso} min={30} max={120} unidad="kg" alCambiar={setPeso} />
          <div className="flex gap-1">{(['hombre', 'mujer'] as const).map((s) => <button key={s} className={sexo === s ? 'chip-activo' : 'chip'} onClick={() => setSexo(s)}>{s === 'hombre' ? 'Hombre (60 %)' : 'Mujer (50 %)'}</button>)}</div>
          <div className="flex gap-1">{(['ganancia', 'perdida'] as const).map((s) => <button key={s} className={sentido === s ? 'chip-activo' : 'chip'} onClick={() => setSentido(s)}>{s === 'ganancia' ? 'Ganancia' : 'Pérdida'}</button>)}</div>
          <div className="grid gap-1">{LIQUIDOS.map((x) => <button key={x.id} className={liquido === x.id ? 'chip-activo justify-start' : 'chip justify-start'} onClick={() => setLiquido(x.id)}>{x.nombre}</button>)}</div>
          <Deslizador etiqueta="Volumen" valor={volumen} min={0} max={10} paso={0.5} decimales={1} unidad="L" alCambiar={setVolumen} />
        </Panel>
        <Panel titulo="Diagrama de Darrow-Yannet">
          {error ? <p className="text-sm text-red-600">{error}</p> : <Diagrama antes={antes} despues={despues} />}
          <p className="text-xs texto-suave">Punteado: antes. Relleno: después. Celeste: LIC; naranja: LEC.</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Dato etiqueta="Osmolaridad" valor={despues.osm} unidad="mOsm/L" tono={Math.abs(despues.osm - 290) < 1 ? undefined : 'alerta'} />
            <Dato etiqueta="LIC" valor={despues.lic} unidad="L" nota={`antes ${fmt(antes.lic)}`} />
            <Dato etiqueta="LEC" valor={despues.lec} unidad="L" nota={`antes ${fmt(antes.lec)}`} />
            <Dato etiqueta="Plasma" valor={despues.plasma} unidad="L" decimales={2} />
            <Dato etiqueta="Intersticio" valor={despues.intersticio} unidad="L" />
            <Dato etiqueta="Agua total" valor={despues.act} unidad="L" />
          </div>
          {!error && <p className="text-sm"><b>Resultado:</b> {clasificarCambio(antes, despues)} del LEC.</p>}
        </Panel>
      </div>
      <EjercicioSim simulador="compartimentos" />
    </div>
  )
}
