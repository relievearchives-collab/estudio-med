# Decisiones

Cosas que no estaban definidas (o que había que elegir entre opciones) y cómo se resolvieron. Regla: lo más simple que respete los principios del PROMPT.

## Generales

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| 1 | Versiones | Vite 8, React 19, TypeScript 6, Tailwind 4, Dexie 4, pdfjs-dist 6, transformers.js 4, ts-fsrs 5 (últimas estables al 14/10/2026). | Proyecto nuevo: sin deuda de migraciones. |
| 2 | Enrutado | `HashRouter` (`/#/chat`). | GitHub Pages no reescribe rutas: con hash funciona sin configuración extra. |
| 3 | `base: './'` en Vite | Rutas relativas. | El mismo build sirve en GitHub Pages (subcarpeta) y Cloudflare Pages (raíz). |
| 4 | Material con derechos | `material-de-estudio/` y `modelos-3d/fuente/` en `.gitignore`. El paquete de contenido solo tiene estructura (UP, disciplinas, temas, páginas) y **resúmenes propios** de las situaciones. El texto oficial de cada situación y sus objetivos se **extrae de la guía que importa el estudiante** (`procesamiento/seccionesGuia.ts`). | El PROMPT prohíbe incluir la guía en el repo o el sitio. |
| 5 | Archivos duplicados `(1)`, `(2)` de la descarga | No se tocaron; quedan ignorados por `.gitignore`. | Son copias idénticas (verificado con `cmp`); borrarlos es decisión de Franco. |

## Contenido del área

| # | Tema | Decisión |
|---|---|---|
| 6 | Diferencias PROGRAMA-AREA.md vs. guía | Manda la guía: UP4 suma **Microbiología** como disciplina; UP5 suma **Semiología** (historia clínica, método clínico, relación médico-paciente) y **metabolismo del potasio**; UP6: situación de Luis en el Cerro Chapelco. |
| 7 | Asignación de unidad a cada fragmento de la guía | Por rangos de páginas definidos en el paquete (UP, material de estudio de cada unidad y actividades disciplinares). La disciplina, por el título de sección detectado ("FISIOLOGIA", "ANATOMIA"…). El tema, por similitud de embeddings dentro de esa unidad/disciplina. En apuntes propios: tema más parecido entre todos. |
| 8 | Parciales | Parcial 1 = UP1–UP3, Parcial 2 = UP4–UP6 como **sugerencia** editable (la guía no lo define; el simulacro de la Fase 4 deja elegir las UP). |

## Procesamiento y búsqueda

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| 9 | Texto por página | Una única función `construirTextoPagina()` la usan el worker y el visor. Los fragmentos guardan `[inicio, fin)` en ese texto. | Así la posición del fragmento y la frase citada coinciden exactamente al resaltar en el PDF. |
| 10 | Encabezados/pies repetidos | Detección genérica: renglones (sin números) presentes en ≥30 % de las páginas se excluyen de los fragmentos. | Funciona con cualquier PDF, no solo la guía. |
| 11 | Tamaño de fragmento | Objetivo ~200 palabras (mín. 150, máx. 300), cortando en párrafos/títulos, nunca entre páginas. En la guía: 614 fragmentos, mediana 209 palabras. | Cita a página exacta + contexto suficiente. |
| 12 | Fragmentos enviados a la IA | 10 por pregunta (el PROMPT pide 8–12). | Equilibrio entre cobertura y cuota. |
| 13 | Fusión híbrida | Reciprocal Rank Fusion; la lista semántica pesa doble. Para preguntas de seguimiento cortas, la búsqueda suma la pregunta anterior. | RRF no requiere calibrar puntajes entre MiniSearch y coseno. |
| 14 | Modelo de embeddings | `Xenova/multilingual-e5-small` cuantizado **q8** (~120 MB, se baja una vez y queda en caché), en WASM dentro del worker. Con prefijos `passage:` / `query:`. | Se probó WebGPU, pero exige el modelo fp32 (~470 MB): demasiado para datos móviles. Velocidad medida en computadora: ~1,6 fragmentos/s (la guía completa ≈ 6 min, una sola vez). |
| 15 | Sin internet la primera vez | La fuente queda "Lista" con búsqueda por texto; los embeddings se completan solos al volver a abrir la app con conexión (`completarEmbeddings`). | Nada se bloquea por la IA o el modelo. |
| 16 | OCR | `tesseract.js` en español. En PDFs: solo si >30 % de las páginas no tienen texto (PDF escaneado). Fotos: siempre. Los archivos del motor e idioma se bajan del CDN de jsDelivr/tessdata la primera vez y quedan en caché (Workbox). | La guía tiene capa de texto en las 247 páginas: OCR innecesario ahí. |
| 17 | PWA y caché | Se precachea la app (~3,4 MB). El WASM de ONNX (~27 MB) **no** se precachea: se guarda al primer uso (CacheFirst). pdf.js y el visor se cargan de forma diferida. | Instalar la app no debe gastar 30 MB de datos de golpe. |

## Citas

| # | Tema | Decisión |
|---|---|---|
| 18 | Formato de respuesta | JSON con segmentos `{texto, citas:[{f, frase}]}` + `fueraDeFuentes` + `sinInformacion` (esquema en `ia/prompts/chatConCitas.ts`). |
| 19 | Normalización para verificar | Minúsculas, sin tildes (NFKD: también `²`→`2`), puntuación→espacio, espacios colapsados y unión de palabras cortadas por guion de fin de renglón. Se aceptan elisiones `...`/`…` (cada tramo, en orden). Frases de menos de 12 caracteres normalizados no cuentan como cita. |
| 20 | Cifras sin cita | Si un segmento tiene números y ninguna cita verificada, se muestra el aviso "Cifra sin cita verificada". |
| 21 | Cita no verificada al tocarla | Abre igual la página del fragmento y resalta el fragmento completo (no la frase), con la cita en gris tachada. |
| 22 | Numeración `¹ ² ³` | Por fragmento, en orden de primera aparición dentro de cada respuesta. |

## IA

| # | Tema | Decisión |
|---|---|---|
| 23 | Modelos Gemini | Verificados en ai.google.dev el 14/10/2026: chat con `gemini-3.8-flash`, lotes con `gemini-3.5-flash-lite` (ambos con nivel gratuito). Editables en Ajustes → Avanzado por si Google los cambia. |
| 24 | Segundo proveedor | **Groq** implementado (`ia/groq.ts`, API compatible con OpenAI, nivel gratuito con clave). **Ollama local**: usar el mismo `crearGroq({ base: 'http://localhost:11434/v1', clave: 'ollama', modeloChat: 'llama3.1' })` — no se expone en la UI porque requiere instalar Ollama en la PC. |
| 25 | Cuota | Contador local de llamadas por día; error 429/`RESOURCE_EXHAUSTED` → mensaje "Llegaste al límite gratis de hoy, se renueva mañana" y marca el día como agotado. Tope diario propio opcional. Caché local de respuestas idénticas (30 días). |
| 26 | Privacidad | Aviso permanente junto a la clave: solo material de estudio, nunca datos de pacientes; el nivel gratuito puede usar el contenido. |

## Datos

| # | Tema | Decisión |
|---|---|---|
| 27 | Respaldo | `.zip` con `datos.json` (todas las tablas), `fuentes/<id>` (archivos originales) y `embeddings.bin` (Float32 concatenados). Importar **reemplaza** todo (con confirmación). La caché de IA no se exporta. |
| 28 | Recordatorio semanal | Aviso en "Hoy" si hay datos y pasaron 7 días desde el último respaldo (o nunca se hizo). |
| 29 | Borrar todo | Doble confirmación: botón + escribir `BORRAR`. |
| 30 | Almacenamiento persistente | Se pide `navigator.storage.persist()` para que el navegador no borre la base por falta de espacio. |
| 31 | Estadísticas de uso | Eventos locales (`pantalla`, `chat`, `fuente`, `ia`, `estudio` cada minuto con la app visible y uso en los últimos 3 min). Exportables a JSON. |

## Tarjetas y repaso (Fase 2)

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| 32 | Algoritmo | `ts-fsrs` 5 sin fuzz, con pasos cortos de aprendizaje (1 min / 10 min). Retención objetivo y nuevas por día editables en Ajustes (0,90 y 25 por defecto). | El PROMPT pide no reimplementar FSRS; sin fuzz, los intervalos que se muestran en los botones son exactamente los que quedan. |
| 33 | Estado FSRS guardado | Mismos campos que `Card` de ts-fsrs, pero con las fechas en **milisegundos** (`EstadoFSRS`). `vence` y `estado` se copian al nivel de la tarjeta e indexan la cola. | El respaldo es JSON: con `Date` las fechas volverían como texto. Con números, exportar/importar restaura el estado idéntico (testeado). |
| 34 | Cola del día | Vencidas (la más atrasada primero) → nuevas hasta el tope diario (las nuevas vistas hoy cuentan) → tarjetas en aprendizaje que vencen en los próximos 20 min, como hace Anki. | Prioriza no perder lo ya aprendido. |
| 35 | Cloze y oclusión | Una "nota" genera una tarjeta por hueco (`c1`, `c2`…) o por máscara, hermanas por `grupoId`. Editar el texto conserva el FSRS de los huecos que siguen; un hueco nuevo crea su tarjeta y uno quitado borra la suya. | Mismo modelo que Anki: cada dato se programa por separado. |
| 36 | Oclusión | Máscaras rectangulares en proporciones (0..1) sobre una imagen propia (`imagenesTarjeta`): una foto, o la página del PDF capturada desde el visor (se renderiza aparte a 1800 px de ancho en JPEG, ~350 KB, sin depender del zoom ni de la pantalla). Se pregunta una máscara y las demás quedan tapadas en otro color. Imágenes que ninguna tarjeta usa se borran al iniciar (más de 1 día). | Sirve igual en celular y compu, sin depender del tamaño de pantalla. |
| 37 | Generación con IA | Modelo de lotes (Flash-Lite), salida JSON con esquema, **20 tarjetas por llamada** y hasta 14 fragmentos por llamada ("30 tarjetas de la UP3" = 2 llamadas). Se eligen primero fragmentos sin tarjetas, repartidos a lo largo del material, y se mandan las tarjetas que ya existen para que no se repitan. Cada tarjeta trae el número de fragmento y una frase textual: si la frase aparece en el fragmento, se marca "respaldo verificado". Nada se guarda sin pasar por la vista previa, y las que tienen respaldo sin verificar vienen **desmarcadas**. | Cuidar la cuota gratis sin perder la trazabilidad a la fuente. |
| 38 | Tema de la tarjeta | Se hereda del fragmento de origen. Si el worker asigna el tema al fragmento después (al terminar los embeddings), las tarjetas sin tema lo heredan; nunca se pisa un tema elegido a mano. | Las tarjetas se pueden generar antes de que termine el procesamiento. |
| 39 | Temas flojos | Tasa de "Otra vez" por tema en los últimos 30 días (mínimo 4 repasos). Sin datos todavía, "Hoy" sugiere las UP con material y sin tarjetas. | Simple y explicable. |
| 40 | Anki | `.apkg` "legacy" (esquema 11) armado en el navegador con **sql.js** (MIT, ~340 KB comprimido, se carga solo al exportar). Básica → modelo Básico; cloze → modelo Cloze; oclusión → Básico con la imagen y la máscara en HTML. Un mazo por UP. Las tarjetas en repaso conservan intervalo y vencimiento; las demás entran como nuevas. | Cero dependencias pagas; Anki (escritorio y AnkiDroid) importa este formato. |
| 41 | CSV | Exporta una fila por nota (tipo, frente, dorso, cloze, unidad, disciplina, tema, etiquetas, página) con BOM para Excel. Importa CSV con o sin encabezado (coma, punto y coma o tab), encabezados en castellano o inglés; un frente con `{{c1::…}}` se toma como cloze. Las oclusiones no van en CSV (tienen imagen): van en `.apkg` y en el respaldo. | Compatible con planillas y con lo que exporta Anki. |
| 42 | Estadísticas | Cada respuesta registra un evento `repaso` (calificación y segundos); "deshacer" lo borra. | "Tarjetas repasadas" en Mis estadísticas. |

## Atlas 3D (Fase 3)

| # | Tema | Decisión | Por qué |
|---|---|---|---|
| 43 | Licencia de los modelos | BodyParts3D hoy se publica con **CC BY 4.0** (su página de licencia, consultada el 15/10/2026); los OBJ de 2011 traen en el encabezado CC BY-SA 2.1 JP. Se atribuye como pide el sitio y los `.glb` derivados se publican con la misma atribución (vale para ambas). | La spec mencionaba BY-SA; manda la licencia vigente del sitio. Nada NC. |
| 44 | Qué malla usar por estructura | Lista **"isa"** (la estructura en sí) cuando existe; "partof" solo si no. | En "partof" un concepto arrastra todas sus partes (la ilíaca común traía el árbol arterial de todo el miembro inferior). |
| 45 | Coordenadas y formato | BodyParts3D (mm, Z arriba, −Y anterior) → three.js (Y arriba, +Z anterior, 1 unidad = 10 cm), escena centrada. GLB con cuantización + meshopt y **sin normales** (las calcula el visor: normales suaves y archivos ≈40 % más chicos). Tope 160 000 triángulos por escena. | Carga liviana (0,1–0,6 MB por escena) y buen rendimiento en celular. |
| 46 | Carga de los `.glb` | `GLTFLoader` + decodificador meshopt de three.js con caché por URL y suspense propio; no `useGLTF` de drei. | Con `useGLTF` la carga quedaba colgada. |
| 47 | Estrechamientos del uréter | Calculados por el script sobre el modelo: punto más alto del uréter por debajo del hilio (el uréter de BodyParts3D incluye pelvis y cálices), punto más cercano a la ilíaca común y punto más bajo. Se guardan en los extras del GLB. | Quedan en su lugar real sin cargarlos a mano. |
| 48 | Esquemas | Riñón por dentro, nefrona y plexo lumbar/autónomo hechos en código (`src/atlas/esquemas.ts`), con los mismos ids que el JSON: el visor los trata igual que un modelo (selección, capas, museo, armar). | Lo que BodyParts3D no trae y lo que se entiende mejor esquemático. |
| 49 | Fichas | `src/atlas/estructuras.json` con una ficha por estructura y datos por lado (relaciones, latín). Las ediciones del estudiante se guardan aparte (`fichasEditadas`) y se pueden restaurar; editar marca la ficha como revisada. | El texto base es reutilizable entre áreas y la versión del estudiante viaja en su respaldo. |
| 50 | Escena ↔ área | La composición de escenas es genérica (`src/atlas/escenas.json`); qué escenas usa el área, en qué UP y desde qué temas se abren está en el paquete de contenido (`atlas`). | Nada de la UNR fuera de `src/contenido/`. |
| 51 | FSRS del atlas | Tabla `estructurasAtlas` (estado FSRS por pieza, el mismo id en todas las escenas). Acierto → Bien, con pista → Difícil, error → Otra vez. La tanda prioriza vencidas, después nunca vistas, después la vista hace más tiempo. No se mezclan con las tarjetas (no se exportan a Anki). | Repasar una estructura necesita la escena 3D, no una tarjeta de texto. |
| 52 | Corrección del Modo Museo | Normalizada (tildes, mayúsculas, artículos, "músculo/glándula/nervio"), contra nombre, latín y sinónimos; tolera 1 error de tipeo (2 si el nombre es largo). El lado no es obligatorio, pero si se dice el equivocado es error. | Como en el laboratorio de reconocimiento: importa la estructura. |
| 53 | Rompecabezas | Piezas en un anillo frente a la cámara y silueta tenue del lugar de cada una. Encaja si queda a menos del 15 % del radio de la escena **medido en el plano de la pantalla**; "error" = soltarla cerca (40 %) pero no en su lugar. Récord = mejor tiempo (eventos `rompecabezas`). | Arrastrando con el dedo no se controla la profundidad. |
| 54 | Crear tarjeta desde el atlas | Captura del canvas + rectángulo proyectado de la estructura → tarjeta de **oclusión** ("¿Qué estructura es?") en la UP/tema de la escena. | Reutiliza las tarjetas de la Fase 2 y se exporta a Anki con la imagen. |
| 55 | Rendimiento | `PerformanceMonitor`: si caen los cuadros por segundo, baja la resolución a 1× y apaga el bloom (se indica "calidad reducida"). three.js en un chunk diferido (+1,1 MB al precaché de la PWA para que el atlas ande sin conexión). | 30+ fps en celulares de gama media sin bajar la calidad en la compu. |
