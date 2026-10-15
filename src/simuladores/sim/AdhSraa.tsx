import { useState } from 'react'
import { fmt } from '../ejercicios'
import { aguaLibreElectrolitos, clearanceAguaLibre, clearanceOsmolar, fena, interpretarFena } from '../formulas/renal'
import { CitasGuia, Dato, Deslizador, EjercicioSim, Panel } from '../ui'

type Flecha = '↑↑' | '↑' | '=' | '↓' | '↓↓'

interface Escenario {
  id: string
  titulo: string
  cambio: string
  sensores: string[]
  hormonas: { nombre: string; cambio: Flecha }[]
  nefrona: string[]
  resultado: { variable: string; cambio: Flecha }[]
}

/** Respuestas integradas típicas (resumen propio, para razonar los mecanismos). */
const ESCENARIOS: Escenario[] = [
  {
    id: 'deshidratacion', titulo: 'Deshidratación (pérdida de agua libre)', cambio: 'Sube la osmolaridad plasmática; el volumen baja poco.',
    sensores: ['Osmorreceptores hipotalámicos (OVLT, órgano subfornical): detectan cambios de 1–2 %', 'Sed', 'Barorreceptores: poco estimulados'],
    hormonas: [{ nombre: 'ADH', cambio: '↑↑' }, { nombre: 'Renina / Ang II / aldosterona', cambio: '↑' }, { nombre: 'Péptido natriurético', cambio: '↓' }],
    nefrona: ['Colector: la ADH (receptor V2) inserta acuaporinas 2 → reabsorbe agua', 'Colector medular interno: más permeable a la urea → gradiente mayor', 'Asa de Henle: mantiene el gradiente medular'],
    resultado: [{ variable: 'Volumen urinario', cambio: '↓↓' }, { variable: 'Osmolaridad urinaria', cambio: '↑↑' }, { variable: 'Clearance de agua libre', cambio: '↓' }, { variable: 'Osmolaridad plasmática', cambio: '↑' }],
  },
  {
    id: 'agua', titulo: 'Sobrecarga de agua', cambio: 'Baja la osmolaridad plasmática (hiponatremia dilucional).',
    sensores: ['Osmorreceptores: inhibidos', 'Se suprime la sed'],
    hormonas: [{ nombre: 'ADH', cambio: '↓↓' }, { nombre: 'Renina / Ang II / aldosterona', cambio: '=' }, { nombre: 'Péptido natriurético', cambio: '↑' }],
    nefrona: ['Colector: sin ADH, impermeable al agua', 'Rama ascendente gruesa y túbulo distal siguen diluyendo (segmentos dilutores)'],
    resultado: [{ variable: 'Volumen urinario', cambio: '↑↑' }, { variable: 'Osmolaridad urinaria', cambio: '↓↓' }, { variable: 'Clearance de agua libre', cambio: '↑↑' }, { variable: 'Osmolaridad plasmática', cambio: '↑' }],
  },
  {
    id: 'hemorragia', titulo: 'Hemorragia (pérdida isotónica de volumen)', cambio: 'Baja el volumen circulante; la osmolaridad no cambia.',
    sensores: ['Barorreceptores arteriales (seno carotídeo, arco aórtico) y de baja presión (aurículas)', 'Arteriola aferente (barorreceptor renal) y mácula densa (menos NaCl)', 'Simpático renal'],
    hormonas: [{ nombre: 'Renina / Ang II / aldosterona', cambio: '↑↑' }, { nombre: 'ADH (estímulo no osmótico, con caída > 10 %)', cambio: '↑' }, { nombre: 'Péptido natriurético', cambio: '↓' }],
    nefrona: ['Arteriola eferente: Ang II la contrae y sostiene la TFG', 'Proximal: Ang II y simpático aumentan la reabsorción de Na⁺', 'Colector: aldosterona (ENaC) reabsorbe Na⁺ y secreta K⁺; ADH reabsorbe agua'],
    resultado: [{ variable: 'Volumen urinario', cambio: '↓↓' }, { variable: 'Na⁺ urinario / FENa', cambio: '↓↓' }, { variable: 'Volumen del LEC', cambio: '↑' }, { variable: 'Osmolaridad plasmática', cambio: '=' }],
  },
  {
    id: 'sal', titulo: 'Dieta con mucha sal', cambio: 'Ingresa Na⁺: sube transitoriamente la osmolaridad y luego se expande el LEC.',
    sensores: ['Osmorreceptores (sed y ADH) al inicio', 'Barorreceptores y aurículas (distensión)', 'Mácula densa (más NaCl → menos renina)'],
    hormonas: [{ nombre: 'Renina / Ang II / aldosterona', cambio: '↓↓' }, { nombre: 'Péptido natriurético', cambio: '↑↑' }, { nombre: 'ADH', cambio: '↑' }],
    nefrona: ['Menos reabsorción de Na⁺ en proximal y colector (sin aldosterona)', 'El PNA dilata la aferente, sube algo la TFG e inhibe la reabsorción de Na⁺ en el colector', 'Natriuresis por presión'],
    resultado: [{ variable: 'Na⁺ urinario / FENa', cambio: '↑↑' }, { variable: 'Volumen urinario', cambio: '↑' }, { variable: 'Volumen del LEC', cambio: '↑' }, { variable: 'Osmolaridad plasmática', cambio: '=' }],
  },
]

const colorFlecha = (f: Flecha) => (f.startsWith('↑') ? 'text-emerald-600' : f.startsWith('↓') ? 'text-red-600' : 'texto-suave')

export default function AdhSraa() {
  const [esc, setEsc] = useState(ESCENARIOS[0].id)
  const e = ESCENARIOS.find((x) => x.id === esc)!
  const [v, setV] = useState(1)
  const [uosm, setUosm] = useState(600)
  const [posm, setPosm] = useState(290)
  const [una, setUna] = useState(40)
  const [uk, setUk] = useState(40)
  const [pna, setPna] = useState(140)
  const [ucr, setUcr] = useState(100)
  const [pcr, setPcr] = useState(1)
  const ch2o = clearanceAguaLibre(uosm, v, posm)
  const fe = fena(una, pna, ucr, pcr)

  return (
    <div className="space-y-4">
      <Panel>
        <p className="text-sm leading-relaxed">
          El riñón regula por separado la <b>osmolaridad</b> (osmorreceptores → sed y ADH → agua libre) y el <b>volumen del LEC</b>
          (barorreceptores, mácula densa → SRAA, simpático, péptidos natriuréticos → balance de Na⁺). Elegí un escenario para ver qué sensores se
          activan, qué hormonas cambian, qué hace cada segmento y cómo queda la orina.
        </p>
        <CitasGuia simulador="adh-sraa" />
      </Panel>
      <div className="flex flex-wrap gap-1">{ESCENARIOS.map((x) => <button key={x.id} className={esc === x.id ? 'chip-activo' : 'chip'} onClick={() => setEsc(x.id)}>{x.titulo}</button>)}</div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel titulo={e.titulo}>
          <p className="text-sm">{e.cambio}</p>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide texto-suave">Sensores</p>
            <ul className="list-inside list-disc text-sm">{e.sensores.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide texto-suave">Hormonas</p>
            <ul className="text-sm">{e.hormonas.map((h) => <li key={h.nombre} className="flex justify-between gap-2"><span>{h.nombre}</span><b className={colorFlecha(h.cambio)}>{h.cambio}</b></li>)}</ul>
          </div>
        </Panel>
        <Panel titulo="Nefrona y resultado">
          <ul className="list-inside list-disc text-sm">{e.nefrona.map((s) => <li key={s}>{s}</li>)}</ul>
          <ul className="text-sm">{e.resultado.map((r) => <li key={r.variable} className="flex justify-between gap-2"><span>{r.variable}</span><b className={colorFlecha(r.cambio)}>{r.cambio}</b></li>)}</ul>
          <p className="text-xs texto-suave">En "resultado", la osmolaridad plasmática indica hacia dónde la corrige la respuesta.</p>
        </Panel>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Panel titulo="Clearance osmolar y de agua libre">
          <Deslizador etiqueta="Volumen minuto" valor={v} min={0.3} max={15} paso={0.1} decimales={1} unidad="mL/min" alCambiar={setV} />
          <Deslizador etiqueta="Osmolaridad urinaria" valor={uosm} min={50} max={1200} paso={10} unidad="mOsm/kg" alCambiar={setUosm} />
          <Deslizador etiqueta="Osmolaridad plasmática" valor={posm} min={250} max={330} unidad="mOsm/kg" alCambiar={setPosm} />
          <div className="grid grid-cols-2 gap-2">
            <Dato etiqueta="Clearance osmolar" valor={clearanceOsmolar(uosm, v, posm)} unidad="mL/min" decimales={2} />
            <Dato etiqueta="Clearance de agua libre" valor={ch2o} unidad="mL/min" decimales={2} tono={ch2o < 0 ? 'bien' : 'alerta'} nota={ch2o < 0 ? 'negativo: retiene agua (ADH)' : 'positivo: excreta agua libre'} />
          </div>
          <Deslizador etiqueta="K⁺ urinario" valor={uk} min={0} max={150} unidad="mEq/L" alCambiar={setUk} />
          <Dato etiqueta="Agua libre de electrolitos" valor={aguaLibreElectrolitos(v, una, uk, pna)} unidad="mL/min" decimales={2} nota="positivo: tiende a subir la natremia" />
        </Panel>
        <Panel titulo="Excreción fraccional de sodio (FENa)">
          <Deslizador etiqueta="Na⁺ urinario" valor={una} min={1} max={200} unidad="mEq/L" alCambiar={setUna} />
          <Deslizador etiqueta="Na⁺ plasmático" valor={pna} min={115} max={160} unidad="mEq/L" alCambiar={setPna} />
          <Deslizador etiqueta="Creatinina urinaria" valor={ucr} min={10} max={300} unidad="mg/dL" alCambiar={setUcr} />
          <Deslizador etiqueta="Creatinina plasmática" valor={pcr} min={0.5} max={10} paso={0.1} decimales={1} unidad="mg/dL" alCambiar={setPcr} />
          <Dato etiqueta="FENa" valor={fe} unidad="%" decimales={2} tono={fe < 1 ? 'bien' : fe > 2 ? 'mal' : 'alerta'} />
          <p className="text-sm">FENa {fmt(fe, 2)} %: {interpretarFena(fe)}.</p>
        </Panel>
      </div>
      <EjercicioSim simulador="adh-sraa" />
    </div>
  )
}
