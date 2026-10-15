# Estudio Med

App para estudiar **"El Ser Humano y Su Medio"** (3.er año de Medicina, FCM-UNR) con tus propias fuentes: preguntás y cada respuesta trae **citas que se tocan** y te llevan a la página exacta de la guía con la frase resaltada. Funciona en el celular y en la compu, **es gratis** y tus datos quedan **en tu dispositivo**.

> Estado: **Fase 1 (núcleo) terminada.** Lo que viene (tarjetas con repetición espaciada, atlas 3D, simuladores, práctica de parcial, tutor ABP) está en [PROGRESO.md](PROGRESO.md).

---

## 1. Crear tu clave gratis de Gemini (5 minutos, una sola vez)

La app usa la IA de Google en su **nivel gratuito**. No pide tarjeta.

1. Entrá a **https://aistudio.google.com/apikey** con tu cuenta de Google (la de Gmail sirve).
2. Si te lo pide, aceptá las condiciones de uso.
3. Tocá **"Create API key"** (Crear clave de API). Si te pregunta por un proyecto, elegí el que te ofrece o creá uno nuevo: da igual.
4. Copiá la clave que aparece (empieza con `AIza…`).
5. En la app: **Bienvenida → paso 1** (o **Ajustes → Inteligencia artificial**), pegala y tocá **Guardar y probar**. Si dice *"Funciona"*, listo.

Importante:
- La clave queda **solo en tu dispositivo**. Podés borrarla cuando quieras desde Ajustes.
- En el nivel gratis, Google puede usar lo que mandás para mejorar sus productos. **Usá solo material de estudio. Nunca cargues datos de pacientes reales.**
- El nivel gratis tiene un límite diario. Si lo alcanzás, la app te avisa ("se renueva mañana") y todo lo que no usa IA sigue andando.

## 2. Instalar la app en el celular

Abrí el link de la app (te lo pasa Franco) y:

- **Android (Chrome):** menú **⋮** → **"Instalar app"** (o "Agregar a la pantalla principal").
- **iPhone (Safari):** botón **Compartir** (cuadrado con flecha) → **"Agregar a inicio"**.

Queda como una app más, con su ícono. Funciona sin internet para todo lo que no sea IA.

## 3. Importar la guía del área

1. Guardá en el celular (o la compu) el PDF de la guía que te pasa Franco.
2. En la **Bienvenida → paso 2** (o **Biblioteca → Fuentes → Importar guía**) elegí el PDF.
3. Se procesa en tu dispositivo, con barra de progreso. La primera vez baja un modelo de búsqueda (~120 MB, una sola vez: mejor con Wi-Fi). Con la guía entera tarda unos minutos; **podés usar la app mientras tanto**.
4. Cuando termina, cada UP muestra su situación problemática y sus objetivos tal como están en la guía.

También podés sumar tus apuntes: PDF, **fotos** de apuntes o del pizarrón (se leen con OCR) o texto pegado.

## 4. Hacer un respaldo (backup)

Todo vive en tu dispositivo. Si se borra el navegador o cambiás de celu, sin respaldo se pierde.

- **Ajustes → Respaldo → Exportar todo (.zip)**. Guardá ese archivo en Google Drive o mandátelo por mail.
- Para pasar a otro dispositivo: instalá la app ahí y **Ajustes → Respaldo → Importar respaldo**. Vuelve todo: fuentes, notas, conversaciones (y más adelante tarjetas con su historial).
- La pantalla **Hoy** te recuerda hacerlo **una vez por semana**.

## 5. Flujo de estudio diario recomendado

1. **Hoy:** mirá la cuenta regresiva al parcial y los avisos.
2. **Elegí una UP** y leé la situación problemática. Antes de leer nada, anotá en una nota qué sabés y qué preguntas te surgen (como en la tutoría).
3. **Preguntá** en el chat con el alcance en esa UP o en un tema. Tocá las citas para ir a la guía: leé el párrafo entero, no solo la respuesta.
4. **Guardá como nota** lo importante y completalo con tus palabras.
5. **Explicalo sin mirar** (en voz alta o escrito) y después verificá con el chat. *Recordar es lo que fija; releer, no.*
6. (Desde la Fase 2) **Repasá las tarjetas del día** con repetición espaciada: 15–30 min diarios rinden más que una maratón antes del parcial.

Modos del chat: *Explicámelo simple*, *Nivel parcial*, *Solo puntos clave*, *Tabla comparativa*. Lo que no esté en tus fuentes aparece aparte, marcado **"No está en tus apuntes"**.

## 6. Pirámide holográfica

Se agrega con el atlas 3D (Fases 3 y 5); las instrucciones para armarla con un acetato van a estar acá.

---

## Para desarrolladores

```bash
npm install
npm run dev      # servidor de desarrollo
npm test         # tests (citas, fragmentación, búsqueda, respaldo)
npm run build    # sitio estático en dist/
npm run iconos   # regenera los íconos PNG desde src/marca.ts
```

- Publicar gratis: ver [DEPLOY.md](DEPLOY.md).
- Arquitectura y esquema de datos: [PLAN.md](PLAN.md). Decisiones: [DECISIONES.md](DECISIONES.md). Avance: [PROGRESO.md](PROGRESO.md).
- La guía y los apuntes **no** se suben al repositorio (`material-de-estudio/` está en `.gitignore`).
