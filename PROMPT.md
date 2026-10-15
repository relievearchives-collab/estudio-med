# PROMPT DEFINITIVO — "Estudio Med": app de estudio interactiva para "El Ser Humano y Su Medio" (Medicina, UNR)

Vas a construir, de punta a punta, una aplicación web instalable en celular y computadora (PWA) para **un estudiante de 3.er año de Medicina de la Facultad de Ciencias Médicas de la UNR (Rosario)** que está cursando el área **"El Ser Humano y Su Medio"**, la última de tercero. Es una versión mejorada de NotebookLM: carga su material, conversa con él con **citas clicables**, lo convierte en **práctica activa** (tarjetas con repetición espaciada, preguntas y ejercicios tipo parcial), experimenta con **simuladores de fisiología renal** y estudia anatomía en un **atlas 3D tipo holograma** que puede desarmar y armar.

Es una **prueba gratuita** que Franco le regala al estudiante; si funciona, se convertirá en un servicio para más estudiantes.

## 0. Antes de escribir código

Leé completos, en este orden:

1. `docs/PROGRAMA-AREA.md` → la estructura del área: 6 Unidades Problema (UP), disciplinas y contenidos.
2. `material-de-estudio/programa/guia-el-ser-humano-y-su-medio-unr.pdf` → la guía oficial 2026 (247 páginas). Leé al menos el índice, las 6 UP (pág. 17–76) y las actividades disciplinares (pág. 231–247). Algunas páginas pueden tener texto en dos columnas: verificá la extracción.
3. `docs/FUNCIONALIDADES.md` → detalle y criterios de aceptación de cada módulo.
4. `docs/ATLAS-3D.md` → modelos 3D, escenas por UP e interacciones.
5. `docs/INVESTIGACION.md` → por qué existe cada función.

Si hay archivos en `material-de-estudio/apuntes/`, usalos también para probar. Este PROMPT.md manda si hay contradicción.

## 1. Regla de oro: costo cero para el estudiante

Nada de servidores pagos, bases de datos en la nube ni suscripciones. Arquitectura **local-first**:

| Pieza | Solución gratuita |
|---|---|
| App | Vite + React + TypeScript + Tailwind. PWA instalable, funciona offline (salvo la IA). |
| Datos | En el navegador del estudiante: IndexedDB con **Dexie**, PDFs incluidos (como Blob). |
| Respaldo | "Exportar todo" → `.zip` (JSON + PDFs). "Importar" lo restaura en otro dispositivo. Recordatorio semanal. |
| Publicación | Sitio estático en **GitHub Pages** o **Cloudflare Pages** (gratis). `DEPLOY.md` paso a paso para alguien no técnico. |
| IA | **API de Google Gemini, nivel gratuito**, con la clave propia del estudiante (gratis en Google AI Studio). Usá los modelos *Flash* / *Flash-Lite* disponibles en el nivel gratuito al momento de construir: verificalo en la documentación oficial de Google, no asumas nombres. La clave se guarda solo en su dispositivo. |
| Embeddings | **En el navegador** con `transformers.js` y un modelo multilingüe chico (familia `multilingual-e5-small`), en un Web Worker. Cero llamadas a la API. |
| Texto exacto | `MiniSearch` (fármacos, siglas, epónimos, fórmulas). Combinado con la vectorial (búsqueda híbrida). |
| Repetición espaciada | `ts-fsrs` (FSRS). No lo reimplementes. |
| PDF | `pdfjs-dist`: texto por página y visor con resaltados. |
| OCR | `tesseract.js` (español), en el navegador. |
| Voz | Web Speech API (dictado y lectura en voz alta). |
| Gráficos de simuladores | SVG/Canvas propios o una librería libre liviana. |
| 3D | `three` + `@react-three/fiber` + `@react-three/drei` + `@react-three/postprocessing`. Modelos de **BodyParts3D** (CC BY-SA). |

**Capa de IA intercambiable:** toda llamada pasa por una interfaz `ProveedorIA` (`chat`, `generarJSON`). Implementá Gemini y dejá documentado un segundo proveedor gratuito (Groq u Ollama local). Si se agota la cuota: mensaje claro ("Llegaste al límite gratis de hoy, se renueva mañana") y todo lo que no usa IA sigue funcionando (tarjetas, preguntas ya generadas, simuladores, atlas 3D).

**Cuidar la cuota:** recuperación y embeddings locales; a la IA solo le llegan los fragmentos relevantes; generación de tarjetas y preguntas por lotes con salida JSON; caché local; contador de llamadas del día.

**Privacidad:** en el nivel gratuito Google puede usar el contenido para mejorar sus productos. Al cargar la clave, avisar: "Usá solo material de estudio. Nunca cargues datos de pacientes reales."

**Derechos de la guía:** la guía es material de la FCM-UNR para uso personal del estudiante. **No la incluyas en el repositorio ni en el sitio publicado** (agregá `material-de-estudio/` al `.gitignore`). La app trae precargada solo la **estructura** de temas (de `PROGRAMA-AREA.md`); el PDF lo importa el estudiante desde su dispositivo en la bienvenida (Franco se lo va a pasar).

## 2. Principios de producto

1. **Anclado a sus fuentes, con citas clicables** (sección 3). Lo que no está en las fuentes se dice; si la IA agrega conocimiento general, va aparte marcado "No está en tus apuntes".
2. **Práctica activa por encima de resúmenes.** La pantalla de inicio ("Hoy") empuja a repasar, practicar y simular.
3. **Organizado como el área:** UP → Disciplina → Tema, con la situación problemática de cada UP. También se puede ver por disciplina.
4. **Todo lo generado es editable, borrable y exportable.**
5. **Cálculos por código, no por IA:** fórmulas, simuladores y corrección de ejercicios numéricos se programan y se testean.
6. Español rioplatense, terminología médica correcta, cómodo en celular, modo oscuro.

## 3. Citas clicables (implementalo exactamente así)

1. **Al cargar una fuente:** texto **página por página**, cortado en fragmentos de ~150–300 palabras respetando títulos y párrafos. Cada fragmento guarda `id`, `fuenteId`, `pagina`, `texto` y la posición en la página (para resaltarlo).
2. **Al preguntar:** se buscan los 8–12 fragmentos más relevantes (híbrido) dentro del alcance elegido.
3. **A la IA** se le manda la pregunta + esos fragmentos numerados `[F1] … [F12]`, con la instrucción de responder **solo** con esa información, marcar cada afirmación con el número del fragmento y devolver la frase textual exacta que usó.
4. **Verificación en la app:** cada cita se comprueba (que el fragmento exista y que la frase aparezca en él, con comparación normalizada tolerante a tildes y espacios). Si no aparece, la cita se muestra gris como "no verificada".
5. **En pantalla:** números chiquitos `¹ ² ³`; al pasar el dedo o el mouse, vista previa del fragmento; al tocar, se abre el PDF **en esa página con la frase resaltada en amarillo** (en celular, como hoja deslizable desde abajo).
6. Debajo de cada respuesta: fuentes usadas ("Guía del área, pág. 241") y botones *Guardar como nota · Hacer tarjetas · Hacer preguntas*.

## 4. Fases

Al terminar cada fase: sin errores, tests de lo crítico (citas, FSRS, fórmulas, exportar/importar), commit claro y `PROGRESO.md` actualizado (qué está hecho, qué falta, cómo probarlo). No avances con la fase anterior rota.

1. **Núcleo:** bienvenida y configuración (clave de Gemini con prueba, fechas de parciales), árbol UP → Disciplina → Tema precargado, importación y procesamiento de la guía y apuntes en un Worker, visor PDF con resaltados, **chat con citas clicables**, notas, exportar/importar todo.
2. **Retención:** tarjetas (básica, cloze, oclusión) generadas con IA y editables; repaso FSRS; pantalla "Hoy"; exportar a Anki y CSV.
3. **Atlas 3D:** primero las escenas de prioridad 1 (riñones y vías urinarias superiores, riñón por dentro, nefrona), después vejiga y uretra, fosa lumbar y retroperitoneo, periné, vasos y nervios. Holograma, desarmar y armar, cortes, recorridos guiados, **Modo Museo** y quiz con FSRS.
4. **Simuladores y práctica de parcial:** los 9 simuladores de `FUNCIONALIDADES.md` (Darrow-Yannet, osmolaridad, Starling, clearance y TFG, Tm/PAH, contracorriente, ADH/SRAA, ácido-base con Davenport e intérprete de gasometrías, análisis de orina), ejercicios numéricos corregidos por código, preguntas tipo parcial y simulacro cronometrado, mapa de calor por UP y disciplina.
5. **Tutoría ABP y extras:** tutor ABP sobre las situaciones problemáticas, examinador oral por voz, caso clínico simulado, tablas y mapas editables, plan de estudio hasta los parciales, AR y modo pirámide holográfica.

## 5. Pensado para convertirse en servicio

Sin agregar nada pago ahora, dejá el código preparado:

- Acceso a datos detrás de una capa `repositorio/` (hoy Dexie), para sumar después cuentas y sincronización sin reescribir la app.
- Nada de este estudiante, la UNR o el área escrito en el código: carrera, universidad, área, UP y temas son **paquetes de contenido** configurables (el de esta área en `src/contenido/unr-ser-humano-y-su-medio/`). Las escenas del atlas y los simuladores, como módulos reutilizables para otras áreas.
- Nombre, colores y logo en un único archivo de marca.
- Estadísticas locales de uso (funciones usadas, tiempo de estudio, tarjetas repasadas, simuladores abiertos) visibles en "Mis estadísticas" y exportables, para evaluar la prueba.
- Al final, `ESCALAR.md`: qué falta para venderlo (cuentas, sincronización, pagos, IA paga, contenidos por facultad sin redistribuir material ajeno) y una estimación de costo por usuario.

## 6. Reglas de trabajo

- Si algo no está definido, elegí lo más simple que respete los principios y anotalo en `DECISIONES.md`. Preguntá solo si es caro de revertir.
- Prompts internos de la IA en `src/ia/prompts/`, uno por archivo.
- Ninguna dependencia que requiera pago, servidor propio o tarjeta de crédito.
- Pantalla "Créditos" con la atribución de los modelos 3D (exigida por su licencia) y de las librerías.
- Al final: `README.md` en español simple (crear la clave gratis de Gemini paso a paso, instalar la app en el celular, importar la guía, hacer backup, flujo de estudio diario recomendado, cómo armar la pirámide holográfica) y `DEPLOY.md`.

## 7. Definición de "terminado"

Desde el celular y sin pagar nada, el estudiante puede: importar la guía → ver las 6 UP con su situación problemática → preguntar "¿qué factores determinan la tasa de filtrado glomerular?" y tocar la cita para ver la frase resaltada en la guía → generar 30 tarjetas de la UP3 y repasarlas con FSRS → abrir el riñón en 3D, desarmarlo, tocar cada parte y volver a armarlo → hacer una tanda del Modo Museo → resolver una gasometría en el simulador de ácido-base → hacer un simulacro del parcial 1 → exportar sus tarjetas a Anki → hacer un backup.

Empezá leyendo los documentos del punto 0, escribí en `PLAN.md` la estructura del proyecto y el esquema de datos, y arrancá la Fase 1.
