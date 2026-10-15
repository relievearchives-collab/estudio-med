# Progreso

## Fase 1 — Núcleo ✅ (14/10/2026)

### Hecho
- **Bienvenida en 3 pasos:** clave de Gemini con guía paso a paso, botón *Guardar y probar*, aviso de privacidad y opción de borrarla; importar la guía; subir apuntes; fechas de parciales.
- **Árbol UP → Disciplina → Tema** precargado desde el paquete de contenido (`src/contenido/unr-ser-humano-y-su-medio/`), editable (agregar, renombrar, borrar temas). Vista por unidad y por disciplina ("toda la Fisiología del área").
- **Cada UP** muestra su situación problemática y objetivos **extraídos de la guía importada** (con "Ver en la guía, pág. N"); antes de importarla, un resumen propio.
- **Procesamiento en Web Worker** (no congela la interfaz, barra de progreso, estados en cola / procesando / listo / error con *Reintentar*, se retoma si se cierra la app): texto por página → OCR si es escaneado o foto → fragmentos de ~150–300 palabras → embeddings locales (multilingual-e5-small) → asignación sugerida de unidad, disciplina y tema.
- **Búsqueda híbrida** (MiniSearch + vectorial, fusión RRF) dentro del alcance: todo / UP / disciplina / tema / fuentes elegidas.
- **Chat con citas clicables:** 10 fragmentos numerados → JSON con frase textual → verificación en la app (tolerante a tildes, espacios, cortes de renglón y "…") → superíndices `¹ ²`; vista previa al pasar el mouse o tocar; al tocar, el PDF se abre en la página con la frase **resaltada en amarillo** (hoja desde abajo en el celular, panel lateral en la compu). Citas no verificadas en gris. Aviso "Cifra sin cita verificada". Bloque aparte **"No está en tus apuntes"**. Fuentes usadas debajo; *Guardar como nota*. Modos: Normal, Explicámelo simple, Nivel parcial, Solo puntos clave, Tabla comparativa. Dictado y lectura en voz alta. Conversaciones guardadas y buscables.
- **Visor** de PDF (zoom, navegación, capa de texto seleccionable) con **resaltador de 4 colores y comentarios**; seleccionar texto → *Preguntar · Crear nota · Resaltar*. Visor de imágenes y texto pegado.
- **Notas** en Markdown con vista previa, guardado automático, enlazadas a temas y fragmentos.
- **Búsqueda unificada** sobre fuentes, notas y conversaciones.
- **IA intercambiable** (`ProveedorIA`: Gemini + Groq), contador diario, caché local, tope opcional, mensaje claro al agotarse la cuota.
- **Exportar / importar todo** (.zip con datos, PDFs y embeddings), recordatorio semanal, borrar todo con doble confirmación.
- **Mis estadísticas** (minutos de estudio, preguntas, llamadas a la IA, funciones más usadas) exportables. **Créditos.** Modo oscuro. PWA instalable.
- `README.md`, `DEPLOY.md` (+ workflow de GitHub Pages), `PLAN.md`, `DECISIONES.md`.

### Verificado
- `npm test`: **24 tests** en verde — normalización y verificación de citas, fragmentación, texto por página, búsqueda (RRF, epónimos, guiones), **exportar/importar** con archivos y embeddings.
- `npm run build` sin errores (precaché de 3,4 MB).
- En el navegador, con la **guía real (247 páginas)**: 614 fragmentos (mediana 209 palabras), embeddings y temas asignados (~6 min en una computadora, una sola vez); situaciones y objetivos de las 6 UP extraídos; la pregunta "¿qué factores determinan la tasa de filtrado glomerular?" recupera primero la pág. 42 (contenidos de Fisiología de la UP3); al tocar la cita se abre la pág. 42 con la frase resaltada exactamente, en escritorio y en tamaño celular; una cita inventada se muestra gris; respaldo real de 12,8 MB exporta en 1,1 s e importa en 0,3 s sin pérdidas; OCR de una foto y texto pegado se procesan y se asignan al tema correcto.

### No verificado todavía
- **Llamada real a Gemini:** no había una clave disponible al construir. El flujo se probó con la API simulada (misma forma de respuesta que `generateContent`). Primer paso al recibir la clave: Ajustes → *Guardar y probar*, y hacer la pregunta de ejemplo.
- Instalación como PWA en un celular real y rendimiento de los embeddings en un celular de gama media (se espera 2–3× más lento que en la compu).

### Cómo probarlo
```bash
npm install
npm run dev
```
Abrir http://localhost:5173 → Bienvenida → pegar la clave → importar `material-de-estudio/programa/guia-el-ser-humano-y-su-medio-unr.pdf` → esperar "Listo" → Preguntar.

### Pendiente menor
- Los botones *Hacer tarjetas* y *Hacer preguntas* del chat están visibles pero deshabilitados hasta las fases 2 y 4.
- La disciplina de un fragmento que mezcla dos secciones toma el último título de la página (ej. la pág. 43 queda en Salud Mental aunque empieza con bibliografía de Fisiología).

## Fase 2 — Retención (siguiente)
Tarjetas básica / cloze / oclusión generadas con IA por lotes y editables; repaso con FSRS (`ts-fsrs`); pantalla "Hoy" con la cola del día, temas flojos y racha; exportar `.apkg` y CSV; importar CSV.

## Fase 3 — Atlas 3D
## Fase 4 — Simuladores y práctica de parcial
## Fase 5 — Tutoría ABP y extras
Al final: `ESCALAR.md`.
