# Investigación de base (octubre 2026)

Contexto para que entiendas **por qué** cada funcionalidad existe. No hace falta copiar nada de acá; usalo para tomar decisiones de producto.

## 1. Qué hace NotebookLM hoy (lo que hay que igualar como mínimo)

- Se cargan fuentes (PDF, Docs, Slides, Word, Sheets, imágenes, EPUB, webs, YouTube, audio) y se conversa con ellas con citas.
- Interfaz en tres columnas: Fuentes / Chat / Studio.
- "Studio" genera con un clic: resumen en audio (estilo podcast, incluso modo clase larga), video resumen, mapa mental, guía de estudio, briefing, FAQ, informes, infografías, presentaciones.
- Tarjetas y cuestionarios generados, con marcado "lo sabía / no lo sabía", mezcla y repetición de las falladas.
- El historial de chat se guarda entre sesiones.
- En planes pagos: busca fuentes en la web por su cuenta y ejecuta código.

## 2. Dónde se queda corto (la oportunidad)

| Limitación de NotebookLM | Cómo la resolvemos |
|---|---|
| Cada cuaderno es un silo; no se puede estudiar "todo cardiología" a la vez. | Biblioteca única materia → sistema → tema, con alcance de chat/práctica seleccionable. |
| Las tarjetas no tienen un algoritmo de repetición espaciada serio. | FSRS (el algoritmo que hoy usa Anki por defecto) con cola diaria. |
| No hay banco de preguntas tipo examen con estadísticas por tema. | Banco de viñetas clínicas, modo examen, mapa de dominio por tema. |
| No hay práctica de razonamiento clínico ni de examen oral. | Simulador de paciente y examinador oral. |
| Los artefactos generados no se pueden editar de verdad. | Todo editable y exportable (Anki, CSV, Markdown, PDF). |
| No verifica actualidad: puede repetir información vieja o desacreditada si la fuente la contiene. | Fecha por fuente, alerta de guías viejas, marca visible de "no está en tus fuentes". |
| Límite de fuentes por cuaderno; captura móvil pobre. | Sin límite práctico; captura por foto (OCR) y grabación de clase. |

## 3. Qué dice la evidencia sobre estudiar medicina

- **Repetición espaciada + recuerdo activo** son las técnicas con mejor evidencia. Un metaanálisis de 2026 con más de 21.000 estudiantes de medicina encontró un efecto moderado-grande (diferencia de medias estandarizada ≈ 0,78) a favor de la repetición espaciada frente al estudio convencional.
- **FSRS** necesita entre ~15 % y ~30 % menos repasos que el viejo SM-2 para la misma retención. Para exámenes de alto riesgo se suele usar retención objetivo 0,90 (algunos llegan a 0,95). Límite típico razonable de tarjetas nuevas: 20–40 por día; más que eso genera atrasos inmanejables.
- **Calidad de tarjeta**: tarjetas atómicas (una idea por tarjeta) funcionan mejor; las tarjetas "gordas" provocan agotamiento. Las tarjetas con imágenes (oclusión) rinden mejor que solo texto en anatomía/histología.
- **El cuello de botella es crear tarjetas**: por eso la generación automática + edición rápida es clave.
- **Leer resúmenes de IA ≠ aprender** (reconocer no es recordar). La IA sirve más para: explicar a demanda, generar casos clínicos, generar preguntas y armar mapas de conceptos.
- **Errores → práctica**: convertir cada error de un banco de preguntas en tarjeta evita estancarse en los temas cómodos.
- **Simulación clínica con IA** (pacientes virtuales con devolución de examinador) tiene evidencia prometedora pero todavía no concluyente; es valiosa como complemento, sobre todo para orales/OSCE.
- **Riesgo**: los modelos generales pueden inventar dosis, guías o estudios. Por eso toda afirmación clínica debe venir con cita a la fuente cargada.

## 4. Referentes a mirar como inspiración (no copiar)

- **Anki** (FSRS, oclusión de imágenes, exportación `.apkg`).
- **RemNote** (notas + tarjetas en un mismo lugar).
- **AMBOSS** (biblioteca + banco de preguntas + simulador de casos y "aprender enseñando").
- **UWorld** (viñetas con explicación por opción).
- **Herramientas de simulación de paciente** con devolución estilo examinador.

## 5. Opción gratuita (verificado en octubre 2026)

- **Gemini API nivel gratuito:** incluye modelos Flash y Flash-Lite y un modelo de embeddings; los modelos Pro son solo pagos. Google no publica límites fijos para el nivel gratuito: cada proyecto ve los suyos en AI Studio, y han sido bajos (pocas llamadas por minuto y por día). Por eso la app hace todo lo posible localmente y agrupa las llamadas.
- En el nivel gratuito Google puede usar el contenido para mejorar sus productos y puede haber revisión humana: solo material de estudio, nunca datos de pacientes.
- **BodyParts3D** (DBCLS, Japón): modelos anatómicos libres, CC BY-SA, por estructura y en un sistema de coordenadas común. **Z-Anatomy** es un atlas libre derivado de ellos (CC BY-SA 4.0), pero algunos modelos que incluye son "No Comercial": evitarlos.
