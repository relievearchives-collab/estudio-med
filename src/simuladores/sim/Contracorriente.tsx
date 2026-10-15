import { useEffect, useState } from 'react'
import { fmt } from '../ejercicios'
import { asaInicial, avanzar, bombear, gradienteMedular, type EstadoAsa } from '../formulas/renal'
import { Barra, CitasGuia, EjercicioSim, Panel } from '../ui'

const color = (osm: number) => {
  const t = Math.min(1, Math.max(0, (osm - 100) / 1100))
  return `hsl(${200 - t * 170}, 80%, ${60 - t * 15}%)`
}

/** Asa de Henle en niveles: descendente (izquierda), intersticio (centro) y ascendente (derecha). */
function Asa({ e, ultimo }: { e: EstadoAsa; ultimo: 'bombear' | 'avanzar' | null }) {
  const n = e.descendente.length
  const W = 360, H = 60 + n * 46
  const celda = (x: number, y: number, v: number, w = 80) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width={w} height={40} rx={6} fill={color(v)} opacity={0.85} />
      <text x={x + w / 2} y={y + 25} fontSize="13" textAnchor="middle" fill="#0f172a" fontWeight={600}>{fmt(v, 0)}</text>
    </g>
  )
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full max-w-md" role="img" aria-label="Asa de Henle">
      <text x={50} y={16} fontSize="11" textAnchor="middle" fill="currentColor">Descendente</text>
      <text x={180} y={16} fontSize="11" textAnchor="middle" fill="currentColor">Intersticio</text>
      <text x={310} y={16} fontSize="11" textAnchor="middle" fill="currentColor">Ascendente</text>
      <text x={50} y={34} fontSize="10" textAnchor="middle" fill="currentColor" opacity={0.6}>entra 300 ↓</text>
      <text x={310} y={34} fontSize="10" textAnchor="middle" fill="currentColor" opacity={0.6}>sale {fmt(e.salida, 0)} ↑</text>
      {e.descendente.map((v, k) => celda(10, 42 + k * 46, v))}
      {e.intersticio.map((v, k) => celda(140, 42 + k * 46, v))}
      {e.ascendente.map((v, k) => celda(270, 42 + k * 46, v))}
      {ultimo === 'bombear' && e.ascendente.map((_, k) => <text key={k} x={232} y={67 + k * 46} fontSize="16" textAnchor="middle" fill="#ef4444">←NaCl</text>)}
      <path d={`M50 ${42 + n * 46} q130 30 260 0`} fill="none" stroke="currentColor" opacity={0.4} strokeDasharray="3 3" />
      <text x={180} y={H - 4} fontSize="10" textAnchor="middle" fill="currentColor" opacity={0.6}>papila (médula interna)</text>
    </svg>
  )
}

export default function Contracorriente() {
  const [e, setE] = useState(() => asaInicial(6))
  const [ultimo, setUltimo] = useState<'bombear' | 'avanzar' | null>(null)
  const [ciclos, setCiclos] = useState(0)
  const [auto, setAuto] = useState(false)
  const [urea, setUrea] = useState(true)
  const [adh, setAdh] = useState(true)
  const [flujo, setFlujo] = useState<'normal' | 'alto'>('normal')

  const paso = () => {
    if (ultimo === 'bombear') { setE((x) => avanzar(x)); setUltimo('avanzar'); setCiclos((c) => c + 1) }
    else { setE((x) => bombear(x)); setUltimo('bombear') }
  }
  useEffect(() => {
    if (!auto) return
    const id = setInterval(paso, 450)
    return () => clearInterval(id)
  })
  const final = gradienteMedular(e, { urea, adh, flujoVasosRectos: flujo })

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          La rama ascendente gruesa saca NaCl sin agua y deja ≈ 200 mOsm/kg de diferencia con el intersticio en cada nivel ("efecto único");
          la descendente, permeable al agua, se equilibra con el intersticio. Al repetir <b>bombear → avanzar</b>, la diferencia se multiplica a lo
          largo del asa y la médula queda cada vez más concentrada hacia la papila. La urea (que recircula con ADH) suma osmolaridad en la médula
          interna, y los vasos rectos, de flujo bajo, la conservan.
        </p>
        <CitasGuia simulador="contracorriente" />
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel titulo={`Asa de Henle · ${ciclos} ciclo(s)`}>
          <Asa e={e} ultimo={ultimo} />
          <div className="flex flex-wrap gap-2">
            <button className="btn-primario" onClick={paso}>{ultimo === 'bombear' ? 'Paso: avanzar el líquido' : 'Paso: bombear NaCl'}</button>
            <button className="btn-secundario" onClick={() => setAuto((a) => !a)}>{auto ? 'Pausa' : 'Reproducir'}</button>
            <button className="btn-fantasma" onClick={() => { setE(asaInicial(6)); setUltimo(null); setCiclos(0); setAuto(false) }}>Reiniciar</button>
          </div>
          <p className="text-xs texto-suave">Números en mOsm/kg. Modelo didáctico de 6 niveles con efecto único de 200 mOsm/kg.</p>
        </Panel>
        <Panel titulo="Gradiente final del intersticio">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={urea} onChange={(x) => setUrea(x.target.checked)} /> Recirculación de urea</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={adh} onChange={(x) => setAdh(x.target.checked)} /> ADH presente</label>
          <div className="flex gap-1 text-sm"><span className="texto-suave">Vasos rectos:</span>{(['normal', 'alto'] as const).map((f) => <button key={f} className={flujo === f ? 'chip-activo' : 'chip'} onClick={() => setFlujo(f)}>flujo {f}</button>)}</div>
          <div className="space-y-1.5">
            {final.map((v, k) => <Barra key={k} etiqueta={k === 0 ? 'Corteza' : k === final.length - 1 ? 'Papila' : `Nivel ${k + 1}`} valor={v} maximo={1500} color="bg-amber-500" texto={`${fmt(v, 0)} mOsm/kg`} />)}
          </div>
          <p className="text-xs texto-suave">Con ADH el colector se equilibra con este intersticio y la orina puede llegar a la osmolaridad de la papila; sin ADH sale diluida (≈ 50–100).</p>
        </Panel>
      </div>
      <EjercicioSim simulador="contracorriente" />
    </div>
  )
}
