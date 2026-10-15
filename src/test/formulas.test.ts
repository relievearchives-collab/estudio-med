import { describe, expect, it } from 'vitest'
import {
  aplicarEvento, atmAMmHg, clasificarCambio, compartimentosIniciales, mgdlAMmol, osmolaridad, osmolaridadPlasmatica,
  porcientoAMolar, presionEfectiva, presionOsmotica, tonicidad, UMBRAL_HEMOLISIS, volumenGlobulo,
} from '../simuladores/formulas/liquidos'
import {
  aguaLibreElectrolitos, asaInicial, avanzar, bombear, cargas, circulacionGlomerular, CIRCULACION_BASAL, ckdEpi2021, clearance,
  clearanceAguaLibre, clearanceOsmolar, cockcroftGault, estadioERC, fena, flujosRenales, glucosaRenal, gradienteMedular, mdrd,
  pahRenal, presionNetaFiltracion, tfgStarling, umbralRenalGlucosa, umbralTeoricoGlucosa,
} from '../simuladores/formulas/renal'
import { anionGap, excesoBases, hco3HH, interpretarGasometria, pco2HH, phHH } from '../simuladores/formulas/acidobase'

describe('Darrow-Yannet', () => {
  const base = compartimentosIniciales(70, 'hombre', 290)
  it('reparte el agua corporal (60 % del peso; LIC 2/3, LEC 1/3, plasma 1/4 del LEC)', () => {
    expect(base.act).toBeCloseTo(42)
    expect(base.lic).toBeCloseTo(28)
    expect(base.lec).toBeCloseTo(14)
    expect(base.plasma).toBeCloseTo(3.5)
    expect(compartimentosIniciales(60, 'mujer').act).toBeCloseTo(30)
  })
  it('isotónica: solo cambia el LEC', () => {
    const d = aplicarEvento(base, 2, 290)
    expect(d.osm).toBeCloseTo(290)
    expect(d.lic).toBeCloseTo(28)
    expect(d.lec).toBeCloseTo(16)
    expect(clasificarCambio(base, d)).toBe('expansión isoosmótica')
  })
  it('agua pura: baja la osmolaridad y se reparte entre LIC y LEC', () => {
    const d = aplicarEvento(base, 1, 0)
    expect(d.osm).toBeCloseTo((290 * 42) / 43)
    expect(d.lic).toBeCloseTo((28 * 290) / d.osm)
    expect(d.lic + d.lec).toBeCloseTo(43)
    expect(clasificarCambio(base, d)).toBe('expansión hipoosmótica')
  })
  it('hipertónica: sube la osmolaridad, sale agua de las células y el LEC crece más que lo infundido', () => {
    const d = aplicarEvento(base, 1, 1026)
    expect(d.osm).toBeGreaterThan(290)
    expect(d.lic).toBeLessThan(28)
    expect(d.lec - base.lec).toBeGreaterThan(1)
  })
  it('pérdida de agua (deshidratación): contracción hiperosmótica', () => {
    const d = aplicarEvento(base, -2, 0)
    expect(clasificarCambio(base, d)).toBe('contracción hiperosmótica')
    expect(() => aplicarEvento(base, -50, 0)).toThrow()
  })
})

describe('osmolaridad y presión osmótica (convención de la guía)', () => {
  it('reproduce el ejemplo NaCl 0,15 M vs CaCl2 0,1 M a 30 °C (π teórica 7,45 atm)', () => {
    expect(presionOsmotica(osmolaridad(0.15, 2), 30)).toBeCloseTo(7.45, 2)
    expect(presionOsmotica(osmolaridad(0.1, 3), 30)).toBeCloseTo(7.45, 2)
    // reales con φ: NaCl 0,95 y CaCl2 0,90 → la de NaCl es mayor
    expect(presionOsmotica(osmolaridad(0.15, 2, 0.95), 30)).toBeGreaterThan(presionOsmotica(osmolaridad(0.1, 3, 0.9), 30))
  })
  it('conversiones y osmolaridad plasmática', () => {
    expect(porcientoAMolar(0.9, 58.5)).toBeCloseTo(0.1538, 3)
    expect(porcientoAMolar(5, 180)).toBeCloseTo(0.2778, 3)
    expect(mgdlAMmol(90, 180)).toBeCloseTo(5)
    expect(osmolaridadPlasmatica(140, 90, 30)).toBeCloseTo(290)
    expect(atmAMmHg(1)).toBe(760)
    expect(presionEfectiva(0.1, 37, 0)).toBe(0)
  })
  it('tonicidad y volumen del glóbulo rojo', () => {
    expect(tonicidad(0.3)).toBe('isotónica')
    expect(tonicidad(0.15)).toBe('hipotónica')
    expect(tonicidad(0.6)).toBe('hipertónica')
    expect(volumenGlobulo(0.3)).toBeCloseTo(1)
    expect(volumenGlobulo(0.6)).toBeLessThan(1)
    expect(volumenGlobulo(porcientoAMolar(0.45, 58.5) * 2)).toBeGreaterThanOrEqual(UMBRAL_HEMOLISIS - 0.02)
  })
})

describe('Starling glomerular', () => {
  it('PNF y TFG con los valores clásicos (60 − 18 − 32 = 10 mmHg; Kf 12,5 → 125 mL/min)', () => {
    const pnf = presionNetaFiltracion({ pcg: 60, pcb: 18, picg: 32 })
    expect(pnf).toBe(10)
    expect(tfgStarling(12.5, pnf)).toBe(125)
  })
  it('modelo de arteriolas: basal razonable; contraer la eferente sube PCG y FF; contraer la aferente baja la TFG', () => {
    const b = circulacionGlomerular(CIRCULACION_BASAL)
    expect(b.pcg).toBeCloseTo(60)
    expect(b.tfg).toBeGreaterThan(100)
    expect(b.tfg).toBeLessThan(150)
    expect(b.ff).toBeGreaterThan(0.15)
    expect(b.ff).toBeLessThan(0.25)
    const ef = circulacionGlomerular({ ...CIRCULACION_BASAL, eferente: 1.5 })
    expect(ef.pcg).toBeGreaterThan(b.pcg)
    expect(ef.ff).toBeGreaterThan(b.ff)
    expect(ef.fpr).toBeLessThan(b.fpr)
    const af = circulacionGlomerular({ ...CIRCULACION_BASAL, aferente: 1.5 })
    expect(af.tfg).toBeLessThan(b.tfg)
    expect(af.fpr).toBeLessThan(b.fpr)
  })
})

describe('clearance y TFG estimada', () => {
  it('clearance genérico U×V/P', () => {
    expect(clearance(120, 1, 1)).toBe(120)
  })
  it('Cockcroft-Gault', () => {
    expect(cockcroftGault(60, 72, 1, 'hombre')).toBeCloseTo(80)
    expect(cockcroftGault(60, 72, 1, 'mujer')).toBeCloseTo(68)
  })
  it('MDRD (IDMS 175)', () => {
    expect(mdrd(50, 1, 'hombre')).toBeCloseTo(79.1, 0)
  })
  it('CKD-EPI 2021', () => {
    expect(ckdEpi2021(50, 1, 'hombre')).toBeCloseTo(91.7, 0)
    expect(ckdEpi2021(60, 0.8, 'mujer')).toBeCloseTo(84.3, 0)
    expect(ckdEpi2021(70, 2.5, 'hombre')).toBeLessThan(30)
    expect(estadioERC(84)).toMatch(/^G2/)
    expect(estadioERC(25)).toMatch(/^G4/)
  })
  it('cargas filtrada y excretada (reabsorción vs secreción neta)', () => {
    const c = cargas(125, 100, 0, 1)
    expect(c.filtrada).toBe(125)
    expect(c.transporteNeto).toBe(125)
    expect(cargas(125, 1, 300, 1).transporteNeto).toBeLessThan(0)
  })
})

describe('glucosa y PAH', () => {
  it('sin glucosuria con glucemia normal; con 400 mg/dL hay glucosuria', () => {
    expect(glucosaRenal(90).excretada).toBeCloseTo(0)
    expect(glucosaRenal(400).excretada).toBeGreaterThan(100)
  })
  it('el umbral real (splay) es menor que el teórico Tm/TFG = 300 mg/dL', () => {
    expect(umbralTeoricoGlucosa()).toBeCloseTo(300)
    const u = umbralRenalGlucosa()
    expect(u).toBeGreaterThan(180)
    expect(u).toBeLessThan(260)
  })
  it('clearance de PAH ≈ FPR efectivo a concentración baja y cae al saturarse la secreción', () => {
    expect(pahRenal(1).clearance).toBeCloseTo(650 * 0.9, -1)
    expect(pahRenal(50).clearance).toBeLessThan(pahRenal(1).clearance)
    const f = flujosRenales(650, 1, 1, 0.45)
    expect(f.fpre).toBe(650)
    expect(f.fsr).toBeCloseTo(1181.8, 0)
  })
})

describe('multiplicador de contracorriente', () => {
  it('genera un gradiente creciente hacia la papila y entrega líquido hipoosmótico al túbulo distal', () => {
    let e = asaInicial(6)
    for (let k = 0; k < 40; k++) e = avanzar(bombear(e))
    const g = e.intersticio
    for (let k = 1; k < g.length; k++) expect(g[k]).toBeGreaterThan(g[k - 1])
    expect(g[g.length - 1]).toBeGreaterThan(800)
    expect(e.salida).toBeLessThan(300)
  })
  it('la urea aumenta y el lavado por flujo alto de vasos rectos disminuye el gradiente', () => {
    let e = asaInicial(6)
    for (let k = 0; k < 40; k++) e = avanzar(bombear(e))
    const base = gradienteMedular(e, { urea: false, adh: true, flujoVasosRectos: 'normal' })
    const urea = gradienteMedular(e, { urea: true, adh: true, flujoVasosRectos: 'normal' })
    const lavado = gradienteMedular(e, { urea: false, adh: true, flujoVasosRectos: 'alto' })
    expect(urea[5]).toBeGreaterThan(base[5])
    expect(lavado[5]).toBeLessThan(base[5])
  })
})

describe('agua libre y FENa', () => {
  it('orina concentrada → clearance de agua libre negativo; diluida → positivo', () => {
    expect(clearanceOsmolar(600, 1, 300)).toBe(2)
    expect(clearanceAguaLibre(600, 1, 300)).toBe(-1)
    expect(clearanceAguaLibre(100, 6, 300)).toBe(4)
    expect(aguaLibreElectrolitos(2, 70, 70, 140)).toBe(0)
  })
  it('FENa', () => {
    expect(fena(20, 140, 100, 1)).toBeCloseTo(0.143, 2)
    expect(fena(60, 140, 30, 3)).toBeCloseTo(4.29, 1)
  })
})

describe('ácido-base', () => {
  it('Henderson-Hasselbalch y su inversa', () => {
    expect(phHH(24, 40)).toBeCloseTo(7.4, 2)
    expect(hco3HH(7.4, 40)).toBeCloseTo(24, 0)
    expect(pco2HH(7.4, 24)).toBeCloseTo(40, 0)
    expect(excesoBases(7.4, 24.4)).toBeCloseTo(0)
  })
  it('acidosis metabólica con AG aumentado y compensación adecuada (Winter)', () => {
    const r = interpretarGasometria({ ph: 7.25, pco2: 28, hco3: 12, na: 140, cl: 104 })
    expect(r.coherente).toBe(true)
    expect(r.primario).toBe('acidosis metabólica')
    expect(r.esperado?.min).toBeCloseTo(24)
    expect(r.esperado?.max).toBeCloseTo(28)
    expect(r.compensacion).toBe('adecuada')
    expect(r.anionGap).toBe(24)
    expect(anionGap(140, 104, 12, 2)).toBe(29)
  })
  it('acidosis metabólica con acidosis respiratoria agregada', () => {
    const r = interpretarGasometria({ ph: 7.1, pco2: 40, hco3: 12 })
    expect(r.primario).toBe('acidosis metabólica')
    expect(r.agregado).toBe('acidosis respiratoria agregada')
  })
  it('respiratorias aguda y crónica', () => {
    const aguda = interpretarGasometria({ ph: 7.24, pco2: 60, hco3: 26 })
    expect(aguda.primario).toBe('acidosis respiratoria')
    expect(aguda.compensacion).toBe('adecuada')
    const cronica = interpretarGasometria({ ph: 7.34, pco2: 60, hco3: 31, cronica: true })
    expect(cronica.compensacion).toBe('adecuada')
    expect(interpretarGasometria({ ph: 7.55, pco2: 25, hco3: 21.5 }).primario).toBe('alcalosis respiratoria')
  })
  it('alcalosis metabólica, mixtos y datos incoherentes', () => {
    expect(interpretarGasometria({ ph: 7.5, pco2: 47, hco3: 36 }).primario).toBe('alcalosis metabólica')
    expect(interpretarGasometria({ ph: 7.0, pco2: 60, hco3: 14 }).primario).toBe('mixto: acidosis metabólica y respiratoria')
    expect(interpretarGasometria({ ph: 7.4, pco2: 60, hco3: 12 }).coherente).toBe(false)
  })
})

describe('ejercicios generados por código', () => {
  it('cada simulador genera ejercicios válidos que se corrigen bien (100 semillas)', async () => {
    const { GENERADORES, azarConSemilla, corregir, fmt } = await import('../simuladores/ejercicios')
    for (const sim of Object.keys(GENERADORES)) {
      for (let s = 1; s <= 100; s++) {
        const e = GENERADORES[sim](azarConSemilla(s * 7919 + sim.length))
        expect(e.enunciado.length).toBeGreaterThan(20)
        expect(e.resolucion.length).toBeGreaterThan(0)
        if (e.tipo === 'numero') {
          expect(Number.isFinite(e.respuesta), `${sim} ${s}`).toBe(true)
          // La respuesta escrita como la escribiría el estudiante (coma decimal) es correcta; un 20 % de error no.
          expect(corregir(e, fmt(e.respuesta, e.decimales + 1))).toBe(true)
          if (Math.abs(e.respuesta) > 1) expect(corregir(e, String(e.respuesta * 1.2))).toBe(false)
        } else {
          expect(e.opciones.length).toBeGreaterThanOrEqual(2)
          expect(new Set(e.opciones).size).toBe(e.opciones.length)
          expect(corregir(e, e.correcta)).toBe(true)
          expect(corregir(e, (e.correcta + 1) % e.opciones.length)).toBe(false)
        }
      }
    }
  })
  it('lee números con coma decimal y puntos de miles', async () => {
    const { leerNumero } = await import('../simuladores/ejercicios')
    expect(leerNumero('7,25')).toBe(7.25)
    expect(leerNumero('1.234,5')).toBe(1234.5)
    expect(leerNumero('125 mL/min')).toBe(125)
    expect(leerNumero('-0,8')).toBe(-0.8)
    expect(leerNumero('abc')).toBeNull()
  })
})
