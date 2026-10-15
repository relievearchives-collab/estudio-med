# Atlas 3D "holograma" — anatomía del área, con foco renal y urinario

Objetivo: que el estudiante gire, desarme, arme, corte y se autoevalúe sobre **toda la anatomía del área**, con estética de holograma. Además del estudio, lo prepara para los **laboratorios de reconocimiento de estructuras del Museo de Cs. Morfológicas** (condición de regularidad).

## 1. Escenas (una por UP, en este orden de prioridad)

| Prioridad | Escena | UP | Estructuras mínimas |
|---|---|---|---|
| 1 | **Riñones y vías urinarias superiores** | UP3 | riñones, glándulas suprarrenales, pelvis renal, uréteres (con sus 3 estrechamientos marcados), arterias y venas renales, aorta abdominal, vena cava inferior |
| 1 | **Riñón por dentro** (esquema) | UP3 | corte coronal: cápsula, corteza, médula, pirámides, columnas renales, papilas, cálices menores y mayores, pelvis, seno, hilio |
| 1 | **Nefrona** (esquema) | UP3–UP5 | arteriolas aferente y eferente, glomérulo, cápsula de Bowman, TCP, asa de Henle (descendente delgada, ascendente gruesa), TCD, mácula densa y aparato yuxtaglomerular, colector, vasos rectos |
| 2 | **Vejiga y uretra** | UP4 | vejiga (con versión abierta: trígono, orificios ureterales, orificio uretral interno), uretra masculina (prostática, membranosa, esponjosa) y femenina, próstata, relaciones con recto/útero |
| 3 | **Fosa lumbar y retroperitoneo** | UP1 | vértebras T12–L5 y discos, costillas 11–12, psoas mayor, cuadrado lumbar, transverso del abdomen, oblicuos, dorsal ancho, diafragma, riñones en posición; triángulos lumbares (Petit y Grynfeltt) como superposición esquemática |
| 3 | **Periné** | UP2 | elevador del ano, coccígeo, transverso superficial y profundo, isquiocavernoso, bulboesponjoso, esfínteres; fosa isquioanal (esquema); versión masculina y femenina si hay modelos |
| 4 | **Vasos de abdomen y pelvis** | UP5 | aorta abdominal y ramas (tronco celíaco, mesentérica superior e inferior, renales, gonadales, lumbares, ilíacas comunes, externas e internas con sus ramas), vena cava inferior y tributarias, sistema porta |
| 4 | **Nervios de abdomen y pelvis** | UP6 | plexo lumbar (iliohipogástrico, ilioinguinal, genitofemoral, cutáneo femoral lateral, femoral, obturador), cadena simpática lumbar y sacra, nervios esplácnicos, plexos autónomos (celíaco, hipogástricos) — usar esquema donde no haya modelo |

Cada escena se puede abrir desde el tema correspondiente del árbol y desde el menú "Atlas 3D".

## 2. De dónde salen los modelos (gratis y legales)

**Fuente principal: BodyParts3D** (Database Center for Life Science, Japón), licencia **CC BY-SA**. Cada estructura es un OBJ separado identificado por su código FMA, y **todas comparten el mismo sistema de coordenadas**: cargadas juntas quedan en su posición anatómica real, que es lo que permite desarmar y volver a armar.

1. Descargá el paquete desde el sitio oficial de descargas de BodyParts3D (DBCLS). Si la descarga automática falla, **no inventes modelos**: escribí en `modelos-3d/LEEME.md` qué archivo tiene que bajar Franco a mano, de qué página y dónde dejarlo, y avanzá con el resto mientras tanto.
2. Usá las listas de partes del paquete (código FMA ↔ nombre en inglés) para encontrar cada estructura de la tabla. Lo que no exista, anotalo en `DECISIONES.md` y resolvelo con un esquema.
3. Convertí OBJ → GLB (`obj2gltf` o `@gltf-transform/cli`): **un `.glb` por escena**, cada estructura como nodo con nombre (id = código FMA), comprimido (Draco o meshopt) y simplificado para celular (objetivo < 8 MB por escena). Guardá el script en `scripts/modelos/`.
4. Alternativa: **Z-Anatomy** (CC BY-SA 4.0, derivado de BodyParts3D). Algunos modelos incluidos ahí son "No Comercial": **no uses nada NC ni sin licencia clara**, porque la app puede convertirse en un servicio pago.
5. Registrá autor y licencia de cada modelo en `src/atlas/creditos.json` y mostralo en la pantalla "Créditos".

**Esquemas hechos en código** (rotulados "Esquema – no a escala"): riñón por dentro, nefrona (con `TubeGeometry` sobre `CatmullRomCurve3`), vejiga abierta, triángulos lumbares, fosa isquioanal, plexos autónomos, y lo que falte en BodyParts3D.

## 3. Estética "holograma"

- Shader propio: borde brillante tipo Fresnel en cian, cuerpo semitransparente, líneas de escaneo suaves, leve parpadeo, *bloom* (`@react-three/postprocessing`), fondo oscuro con grilla.
- Botón **Holograma ↔ Realista** (colores anatómicos convencionales: riñón rojo-marrón, arterias rojas, venas azules, nervios amarillos, músculo rojo, hueso marfil).
- Lo seleccionado brilla en otro color; lo demás se atenúa.

## 4. Interacciones (criterios de aceptación ✔)

**Navegar**
- ✔ Rotar, zoom y desplazar con mouse y gestos táctiles; doble toque centra en una estructura; vistas rápidas anterior, posterior, lateral, superior.

**Desarmar**
- ✔ Deslizador "Desarmar" 0–100 %: las piezas se alejan del centro con animación; en 0 % vuelven exactas a su lugar.
- ✔ Arrastrar una pieza individual fuera del conjunto.
- ✔ Capas que se prenden y apagan según la escena (urinario, vascular, nervioso, muscular, óseo, suprarrenal).
- ✔ Plano de corte (coronal, sagital, transversal) con deslizador.

**Aprender**
- ✔ Tocar una estructura muestra: nombre en español y latín (Terminología Anatómica), descripción breve, relaciones, irrigación e inervación cuando corresponda, y botones *Preguntarle a mis apuntes* y *Crear tarjeta* (con captura de la estructura resaltada).
- ✔ Rótulos flotantes: todos, ninguno o solo el seleccionado.
- ✔ Recorrido guiado **"Camino de la orina"**: nefrona → cálices → pelvis → uréter (marcando estrechamientos) → vejiga → uretra.
- ✔ Recorrido guiado **"Camino de la sangre renal"**: aorta → arteria renal → segmentarias → interlobulares → aferente → glomérulo → eferente → vasos rectos → vena renal → cava.
- ✔ En la nefrona: animación de partículas del filtrado, y al tocar cada segmento, qué se reabsorbe y secreta ahí (enlazado al simulador de fisiología correspondiente).

**Armar (rompecabezas)**
- ✔ Las piezas aparecen desordenadas; el estudiante las arrastra a su lugar; encajan con destello cuando quedan cerca. Cronómetro, errores y récord personal.

**Autoevaluarse — "Modo Museo"**
- ✔ Simula el **laboratorio de reconocimiento**: se resalta una estructura (con una flecha o un alfiler, como en el museo) y hay que escribir su nombre (tolerante a tildes y sinónimos). Tanda cronometrada, puntaje y lista de las que falló.
- ✔ Quiz "¿Dónde está…?": se nombra una estructura y hay que tocarla.
- ✔ Cada estructura es una tarjeta interna con estado **FSRS**: las falladas vuelven más seguido, también en la cola de "Hoy".

## 5. Contenido de las fichas

Textos en `src/atlas/estructuras.json` (id FMA, nombre, latín, sinónimos, descripción, relaciones, irrigación, inervación, escena, capa, UP). Escribí textos breves y correctos siguiendo la línea de Rouvière (bibliografía obligatoria), todos con `"revisado": false` y un aviso discreto "Texto generado, verificá con Rouvière" hasta que el estudiante lo marque como revisado o lo edite. Si sus apuntes mencionan esa estructura, el panel muestra también esos fragmentos con cita clicable.

## 6. Extras (fase final)

- **Realidad aumentada:** Android (Chrome) con WebXR para poner el modelo sobre la mesa; iPhone con USDZ y AR Quick Look (`<model-viewer>`).
- **Modo pirámide holográfica:** el modelo renderizado cuatro veces sobre fondo negro, para apoyar una pirámide de acetato sobre el celular. Incluí en el README cómo armarla.

## 7. Rendimiento

Cada escena se carga solo al abrirse. Mantener 30+ fps en un celular de gama media; si no, bajar calidad automáticamente.
