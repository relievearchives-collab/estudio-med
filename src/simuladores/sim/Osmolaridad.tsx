import { useState } from 'react'
import { fmt } from '../ejercicios'
import { atmAMmHg, osmolaridad, porcientoAMolar, presionOsmotica, tonicidad, UMBRAL_HEMOLISIS, volumenGlobulo } from '../formulas/liquidos'
import { CitasGuia, Dato, Deslizador, EjercicioSim, Panel } from '../ui'

/** σ: coeficiente de reflexión frente a la membrana del glóbulo rojo (1 = no la atraviesa; 0 = la atraviesa libremente). */
const SOLUTOS = [
  { id: 'nacl', nombre: 'NaCl', pm: 58.5, i: 2, phi: 0.93, sigma: 1, valencia: 1 },
  { id: 'kcl', nombre: 'KCl', pm: 74.5, i: 2, phi: 0.92, sigma: 1, valencia: 1 },
  { id: 'cacl2', nombre: 'CaCl₂', pm: 111, i: 3, phi: 0.86, sigma: 1, valencia: 2 },
  { id: 'glucosa', nombre: 'Glucosa', pm: 180, i: 1, phi: 1, sigma: 1, valencia: 0 },
  { id: 'urea', nombre: 'Urea', pm: 60, i: 1, phi: 1, sigma: 0, valencia: 0 },
  { id: 'sacarosa', nombre: 'Sacarosa', pm: 342, i: 1, phi: 1, sigma: 1, valencia: 0 },
]

/** Glóbulo rojo: disco que se hincha (hasta lisarse) o se arruga (crenocito). */
function GloboRojo({ volumen }: { volumen: number }) {
  const lisis = volumen >= UMBRAL_HEMOLISIS
  const r = 38 * Math.cbrt(Math.min(volumen, UMBRAL_HEMOLISIS))
  const crenado = volumen < 0.9
  const puntas = 18
  const camino = crenado
    ? Array.from({ length: puntas * 2 }, (_, k) => {
      const a = (k / (puntas * 2)) * Math.PI * 2
      const rr = k % 2 ? r : r * (1 + (0.9 - volumen) * 0.9)
      return `${k ? 'L' : 'M'}${80 + rr * Math.cos(a)},${60 + rr * Math.sin(a)}`
    }).join(' ') + 'Z'
    : ''
  return (
    <svg viewBox="0 0 160 120" className="mx-auto h-32" role="img" aria-label={lisis ? 'Glóbulo rojo lisado' : crenado ? 'Glóbulo rojo crenado' : 'Glóbulo rojo'}>
      {lisis ? (
        <>
          {Array.from({ length: 7 }, (_, k) => <path key={k} d={`M80 60 L${80 + 50 * Math.cos(k)} ${60 + 45 * Math.sin(k)}`} stroke="#dc2626" strokeWidth={4} opacity={0.5} strokeLinecap="round" />)}
          <text x="80" y="115" fontSize="11" textAnchor="middle" fill="#dc2626">hemólisis</text>
        </>
      ) : crenado ? (
        <path d={camino} fill="#dc2626" opacity={0.85} />
      ) : (
        <>
          <ellipse cx="80" cy="60" rx={r} ry={r * 0.92} fill="#dc2626" opacity={0.85} />
          <ellipse cx="80" cy="60" rx={r * 0.45 * Math.max(0.1, 1.5 - volumen)} ry={r * 0.4 * Math.max(0.1, 1.5 - volumen)} fill="#991b1b" opacity={0.6} />
        </>
      )}
    </svg>
  )
}

export default function Osmolaridad() {
  const [solutoId, setSolutoId] = useState('nacl')
  const [porc, setPorc] = useState(0.9)
  const [temp, setTemp] = useState(37)
  const s = SOLUTOS.find((x) => x.id === solutoId)!
  const [phi, setPhi] = useState(s.phi)
  const m = porcientoAMolar(porc, s.pm)
  const teorica = osmolaridad(m, s.i)
  const real = osmolaridad(m, s.i, phi)
  const efectiva = real * s.sigma
  const vol = volumenGlobulo(efectiva)
  const tono = tonicidad(efectiva)

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          La presión osmótica depende del número de partículas: π = R × T × C, con C = M × i × φ (i: partículas por molécula; φ: coeficiente
          osmótico, que corrige la disociación incompleta). Para el glóbulo rojo importa la osmolaridad <b>efectiva</b>: un soluto que atraviesa
          la membrana (σ = 0, como la urea) no retiene agua, aunque la solución sea isoosmótica.
        </p>
        <CitasGuia simulador="osmolaridad" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
        <Panel titulo="Solución">
          <div className="flex flex-wrap gap-1">{SOLUTOS.map((x) => <button key={x.id} className={solutoId === x.id ? 'chip-activo' : 'chip'} onClick={() => { setSolutoId(x.id); setPhi(x.phi) }}>{x.nombre}</button>)}</div>
          <Deslizador etiqueta="Concentración" valor={porc} min={0.05} max={10} paso={0.05} decimales={2} unidad="% p/v" alCambiar={setPorc} />
          <Deslizador etiqueta="Coeficiente osmótico (φ)" valor={phi} min={0.5} max={1} paso={0.01} decimales={2} alCambiar={setPhi} />
          <Deslizador etiqueta="Temperatura" valor={temp} min={0} max={45} unidad="°C" alCambiar={setTemp} />
          <p className="text-xs texto-suave">PM {s.pm} g/mol · i = {s.i} · σ frente al glóbulo rojo = {s.sigma}</p>
        </Panel>
        <Panel titulo="Resultados">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Dato etiqueta="Molaridad" valor={m * 1000} unidad="mmol/L" />
            {s.valencia > 0 && <Dato etiqueta={`${s.nombre.replace(/Cl.*$/, '')} en mEq/L`} valor={m * 1000 * s.valencia} unidad="mEq/L" />}
            <Dato etiqueta="Osmolaridad teórica" valor={teorica * 1000} unidad="mOsm/L" />
            <Dato etiqueta="Osmolaridad real" valor={real * 1000} unidad="mOsm/L" />
            <Dato etiqueta="π teórica" valor={presionOsmotica(teorica, temp)} unidad="atm" decimales={2} />
            <Dato etiqueta="π real" valor={presionOsmotica(real, temp)} unidad="atm" decimales={2} nota={`${fmt(atmAMmHg(presionOsmotica(real, temp)), 0)} mmHg`} />
          </div>
          <div className="grid items-center gap-2 sm:grid-cols-2">
            <GloboRojo volumen={vol} />
            <div className="text-sm">
              <p>Osmolaridad efectiva: <b>{fmt(efectiva * 1000)} mOsm/L</b> (célula ≈ 300).</p>
              <p>Solución <b>{tono}</b> para el glóbulo rojo.</p>
              <p className="texto-suave">{vol >= UMBRAL_HEMOLISIS ? 'El agua entra hasta romper la membrana (hemólisis).' : vol > 1.03 ? `Entra agua: el volumen sube a ${fmt(vol * 100, 0)} %.` : vol < 0.97 ? `Sale agua: el volumen baja a ${fmt(vol * 100, 0)} % (crenación).` : 'Sin flujo neto de agua.'}</p>
            </div>
          </div>
        </Panel>
      </div>
      <EjercicioSim simulador="osmolaridad" />
    </div>
  )
}
