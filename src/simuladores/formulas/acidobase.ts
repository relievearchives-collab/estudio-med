/**
 * Equilibrio ácido-base: Henderson-Hasselbalch, exceso de bases, anión gap e intérprete de gasometrías.
 * Rangos normales: pH 7,35–7,45; pCO2 35–45 mmHg; HCO3− 22–26 mEq/L.
 */

export const PK = 6.1
/** Solubilidad del CO2: mmol/L por mmHg. */
export const S_CO2 = 0.03
export const NORMAL = { ph: 7.4, pco2: 40, hco3: 24 }

/** pH = 6,1 + log(HCO3− / (0,03 × pCO2)). */
export const phHH = (hco3: number, pco2: number) => PK + Math.log10(hco3 / (S_CO2 * pco2))
/** HCO3− (mEq/L) que corresponde a un pH y una pCO2 (isóbara del diagrama de Davenport). */
export const hco3HH = (ph: number, pco2: number) => S_CO2 * pco2 * 10 ** (ph - PK)
/** pCO2 (mmHg) que corresponde a un pH y un HCO3−. */
export const pco2HH = (ph: number, hco3: number) => hco3 / (S_CO2 * 10 ** (ph - PK))

/** Exceso de bases (mEq/L), ecuación de Van Slyke simplificada para sangre (Hb ≈ 15 g/dL). */
export const excesoBases = (ph: number, hco3: number) => 0.93 * (hco3 - 24.4 + 14.8 * (ph - 7.4))

/** Bases buffer totales normales de la sangre (≈ 48 mEq/L): BB = 48 + EB. */
export const basesBuffer = (ph: number, hco3: number) => 48 + excesoBases(ph, hco3)

/** Pendiente de la línea buffer de la sangre en el diagrama de Davenport (mEq/L por unidad de pH). */
export const PENDIENTE_BUFFER = -25

/** HCO3− sobre la línea buffer normal (cambios puramente respiratorios agudos, a EB = 0). */
export const hco3LineaBuffer = (ph: number) => NORMAL.hco3 + PENDIENTE_BUFFER * (ph - NORMAL.ph)

/** Anión gap = Na − (Cl + HCO3−); corregido por albúmina (+2,5 por cada g/dL por debajo de 4). */
export function anionGap(na: number, cl: number, hco3: number, albumina?: number) {
  const ag = na - (cl + hco3)
  return albumina === undefined ? ag : ag + 2.5 * (4 - albumina)
}

export type Trastorno =
  | 'normal'
  | 'acidosis metabólica'
  | 'alcalosis metabólica'
  | 'acidosis respiratoria'
  | 'alcalosis respiratoria'
  | 'mixto: acidosis metabólica y respiratoria'
  | 'mixto: alcalosis metabólica y respiratoria'
  | 'compensado o mixto con pH normal'

export interface Interpretacion {
  coherente: boolean
  phCalculado: number
  estado: 'acidemia' | 'alcalemia' | 'pH normal'
  primario: Trastorno
  /** Rango esperado de la compensación (pCO2 en los metabólicos, HCO3− en los respiratorios). */
  esperado?: { variable: 'pCO2' | 'HCO3'; min: number; max: number; formula: string; cronicidad?: 'aguda' | 'crónica' }
  compensacion?: 'adecuada' | 'insuficiente o con otro trastorno'
  agregado?: string
  anionGap?: number
  deltaRatio?: number
  excesoBases: number
  pasos: string[]
}

const f1 = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 1 })
const f2 = (x: number) => x.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Intérprete paso a paso: coherencia, acidemia/alcalemia, trastorno primario, compensación esperada
 * (Winter y reglas de 1-3,5 / 2-5 por cada 10 mmHg de pCO2), trastorno agregado y anión gap.
 */
export function interpretarGasometria(g: { ph: number; pco2: number; hco3: number; na?: number; cl?: number; albumina?: number; cronica?: boolean }): Interpretacion {
  const pasos: string[] = []
  const phCalculado = phHH(g.hco3, g.pco2)
  const coherente = Math.abs(phCalculado - g.ph) <= 0.04
  pasos.push(`1. Coherencia (Henderson-Hasselbalch): pH = 6,1 + log(${f1(g.hco3)} / (0,03 × ${f1(g.pco2)})) = ${f2(phCalculado)}${coherente ? ' → los datos son coherentes.' : ` → no coincide con el pH informado (${f2(g.ph)}): revisá los valores.`}`)

  const estado = g.ph < 7.35 ? 'acidemia' : g.ph > 7.45 ? 'alcalemia' : 'pH normal'
  pasos.push(`2. pH ${f2(g.ph)}: ${estado}.`)

  let primario: Trastorno = 'normal'
  const hco3Bajo = g.hco3 < 22, hco3Alto = g.hco3 > 26, pco2Alta = g.pco2 > 45, pco2Baja = g.pco2 < 35
  if (estado === 'acidemia') {
    if (hco3Bajo && pco2Alta) primario = 'mixto: acidosis metabólica y respiratoria'
    else if (hco3Bajo) primario = 'acidosis metabólica'
    else if (pco2Alta) primario = 'acidosis respiratoria'
  } else if (estado === 'alcalemia') {
    if (hco3Alto && pco2Baja) primario = 'mixto: alcalosis metabólica y respiratoria'
    else if (hco3Alto) primario = 'alcalosis metabólica'
    else if (pco2Baja) primario = 'alcalosis respiratoria'
  } else if (hco3Bajo || hco3Alto || pco2Alta || pco2Baja) primario = 'compensado o mixto con pH normal'
  pasos.push(`3. Trastorno primario: ${primario}${primario.startsWith('mixto') ? ' (HCO3− y pCO2 se mueven en el sentido que empeora el pH).' : primario === 'compensado o mixto con pH normal' ? ' (pH normal con HCO3− o pCO2 alterados: buscá dos trastornos opuestos).' : '.'}`)

  let esperado: Interpretacion['esperado']
  if (primario === 'acidosis metabólica') {
    const c = 1.5 * g.hco3 + 8
    esperado = { variable: 'pCO2', min: c - 2, max: c + 2, formula: `Winter: pCO2 = 1,5 × ${f1(g.hco3)} + 8 ± 2` }
  } else if (primario === 'alcalosis metabólica') {
    const c = 0.7 * g.hco3 + 21
    esperado = { variable: 'pCO2', min: c - 2, max: c + 2, formula: `pCO2 = 0,7 × ${f1(g.hco3)} + 21 ± 2` }
  } else if (primario === 'acidosis respiratoria') {
    const k = g.cronica ? 3.5 : 1
    const c = 24 + (k * (g.pco2 - 40)) / 10
    esperado = { variable: 'HCO3', min: c - 2, max: c + 2, formula: `HCO3− sube ${f1(k)} por cada 10 mmHg de pCO2 (${g.cronica ? 'crónica' : 'aguda'}): 24 + ${f1(k)} × (${f1(g.pco2)} − 40) / 10 ± 2`, cronicidad: g.cronica ? 'crónica' : 'aguda' }
  } else if (primario === 'alcalosis respiratoria') {
    const k = g.cronica ? 5 : 2
    const c = 24 - (k * (40 - g.pco2)) / 10
    esperado = { variable: 'HCO3', min: c - 2, max: c + 2, formula: `HCO3− baja ${k} por cada 10 mmHg de pCO2 (${g.cronica ? 'crónica' : 'aguda'}): 24 − ${k} × (40 − ${f1(g.pco2)}) / 10 ± 2`, cronicidad: g.cronica ? 'crónica' : 'aguda' }
  }

  let compensacion: Interpretacion['compensacion']
  let agregado: string | undefined
  if (esperado) {
    const real = esperado.variable === 'pCO2' ? g.pco2 : g.hco3
    compensacion = real >= esperado.min && real <= esperado.max ? 'adecuada' : 'insuficiente o con otro trastorno'
    if (compensacion !== 'adecuada') {
      if (esperado.variable === 'pCO2') agregado = real > esperado.max ? 'acidosis respiratoria agregada' : 'alcalosis respiratoria agregada'
      else agregado = real > esperado.max ? 'alcalosis metabólica agregada' : 'acidosis metabólica agregada'
    }
    pasos.push(`4. Compensación esperada (${esperado.formula}) → ${esperado.variable} entre ${f1(esperado.min)} y ${f1(esperado.max)}. Real: ${f1(real)} → ${compensacion === 'adecuada' ? 'compensación adecuada (trastorno simple).' : `fuera de la banda: ${agregado}.`}`)
  } else {
    pasos.push('4. Compensación: no corresponde evaluar una sola banda (trastorno mixto o valores normales).')
  }

  let ag: number | undefined
  let deltaRatio: number | undefined
  if (g.na !== undefined && g.cl !== undefined) {
    ag = anionGap(g.na, g.cl, g.hco3, g.albumina)
    const alto = ag > 14
    pasos.push(`5. Anión gap = ${f1(g.na)} − (${f1(g.cl)} + ${f1(g.hco3)})${g.albumina !== undefined ? ` + 2,5 × (4 − ${f1(g.albumina)})` : ''} = ${f1(ag)} mEq/L → ${alto ? 'aumentado (ácidos no medidos: cetoácidos, lactato, tóxicos, insuficiencia renal)' : 'normal (si hay acidosis metabólica, es hiperclorémica: pérdidas digestivas o renales de HCO3−)'}.`)
    if (alto && (primario.includes('acidosis metabólica') || g.hco3 < 22)) {
      deltaRatio = (ag - 12) / (24 - g.hco3)
      pasos.push(`6. Delta/delta = (AG − 12) / (24 − HCO3−) = ${f1(deltaRatio)} → ${deltaRatio < 1 ? 'además hay acidosis hiperclorémica (AG normal)' : deltaRatio > 2 ? 'además hay alcalosis metabólica' : 'acidosis con AG aumentado pura'}.`)
    }
  }
  const eb = excesoBases(g.ph, g.hco3)
  pasos.push(`Exceso de bases ≈ ${f1(eb)} mEq/L (${eb < -2 ? 'déficit de bases: componente metabólico ácido' : eb > 2 ? 'exceso de bases: componente metabólico alcalino' : 'normal'}).`)

  return { coherente, phCalculado, estado, primario, esperado, compensacion, agregado, anionGap: ag, deltaRatio, excesoBases: eb, pasos }
}
