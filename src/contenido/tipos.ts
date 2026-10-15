/**
 * Un "paquete de contenido" describe una materia/área de una carrera y universidad.
 * La app no tiene nada de una facultad escrito en el código: todo sale de acá.
 * Solo contiene ESTRUCTURA (unidades, disciplinas, temas, páginas de referencia) y
 * resúmenes propios; nunca texto copiado de material con derechos de terceros.
 */
export interface Disciplina {
  id: string
  nombre: string
  /** Títulos con que la disciplina aparece en el material (para detectar secciones). */
  alias: string[]
  color: string
}

export interface Unidad {
  id: string
  numero: number
  /** Nombre corto que se muestra (ej. "UP3"). */
  sigla: string
  titulo: string
  modulo: string
  /** Páginas de la unidad en la guía oficial [desde, hasta]. */
  paginas: [number, number]
  /** Resumen propio de la situación problemática (el texto completo se extrae de la guía importada). */
  resumenSituacion: string
  /** Página de la guía donde está la situación problemática. */
  paginaSituacion: number
  /** Página de la guía donde empiezan los objetivos. */
  paginaObjetivos: number
}

export interface TemaPaquete {
  id: string
  unidadId: string
  disciplinaId: string
  nombre: string
}

/** Qué unidad (y opcionalmente disciplina) corresponde a cada tramo de páginas de la guía. */
export interface RangoGuia {
  desde: number
  hasta: number
  unidadId: string
  tipo: 'unidad' | 'material' | 'actividad'
  disciplinaId?: string
  descripcion?: string
}

/** Una escena del atlas 3D (src/atlas/escenas.json) dentro de esta área: a qué unidad y temas corresponde. */
export interface EscenaAtlasPaquete {
  escena: string
  unidadId: string
  /** 1 = primero (ver docs/ATLAS-3D.md). */
  prioridad: number
  temaIds: string[]
}

export interface Parcial {
  id: string
  nombre: string
  unidadesSugeridas: string[]
}

export interface PaqueteContenido {
  id: string
  version: number
  carrera: string
  universidad: string
  facultad: string
  area: string
  anio: number
  /** Nombre de las unidades en esta área ("Unidad Problema"). */
  nombreUnidad: string
  disciplinas: Disciplina[]
  unidades: Unidad[]
  temas: TemaPaquete[]
  guia: {
    nombre: string
    paginas: number
    rangos: RangoGuia[]
    /** Texto para reconocer que un PDF importado es la guía (portada). */
    huella: string[]
  }
  parciales: Parcial[]
  /** Escenas del atlas 3D que usa esta área (los modelos y fichas son reutilizables entre áreas). */
  atlas: EscenaAtlasPaquete[]
  /** Notas de evaluación/regularidad (resumen propio). */
  evaluacion: string[]
  bibliografiaBase: { disciplinaId: string; obligatoria: string[]; ampliatoria: string[] }[]
}
