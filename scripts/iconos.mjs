// Genera los íconos PNG de la PWA a partir del logo en src/marca.ts (único archivo de marca).
import { Resvg } from '@resvg/resvg-js'
import fs from 'node:fs'

const marca = fs.readFileSync(new URL('../src/marca.ts', import.meta.url), 'utf8')
const svg = marca.match(/logoSvg: `([^`]*)`/)[1]
const fondo = marca.match(/fondoOscuro: '([^']+)'/)[1]
fs.writeFileSync(new URL('../public/favicon.svg', import.meta.url), svg)
// Ícono "maskable": fondo lleno y logo con margen de seguridad.
const interior = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(/<rect[^>]*\/>/, '')
const cuadrado = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-8 -8 80 80"><rect x="-8" y="-8" width="80" height="80" fill="${fondo}"/>${interior}</svg>`
for (const t of [192, 512]) {
  const png = new Resvg(cuadrado, { fitTo: { mode: 'width', value: t } }).render().asPng()
  fs.writeFileSync(new URL(`../public/icono-${t}.png`, import.meta.url), png)
  console.log(`public/icono-${t}.png`, png.length, 'bytes')
}
