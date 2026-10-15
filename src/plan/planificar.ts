import type { Tema } from '../repositorio/tipos'

/**
 * Plan de estudio hasta cada parcial (código puro, sin IA). Se recalcula cada vez con lo que falta:
 * si un día no se estudió lo previsto, esos temas se reparten en los días que quedan.
 */

export interface ParcialPlan {
  id: string
  nombre: string
  /** Fecha del parcial (AAAA-MM-DD). */
  fecha: string
  unidadIds: string[]
}

export type TipoDia = 'estudio' | 'repaso' | 'parcial'

export interface DiaPlan {
  fecha: string
  tipo: TipoDia
  temaIds: string[]
}

export interface PlanParcial {
  parcial: ParcialPlan
  dias: DiaPlan[]
  total: number
  estudiados: number
  pendientes: number
  diasEstudio: number
  /** Máximo de temas que toca en un día. */
  temasPorDia: number
  /** El ritmo necesario supera el máximo que eligió el estudiante. */
  noAlcanza: boolean
}

const DIA = 864e5

/** Fecha local AAAA-MM-DD. */
export function fechaISO(d: Date | number) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

const medianoche = (iso: string) => { const [a, m, d] = iso.split('-').map(Number); return new Date(a, m - 1, d).getTime() }

/** Días enteros de `desde` a `hasta` (ambas AAAA-MM-DD); robusto a cambios de horario. */
export function diasEntre(desde: string, hasta: string) {
  return Math.round((medianoche(hasta) - medianoche(desde)) / DIA)
}

export function sumarDias(iso: string, n: number) {
  const [a, m, d] = iso.split('-').map(Number)
  return fechaISO(new Date(a, m - 1, d + n))
}

/** Días de repaso general antes del parcial según los días disponibles. */
export function diasDeRepaso(disponibles: number) {
  return disponibles >= 6 ? 2 : disponibles >= 3 ? 1 : 0
}

/** Reparte `n` ítems en `dias` días de forma pareja (los días con más temas quedan espaciados). */
export function repartir<T>(items: T[], dias: number): T[][] {
  return Array.from({ length: dias }, (_, i) => items.slice(Math.floor((i * items.length) / dias), Math.floor(((i + 1) * items.length) / dias)))
}

export function planificar(op: {
  parciales: ParcialPlan[]
  /** Temas visibles, en el orden en que se estudian. */
  temas: Tema[]
  /** temaId → fecha en que el estudiante lo marcó como estudiado. */
  estudiados: Record<string, number>
  hoy: Date | number
  maxPorDia: number
  /** Temas a reforzar en los días de repaso (p. ej. flojos en práctica o repaso). */
  reforzar?: string[]
}): PlanParcial[] {
  const hoy = fechaISO(op.hoy)
  const inicioHoy = medianoche(hoy)
  const futuros = op.parciales.filter((p) => p.fecha && diasEntre(hoy, p.fecha) >= 0).sort((a, b) => a.fecha.localeCompare(b.fecha))
  const salida: PlanParcial[] = []
  let inicio = hoy
  for (const parcial of futuros) {
    const deParcial = parcial.unidadIds.flatMap((u) => op.temas.filter((t) => t.unidadId === u))
    const pendientes = deParcial.filter((t) => !op.estudiados[t.id])
    // Lo que se marcó hoy se sigue repartiendo como pendiente: así el día de hoy no cambia al ir tildando.
    const aRepartir = deParcial.filter((t) => !op.estudiados[t.id] || op.estudiados[t.id] >= inicioHoy)
    const disponibles = Math.max(0, diasEntre(inicio, parcial.fecha))
    let repaso = diasDeRepaso(disponibles)
    // Si con los días de repaso no alcanza, se usan para estudiar.
    if (aRepartir.length > (disponibles - repaso) * op.maxPorDia) repaso = 0
    const diasEstudio = disponibles - repaso
    const reparto = diasEstudio > 0 ? repartir(aRepartir, diasEstudio) : []
    const reforzar = (op.reforzar ?? []).filter((id) => deParcial.some((t) => t.id === id))
    const dias: DiaPlan[] = [
      ...reparto.map((ts, i) => ({ fecha: sumarDias(inicio, i), tipo: 'estudio' as const, temaIds: ts.map((t) => t.id) })),
      ...Array.from({ length: repaso }, (_, i) => ({ fecha: sumarDias(inicio, diasEstudio + i), tipo: 'repaso' as const, temaIds: reforzar })),
      // Sin días disponibles (el parcial es hoy), lo pendiente queda en el día del parcial.
      { fecha: parcial.fecha, tipo: 'parcial' as const, temaIds: diasEstudio > 0 ? [] : pendientes.map((t) => t.id) },
    ]
    const temasPorDia = Math.max(0, ...reparto.map((d) => d.length))
    salida.push({
      parcial, dias, total: deParcial.length, estudiados: deParcial.length - pendientes.length, pendientes: pendientes.length, diasEstudio,
      temasPorDia, noAlcanza: pendientes.length > 0 && (diasEstudio === 0 || temasPorDia > op.maxPorDia),
    })
    inicio = sumarDias(parcial.fecha, 1)
  }
  return salida
}

/** Lo que toca hoy: el primer día del plan del parcial más próximo, si es hoy. */
export function planDeHoy(planes: PlanParcial[], hoy: Date | number): { plan: PlanParcial; dia: DiaPlan } | null {
  const iso = fechaISO(hoy)
  for (const plan of planes) {
    const dia = plan.dias.find((d) => d.fecha === iso)
    if (dia) return { plan, dia }
  }
  return null
}

/** "Hoy · jueves 15 oct.", "Mañana · …" o la fecha larga. */
export function etiquetaFecha(iso: string, hoy: number) {
  const fecha = new Date(iso + 'T12:00')
  const hoyISO = fechaISO(hoy)
  const manana = fechaISO(hoy + 864e5)
  const base = fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'short' })
  return iso === hoyISO ? `Hoy · ${base}` : iso === manana ? `Mañana · ${base}` : base
}
