/**
 * Fisiología renal: Starling glomerular, clearance y estimaciones de TFG, Tm de glucosa, PAH,
 * multiplicador de contracorriente, agua libre y FENa. Unidades clínicas habituales.
 */

// ───────────────────────── Starling glomerular ─────────────────────────

export interface FuerzasStarling {
  /** mmHg */
  pcg: number
  pcb: number
  picg: number
  picb?: number
}

/** Presión neta de filtración = (P capilar glomerular − P Bowman) − (π capilar − π Bowman). */
export const presionNetaFiltracion = (f: FuerzasStarling) => f.pcg - f.pcb - (f.picg - (f.picb ?? 0))

/** TFG (mL/min) = Kf (mL/min/mmHg) × PNF. */
export const tfgStarling = (kf: number, pnf: number) => Math.max(0, kf * pnf)

export interface CirculacionGlomerular {
  /** Presión arterial media (mmHg) */
  pam: number
  /** Resistencias relativas de las arteriolas (1 = basal) */
  aferente: number
  eferente: number
  kf: number
  pcb: number
  /** Proteínas plasmáticas: presión oncótica que entra al glomérulo (mmHg) */
  piPlasma: number
  hematocrito: number
}

export const CIRCULACION_BASAL: CirculacionGlomerular = { pam: 100, aferente: 1, eferente: 1, kf: 12.5, pcb: 18, piPlasma: 28, hematocrito: 0.45 }

/**
 * Modelo simple de las dos arteriolas en serie: con resistencias basales calibradas para FSR ≈ 1100 mL/min y
 * PCG ≈ 60 mmHg a PAM 100. La presión oncótica media del capilar sube a medida que se filtra
 * (π de salida = π de entrada / (1 − FF)), así que TFG y FF se resuelven juntas por iteración.
 */
export function circulacionGlomerular(c: CirculacionGlomerular) {
  const FSR_BASAL = 1100
  const PV = 8 // presión venosa renal
  const ra = ((100 - 60) / FSR_BASAL) * c.aferente
  const re = ((60 - PV) / FSR_BASAL) * c.eferente
  const fsr = (c.pam - PV) / (ra + re)
  const pcg = c.pam - fsr * ra
  const fpr = fsr * (1 - c.hematocrito)
  let tfg = 0
  let piMedia = c.piPlasma
  for (let k = 0; k < 50; k++) {
    const ff = Math.min(0.6, tfg / fpr)
    piMedia = (c.piPlasma + c.piPlasma / (1 - ff)) / 2
    tfg = Math.max(0, c.kf * (pcg - c.pcb - piMedia))
  }
  return { fsr, fpr, pcg, piMedia, pnf: pcg - c.pcb - piMedia, tfg, ff: tfg / fpr }
}

// ───────────────────────── Clearance y TFG estimada ─────────────────────────

/** Clearance (mL/min) = U × V / P, con U y P en las mismas unidades y V en mL/min. */
export const clearance = (u: number, v: number, p: number) => (u * v) / p

/** Cockcroft-Gault (mL/min): (140 − edad) × peso / (72 × Cr) × 0,85 en la mujer. */
export function cockcroftGault(edad: number, peso: number, creatininaMgdl: number, sexo: 'hombre' | 'mujer') {
  return (((140 - edad) * peso) / (72 * creatininaMgdl)) * (sexo === 'mujer' ? 0.85 : 1)
}

/** MDRD de 4 variables con creatinina estandarizada (IDMS, constante 175), mL/min/1,73 m². Sin factor étnico. */
export function mdrd(edad: number, creatininaMgdl: number, sexo: 'hombre' | 'mujer') {
  return 175 * creatininaMgdl ** -1.154 * edad ** -0.203 * (sexo === 'mujer' ? 0.742 : 1)
}

/** CKD-EPI 2021 (sin raza), mL/min/1,73 m². */
export function ckdEpi2021(edad: number, creatininaMgdl: number, sexo: 'hombre' | 'mujer') {
  const k = sexo === 'mujer' ? 0.7 : 0.9
  const a = sexo === 'mujer' ? -0.241 : -0.302
  const r = creatininaMgdl / k
  return 142 * Math.min(r, 1) ** a * Math.max(r, 1) ** -1.2 * 0.9938 ** edad * (sexo === 'mujer' ? 1.012 : 1)
}

/** Estadio KDIGO según TFG (mL/min/1,73 m²). */
export function estadioERC(tfg: number) {
  if (tfg >= 90) return 'G1 (normal o alta)'
  if (tfg >= 60) return 'G2 (levemente disminuida)'
  if (tfg >= 45) return 'G3a (leve a moderada)'
  if (tfg >= 30) return 'G3b (moderada a grave)'
  if (tfg >= 15) return 'G4 (gravemente disminuida)'
  return 'G5 (falla renal)'
}

/** Cargas (mg/min) con P y U en mg/dL, TFG y V en mL/min. Positivo = reabsorción neta; negativo = secreción neta. */
export function cargas(tfg: number, pMgdl: number, uMgdl: number, vMlMin: number) {
  const filtrada = (tfg * pMgdl) / 100
  const excretada = (uMgdl * vMlMin) / 100
  return { filtrada, excretada, transporteNeto: filtrada - excretada, fraccionExcretada: excretada / filtrada }
}

// ───────────────────────── Glucosa (Tm) y PAH ─────────────────────────

/** Puntos (z) de una normal para repartir el Tm entre nefronas (heterogeneidad → "splay"). */
const CUANTILES = [-2, -1.6, -1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2, 1.6, 2]
const PESOS = CUANTILES.map((z) => Math.exp((-z * z) / 2))
const SUMA_PESOS = PESOS.reduce((s, x) => s + x, 0)

/**
 * Manejo renal de glucosa (mg/min): carga filtrada, reabsorbida y excretada. El Tm de cada nefrona varía
 * (coeficiente de variación `cv`), por eso la glucosuria aparece antes de alcanzar el Tm total ("splay").
 */
export function glucosaRenal(glucemiaMgdl: number, tfg = 125, tm = 375, cv = 0.15) {
  const filtrada = (tfg * glucemiaMgdl) / 100
  let reabsorbida = 0
  CUANTILES.forEach((z, k) => { reabsorbida += (PESOS[k] / SUMA_PESOS) * Math.min(filtrada, tm * Math.max(0.05, 1 + cv * z)) })
  return { filtrada, reabsorbida, excretada: Math.max(0, filtrada - reabsorbida) }
}

/** Glucemia (mg/dL) a partir de la cual se excreta más de 1 mg/min de glucosa (umbral renal real, con splay). */
export function umbralRenalGlucosa(tfg = 125, tm = 375, cv = 0.15) {
  let lo = 0
  let hi = 2000
  for (let k = 0; k < 60; k++) {
    const m = (lo + hi) / 2
    if (glucosaRenal(m, tfg, tm, cv).excretada > 1) hi = m
    else lo = m
  }
  return hi
}

/** Umbral teórico sin splay: P = Tm / TFG. */
export const umbralTeoricoGlucosa = (tfg = 125, tm = 375) => (tm / tfg) * 100

/**
 * PAH: se filtra y se secreta (Tm de secreción ≈ 80 mg/min). A concentraciones bajas casi todo el PAH que llega
 * se excreta y su clearance estima el flujo plasmático renal efectivo; al saturarse la secreción, el clearance cae.
 */
export function pahRenal(pahMgdl: number, fpr = 650, tfg = 125, tmSecrecion = 80, extraccion = 0.9) {
  const filtrada = (tfg * pahMgdl) / 100
  const secretable = ((fpr * extraccion - tfg) * pahMgdl) / 100
  const secretada = Math.min(tmSecrecion, Math.max(0, secretable))
  const excretada = filtrada + secretada
  return { filtrada, secretada, excretada, clearance: (excretada / pahMgdl) * 100 }
}

/** Flujo plasmático renal efectivo (clearance de PAH) y flujo sanguíneo renal. */
export function flujosRenales(uPah: number, vMlMin: number, pPah: number, hematocrito: number) {
  const fpre = clearance(uPah, vMlMin, pPah)
  return { fpre, fsr: fpre / (1 - hematocrito) }
}

// ───────────────────────── Multiplicador de contracorriente ─────────────────────────

export interface EstadoAsa {
  /** mOsm/kg por nivel, de la corteza (0) a la papila (n−1) */
  descendente: number[]
  ascendente: number[]
  intersticio: number[]
  /** mOsm/kg del líquido que sale hacia el túbulo distal */
  salida: number
}

export function asaInicial(niveles = 6): EstadoAsa {
  const f = () => Array<number>(niveles).fill(300)
  return { descendente: f(), ascendente: f(), intersticio: f(), salida: 300 }
}

/**
 * Paso 1, "efecto único": la rama ascendente gruesa saca NaCl hasta dejar una diferencia de `gradiente`
 * (200 mOsm/kg) con el intersticio en cada nivel; la descendente (permeable al agua) se equilibra con el intersticio.
 */
export function bombear(e: EstadoAsa, gradiente = 200): EstadoAsa {
  const n = e.descendente.length
  const d = [...e.descendente]
  const a = [...e.ascendente]
  const i = [...e.intersticio]
  for (let k = 0; k < n; k++) {
    const media = (d[k] + a[k]) / 2
    a[k] = media - gradiente / 2
    d[k] = media + gradiente / 2
    i[k] = d[k]
  }
  return { ...e, descendente: d, ascendente: a, intersticio: i }
}

/** Paso 2, "flujo": entra líquido nuevo (300) a la descendente, todo avanza un nivel y sale líquido de la ascendente. */
export function avanzar(e: EstadoAsa): EstadoAsa {
  const n = e.descendente.length
  const d = [300, ...e.descendente.slice(0, n - 1)]
  const a = [...e.ascendente.slice(1), e.descendente[n - 1]]
  return { ...e, descendente: d, ascendente: a, salida: e.ascendente[0] }
}

/**
 * Gradiente final del intersticio con los factores que lo modulan: urea (recirculación en la médula interna,
 * mayor con ADH) y flujo de los vasos rectos (si aumenta, "lava" el gradiente).
 */
export function gradienteMedular(e: EstadoAsa, opciones: { urea: boolean; adh: boolean; flujoVasosRectos: 'normal' | 'alto' }) {
  const n = e.intersticio.length
  const lavado = opciones.flujoVasosRectos === 'alto' ? 0.6 : 1
  return e.intersticio.map((x, k) => {
    const urea = opciones.urea ? (opciones.adh ? 300 : 120) * Math.max(0, (k - n / 2 + 1) / (n / 2)) : 0
    return 300 + (x + urea - 300) * lavado
  })
}

// ───────────────────────── Agua libre, osmolar y FENa ─────────────────────────

/** Clearance osmolar (mL/min) = Uosm × V / Posm. */
export const clearanceOsmolar = (uOsm: number, vMlMin: number, pOsm: number) => (uOsm * vMlMin) / pOsm

/** Clearance de agua libre (mL/min) = V − Cosm. Positivo: orina diluida (se pierde agua libre); negativo: orina concentrada. */
export const clearanceAguaLibre = (uOsm: number, vMlMin: number, pOsm: number) => vMlMin - clearanceOsmolar(uOsm, vMlMin, pOsm)

/** Clearance de agua libre de electrolitos = V × (1 − (UNa + UK) / PNa). Predice el efecto sobre la natremia. */
export const aguaLibreElectrolitos = (vMlMin: number, uNa: number, uK: number, pNa: number) => vMlMin * (1 - (uNa + uK) / pNa)

/** Excreción fraccional de sodio (%) = (UNa × PCr) / (PNa × UCr) × 100. */
export const fena = (uNa: number, pNa: number, uCr: number, pCr: number) => ((uNa * pCr) / (pNa * uCr)) * 100

/** Lectura habitual de la FENa en una oliguria: < 1 % prerrenal; > 2 % necrosis tubular aguda. */
export function interpretarFena(f: number) {
  if (f < 1) return 'menor a 1 %: compatible con causa prerrenal (el túbulo conserva sodio)'
  if (f > 2) return 'mayor a 2 %: compatible con daño tubular (necrosis tubular aguda)'
  return 'entre 1 y 2 %: zona indeterminada'
}
