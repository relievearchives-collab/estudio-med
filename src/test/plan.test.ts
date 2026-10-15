import { describe, expect, it } from 'vitest'
import { diasEntre, fechaISO, planDeHoy, planificar, repartir, sumarDias } from '../plan/planificar'
import type { Tema } from '../repositorio/tipos'

const tema = (id: string, unidadId: string): Tema => ({ id, unidadId, disciplinaId: 'fisiologia', nombre: id, orden: 0, origen: 'paquete' })
const temasUP = (u: string, n: number) => Array.from({ length: n }, (_, i) => tema(`${u}-t${i + 1}`, u))
const HOY = new Date(2026, 9, 15, 10, 0)

describe('fechas', () => {
  it('suma días y cuenta diferencias en fecha local, cruzando meses', () => {
    expect(fechaISO(HOY)).toBe('2026-10-15')
    expect(sumarDias('2026-10-30', 3)).toBe('2026-11-02')
    expect(diasEntre('2026-10-15', '2026-11-02')).toBe(18)
  })

  it('reparte parejo, sin perder ni repetir', () => {
    const r = repartir([1, 2, 3, 4, 5, 6, 7], 3)
    expect(r.map((x) => x.length)).toEqual([2, 2, 3])
    expect(r.flat()).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(repartir([1, 2], 4).map((x) => x.length)).toEqual([0, 1, 0, 1])
  })
})

describe('plan hasta los parciales', () => {
  const temas = [...temasUP('up1', 6), ...temasUP('up2', 6), ...temasUP('up4', 4)]
  const parciales = [
    { id: 'p1', nombre: 'Parcial 1', fecha: '2026-10-25', unidadIds: ['up1', 'up2'] },
    { id: 'p2', nombre: 'Parcial 2', fecha: '2026-11-10', unidadIds: ['up4'] },
  ]

  it('reparte los temas pendientes en los días que faltan y deja días de repaso', () => {
    const [p1, p2] = planificar({ parciales, temas, estudiados: {}, hoy: HOY, maxPorDia: 3, reforzar: ['up2-t3', 'up4-t1'] })
    // 10 días hasta el parcial 1: 8 de estudio + 2 de repaso + el día del parcial
    expect(p1.diasEstudio).toBe(8)
    expect(p1.dias.map((d) => d.tipo)).toEqual([...Array(8).fill('estudio'), 'repaso', 'repaso', 'parcial'])
    expect(p1.dias[0].fecha).toBe('2026-10-15')
    expect(p1.dias.at(-1)!.fecha).toBe('2026-10-25')
    expect(p1.dias.flatMap((d) => (d.tipo === 'estudio' ? d.temaIds : []))).toEqual([...temasUP('up1', 6), ...temasUP('up2', 6)].map((t) => t.id))
    expect(p1.temasPorDia).toBe(2)
    expect(p1.noAlcanza).toBe(false)
    // El repaso del parcial 1 refuerza solo sus temas flojos
    expect(p1.dias[8].temaIds).toEqual(['up2-t3'])
    // El parcial 2 arranca el día después del parcial 1
    expect(p2.dias[0].fecha).toBe('2026-10-26')
    expect(p2.total).toBe(4)
  })

  it('se reajusta: lo estudiado sale del plan y lo atrasado se redistribuye en los días que quedan', () => {
    const estudiados = Object.fromEntries(temasUP('up1', 6).map((t) => [t.id, 1]))
    const [p1] = planificar({ parciales, temas, estudiados, hoy: HOY, maxPorDia: 3 })
    expect(p1.estudiados).toBe(6)
    expect(p1.pendientes).toBe(6)
    expect(p1.dias.flatMap((d) => d.temaIds)).not.toContain('up1-t1')

    // Cinco días después sin estudiar nada: los mismos 6 temas en menos días.
    const [tarde] = planificar({ parciales, temas, estudiados: {}, hoy: new Date(2026, 9, 22), maxPorDia: 3 })
    expect(tarde.dias[0].fecha).toBe('2026-10-22')
    expect(tarde.diasEstudio).toBe(3)
    expect(tarde.temasPorDia).toBe(4)
    expect(tarde.noAlcanza).toBe(true)
  })

  it('lo que se tilda hoy queda en el día de hoy (el plan del día no cambia al marcarlo)', () => {
    const antes = planificar({ parciales, temas, estudiados: {}, hoy: HOY, maxPorDia: 3 })[0]
    const despues = planificar({ parciales, temas, estudiados: { 'up1-t1': HOY.getTime() }, hoy: HOY, maxPorDia: 3 })[0]
    expect(despues.dias.map((d) => d.temaIds)).toEqual(antes.dias.map((d) => d.temaIds))
    expect(despues.pendientes).toBe(11)
    // Al día siguiente ya no se reparte
    const manana = planificar({ parciales, temas, estudiados: { 'up1-t1': HOY.getTime() }, hoy: new Date(2026, 9, 16), maxPorDia: 3 })[0]
    expect(manana.dias.flatMap((d) => d.temaIds)).not.toContain('up1-t1')
  })

  it('usa los días de repaso para estudiar si no alcanza el tiempo', () => {
    const [p1] = planificar({ parciales, temas, estudiados: {}, hoy: new Date(2026, 9, 18), maxPorDia: 2 })
    // 7 días: con 2 de repaso quedarían 5 × 2 = 10 < 12 temas → todos de estudio
    expect(p1.dias.filter((d) => d.tipo === 'repaso')).toHaveLength(0)
    expect(p1.diasEstudio).toBe(7)
  })

  it('el día del parcial y parciales pasados', () => {
    const planes = planificar({ parciales, temas, estudiados: {}, hoy: new Date(2026, 9, 25), maxPorDia: 3 })
    expect(planes[0].dias).toHaveLength(1)
    expect(planes[0].dias[0]).toMatchObject({ tipo: 'parcial' })
    expect(planes[0].noAlcanza).toBe(true)
    expect(planificar({ parciales, temas, estudiados: {}, hoy: new Date(2026, 10, 11), maxPorDia: 3 })).toEqual([])
    expect(planificar({ parciales: [{ ...parciales[0], fecha: '' }], temas, estudiados: {}, hoy: HOY, maxPorDia: 3 })).toEqual([])
  })

  it('plan de hoy', () => {
    const planes = planificar({ parciales, temas, estudiados: {}, hoy: HOY, maxPorDia: 3 })
    const h = planDeHoy(planes, HOY)
    expect(h?.plan.parcial.id).toBe('p1')
    expect(h?.dia.temaIds).toEqual(['up1-t1'])
    expect(planDeHoy(planes, new Date(2026, 11, 1))).toBeNull()
  })
})
