/** Entidades persistidas. La app accede a ellas SOLO a través de src/repositorio/. */

export type EstadoFuente = 'en_cola' | 'procesando' | 'listo' | 'error'
export type TipoFuente = 'pdf' | 'imagen' | 'texto'

export interface Fuente {
  id: string
  nombre: string
  tipo: TipoFuente
  esGuia: boolean
  /** Archivo original (PDF o imagen). En fuentes de texto pegado, undefined. */
  archivo?: Blob
  mime?: string
  paginas: number
  estado: EstadoFuente
  /** 0..1 */
  progreso: number
  etapa?: string
  error?: string
  creada: number
  /** Fecha del material, si el estudiante la indica (para alertar sobre material viejo). */
  fechaMaterial?: string
  unidadIds: string[]
}

export interface Pagina {
  fuenteId: string
  numero: number
  texto: string
  /** true si el texto salió de OCR. */
  ocr?: boolean
}

export interface Fragmento {
  id: string
  fuenteId: string
  pagina: number
  /** Posición [inicio, fin) dentro del texto de la página (ver procesamiento/textoPagina.ts). */
  inicio: number
  fin: number
  texto: string
  /** Último título detectado antes del fragmento. */
  titulo?: string
  palabras: number
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  embedding?: Float32Array
}

export interface Tema {
  id: string
  unidadId: string
  disciplinaId: string
  nombre: string
  orden: number
  origen: 'paquete' | 'usuario'
  oculto?: boolean
}

export interface ContenidoGuia {
  unidadId: string
  situacion: string
  paginaSituacion: number
  objetivos: string
  paginaObjetivos: number
  fuenteId: string
}

export interface CitaVerificada {
  /** Número de fragmento en la respuesta (F1 → 1). */
  n: number
  fragmentoId?: string
  frase: string
  verificada: boolean
}

export interface Segmento {
  texto: string
  citas: CitaVerificada[]
  /** El segmento tiene cifras/fórmulas sin ninguna cita verificada. */
  cifraSinCita?: boolean
}

export interface MensajeChat {
  id: string
  rol: 'usuario' | 'ia'
  texto: string
  segmentos?: Segmento[]
  fueraDeFuentes?: string
  sinInformacion?: boolean
  fragmentoIds?: string[]
  modo?: string
  error?: string
  fecha: number
}

export interface Alcance {
  tipo: 'todo' | 'unidad' | 'disciplina' | 'tema' | 'fuentes'
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  fuenteIds?: string[]
}

export interface Chat {
  id: string
  titulo: string
  alcance: Alcance
  mensajes: MensajeChat[]
  creado: number
  actualizado: number
}

export interface Nota {
  id: string
  titulo: string
  markdown: string
  temaIds: string[]
  fragmentoIds: string[]
  origen?: 'chat' | 'visor' | 'manual'
  creada: number
  actualizada: number
}

export interface Resaltado {
  id: string
  fuenteId: string
  pagina: number
  inicio: number
  fin: number
  texto: string
  color: 'amarillo' | 'verde' | 'rosa' | 'celeste'
  comentario?: string
  creado: number
}

export interface UsoIA {
  fecha: string
  llamadas: number
  tokens: number
  agotado?: boolean
}

export interface CacheIA {
  hash: string
  respuesta: string
  fecha: number
}

export interface Evento {
  id?: number
  tipo: string
  fecha: number
  detalle?: string
  /** segundos */
  duracion?: number
}

export interface Ajuste {
  clave: string
  valor: unknown
}

// ───────────────────────── Fase 2: tarjetas ─────────────────────────

export type TipoTarjeta = 'basica' | 'cloze' | 'oclusion'

/**
 * Estado FSRS de una tarjeta (mismos campos que `Card` de ts-fsrs) con las fechas
 * en milisegundos: así sobrevive intacto al respaldo JSON.
 */
export interface EstadoFSRS {
  due: number
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  learning_steps: number
  reps: number
  lapses: number
  /** 0 nueva · 1 aprendiendo · 2 repaso · 3 reaprendiendo */
  state: number
  last_review?: number
}

/** Rectángulo de oclusión, en proporciones de la imagen (0..1). */
export interface Mascara {
  id: string
  x: number
  y: number
  w: number
  h: number
  /** Lo que hay debajo (lo que hay que recordar). */
  etiqueta: string
}

export interface Tarjeta {
  id: string
  tipo: TipoTarjeta
  /** Básica: pregunta. Oclusión: consigna opcional. */
  frente: string
  /** Básica: respuesta. Cloze/oclusión: dato extra opcional que se muestra al revelar. */
  dorso: string
  /** Cloze: texto con {{c1::respuesta}} o {{c1::respuesta::pista}}. */
  cloze?: string
  /** Cloze: número de hueco que pregunta esta tarjeta (c1, c2…). */
  clozeN?: number
  /** Oclusión: imagen compartida y todas sus máscaras; `mascara` es la que pregunta esta tarjeta. */
  imagenId?: string
  mascaras?: Mascara[]
  mascara?: string
  /** Tarjetas hermanas (mismo cloze con varios huecos o misma imagen). */
  grupoId?: string
  fragmentoId?: string
  fuenteId?: string
  pagina?: number
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  etiquetas: string[]
  origen: 'ia' | 'manual' | 'csv'
  /** Copias indexadas de fsrs.due y fsrs.state, para armar la cola. */
  vence: number
  estado: number
  fsrs: EstadoFSRS
  suspendida?: boolean
  creada: number
  actualizada: number
}

export interface Revision {
  id?: number
  tarjetaId: string
  fecha: number
  /** 1 Otra vez · 2 Difícil · 3 Bien · 4 Fácil */
  calificacion: number
  /** Estado previo (para deshacer). */
  antes: EstadoFSRS
  /** Días hasta el próximo repaso que quedó programado. */
  intervalo: number
  estabilidad: number
  dificultad: number
  /** ms que tardó en responder */
  duracion?: number
}

// ───────────────────────── Fase 4: preguntas tipo parcial ─────────────────────────

export interface OpcionPregunta {
  texto: string
  /** Por qué es correcta o incorrecta. */
  explicacion: string
}

/** Pregunta de opción múltiple estilo parcial (situación clínica), editable. */
export interface Pregunta {
  id: string
  enunciado: string
  opciones: OpcionPregunta[]
  correcta: number
  /** Explicación general de la respuesta. */
  explicacion: string
  fragmentoId?: string
  fuenteId?: string
  pagina?: number
  /** Frase textual de la fuente que respalda la respuesta. */
  frase?: string
  verificada: boolean
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  origen: 'ia' | 'manual'
  /** Motivo si el estudiante la reportó como mala. */
  reportada?: string
  creada: number
  actualizada: number
}

/** Un intento de práctica: una pregunta del banco o un ejercicio numérico de un simulador. */
export interface Intento {
  id?: number
  origen: 'pregunta' | 'ejercicio' | 'oral'
  preguntaId?: string
  /** Simulador del ejercicio numérico. */
  simulador?: string
  enunciado: string
  respuesta?: string
  correcta: boolean
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  simulacroId?: string
  fecha: number
  /** segundos */
  duracion?: number
}

// ───────────────────────── Fase 3: atlas 3D ─────────────────────────

/** Estado de repaso de una estructura del atlas (Modo Museo / ¿Dónde está?), con FSRS. */
export interface EstructuraAtlas {
  /** id de la pieza (el mismo en todas las escenas donde aparece). */
  id: string
  escena: string
  fsrs: EstadoFSRS
  vence: number
  estado: number
  aciertos: number
  fallos: number
  ultimo?: number
}

/** Cambios del estudiante a una ficha del atlas (texto propio o "revisado"). */
export interface FichaEditada {
  /** id de la ficha (src/atlas/estructuras.json) */
  id: string
  cambios: Record<string, string>
  revisado: boolean
  actualizada: number
}

export interface ImagenTarjeta {
  id: string
  archivo: Blob
  mime: string
  nombre?: string
  creada: number
}

// ───────────────────────── Fase 5: tutoría ABP ─────────────────────────

export type EtapaTutoria = 'situacion' | 'ideas' | 'tutor' | 'preguntas' | 'cierre'

export interface MensajeTutoria {
  rol: 'estudiante' | 'tutor'
  texto: string
  fecha: number
}

/** Pregunta de aprendizaje del estudiante y los temas de la UP que la IA le asignó (validados por código). */
export interface PreguntaAprendizaje {
  texto: string
  temaIds: string[]
}

/** Tema de la UP que no quedó cubierto: lo decide el código; la IA solo redacta el "te faltó…". */
export interface FaltanteTutoria {
  temaId: string
  disciplinaId: string
  texto: string
  cita?: CitaVerificada
}

/** Devolución del cierre integrador. */
export interface DevolucionTutoria {
  segmentos: Segmento[]
  /** Disciplinas de la UP que la explicación no integró (calculado por código). */
  disciplinasFaltantes: string[]
  /** Fragmentos enviados a la IA (para enlazar las tarjetas sugeridas). */
  fragmentoIds: string[]
  /** Tarjetas sugeridas para lo que faltó (el estudiante elige cuáles guardar). */
  tarjetas: TarjetaSugerida[]
}

export interface TarjetaSugerida {
  tipo: 'basica' | 'cloze'
  frente: string
  dorso: string
  cloze?: string
  fragmentoId?: string
  frase: string
  verificada: boolean
  /** Ya se guardó en el mazo. */
  guardada?: boolean
}

/** Una tutoría ABP sobre la situación problemática de una UP. */
export interface Tutoria {
  id: string
  unidadId: string
  etapa: EtapaTutoria
  ideas: string[]
  hipotesis: string[]
  mensajes: MensajeTutoria[]
  preguntas: PreguntaAprendizaje[]
  faltantes?: FaltanteTutoria[]
  explicacion?: string
  devolucion?: DevolucionTutoria
  terminada?: number
  creada: number
  actualizada: number
}

// ───────────────────────── Fase 5: examen oral ─────────────────────────

export interface TurnoOral {
  rol: 'examinador' | 'estudiante'
  texto: string
}

/** Una pregunta del examen oral con su rúbrica (puntos clave) y lo que pasó al responderla. */
export interface PreguntaOral {
  enunciado: string
  /** Puntos clave que una respuesta completa tiene que mencionar (rúbrica). */
  puntos: string[]
  fragmentoId?: string
  frase?: string
  verificada: boolean
  unidadId?: string
  disciplinaId?: string
  temaId?: string
  turnos: TurnoOral[]
  /** Índices de `puntos` que el estudiante cubrió (unión de todas sus respuestas). */
  cubiertos: number[]
  /** Los que cubrió en la primera respuesta (antes de la repregunta). */
  cubiertosPrimera?: number[]
  /** Errores conceptuales detectados. */
  errores: string[]
  repreguntada: boolean
  /** 0–10, calculada por código a partir de cubiertos y errores. */
  nota?: number
  devolucion?: Segmento[]
}

export interface ExamenOral {
  id: string
  alcance: Alcance
  titulo: string
  preguntas: PreguntaOral[]
  /** Pregunta en curso. */
  actual: number
  /** Nota final 0–10 (promedio por código) al terminar. */
  nota?: number
  terminado?: number
  creado: number
  actualizado: number
}
