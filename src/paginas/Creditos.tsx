import { Encabezado } from '../componentes/Encabezado'
import { paqueteActivo } from '../contenido'
import { marca } from '../marca'
import { MODELO_EMBEDDINGS } from '../procesamiento/constantes'

const LIBRERIAS = [
  ['React', 'MIT'], ['Vite', 'MIT'], ['Tailwind CSS', 'MIT'], ['React Router', 'MIT'], ['Dexie.js', 'Apache-2.0'],
  ['pdf.js (pdfjs-dist)', 'Apache-2.0'], ['Tesseract.js', 'Apache-2.0'], ['Transformers.js (Hugging Face)', 'Apache-2.0'],
  ['MiniSearch', 'MIT'], ['ts-fsrs', 'MIT'], ['JSZip', 'MIT / GPLv3'], ['marked', 'MIT'], ['DOMPurify', 'Apache-2.0 / MPL-2.0'],
  ['vite-plugin-pwa / Workbox', 'MIT'], ['sql.js (SQLite en WASM, exportación a Anki)', 'MIT'],
]

export default function Creditos() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4">
      <Encabezado titulo="Créditos" subtitulo={`${marca.nombre} · ${marca.lema}`} />
      <section className="tarjeta space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Contenido</h2>
        <p>Estructura del área “{paqueteActivo.area}” ({paqueteActivo.facultad}, {paqueteActivo.universidad}, {paqueteActivo.anio}) organizada a partir de la guía oficial de aprendizaje. La guía es material de la facultad para uso personal del estudiante: <b>no se distribuye con la app</b>; cada estudiante importa su copia en su dispositivo.</p>
      </section>
      <section className="tarjeta space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Modelos 3D</h2>
        <p>BodyParts3D, © The Database Center for Life Science (DBCLS), licencia <a className="underline" href="https://creativecommons.org/licenses/by-sa/2.1/jp/" target="_blank" rel="noreferrer">CC BY-SA 2.1 Japón</a>. Las atribuciones por estructura se listan acá cuando se incorpore el atlas 3D (Fase 3).</p>
      </section>
      <section className="tarjeta space-y-2 p-4 text-sm">
        <h2 className="font-semibold">Inteligencia artificial</h2>
        <p>Respuestas: Google Gemini (nivel gratuito, con la clave del estudiante). Alternativa: Groq.</p>
        <p>Búsqueda por significado: modelo <code>{MODELO_EMBEDDINGS}</code> (familia multilingual-e5-small, licencia MIT), ejecutado en el dispositivo.</p>
      </section>
      <section className="tarjeta p-4 text-sm">
        <h2 className="mb-2 font-semibold">Librerías de código abierto</h2>
        <ul className="grid gap-1 sm:grid-cols-2">
          {LIBRERIAS.map(([n, l]) => <li key={n} className="flex justify-between gap-2"><span>{n}</span><span className="texto-suave">{l}</span></li>)}
        </ul>
      </section>
    </div>
  )
}
