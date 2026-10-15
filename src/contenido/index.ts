import type { PaqueteContenido } from './tipos'
import { paqueteUnrSerHumano } from './unr-ser-humano-y-su-medio'

/** Paquetes disponibles. Para sumar otra área/facultad se agrega un paquete acá. */
export const paquetes: PaqueteContenido[] = [paqueteUnrSerHumano]

export const paqueteActivo: PaqueteContenido = paqueteUnrSerHumano

export function nombreDisciplina(id?: string) {
  return paqueteActivo.disciplinas.find((d) => d.id === id)?.nombre ?? 'Sin disciplina'
}
export function unidadPorId(id?: string) {
  return paqueteActivo.unidades.find((u) => u.id === id)
}
export function colorDisciplina(id?: string) {
  return paqueteActivo.disciplinas.find((d) => d.id === id)?.color ?? '#64748b'
}
/** Unidad (y disciplina) que corresponde a una página de la guía. */
export function rangoDePaginaGuia(pagina: number) {
  return paqueteActivo.guia.rangos.find((r) => pagina >= r.desde && pagina <= r.hasta)
}
