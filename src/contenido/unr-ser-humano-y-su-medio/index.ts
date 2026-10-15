import type { PaqueteContenido, TemaPaquete } from '../tipos'

/**
 * Paquete: "El Ser Humano y Su Medio" — Medicina, FCM-UNR, 2026.
 * Estructura tomada de docs/PROGRAMA-AREA.md y verificada contra la guía oficial
 * (la guía manda). Los resúmenes de las situaciones son redacción propia; el texto
 * completo se extrae de la guía que importa el estudiante en su dispositivo.
 */

const temas: TemaPaquete[] = []
function t(unidadId: string, disciplinaId: string, nombres: string[]) {
  nombres.forEach((nombre, i) => temas.push({ id: `${unidadId}-${disciplinaId}-${i + 1}`, unidadId, disciplinaId, nombre }))
}

// UP1 — Introductorio
t('up1', 'anatomia', ['Fosa lumbar', 'Columna lumbar', 'Articulaciones de la columna lumbar', 'Músculos de la región lumbar', 'Retroperitoneo'])
t('up1', 'histologia', ['Tejido conectivo (repaso)', 'Tejido sanguíneo (repaso)'])
t('up1', 'fisiologia', ['Fisiología de la sangre: fracciones, volumen sanguíneo y hematocrito', 'Plasma y proteinograma; valores de referencia', 'Distribución del agua corporal; ingresos y egresos', 'Compartimentos líquidos: composición y medición'])
t('up1', 'fisica', ['El agua como solvente polar; capacidad solvente y dispersante', 'Densidad y tensión superficial', 'Propiedades térmicas: calor específico y calor latente', 'Rol del agua en la termorregulación'])
t('up1', 'biologia', ['Sistemas cibernéticos y retroalimentación', 'Ecosistema: tipos y evolución (sucesión, regresión)', 'Hábitat, nicho ecológico y leyes ecológicas', 'Factores bióticos y abióticos; relaciones entre especies', 'Síndrome general de adaptación'])
t('up1', 'salud-mental', ['Ambioma, genoma y epigenoma', 'Psiconeuroinmunoendocrinología (PNIE) 1: ejes'])
t('up1', 'medicina-sociedad', ['Condiciones de vida y salud'])
t('up1', 'med-preventiva', ['Ambiente como construcción social; salud ambiental', 'Epidemiología: concepto y aplicaciones', 'Control de vectores en salud pública'])

// UP2 — Niñez
t('up2', 'anatomia', ['Periné'])
t('up2', 'fisiologia', ['Intercambio de agua entre LIC y LEC', 'Intercambio entre plasma e intersticio', 'Diagramas de Darrow-Yannet', 'Osmolaridad plasmática: medición y estimación', 'Cationes y aniones séricos'])
t('up2', 'fisica', ['Ósmosis y presión osmótica', "Ley de Van't Hoff", 'Concentración osmótica efectiva y presión osmótica real', 'Soluciones iso, hipo e hiperosmóticas', 'Presión oncótica (soluciones coloidales)', 'Ósmosis inversa'])
t('up2', 'salud-mental', ['PNIE 2', 'Funciones de representación: lenguaje, pensamiento, gráfica y juego', 'La familia desde la perspectiva sistémica', 'Crisis vitales y ciclo vital familiar'])
t('up2', 'med-preventiva', ['Indicadores de salud: tasas, razones y proporciones', 'Natalidad, mortalidad y mortalidad infantil', 'Incidencia y prevalencia', 'Proceso salud-enfermedad-atención-cuidado; determinación social'])

// UP3 — Adolescencia
t('up3', 'anatomia', ['Riñones: configuración externa e interna', 'Relaciones y medios de fijación del riñón', 'Pelvis renal y cálices', 'Uréteres: trayecto, porciones y estrechamientos'])
t('up3', 'histologia', ['Configuración microscópica del riñón', 'Tubo urinífero: nefrón y tubo colector', 'Corpúsculo renal y barrera de filtración', 'Histología de vejiga y vías urinarias'])
t('up3', 'fisiologia', ['Nefrón: relación estructura-función', 'Flujo sanguíneo renal y autorregulación', 'Filtración, reabsorción, secreción y excreción', 'Filtración glomerular: ecuación de Starling', 'Barrera de filtración y albuminuria', 'TFG, fracción de filtración y carga filtrada', 'Regulación de la TFG', 'Clearance (aclaramiento) renal', 'Clearance de creatinina; Cockcroft-Gault, MDRD y CKD-EPI', 'Análisis de orina: examen físico, químico y sedimento'])
t('up3', 'salud-mental', ['PNIE 3', 'Consolidación de la identidad; normas y reglas', 'Familia y adolescencia', 'Redes sociales y salud mental'])
t('up3', 'medicina-sociedad', ['Estilos de vida y prácticas de salud'])

// UP4 — Adulto joven (función tubular)
t('up4', 'anatomia', ['Vejiga urinaria', 'Uretra masculina', 'Uretra femenina'])
t('up4', 'fisiologia', ['Reabsorción y secreción tubular', 'Carga filtrada y carga excretada', 'Transporte en el túbulo contorneado proximal', 'Glucosa y transporte máximo (Tm)', 'PAH y flujo plasmático renal efectivo', 'Asa de Henle; acuaporinas', 'Multiplicador de contracorriente', 'Manejo renal de la urea', 'Vasos rectos: intercambiador de contracorriente'])
t('up4', 'biologia', ['Población: estructura, demografía y pirámides', 'Crecimiento exponencial y sigmoideo', 'Crecimiento de la población humana'])
t('up4', 'microbiologia', ['El mundo microbiano: bacterias, hongos, parásitos y virus', 'Microbiota habitual; comensalismo, mutualismo y parasitismo'])
t('up4', 'salud-mental', ['El hombre en comunidad y el sufrimiento', 'Medio ambiente, ecología y salud mental'])
t('up4', 'med-preventiva', ['Agua potable y potabilización', 'Indicadores de condiciones de vida; pobreza y NBI'])

// UP5 — Adulto joven (volumen y osmolaridad)
t('up5', 'anatomia', ['Aorta abdominal y sus ramas', 'Vena cava inferior y tributarias', 'Arterias y venas de la pelvis', 'Sistema porta'])
t('up5', 'histologia', ['Embriología del aparato urinario'])
t('up5', 'fisiologia', ['Regulación diferencial de volumen del LEC y osmolaridad', 'Sed y balance hídrico', 'Clearance de agua libre y clearance osmolar', 'Túbulo distal y colector', 'ADH (vasopresina) y acuaporinas', 'Balance de sodio y sensores de volumen', 'Excreción fraccional de sodio (FENa)', 'Sistema renina-angiotensina-aldosterona; aparato yuxtaglomerular', 'Glándula suprarrenal', 'Péptidos natriuréticos', 'Riñón y presión arterial', 'Metabolismo del potasio y su regulación'])
t('up5', 'semiologia', ['Historia clínica', 'Método clínico', 'Relación médico-paciente'])
t('up5', 'salud-mental', ['Salud mental: concepto e indicadores', 'Semiología psiquiátrica en la posmodernidad'])
t('up5', 'medicina-sociedad', ['Relación ambiente-salud', 'Cambio climático'])
t('up5', 'med-preventiva', ['Saneamiento ambiental', 'Eliminación de residuos sólidos'])

// UP6 — Adulto mayor
t('up6', 'anatomia', ['Plexo lumbar y sus ramos', 'Nervios esplácnicos', 'Cadena simpática lumbar y sacra', 'Plexos autónomos abdominales y pelvianos'])
t('up6', 'fisiologia', ['pH y sistemas buffer', 'Bases buffer totales y exceso de bases', 'Sistema bicarbonato abierto y anhidrasa carbónica', 'Henderson-Hasselbalch y diagrama de Davenport', 'Trastornos ácido-base metabólicos y respiratorios', 'Compensaciones y banda de compensación', 'Trastornos mixtos', 'Riñón y metabolismo fosfocálcico: vitamina D y PTH', 'Regulación de la micción', 'Medio interno del adulto mayor'])
t('up6', 'fisica', ['Equilibrio químico y principio de Le Chatelier', 'Electrolitos fuertes y débiles', 'Kw, pH, pOH y cálculos de pH', 'Ácidos y bases: fuerza y neutralización', 'Mezclas reguladoras'])
t('up6', 'biologia', ['Contaminación ambiental: definición y clasificación', 'Capa de ozono y efecto invernadero', 'Magnificación biológica'])
t('up6', 'salud-mental', ['El adulto mayor en su medio social y familiar'])
t('up6', 'medicina-sociedad', ['Promoción de la salud', 'APS en el contexto rural', 'Desarrollo sostenible: Agenda 2030 y ODS'])
t('up6', 'med-preventiva', ['Eliminación de excretas', 'Envejecimiento poblacional', 'Barreras en la vida cotidiana de los adultos mayores'])

export const paqueteUnrSerHumano: PaqueteContenido = {
  id: 'unr-ser-humano-y-su-medio',
  version: 1,
  carrera: 'Medicina',
  universidad: 'Universidad Nacional de Rosario',
  facultad: 'Facultad de Ciencias Médicas',
  area: 'El Ser Humano y Su Medio',
  anio: 2026,
  nombreUnidad: 'Unidad Problema',
  disciplinas: [
    { id: 'anatomia', nombre: 'Anatomía', alias: ['ANATOMIA', 'ANATOMÍA'], color: '#ef4444' },
    { id: 'histologia', nombre: 'Histología y Embriología', alias: ['HISTOLOGÍA Y EMBRIOLOGÍA', 'HISTOLOGIA Y EMBRIOLOGIA', 'HISTOLOGÍA', 'HISTOLOGIA'], color: '#ec4899' },
    { id: 'fisiologia', nombre: 'Fisiología', alias: ['FISIOLOGIA', 'FISIOLOGÍA'], color: '#0ea5e9' },
    { id: 'fisica', nombre: 'Física Biológica', alias: ['FISICA', 'FÍSICA', 'FÍSICA BIOLÓGICA'], color: '#8b5cf6' },
    { id: 'biologia', nombre: 'Biología', alias: ['BIOLOGIA', 'BIOLOGÍA'], color: '#22c55e' },
    { id: 'microbiologia', nombre: 'Microbiología', alias: ['MICROBIOLOGIA', 'MICROBIOLOGÍA'], color: '#84cc16' },
    { id: 'salud-mental', nombre: 'Salud Mental', alias: ['SALUD MENTAL'], color: '#f97316' },
    { id: 'medicina-sociedad', nombre: 'Medicina y Sociedad', alias: ['MEDICINA Y SOCIEDAD'], color: '#eab308' },
    { id: 'med-preventiva', nombre: 'Medicina Preventiva y Social', alias: ['MEDICINA PREVENTIVA Y SOCIAL'], color: '#14b8a6' },
    { id: 'semiologia', nombre: 'Semiología', alias: ['SEMIOLOGIA', 'SEMIOLOGÍA'], color: '#64748b' },
  ],
  unidades: [
    { id: 'up1', numero: 1, sigla: 'UP1', titulo: 'Agua, medio interno y ambiente', modulo: 'Introductorio', paginas: [17, 24], paginaSituacion: 19, paginaObjetivos: 21, resumenSituacion: 'Una vecina de un barrio de Rosario almacena en baldes el agua que trae de una canilla comunitaria mientras aumentan los mosquitos y el dengue.' },
    { id: 'up2', numero: 2, sigla: 'UP2', titulo: 'Membranas e intercambio de agua', modulo: 'Niñez', paginas: [27, 34], paginaSituacion: 29, paginaObjetivos: 31, resumenSituacion: 'Un chico de 9 años que juega al rugby toma gaseosa "para hidratarse" después de entrenar; en la familia preocupa el aumento de caries.' },
    { id: 'up3', numero: 3, sigla: 'UP3', titulo: 'El riñón y la filtración', modulo: 'Adolescencia', paginas: [37, 44], paginaSituacion: 39, paginaObjetivos: 41, resumenSituacion: 'Dos adolescentes de 15 años consultan en el centro de salud por un video sobre dietas hiperproteicas y daño renal, y por cuánto deciden sobre su propio cuidado.' },
    { id: 'up4', numero: 4, sigla: 'UP4', titulo: 'Función tubular y agua', modulo: 'Adulto joven', paginas: [47, 54], paginaSituacion: 49, paginaObjetivos: 51, resumenSituacion: 'En un departamento de Santiago del Estero la mayoría de las viviendas no bebe agua de red; un médico nota pacientes que toman poca agua y tienen orina oscura.' },
    { id: 'up5', numero: 5, sigla: 'UP5', titulo: 'Regulación de volumen y osmolaridad', modulo: 'Adulto joven', paginas: [55, 64], paginaSituacion: 57, paginaObjetivos: 59, resumenSituacion: 'Un repartidor en bicicleta, con veranos cada vez más calurosos, toma poca agua, descansa mal y termina exhausto la jornada.' },
    { id: 'up6', numero: 6, sigla: 'UP6', titulo: 'Ácido-base, calcio-fósforo y micción', modulo: 'Adulto mayor', paginas: [67, 76], paginaSituacion: 70, paginaObjetivos: 72, resumenSituacion: 'Un jubilado recién enviudado sube a pie un cerro de casi 2000 m, se suma a un reclamo comunitario por la contaminación de un arroyo y empieza a respirar rápido y a marearse.' },
  ],
  temas,
  guia: {
    nombre: 'Guía del área',
    paginas: 247,
    huella: ['el ser humano', 'su medio', 'guía de', 'aprendizaje'],
    rangos: [
      { desde: 17, hasta: 24, unidadId: 'up1', tipo: 'unidad' },
      { desde: 27, hasta: 34, unidadId: 'up2', tipo: 'unidad' },
      { desde: 37, hasta: 44, unidadId: 'up3', tipo: 'unidad' },
      { desde: 47, hasta: 54, unidadId: 'up4', tipo: 'unidad' },
      { desde: 55, hasta: 64, unidadId: 'up5', tipo: 'unidad' },
      { desde: 67, hasta: 76, unidadId: 'up6', tipo: 'unidad' },
      { desde: 77, hasta: 116, unidadId: 'up1', tipo: 'material' },
      { desde: 117, hasta: 132, unidadId: 'up2', tipo: 'material' },
      { desde: 133, hasta: 146, unidadId: 'up3', tipo: 'material', descripcion: 'Anatomía del aparato urinario y micción' },
      { desde: 147, hasta: 172, unidadId: 'up4', tipo: 'material' },
      { desde: 173, hasta: 206, unidadId: 'up5', tipo: 'material' },
      { desde: 207, hasta: 230, unidadId: 'up6', tipo: 'material' },
      { desde: 233, hasta: 233, unidadId: 'up1', tipo: 'actividad', disciplinaId: 'med-preventiva', descripcion: 'Salida a terreno' },
      { desde: 234, hasta: 235, unidadId: 'up1', tipo: 'actividad', disciplinaId: 'fisica', descripcion: 'Laboratorio: dispersiones y concentraciones' },
      { desde: 236, hasta: 237, unidadId: 'up1', tipo: 'actividad', disciplinaId: 'histologia', descripcion: 'Laboratorio: tejidos conjuntivo y sanguíneo' },
      { desde: 238, hasta: 239, unidadId: 'up2', tipo: 'actividad', disciplinaId: 'fisica', descripcion: 'Laboratorio: ósmosis entre compartimentos' },
      { desde: 240, hasta: 243, unidadId: 'up3', tipo: 'actividad', disciplinaId: 'histologia', descripcion: 'Laboratorio: aparato urinario' },
      { desde: 244, hasta: 247, unidadId: 'up6', tipo: 'actividad', disciplinaId: 'fisica', descripcion: 'Seminarios: pH y regulación del pH' },
    ],
  },
  atlas: [
    { escena: 'rinones', unidadId: 'up3', prioridad: 1, temaIds: ['up3-anatomia-1', 'up3-anatomia-2', 'up3-anatomia-4'] },
    { escena: 'rinon-interior', unidadId: 'up3', prioridad: 1, temaIds: ['up3-anatomia-1', 'up3-anatomia-3'] },
    { escena: 'nefrona', unidadId: 'up3', prioridad: 1, temaIds: ['up3-fisiologia-1', 'up4-fisiologia-3', 'up4-fisiologia-6', 'up4-fisiologia-7', 'up4-fisiologia-9', 'up5-fisiologia-4', 'up5-fisiologia-8'] },
    { escena: 'vejiga-uretra', unidadId: 'up4', prioridad: 2, temaIds: ['up4-anatomia-1', 'up4-anatomia-2', 'up4-anatomia-3'] },
    { escena: 'vejiga-abierta', unidadId: 'up4', prioridad: 2, temaIds: ['up4-anatomia-1'] },
    { escena: 'triangulos-lumbares', unidadId: 'up1', prioridad: 3, temaIds: ['up1-anatomia-1', 'up1-anatomia-4'] },
    { escena: 'fosa-lumbar', unidadId: 'up1', prioridad: 3, temaIds: ['up1-anatomia-1', 'up1-anatomia-2', 'up1-anatomia-3', 'up1-anatomia-4', 'up1-anatomia-5'] },
    { escena: 'perine', unidadId: 'up2', prioridad: 3, temaIds: ['up2-anatomia-1'] },
    { escena: 'fosa-isquioanal', unidadId: 'up2', prioridad: 3, temaIds: ['up2-anatomia-1'] },
    { escena: 'vasos', unidadId: 'up5', prioridad: 4, temaIds: ['up5-anatomia-1', 'up5-anatomia-2', 'up5-anatomia-3', 'up5-anatomia-4'] },
    { escena: 'nervios', unidadId: 'up6', prioridad: 4, temaIds: ['up6-anatomia-1', 'up6-anatomia-2', 'up6-anatomia-3', 'up6-anatomia-4'] },
  ],
  simuladores: [
    { simulador: 'compartimentos', unidadIds: ['up1', 'up2'], disciplinaId: 'fisiologia', temaIds: ['up1-fisiologia-3', 'up1-fisiologia-4', 'up2-fisiologia-1', 'up2-fisiologia-3'], paginasGuia: [32, 185] },
    { simulador: 'osmolaridad', unidadIds: ['up2'], disciplinaId: 'fisica', temaIds: ['up2-fisica-1', 'up2-fisica-2', 'up2-fisica-3', 'up2-fisica-4', 'up2-fisiologia-4'], paginasGuia: [124, 125, 129, 130] },
    { simulador: 'starling', unidadIds: ['up3'], disciplinaId: 'fisiologia', temaIds: ['up3-fisiologia-4', 'up3-fisiologia-6', 'up3-fisiologia-7'], paginasGuia: [42, 131] },
    { simulador: 'clearance', unidadIds: ['up3', 'up4'], disciplinaId: 'fisiologia', temaIds: ['up3-fisiologia-8', 'up3-fisiologia-9', 'up4-fisiologia-2'], paginasGuia: [42, 52] },
    { simulador: 'tm-pah', unidadIds: ['up4'], disciplinaId: 'fisiologia', temaIds: ['up4-fisiologia-4', 'up4-fisiologia-5'], paginasGuia: [52] },
    { simulador: 'contracorriente', unidadIds: ['up4'], disciplinaId: 'fisiologia', temaIds: ['up4-fisiologia-6', 'up4-fisiologia-7', 'up4-fisiologia-8', 'up4-fisiologia-9'], paginasGuia: [52] },
    { simulador: 'adh-sraa', unidadIds: ['up5'], disciplinaId: 'fisiologia', temaIds: ['up5-fisiologia-1', 'up5-fisiologia-3', 'up5-fisiologia-5', 'up5-fisiologia-7', 'up5-fisiologia-8'], paginasGuia: [59, 60, 185, 192] },
    { simulador: 'acidobase', unidadIds: ['up6'], disciplinaId: 'fisiologia', temaIds: ['up6-fisiologia-1', 'up6-fisiologia-2', 'up6-fisiologia-4', 'up6-fisiologia-5', 'up6-fisiologia-6', 'up6-fisiologia-7', 'up6-fisica-3', 'up6-fisica-5'], paginasGuia: [73, 244] },
    { simulador: 'orina', unidadIds: ['up3'], disciplinaId: 'fisiologia', temaIds: ['up3-fisiologia-10'], paginasGuia: [42, 240] },
  ],
  parciales: [
    { id: 'parcial-1', nombre: 'Parcial 1', unidadesSugeridas: ['up1', 'up2', 'up3'] },
    { id: 'parcial-2', nombre: 'Parcial 2', unidadesSugeridas: ['up4', 'up5', 'up6'] },
  ],
  evaluacion: [
    'Dos parciales, con recuperatorio.',
    'Regularidad: 75 % de asistencia a tutorías y a actividades disciplinares, formativa satisfactoria, un parcial aprobado, laboratorios de reconocimiento de estructuras del Museo de Cs. Morfológicas, Soporte Vital y Práctica Territorial.',
    'Coloquio: los dos parciales con 8 o más sin recuperatorio y formativa muy satisfactoria.',
  ],
  bibliografiaBase: [
    { disciplinaId: 'anatomia', obligatoria: ['Rouvière, Delmas — Anatomía Humana'], ampliatoria: ['Bouchet', 'Moore', 'Latarjet', 'Pró', 'Prometheus', 'Testut', 'Atlas: Netter, Sobotta, Grant'] },
    { disciplinaId: 'fisiologia', obligatoria: [], ampliatoria: ['Houssay', 'Guyton & Hall', 'Berne & Levy', 'Aranalde y col. — Fisiología Renal'] },
  ],
}
