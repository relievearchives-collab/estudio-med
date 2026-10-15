/**
 * Único archivo de marca: nombre, colores y logo.
 * Para cambiar la identidad visual del producto, se edita solo este archivo
 * (y los íconos PNG de /public, que se regeneran con `npm run iconos`).
 */
export const marca = {
  nombre: 'Estudio Med',
  lema: 'Tus fuentes, tus citas, tu práctica.',
  /** Colores en hex. `primario` es el color de acción; `acento`, el de las citas y el holograma. */
  colores: {
    primario: '#0e7490',
    primarioClaro: '#22d3ee',
    acento: '#f59e0b',
    fondoOscuro: '#0b1220',
  },
  /** Logo en SVG (se usa en la app, el favicon y los íconos). */
  logoSvg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#0b1220"/><path d="M38 11c-13-3-25 6-25 21s12 24 25 21c7-2 9-8 5-12-3-3-3-6 0-9 5-5 3-19-5-21z" fill="none" stroke="#22d3ee" stroke-width="3.5" stroke-linejoin="round"/><path d="M42 32h10" stroke="#22d3ee" stroke-width="3.5" stroke-linecap="round"/><circle cx="52" cy="32" r="4" fill="#f59e0b"/></svg>`,
} as const

/** Aplica los colores de marca como variables CSS (las usa Tailwind vía @theme). */
export function aplicarMarca() {
  const r = document.documentElement.style
  r.setProperty('--marca-primario', marca.colores.primario)
  r.setProperty('--marca-primario-claro', marca.colores.primarioClaro)
  r.setProperty('--marca-acento', marca.colores.acento)
  document.title = marca.nombre
}
