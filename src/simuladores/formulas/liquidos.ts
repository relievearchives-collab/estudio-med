/**
 * Compartimentos líquidos (Darrow-Yannet), osmolaridad y tonicidad.
 * Todo en código y testeado: la IA nunca calcula.
 */

export type Sexo = 'hombre' | 'mujer'

export interface Compartimentos {
  /** litros */
  act: number
  lic: number
  lec: number
  plasma: number
  intersticio: number
  /** mOsm/L */
  osm: number
}

/** Agua corporal total: 60 % del peso en el hombre adulto, 50 % en la mujer. LIC 2/3, LEC 1/3; plasma 1/4 del LEC. */
export function compartimentosIniciales(peso: number, sexo: Sexo, osm = 290): Compartimentos {
  const act = peso * (sexo === 'hombre' ? 0.6 : 0.5)
  const lic = (act * 2) / 3
  const lec = act / 3
  return { act, lic, lec, plasma: lec / 4, intersticio: (lec * 3) / 4, osm }
}

/**
 * Ganancia (volumen > 0) o pérdida (volumen < 0) de un líquido de osmolaridad `osmLiquido` (mOsm/L; 0 = agua pura).
 * Supuestos de Darrow-Yannet: el soluto agregado o perdido queda en el LEC (no entra a las células),
 * el agua se redistribuye hasta igualar la osmolaridad y los osmoles del LIC no cambian.
 * Plasma e intersticio mantienen la proporción 1:3.
 */
export function aplicarEvento(c: Compartimentos, volumen: number, osmLiquido: number): Compartimentos {
  const act = c.act + volumen
  if (act <= 0) throw new Error('El volumen perdido no puede superar el agua corporal total.')
  const osmolesTotales = c.act * c.osm + volumen * osmLiquido
  if (osmolesTotales <= 0) throw new Error('No pueden quedar osmoles negativos.')
  const osm = osmolesTotales / act
  const lic = (c.lic * c.osm) / osm
  const lec = act - lic
  if (lec <= 0) throw new Error('El LEC quedaría sin volumen: el evento no es fisiológico.')
  return { act, lic, lec, plasma: lec / 4, intersticio: (lec * 3) / 4, osm }
}

/** Tipo de cambio para el diagrama: "contracción/expansión" + "hipo/iso/hiperosmótica". */
export function clasificarCambio(antes: Compartimentos, despues: Compartimentos) {
  const dv = despues.lec - antes.lec
  const dosm = despues.osm - antes.osm
  const volumen = Math.abs(dv) < 0.01 ? 'sin cambio de volumen' : dv > 0 ? 'expansión' : 'contracción'
  const tono = Math.abs(dosm) < 0.5 ? 'isoosmótica' : dosm > 0 ? 'hiperosmótica' : 'hipoosmótica'
  return `${volumen} ${tono}`
}

// ───────────────────────── Osmolaridad ─────────────────────────

/** Constante de los gases como la usa la guía: 0,082 L·atm/(mol·K). */
export const R_ATM = 0.082

/** Osmolaridad (Osm/L) = M × i × φ. Con φ = 1 es la teórica o ideal. */
export const osmolaridad = (molaridad: number, i: number, phi = 1) => molaridad * i * phi

/** Presión osmótica (atm) = R × T × C, con T en °C. */
export const presionOsmotica = (osmolar: number, tempC: number) => R_ATM * (tempC + 273) * osmolar

/** Presión osmótica efectiva entre dos compartimentos con coeficiente de reflexión σ (atm). */
export const presionEfectiva = (deltaOsmolar: number, tempC: number, sigma: number) => sigma * presionOsmotica(deltaOsmolar, tempC)

export const atmAMmHg = (atm: number) => atm * 760

/** % p/v (g/100 mL) → molaridad (mol/L). */
export const porcientoAMolar = (porciento: number, pesoMolecular: number) => (porciento * 10) / pesoMolecular

/** mg/dL → mmol/L. */
export const mgdlAMmol = (mgdl: number, pesoMolecular: number) => (mgdl * 10) / pesoMolecular

/** mmol/L → mEq/L. */
export const mmolAMeq = (mmol: number, valencia: number) => mmol * Math.abs(valencia)

/** Osmolaridad plasmática estimada (mOsm/L) = 2 × Na + glucemia/18 + urea/6 (mg/dL; con BUN sería /2,8). */
export const osmolaridadPlasmatica = (na: number, glucemiaMgdl: number, ureaMgdl: number) => 2 * na + glucemiaMgdl / 18 + ureaMgdl / 6

/**
 * Tonicidad respecto del glóbulo rojo (citoplasma ≈ 0,3 Osm/L efectivos). Solo cuentan los solutos que no
 * atraviesan la membrana: osmolaridad efectiva = Σ C × σ.
 */
export function tonicidad(osmEfectiva: number, osmCelula = 0.3) {
  const r = osmEfectiva / osmCelula
  return r < 0.97 ? 'hipotónica' : r > 1.03 ? 'hipertónica' : 'isotónica'
}

/** Fracción del volumen del glóbulo rojo que no participa en la ósmosis (Boyle-van't Hoff). */
const VOLUMEN_INACTIVO = 0.4
/** Volumen relativo a partir del cual se considera hemólisis (≈ NaCl 0,45 %). */
export const UMBRAL_HEMOLISIS = 1.55

/** Volumen relativo del glóbulo rojo (1 = normal) en una solución de osmolaridad efectiva dada. */
export function volumenGlobulo(osmEfectiva: number, osmCelula = 0.3) {
  if (osmEfectiva <= 0) return Infinity
  return VOLUMEN_INACTIVO + (1 - VOLUMEN_INACTIVO) * (osmCelula / osmEfectiva)
}
