# Publicar la app gratis (paso a paso, sin saber programar)

La app es un **sitio estático**: no necesita servidor ni base de datos. Se publica gratis en **GitHub Pages**. (Alternativa al final: Cloudflare Pages.)

> La guía del área y los apuntes **nunca** se suben: la carpeta `material-de-estudio/` está excluida. Cada estudiante importa su PDF en su propio dispositivo.

## Opción A — GitHub Pages (recomendada)

### 1. Crear la cuenta y el repositorio
1. Creá una cuenta gratis en **https://github.com** (si no tenés).
2. Arriba a la derecha: **+** → **New repository**.
3. Nombre: `estudio-med`. Dejalo **Public** (Pages gratis lo requiere en cuentas gratuitas). No marques ninguna opción extra. **Create repository**.

### 2. Subir el código
La forma más simple es con **GitHub Desktop** (https://desktop.github.com):
1. Instalalo e iniciá sesión con tu cuenta.
2. **File → Add local repository…** → elegí la carpeta `estudio-med` (si dice que no es un repositorio, tocá *create a repository*).
3. Verificá en la lista de cambios que **no** aparece `material-de-estudio` (si aparece, no sigas y avisá).
4. Escribí un resumen ("Primera versión") → **Commit to main** → **Publish repository** (destildá *Keep this code private* si querés usar Pages gratis).

### 3. Activar la publicación automática
1. En la página del repositorio en GitHub: **Settings → Pages**.
2. En **Source** elegí **GitHub Actions**.
3. Listo: el archivo `.github/workflows/deploy.yml` (ya incluido) compila y publica la app cada vez que subís cambios.
4. Andá a la pestaña **Actions** y esperá el tilde verde (2–3 minutos).
5. La app queda en: `https://TU-USUARIO.github.io/estudio-med/`

Ese link es el que se abre en el celular para instalar la app (ver README, sección 2).

### 4. Actualizar
Cada vez que cambies algo: en GitHub Desktop, **Commit** → **Push origin**. En unos minutos se actualiza sola; en los celulares, la app se actualiza al abrirla.

## Opción B — Cloudflare Pages

1. Cuenta gratis en **https://dash.cloudflare.com** → **Workers & Pages → Create → Pages → Connect to Git**.
2. Elegí el repositorio `estudio-med`.
3. Configuración: *Framework preset* **Vite**, *Build command* `npm run build`, *Build output directory* `dist`.
4. **Save and Deploy**. Queda en `https://estudio-med.pages.dev`.

## Preguntas frecuentes

- **¿Cuesta algo?** No. GitHub Pages y Cloudflare Pages son gratis para esto; la IA usa la clave gratuita de cada estudiante.
- **¿Los datos del estudiante pasan por el sitio?** No. Todo se guarda en el navegador de su dispositivo. El sitio solo entrega la app.
- **¿Y si Google cambia los nombres de los modelos de IA?** En la app: **Ajustes → Inteligencia artificial → Avanzado**, se cambian ahí sin volver a publicar.
