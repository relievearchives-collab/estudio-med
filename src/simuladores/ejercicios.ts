import { normalizar } from '../busqueda/normalizar'
import { aplicarEvento, compartimentosIniciales, osmolaridad, porcientoAMolar, presionOsmotica } from './formulas/liquidos'
import { interpretarGasometria, phHH } from './formulas/acidobase'
import {
  ckdEpi2021, clearance, clearanceAguaLibre, clearanceOsmolar, cockcroftGault, fena, flujosRenales, glucosaRenal,
  presionNetaFiltracion, tfgStarling,
} from './formulas/renal'

/**
 * Ejercicios numéricos con valores al azar, respuesta y resolución calculadas por código (nunca por la IA).
 * Cada simulador tiene su generador; también se usan en la práctica y en el simulacro de parcial.
 */

export type Ejercicio =
  | { tipo: 'numero'; id: string; simulador: string; enunciado: string; respuesta: number; unidad: string; tolerancia: number; decimales: number; resolucion: string[] }
  | { tipo: 'opcion'; id: string; simulador: string; enunciado: string; opciones: string[]; correcta: number; resolucion: string[] }

export type Azar = () => number

/** Generador pseudoaleatorio con semilla (para tests y para repetir un ejercicio). */
export function azarConSemilla(semilla: number): Azar {
  let s = semilla >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

const entre = (r: Azar, min: number, max: number, paso = 1) => Math.round((min + r() * (max - min)) / paso) * paso
const elegir = <T,>(r: Azar, xs: T[]) => xs[Math.floor(r() * xs.length)]
export const fmt = (x: number, dec = 1) => x.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
const id = (sim: string, r: Azar) => `${sim}-${Math.floor(r() * 1e9).toString(36)}`

/** Lee un número escrito por el estudiante: acepta coma decimal, puntos de miles y espacios. */
export function leerNumero(texto: string): number | null {
  let t = texto.trim().replace(/\s/g, '').replace(/[^\d.,-]/g, '')
  if (!t) return null
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.')
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** ¿Es correcta? Tolerancia relativa (ej. 0,03 = 3 %) o, para valores cercanos a 0, absoluta según los decimales pedidos. */
export function corregir(e: Ejercicio, respuesta: string | number): boolean {
  if (e.tipo === 'opcion') return Number(respuesta) === e.correcta
  const n = typeof respuesta === 'number' ? respuesta : leerNumero(respuesta)
  if (n === null) return false
  const absoluta = 10 ** -e.decimales * 1.5
  return Math.abs(n - e.respuesta) <= Math.max(Math.abs(e.respuesta) * e.tolerancia, absoluta)
}

function numero(sim: string, r: Azar, enunciado: string, respuesta: number, unidad: string, resolucion: string[], decimales = 1, tolerancia = 0.03): Ejercicio {
  return { tipo: 'numero', id: id(sim, r), simulador: sim, enunciado, respuesta, unidad, tolerancia, decimales, resolucion }
}

/** Mezcla las opciones manteniendo cuál es la correcta. */
function opcion(sim: string, r: Azar, enunciado: string, correcta: string, incorrectas: string[], resolucion: string[]): Ejercicio {
  const todas = [correcta, ...incorrectas]
  const orden = todas.map((_, i) => i).sort(() => r() - 0.5)
  return { tipo: 'opcion', id: id(sim, r), simulador: sim, enunciado, opciones: orden.map((i) => todas[i]), correcta: orden.indexOf(0), resolucion }
}

export const GENERADORES: Record<string, (r: Azar) => Ejercicio> = {
  compartimentos: (r) => {
    const peso = entre(r, 50, 90)
    const sexo = elegir(r, ['hombre', 'mujer'] as const)
    const evento = elegir(r, [
      { nombre: 'agua destilada (sin solutos)', osm: 0 },
      { nombre: 'solución fisiológica (NaCl 0,9 %, ≈ 290 mOsm/L)', osm: 290 },
      { nombre: 'NaCl 3 % (≈ 1026 mOsm/L)', osm: 1026 },
      { nombre: 'NaCl 0,45 % (≈ 154 mOsm/L)', osm: 154 },
    ])
    const vol = entre(r, 1, 3, 0.5)
    const c0 = compartimentosIniciales(peso, sexo, 290)
    const c1 = aplicarEvento(c0, vol, evento.osm)
    return numero('compartimentos', r,
      `Un${sexo === 'mujer' ? 'a mujer' : ' hombre'} de ${peso} kg con osmolaridad plasmática de 290 mOsm/L recibe ${fmt(vol)} L de ${evento.nombre} por vía intravenosa. Suponiendo que el soluto queda en el LEC, ¿cuál es su nueva osmolaridad plasmática?`,
      c1.osm, 'mOsm/L', [
        `Agua corporal total = ${sexo === 'hombre' ? '60' : '50'} % × ${peso} = ${fmt(c0.act)} L; LIC = ${fmt(c0.lic)} L; LEC = ${fmt(c0.lec)} L.`,
        `Osmoles totales = ${fmt(c0.act)} × 290 + ${fmt(vol)} × ${evento.osm} = ${fmt(c0.act * 290 + vol * evento.osm, 0)} mOsm.`,
        `Nueva agua corporal = ${fmt(c1.act)} L → osmolaridad = ${fmt(c0.act * 290 + vol * evento.osm, 0)} / ${fmt(c1.act)} = ${fmt(c1.osm)} mOsm/L.`,
        `El LIC conserva sus osmoles: LIC = ${fmt(c0.lic)} × 290 / ${fmt(c1.osm)} = ${fmt(c1.lic)} L; LEC = ${fmt(c1.lec)} L.`,
      ], 1, 0.01)
  },

  osmolaridad: (r) => {
    const soluto = elegir(r, [
      { nombre: 'NaCl', i: 2, pm: 58.5, phi: 0.93 },
      { nombre: 'CaCl₂', i: 3, pm: 111, phi: 0.86 },
      { nombre: 'glucosa', i: 1, pm: 180, phi: 1 },
      { nombre: 'urea', i: 1, pm: 60, phi: 1 },
    ])
    const porc = soluto.nombre === 'glucosa' ? entre(r, 2, 10, 0.5) : soluto.nombre === 'urea' ? entre(r, 0.5, 3, 0.5) : entre(r, 0.3, 2, 0.1)
    const temp = elegir(r, [25, 30, 37])
    const m = porcientoAMolar(porc, soluto.pm)
    const osm = osmolaridad(m, soluto.i, soluto.phi)
    const pi = presionOsmotica(osm, temp)
    return numero('osmolaridad', r,
      `Calculá la presión osmótica real (en atm) de una solución de ${soluto.nombre} al ${fmt(porc, 2)} % p/v a ${temp} °C (PM = ${soluto.pm} g/mol; i = ${soluto.i}; φ = ${fmt(soluto.phi, 2)}). Usá R = 0,082 L·atm/(mol·K).`,
      pi, 'atm', [
        `Molaridad = (${fmt(porc, 2)} g/100 mL × 10) / ${soluto.pm} = ${fmt(m, 4)} mol/L.`,
        `Osmolaridad real = M × i × φ = ${fmt(m, 4)} × ${soluto.i} × ${fmt(soluto.phi, 2)} = ${fmt(osm, 4)} Osm/L.`,
        `π = R × T × C = 0,082 × ${temp + 273} × ${fmt(osm, 4)} = ${fmt(pi, 2)} atm.`,
      ], 2)
  },

  starling: (r) => {
    const pcg = entre(r, 45, 70)
    const pcb = entre(r, 10, 25)
    const picg = entre(r, 22, 36)
    const kf = entre(r, 8, 15, 0.5)
    const pnf = presionNetaFiltracion({ pcg, pcb, picg })
    if (pnf <= 0) return GENERADORES.starling(r)
    return numero('starling', r,
      `En un glomérulo la presión hidrostática capilar es ${pcg} mmHg, la de la cápsula de Bowman ${pcb} mmHg y la presión oncótica capilar media ${picg} mmHg (la oncótica de Bowman es despreciable). Si Kf = ${fmt(kf)} mL/min/mmHg, ¿cuál es la TFG?`,
      tfgStarling(kf, pnf), 'mL/min', [
        `PNF = (PCG − PCB) − (πCG − πCB) = (${pcg} − ${pcb}) − (${picg} − 0) = ${pnf} mmHg.`,
        `TFG = Kf × PNF = ${fmt(kf)} × ${pnf} = ${fmt(tfgStarling(kf, pnf))} mL/min.`,
      ])
  },

  clearance: (r) => {
    const tipo = elegir(r, ['cg', 'ckd', 'cl'] as const)
    const sexo = elegir(r, ['hombre', 'mujer'] as const)
    const edad = entre(r, 25, 85)
    const cr = entre(r, 0.6, 3, 0.1)
    if (tipo === 'cg') {
      const peso = entre(r, 50, 100)
      const v = cockcroftGault(edad, peso, cr, sexo)
      return numero('clearance', r, `Estimá el clearance de creatinina con Cockcroft-Gault: ${sexo === 'mujer' ? 'mujer' : 'hombre'} de ${edad} años, ${peso} kg, creatinina ${fmt(cr)} mg/dL.`, v, 'mL/min', [
        `CG = (140 − edad) × peso / (72 × Cr)${sexo === 'mujer' ? ' × 0,85' : ''} = (140 − ${edad}) × ${peso} / (72 × ${fmt(cr)})${sexo === 'mujer' ? ' × 0,85' : ''} = ${fmt(v)} mL/min.`,
      ])
    }
    if (tipo === 'ckd') {
      const v = ckdEpi2021(edad, cr, sexo)
      return numero('clearance', r, `Estimá la TFG con CKD-EPI 2021: ${sexo === 'mujer' ? 'mujer' : 'hombre'} de ${edad} años, creatinina ${fmt(cr)} mg/dL.`, v, 'mL/min/1,73 m²', [
        `CKD-EPI 2021 = 142 × mín(Cr/κ, 1)^α × máx(Cr/κ, 1)^−1,2 × 0,9938^edad${sexo === 'mujer' ? ' × 1,012' : ''}, con κ = ${sexo === 'mujer' ? '0,7' : '0,9'} y α = ${sexo === 'mujer' ? '−0,241' : '−0,302'}.`,
        `Resultado: ${fmt(v)} mL/min/1,73 m².`,
      ], 0, 0.04)
    }
    const ucr = entre(r, 60, 200)
    const v = entre(r, 0.6, 2, 0.1)
    const res = clearance(ucr, v, cr)
    return numero('clearance', r, `Orina de 24 h: creatinina urinaria ${ucr} mg/dL, volumen minuto ${fmt(v)} mL/min; creatinina plasmática ${fmt(cr)} mg/dL. ¿Cuál es el clearance de creatinina?`, res, 'mL/min', [
      `C = U × V / P = ${ucr} × ${fmt(v)} / ${fmt(cr)} = ${fmt(res)} mL/min.`,
    ])
  },

  'tm-pah': (r) => {
    if (r() < 0.5) {
      const glu = entre(r, 150, 600, 10)
      const tfg = entre(r, 90, 130, 5)
      const g = glucosaRenal(glu, tfg, 375, 0)
      return numero('tm-pah', r, `Con una glucemia de ${glu} mg/dL, TFG de ${tfg} mL/min y un Tm de glucosa de 375 mg/min (sin considerar el splay), ¿cuánta glucosa se excreta por minuto?`, g.excretada, 'mg/min', [
        `Carga filtrada = TFG × P = ${tfg} × ${glu} / 100 = ${fmt(g.filtrada)} mg/min.`,
        `Reabsorbida = mín(carga filtrada, Tm) = ${fmt(g.reabsorbida)} mg/min.`,
        `Excretada = filtrada − reabsorbida = ${fmt(g.excretada)} mg/min${g.excretada === 0 ? ' (no hay glucosuria).' : '.'}`,
      ], 1, 0.02)
    }
    const upah = entre(r, 300, 700, 10)
    const ppah = entre(r, 1, 3, 0.5)
    const v = entre(r, 0.8, 2, 0.1)
    const hto = entre(r, 0.38, 0.5, 0.01)
    const f = flujosRenales(upah, v, ppah, hto)
    return numero('tm-pah', r, `PAH urinario ${upah} mg/dL, PAH plasmático ${fmt(ppah)} mg/dL, volumen minuto ${fmt(v)} mL/min y hematocrito ${fmt(hto * 100, 0)} %. ¿Cuál es el flujo sanguíneo renal?`, f.fsr, 'mL/min', [
      `FPR efectivo = clearance de PAH = ${upah} × ${fmt(v)} / ${fmt(ppah)} = ${fmt(f.fpre)} mL/min.`,
      `FSR = FPR / (1 − Hto) = ${fmt(f.fpre)} / ${fmt(1 - hto, 2)} = ${fmt(f.fsr)} mL/min.`,
    ])
  },

  contracorriente: (r) => {
    const preguntas = [
      { p: '¿Qué segmento es impermeable al agua y saca NaCl activamente, creando el "efecto único" del multiplicador?', ok: 'Rama ascendente gruesa del asa de Henle', mal: ['Rama descendente delgada', 'Túbulo contorneado proximal', 'Vasos rectos'], exp: 'La rama ascendente gruesa transporta Na⁺-K⁺-2Cl⁻ (NKCC2) sin agua: el líquido tubular se diluye y el intersticio se concentra.' },
      { p: '¿Qué pasa con el gradiente medular si aumenta mucho el flujo de los vasos rectos?', ok: 'Se lava y disminuye', mal: ['Aumenta', 'No cambia', 'Se invierte'], exp: 'Los vasos rectos son un intercambiador de contracorriente de flujo bajo; si el flujo aumenta, arrastran solutos y "lavan" el gradiente.' },
      { p: '¿Qué aporta la urea al gradiente de la médula interna?', ok: 'Recircula desde el colector medular (con ADH) y suma osmolaridad en la médula interna', mal: ['Se secreta en el túbulo proximal y diluye la médula', 'No participa en el gradiente', 'Sale por la rama ascendente gruesa'], exp: 'La ADH hace permeable a la urea el colector medular interno (UT-A1); la urea se acumula en el intersticio de la médula interna.' },
      { p: '¿Con qué osmolaridad llega el líquido tubular al túbulo distal?', ok: 'Hipoosmótico (≈ 100 mOsm/kg)', mal: ['Isoosmótico (≈ 300 mOsm/kg)', 'Hiperosmótico (≈ 1200 mOsm/kg)', 'Depende solo de la ADH'], exp: 'Al salir de la rama ascendente gruesa (segmento dilutor) el líquido es siempre hipoosmótico, con o sin ADH.' },
    ]
    const q = elegir(r, preguntas)
    return opcion('contracorriente', r, q.p, q.ok, q.mal, [q.exp])
  },

  'adh-sraa': (r) => {
    if (r() < 0.5) {
      const posm = entre(r, 270, 310)
      const uosm = elegir(r, [entre(r, 60, 200), entre(r, 500, 1100)])
      const v = uosm < 250 ? entre(r, 4, 12, 0.5) : entre(r, 0.4, 1.5, 0.1)
      const cosm = clearanceOsmolar(uosm, v, posm)
      const ch2o = clearanceAguaLibre(uosm, v, posm)
      return numero('adh-sraa', r, `Volumen minuto ${fmt(v)} mL/min, osmolaridad urinaria ${uosm} mOsm/kg y plasmática ${posm} mOsm/kg. ¿Cuál es el clearance de agua libre?`, ch2o, 'mL/min', [
        `Cosm = Uosm × V / Posm = ${uosm} × ${fmt(v)} / ${posm} = ${fmt(cosm, 2)} mL/min.`,
        `CH2O = V − Cosm = ${fmt(v)} − ${fmt(cosm, 2)} = ${fmt(ch2o, 2)} mL/min (${ch2o < 0 ? 'negativo: el riñón retiene agua libre, orina concentrada (ADH alta)' : 'positivo: se excreta agua libre, orina diluida (ADH baja)'}).`,
      ], 2, 0.03)
    }
    const una = entre(r, 5, 80), pna = entre(r, 130, 145), ucr = entre(r, 30, 150), pcr = entre(r, 1, 6, 0.1)
    const f = fena(una, pna, ucr, pcr)
    return numero('adh-sraa', r, `Na urinario ${una} mEq/L, Na plasmático ${pna} mEq/L, creatinina urinaria ${ucr} mg/dL y plasmática ${fmt(pcr)} mg/dL. ¿Cuál es la excreción fraccional de sodio?`, f, '%', [
      `FENa = (UNa × PCr) / (PNa × UCr) × 100 = (${una} × ${fmt(pcr)}) / (${pna} × ${ucr}) × 100 = ${fmt(f, 2)} %.`,
      f < 1 ? 'Menor a 1 %: patrón prerrenal (el túbulo conserva sodio).' : f > 2 ? 'Mayor a 2 %: sugiere daño tubular.' : 'Entre 1 y 2 %: indeterminado.',
    ], 2, 0.03)
  },

  acidobase: (r) => {
    if (r() < 0.4) {
      const hco3 = entre(r, 8, 40)
      const pco2 = entre(r, 20, 75)
      const ph = phHH(hco3, pco2)
      return numero('acidobase', r, `Calculá el pH con Henderson-Hasselbalch si HCO3− = ${hco3} mEq/L y pCO2 = ${pco2} mmHg (pK = 6,1; s = 0,03 mmol/L/mmHg).`, ph, '', [
        `pH = 6,1 + log(HCO3− / (0,03 × pCO2)) = 6,1 + log(${hco3} / ${fmt(0.03 * pco2, 2)}) = ${fmt(ph, 2)}.`,
      ], 2, 0.003)
    }
    const casos = [
      { ph: 7.25, pco2: 28, hco3: 12, na: 140, cl: 104 },
      { ph: 7.32, pco2: 30, hco3: 15, na: 138, cl: 112 },
      { ph: 7.5, pco2: 48, hco3: 37 },
      { ph: 7.24, pco2: 60, hco3: 26 },
      { ph: 7.36, pco2: 58, hco3: 32, cronica: true },
      { ph: 7.55, pco2: 25, hco3: 21.5 },
      { ph: 7.1, pco2: 40, hco3: 12 },
      { ph: 7.6, pco2: 30, hco3: 29 },
    ]
    const g = elegir(r, casos)
    const i = interpretarGasometria(g)
    const diagnostico = i.agregado ? `${i.primario} con ${i.agregado}` : i.primario.startsWith('mixto') ? i.primario : `${i.primario} ${i.compensacion === 'adecuada' ? 'compensada adecuadamente' : ''}`.trim()
    const otras = ['acidosis metabólica compensada adecuadamente', 'alcalosis metabólica compensada adecuadamente', 'acidosis respiratoria compensada adecuadamente', 'alcalosis respiratoria compensada adecuadamente', 'acidosis metabólica con acidosis respiratoria agregada', 'mixto: alcalosis metabólica y respiratoria']
      .filter((x) => normalizar(x) !== normalizar(diagnostico))
    return opcion('acidobase', r,
      `Gasometría arterial: pH ${fmt(g.ph, 2)}, pCO2 ${g.pco2} mmHg, HCO3− ${fmt(g.hco3)} mEq/L${g.na ? `, Na ${g.na}, Cl ${g.cl} mEq/L` : ''}${g.cronica ? ' (cuadro de varios días)' : ''}. ¿Cuál es la interpretación?`,
      diagnostico, otras.sort(() => r() - 0.5).slice(0, 3), i.pasos)
  },

  orina: (r) => {
    const casos = [
      { p: 'Orina con nitritos positivos, leucocituria abundante y bacterias en el sedimento, sin cilindros. ¿Qué sugiere?', ok: 'Infección urinaria baja', mal: ['Glomerulonefritis', 'Necrosis tubular aguda', 'Diabetes descompensada'] },
      { p: 'Hematuria con hematíes dismórficos y cilindros hemáticos, con proteinuria moderada. ¿Qué sugiere?', ok: 'Hematuria de origen glomerular (glomerulonefritis)', mal: ['Litiasis ureteral', 'Infección urinaria baja', 'Contaminación menstrual'] },
      { p: 'Glucosuria y cetonuria con densidad urinaria alta en un paciente con poliuria. ¿Qué sugiere?', ok: 'Diabetes descompensada (glucosuria por superar el Tm)', mal: ['Síndrome nefrótico', 'Insuficiencia renal crónica', 'Infección urinaria'] },
      { p: 'Proteinuria masiva (3+/4+), cilindros grasos y cuerpos ovales grasos, sin hematuria. ¿Qué sugiere?', ok: 'Síndrome nefrótico', mal: ['Síndrome nefrítico', 'Infección urinaria', 'Deshidratación'] },
      { p: 'Cilindros granulosos "pardos" y células epiteliales tubulares en un paciente con insuficiencia renal aguda. ¿Qué sugiere?', ok: 'Necrosis tubular aguda', mal: ['Causa prerrenal pura', 'Cistitis', 'Litiasis'] },
      { p: 'Densidad urinaria 1,030, cilindros hialinos aislados y sedimento sin otros hallazgos en un paciente deshidratado. ¿Qué sugiere?', ok: 'Orina concentrada por causa prerrenal (hallazgo no patológico del sedimento)', mal: ['Glomerulonefritis', 'Pielonefritis', 'Síndrome nefrótico'] },
      { p: 'Bilirrubina positiva en orina, orina color "coca-cola" y urobilinógeno bajo. ¿Qué sugiere?', ok: 'Colestasis (bilirrubina conjugada que se filtra)', mal: ['Hemólisis', 'Hematuria glomerular', 'Rabdomiólisis'] },
      { p: 'Tira reactiva positiva para "sangre" pero sin hematíes en el sedimento, tras un esfuerzo físico extremo. ¿Qué sugiere?', ok: 'Mioglobinuria (rabdomiólisis) o hemoglobinuria', mal: ['Hematuria glomerular', 'Infección urinaria', 'Error de laboratorio seguro'] },
    ]
    const c = elegir(r, casos)
    return opcion('orina', r, c.p, c.ok, c.mal, [`Respuesta: ${c.ok}.`])
  },
}

export function nuevoEjercicio(simulador: string, azar: Azar = Math.random): Ejercicio {
  const g = GENERADORES[simulador]
  if (!g) throw new Error(`No hay ejercicios para "${simulador}".`)
  return g(azar)
}

