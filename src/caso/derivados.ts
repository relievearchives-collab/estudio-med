import type { ClaveAnalito, EstudioCaso } from '../repositorio/tipos'
import { anionGap, hco3HH, interpretarGasometria } from '../simuladores/formulas/acidobase'
import { osmolaridadPlasmatica } from '../simuladores/formulas/liquidos'
import { ckdEpi2021, estadioERC, fena, interpretarFena } from '../simuladores/formulas/renal'

/**
 * Lo numérico del caso clínico lo hace el código (regla del proyecto): la IA inventa los datos del
 * paciente, pero los valores derivados se calculan con las fórmulas de los simuladores y los datos
 * fuera de rango o incoherentes se corrigen o descartan.
 */

export const CLAVES_ANALITO: ClaveAnalito[] = ['na', 'k', 'cl', 'hco3', 'glucemia', 'urea', 'creatinina', 'albumina', 'hematocrito', 'ph', 'pco2', 'orinaNa', 'orinaCreatinina', 'orinaOsm']

/** Rangos posibles (no normales): fuera de esto el valor se descarta por absurdo. */
export const RANGOS_POSIBLES: Record<ClaveAnalito, [number, number]> = {
  na: [100, 190], k: [1, 10], cl: [60, 140], hco3: [2, 60], glucemia: [20, 1500], urea: [5, 400], creatinina: [0.2, 20],
  albumina: [0.5, 6.5], hematocrito: [10, 75], ph: [6.7, 7.9], pco2: [10, 130], orinaNa: [1, 300], orinaCreatinina: [5, 500], orinaOsm: [40, 1400],
}

const f1 = (x: number) => x.toLocaleString('es-AR', { maximumFractionDigits: 1 })
const f2 = (x: number) => x.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/**
 * Limpia los estudios de la IA: clave desconocida o valor fuera de rango → queda solo el texto;
 * gasometría incoherente (Henderson-Hasselbalch) → el HCO3− se recalcula a partir de pH y pCO2.
 */
export function sanearEstudios(estudios: EstudioCaso[]): EstudioCaso[] {
  const salida = estudios.map((e): EstudioCaso => {
    const clave = e.clave && CLAVES_ANALITO.includes(e.clave) ? e.clave : undefined
    const valido = clave && typeof e.valor === 'number' && Number.isFinite(e.valor) && e.valor >= RANGOS_POSIBLES[clave][0] && e.valor <= RANGOS_POSIBLES[clave][1]
    return valido ? { ...e, clave } : { ...e, clave: undefined, valor: undefined }
  })
  const buscar = (c: ClaveAnalito) => salida.find((e) => e.clave === c)
  const ph = buscar('ph'), pco2 = buscar('pco2'), hco3 = buscar('hco3')
  if (ph && pco2 && hco3 && !interpretarGasometria({ ph: ph.valor!, pco2: pco2.valor!, hco3: hco3.valor! }).coherente) {
    const nuevo = Math.round(hco3HH(ph.valor!, pco2.valor!) * 10) / 10
    const i = salida.indexOf(hco3)
    salida[i] = { ...hco3, valor: nuevo, resultado: `${f1(nuevo)} ${hco3.unidad ?? 'mEq/L'}`, ajustado: 'Recalculado con Henderson-Hasselbalch a partir del pH y la pCO2 para que la gasometría sea coherente.' }
  }
  return salida
}

export interface Derivado {
  nombre: string
  valor: string
  formula: string
  lectura?: string
}

/** Valores derivados con los estudios ya pedidos (solo si están todos los datos necesarios). */
export function calcularDerivados(estudios: EstudioCaso[], paciente: { edad: number; sexo: 'hombre' | 'mujer' }): Derivado[] {
  const v = (c: ClaveAnalito) => estudios.find((e) => e.clave === c)?.valor
  const [na, cl, hco3, glu, urea, cr, alb, ph, pco2, uNa, uCr] = (['na', 'cl', 'hco3', 'glucemia', 'urea', 'creatinina', 'albumina', 'ph', 'pco2', 'orinaNa', 'orinaCreatinina'] as const).map(v)
  const salida: Derivado[] = []
  if (na !== undefined && glu !== undefined && urea !== undefined) {
    const osm = osmolaridadPlasmatica(na, glu, urea)
    salida.push({ nombre: 'Osmolaridad plasmática calculada', valor: `${f1(osm)} mOsm/L`, formula: '2 × Na + glucemia/18 + urea/6', lectura: osm < 280 ? 'baja' : osm > 295 ? 'alta' : 'normal (≈ 280–295)' })
  }
  if (na !== undefined && cl !== undefined && hco3 !== undefined) {
    const ag = anionGap(na, cl, hco3, alb)
    salida.push({ nombre: alb !== undefined ? 'Anión gap corregido por albúmina' : 'Anión gap', valor: `${f1(ag)} mEq/L`, formula: alb !== undefined ? 'Na − (Cl + HCO3) + 2,5 × (4 − albúmina)' : 'Na − (Cl + HCO3)', lectura: ag > 12 ? 'aumentado' : 'normal (≈ 8–12)' })
  }
  if (cr !== undefined && paciente.edad >= 18) {
    const tfg = ckdEpi2021(paciente.edad, cr, paciente.sexo)
    salida.push({ nombre: 'TFG estimada (CKD-EPI 2021)', valor: `${Math.round(tfg)} mL/min/1,73 m²`, formula: 'CKD-EPI 2021 con creatinina, edad y sexo', lectura: estadioERC(tfg) })
  }
  if (uNa !== undefined && na !== undefined && uCr !== undefined && cr !== undefined) {
    const x = fena(uNa, na, uCr, cr)
    salida.push({ nombre: 'Fracción excretada de sodio', valor: `${f2(x)} %`, formula: '(Na orina × Cr plasma) / (Na plasma × Cr orina) × 100', lectura: interpretarFena(x) })
  }
  if (ph !== undefined && pco2 !== undefined && hco3 !== undefined) {
    const g = interpretarGasometria({ ph, pco2, hco3, na, cl, albumina: alb })
    salida.push({
      nombre: 'Gasometría', valor: `${g.estado} · ${g.primario}`, formula: 'Henderson-Hasselbalch, compensación esperada (Winter y reglas por cada 10 mmHg)',
      lectura: [g.compensacion && `compensación ${g.compensacion}`, g.agregado].filter(Boolean).join('; ') || undefined,
    })
  }
  return salida
}
