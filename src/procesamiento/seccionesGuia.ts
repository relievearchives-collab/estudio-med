import type { PaqueteContenido } from '../contenido/tipos'
import type { ContenidoGuia } from '../repositorio/tipos'
import { limpiarRenglones, normalizar } from '../busqueda/normalizar'
import { claveEncabezado, esRenglonDescartable } from './fragmentar'

/**
 * Extrae de la guía importada la situación problemática y los objetivos de cada unidad,
 * usando las páginas que indica el paquete. Así la app muestra el texto oficial sin
 * que esté copiado en el código.
 */
export function extraerSeccionesGuia(
  paquete: PaqueteContenido,
  textoDePagina: (n: number) => string | undefined,
  encabezados: Set<string>,
  fuenteId: string,
): ContenidoGuia[] {
  const lineas = (n: number) =>
    (textoDePagina(n) ?? '').split('\n').map((l) => l.trim()).filter((l) => !esRenglonDescartable(l) && !encabezados.has(claveEncabezado(l)))
  const aliasDisciplinas = new Set(paquete.disciplinas.flatMap((d) => d.alias.map(normalizar)))

  return paquete.unidades.map((u) => {
    // Situación problemática: desde el título "SITUACIÓN PROBLEMÁTICA" hasta una cita entre comillas o el fin de la página
    const ls = lineas(u.paginaSituacion)
    const i = ls.findIndex((l) => normalizar(l).startsWith('situacion problematica'))
    const situacionLineas: string[] = []
    if (i >= 0) {
      for (const l of ls.slice(i + 1)) {
        if (/^[“"]/.test(l) || normalizar(l) === 'lluvia de ideas') break
        situacionLineas.push(l)
      }
    }
    // Objetivos: desde "Objetivos" hasta el primer título de disciplina
    const lo = lineas(u.paginaObjetivos)
    const j = lo.findIndex((l) => normalizar(l) === 'objetivos')
    const objetivos: string[] = []
    if (j >= 0) {
      for (const l of lo.slice(j + 1)) {
        if (aliasDisciplinas.has(normalizar(l))) break
        objetivos.push(l)
      }
    }
    return {
      unidadId: u.id,
      situacion: limpiarRenglones(situacionLineas),
      paginaSituacion: u.paginaSituacion,
      objetivos: objetivosAMarkdown(objetivos),
      paginaObjetivos: u.paginaObjetivos,
      fuenteId,
    }
  })
}

/** Convierte renglones con viñetas "•" y subtítulos (Generales/Específicos) en Markdown. */
function objetivosAMarkdown(lineas: string[]) {
  const items: string[] = []
  let actual: string[] = []
  const cerrar = () => { if (actual.length) items.push('- ' + limpiarRenglones(actual)); actual = [] }
  for (const l of lineas) {
    if (/^(general(es)?|espec[ií]fic[oa]s?)$/i.test(l)) { cerrar(); items.push(`\n**${l}**\n`); continue }
    if (/^[•y]\s/.test(l) || l.startsWith('•')) { cerrar(); actual.push(l.replace(/^[•y]\s*/, '')); continue }
    actual.push(l)
  }
  cerrar()
  return items.join('\n').trim()
}
