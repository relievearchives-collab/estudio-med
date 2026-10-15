# Funcionalidades y criterios de aceptación

"✔" = tiene que cumplirse para dar el módulo por terminado. Fases según PROMPT.md. El atlas 3D está en `ATLAS-3D.md`; los temas del área en `PROGRAMA-AREA.md`.

---

## A. Primera vez y configuración (Fase 1)

- Bienvenida en 3 pasos: (1) pegar la clave gratuita de Gemini, con guía paso a paso y botón "Probar"; (2) importar la **guía del área** (el árbol de temas ya viene armado; la guía se procesa como primera fuente); (3) subir sus propios apuntes (opcional).
- ✔ La clave se guarda solo en el dispositivo y se puede borrar.
- ✔ Aviso de privacidad: solo material de estudio, nunca datos de pacientes.
- ✔ Contador de llamadas de IA del día y aviso claro cuando se agota la cuota gratuita.
- ✔ Fecha de los parciales configurable (cuenta regresiva en "Hoy").

## B. Biblioteca (Fase 1)

- Árbol **UP → Disciplina → Tema**, precargado desde `PROGRAMA-AREA.md` y editable. Vista alternativa por disciplina (ej. "toda la Fisiología del área").
- Cada UP muestra su **situación problemática** y sus objetivos.
- Fuentes: PDF, foto de apunte o pizarrón (OCR), texto pegado.
- Procesamiento en Web Worker: texto por página → OCR si hace falta → fragmentos → embeddings locales → índice de texto exacto → asignación sugerida de tema.
- ✔ La guía de 247 páginas se procesa sin congelar la interfaz, con barra de progreso.
- ✔ Estado visible (en cola / procesando / listo / error con reintentar).

## C. Chat con citas clicables (Fase 1) — ver sección 3 del PROMPT

- Alcance: todo / una UP / una disciplina / un tema / fuentes elegidas.
- Botones de modo: Normal · Explicámelo simple · Nivel parcial · Solo puntos clave · Tabla comparativa.
- ✔ Cada afirmación lleva su número de cita; tocarlo abre el PDF en la página con la frase resaltada.
- ✔ Las citas se verifican en la app; las no verificables se ven en gris.
- ✔ Lo que no está en sus fuentes aparece aparte, marcado "No está en tus apuntes".
- ✔ Valores de referencia, fórmulas y cifras nunca sin cita.
- ✔ Conversaciones guardadas y buscables.

## D. Visor y notas (Fase 1)

- Visor PDF con resaltador de colores y comentarios. Seleccionar texto → *Preguntar · Crear tarjeta · Crear nota*.
- Notas en Markdown enlazadas a fragmentos y temas.
- ✔ Una sola barra de búsqueda sobre fuentes, notas y tarjetas.

## E. Tarjetas + FSRS y pantalla "Hoy" (Fase 2)

- Tipos: básica, cloze, oclusión de imagen (sobre imágenes de la guía, de sus apuntes o capturas del atlas 3D).
- Generación con IA desde fuente, tema, selección o respuesta del chat: una idea por tarjeta, enlace al fragmento de origen, vista previa para aceptar, editar o descartar.
- Repaso con Otra vez / Difícil / Bien / Fácil (teclas 1–4, espacio para revelar) y el próximo intervalo visible.
- Ajustes: retención objetivo (0,90 por defecto), nuevas por día (25 por defecto).
- "Hoy": repasos pendientes (incluye estructuras del atlas), sugerencias de temas flojos, cuenta regresiva al parcial, racha.
- ✔ Exportar `.apkg` (Anki) y CSV; importar CSV.

## F. Simuladores de fisiología y física (Fase 4)

Interactivos, con deslizadores y gráficos que cambian en vivo. Cada uno con: explicación breve citada a la guía, ejemplo resuelto y botón "Ejercicio nuevo" (la app genera valores aleatorios y corrige la respuesta del estudiante). **Las fórmulas se implementan en código, con tests unitarios, nunca las calcula la IA.**

1. **Compartimentos líquidos — Darrow-Yannet** (UP1–UP2): agua corporal total, LIC, LEC, plasma, intersticio. Elegir un evento (ganancia o pérdida de agua, de solución isotónica, hipertónica o hipotónica) y ver cómo cambian volúmenes y osmolaridad en el diagrama.
2. **Osmolaridad y tonicidad** (UP2, labs de Física): calculadora de mOsm/L, mEq/L, coeficiente osmótico y de reflexión; glóbulo rojo que se hincha o se arruga según la solución.
3. **Filtración glomerular — Starling** (UP3): presiones hidrostáticas y oncóticas, coeficiente de filtración; TFG y fracción de filtración resultantes; efecto de contraer la aferente o la eferente.
4. **Clearance y estimación de TFG** (UP3–UP4): clearance genérico (U×V/P), creatinina, **Cockcroft-Gault, MDRD y CKD-EPI** (usar la versión que figure en el material de la cátedra; si no figura, CKD-EPI 2021, y avisarlo en pantalla); carga filtrada vs. excretada.
5. **Glucosa y Tm / PAH** (UP4): curvas de carga filtrada, reabsorbida y excretada; umbral renal; flujo plasmático renal efectivo.
6. **Multiplicador de contracorriente** (UP4): animación por pasos del asa de Henle generando el gradiente medular; rol de la urea y de los vasos rectos.
7. **ADH, agua libre y SRAA** (UP5): escenarios (deshidratación, sobrecarga de agua, hemorragia, dieta con mucha sal) que muestran qué sensores se activan, qué hormonas suben o bajan, qué hace cada segmento de la nefrona y cómo cambian orina, osmolaridad y volumen; clearance osmolar y de agua libre; FENa.
8. **Ácido-base** (UP6, seminarios de Física): Henderson-Hasselbalch interactivo, **diagrama de Davenport**, bases buffer y exceso de bases; **intérprete paso a paso de gasometrías** (pH, pCO2, HCO3−): trastorno primario, compensación esperada, banda de compensación, trastorno mixto.
9. **Análisis de orina** (UP3): interpretar casos de examen físico, químico y sedimento.

## G. Preguntas tipo parcial (Fase 4)

- Opción múltiple estilo situación clínica (4–5 opciones), con explicación de cada opción y cita.
- **Ejercicios numéricos** al estilo de las actividades disciplinares (concentraciones, osmolaridad, pH, clearance), corregidos por código.
- Modo práctica y **simulacro de parcial** cronometrado (parcial 1 y parcial 2 con las UP que el estudiante elija).
- Reportar pregunta mala → editar o regenerar.
- ✔ Pregunta fallada → tarjeta con un toque.
- ✔ Mapa de calor de aciertos por UP y disciplina, y lista de temas flojos.

## H. Tutoría ABP (Fase 5)

Imita la dinámica de las tutorías del área:
- Muestra la **situación problemática** de la UP.
- **Lluvia de ideas:** el estudiante escribe sus ideas e hipótesis; la app las guarda.
- La IA hace de **tutor**: no da respuestas, hace preguntas que llevan a identificar los temas de cada disciplina, y al final compara las preguntas de aprendizaje del estudiante con los contenidos de esa UP en la guía ("te faltó pensar en…", con cita).
- Al cerrar la UP: "Explicá la situación integrando todas las disciplinas" → devolución con lo que faltó y tarjetas sugeridas.

## I. Extras (Fase 5)

- Examinador oral por voz (Web Speech API): pregunta, repregunta y califica.
- Caso clínico simulado paso a paso (interrogatorio → examen físico → estudios → interpretación), basado en las situaciones del área.
- Tablas comparativas y mapas conceptuales generados y editables, cada nodo con su cita.
- Plan de estudio hasta cada parcial, que se reajusta si se atrasa.
- Escuchar un resumen de un tema en voz alta.

## J. Datos

- ✔ Exportar todo a `.zip` e importarlo en otro dispositivo sin perder nada (incluido el estado FSRS).
- ✔ Recordatorio semanal de backup.
- ✔ Borrar todos los datos con doble confirmación.
