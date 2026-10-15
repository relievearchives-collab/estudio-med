import { useMemo } from 'react'
import { paqueteActivo } from '../contenido'
import { temasFlojosPractica } from '../practica/sesion'
import { useAjustes, useIntentos, useRevisionesDesde, useTarjetas, useTemas } from '../repositorio/hooks'
import { temasFlojos } from '../tarjetas/flojos'
import { planificar, type ParcialPlan } from './planificar'

const DIA = 864e5

/** Plan de estudio vigente: parciales con fecha, temas visibles, lo estudiado y los temas flojos a reforzar. */
export function usePlan(ahora: number) {
  const a = useAjustes()
  const temas = useTemas()
  const intentos = useIntentos()
  const tarjetas = useTarjetas()
  const revs = useRevisionesDesde(ahora - 30 * DIA)
  return useMemo(() => {
    if (!a || !temas) return null
    const parciales: ParcialPlan[] = paqueteActivo.parciales
      .filter((p) => a.fechasParciales[p.id])
      .map((p) => ({ id: p.id, nombre: p.nombre, fecha: a.fechasParciales[p.id], unidadIds: p.unidadesSugeridas }))
    const porId = new Map((tarjetas ?? []).map((t) => [t.id, t]))
    const reforzar = [...new Set([
      ...temasFlojosPractica(intentos ?? [], 3, 10).map((x) => x.temaId),
      ...temasFlojos(revs ?? [], porId, 4, 10).map((x) => x.temaId),
    ])]
    return {
      planes: planificar({ parciales, temas, estudiados: a.temasEstudiados, hoy: ahora, maxPorDia: a.temasPorDiaMax, reforzar }),
      temas, estudiados: a.temasEstudiados, maxPorDia: a.temasPorDiaMax, hayFechas: parciales.length > 0,
    }
  }, [a, temas, intentos, tarjetas, revs, ahora])
}
