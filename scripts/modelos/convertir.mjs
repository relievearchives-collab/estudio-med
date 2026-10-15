// Convierte las mallas de BodyParts3D (OBJ, un archivo por elemento) en un .glb por escena del atlas.
//
// Uso:  node scripts/modelos/convertir.mjs [escena ...]
//
// Necesita en modelos-3d/fuente/ (ver modelos-3d/LEEME.md):
//   partof_BP3D_4.0_obj_99.zip, isa_BP3D_4.0_obj_99.zip, partof_element_parts.txt, isa_element_parts.txt
//
// Cada pieza de src/atlas/escenas.json (código FMA) se arma uniendo sus elementos (FJxxxx.obj),
// se pasa a coordenadas de three.js (Y arriba, paciente mirando a +Z, 1 unidad = 10 cm),
// se simplifica para celular y se comprime con meshopt. Cada pieza queda como un nodo con su id.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { Document, NodeIO } from '@gltf-transform/core'
import { EXTMeshoptCompression, KHRMeshQuantization } from '@gltf-transform/extensions'
import { meshopt, prune, quantize, simplify, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const fuente = resolve(raiz, 'modelos-3d/fuente')
const salida = resolve(raiz, 'public/atlas')
/** Triángulos objetivo por escena (celular de gama media). */
const TRIANGULOS_ESCENA = 160_000
/** mm → unidades de la escena (1 unidad = 10 cm). */
const ESCALA = 0.01

const { escenas } = JSON.parse(readFileSync(resolve(raiz, 'src/atlas/escenas.json'), 'utf8'))
const pedidas = process.argv.slice(2)

// FMA → archivos de elemento (FJ…). Se prefiere la lista "isa" (la estructura en sí): en "partof"
// un concepto arrastra todas sus partes (p. ej. la ilíaca común incluye el árbol arterial del miembro inferior).
function leerElementos(lista) {
  const m = new Map()
  for (const linea of readFileSync(resolve(fuente, lista), 'utf8').split(/\r?\n/).slice(1)) {
    const [fma, , fj] = linea.split('\t')
    if (!fma || !fj) continue
    if (!m.has(fma)) m.set(fma, new Set())
    m.get(fma).add(fj.trim())
  }
  return m
}
const elementosIsa = leerElementos('isa_element_parts.txt')
const elementosPartof = leerElementos('partof_element_parts.txt')

// FJ → entrada del zip
const archivos = new Map()
for (const z of ['partof_BP3D_4.0_obj_99.zip', 'isa_BP3D_4.0_obj_99.zip']) {
  let zip
  try { zip = await JSZip.loadAsync(readFileSync(resolve(fuente, z))) } catch { console.warn(`(no está ${z}, se sigue sin él)`); continue }
  zip.forEach((ruta, entrada) => {
    // Los del lado izquierdo suelen ser espejos del derecho: FJ1431M.obj
    const m = /(FJ\d+M?)\.obj$/i.exec(ruta)
    if (m && !archivos.has(m[1])) archivos.set(m[1], entrada)
  })
}
/** Elementos de un concepto: los de "isa" si están en los paquetes; si no, los de "partof". */
function elementosDe(fma) {
  const isa = [...(elementosIsa.get(fma) ?? [])].filter((fj) => archivos.has(fj))
  return isa.length ? isa : [...(elementosPartof.get(fma) ?? [])].filter((fj) => archivos.has(fj))
}
console.log(`${elementosIsa.size + elementosPartof.size} conceptos FMA, ${archivos.size} mallas disponibles`)

/** OBJ → posiciones (ya en coordenadas de la escena) e índices de triángulos. */
function parsearObj(texto) {
  const pos = []
  const idx = []
  for (const l of texto.split('\n')) {
    if (l.startsWith('v ')) {
      const [, x, y, z] = l.trim().split(/\s+/).map(Number)
      // BodyParts3D: mm, Z arriba, -Y anterior, +X izquierda del paciente → three: Y arriba, +Z anterior.
      pos.push(x * ESCALA, z * ESCALA, -y * ESCALA)
    } else if (l.startsWith('f ')) {
      const vs = l.trim().split(/\s+/).slice(1).map((t) => parseInt(t, 10) - 1)
      for (let i = 1; i + 1 < vs.length; i++) idx.push(vs[0], vs[i], vs[i + 1])
    }
  }
  return { pos, idx }
}

async function mallaDePieza(p) {
  const fjs = elementosDe(p.fma)
  if (!fjs.length) return null
  const pos = []
  const idx = []
  for (const fj of fjs) {
    const m = parsearObj(await archivos.get(fj).async('string'))
    const base = pos.length / 3
    for (const v of m.pos) pos.push(v)
    for (const i of m.idx) idx.push(i + base)
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx), elementos: fjs }
}

function caja(pos) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < pos.length; i += 3) for (let k = 0; k < 3; k++) { min[k] = Math.min(min[k], pos[i + k]); max[k] = Math.max(max[k], pos[i + k]) }
  return { min, max }
}

/**
 * Los 3 estrechamientos del uréter: unión pieloureteral, cruce con los vasos ilíacos y unión
 * ureterovesical. El uréter de BodyParts3D incluye pelvis y cálices, así que la unión pieloureteral
 * se toma como el punto más alto del uréter por debajo del hilio (centro del riñón menos 15 % de su alto).
 */
function estrechamientos(ureter, arteria, rinon, centro) {
  const cr = caja(rinon)
  const hilio = (cr.min[1] + cr.max[1]) / 2 - (cr.max[1] - cr.min[1]) * 0.15
  let arriba = -1
  let abajo = 0
  for (let i = 0; i < ureter.length; i += 3) {
    if (ureter[i + 1] < hilio && (arriba < 0 || ureter[i + 1] > ureter[arriba + 1])) arriba = i
    if (ureter[i + 1] < ureter[abajo + 1]) abajo = i
  }
  if (arriba < 0) arriba = 0
  let cruce = 0
  let mejor = Infinity
  // muestreo: alcanza con 1 de cada 4 vértices de la arteria
  for (let i = 0; i < ureter.length; i += 3) {
    for (let j = 0; j < arteria.length; j += 12) {
      const d = (ureter[i] - arteria[j]) ** 2 + (ureter[i + 1] - arteria[j + 1]) ** 2 + (ureter[i + 2] - arteria[j + 2]) ** 2
      if (d < mejor) { mejor = d; cruce = i }
    }
  }
  const pt = (i) => [ureter[i] - centro[0], ureter[i + 1] - centro[1], ureter[i + 2] - centro[2]].map((v) => Math.round(v * 1000) / 1000)
  return { pieloureteral: pt(arriba), iliaco: pt(cruce), vesical: pt(abajo) }
}

await MeshoptSimplifier.ready
await MeshoptEncoder.ready
mkdirSync(salida, { recursive: true })

for (const escena of escenas.filter((e) => e.tipo === 'modelo' && (!pedidas.length || pedidas.includes(e.id)))) {
  const piezas = []
  const faltan = []
  for (const p of escena.piezas) {
    const m = await mallaDePieza(p)
    if (m) piezas.push({ ...p, ...m })
    else faltan.push(`${p.id} (${p.fma})`)
  }
  // Centrar la escena en el origen
  const cajas = piezas.map((p) => caja(p.pos))
  const min = [0, 1, 2].map((k) => Math.min(...cajas.map((c) => c.min[k])))
  const max = [0, 1, 2].map((k) => Math.max(...cajas.map((c) => c.max[k])))
  const centro = [0, 1, 2].map((k) => (min[k] + max[k]) / 2)
  const totalTri = piezas.reduce((s, p) => s + p.idx.length / 3, 0)
  const ratio = Math.min(1, TRIANGULOS_ESCENA / totalTri)

  const marcadores = []
  for (const e of escena.estrechamientos ?? []) {
    const u = piezas.find((p) => p.id === e.ureter)
    const a = piezas.find((p) => p.id === e.arteria)
    const r = piezas.find((p) => p.id === e.rinon)
    if (u && a && r) marcadores.push({ ureter: e.ureter, ...estrechamientos(u.pos, a.pos, r.pos, centro) })
  }

  const doc = new Document()
  const buffer = doc.createBuffer()
  const nodoEscena = doc.createScene(escena.id)
  for (const p of piezas) {
    for (let i = 0; i < p.pos.length; i += 3) { p.pos[i] -= centro[0]; p.pos[i + 1] -= centro[1]; p.pos[i + 2] -= centro[2] }
    const prim = doc.createPrimitive()
      .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(p.pos).setBuffer(buffer))
      .setIndices(doc.createAccessor().setType('SCALAR').setArray(p.idx).setBuffer(buffer))
    const malla = doc.createMesh(p.id).addPrimitive(prim)
    nodoEscena.addChild(doc.createNode(p.id).setMesh(malla).setExtras({ fma: p.fma, elementos: p.elementos }))
  }
  nodoEscena.setExtras({ escena: escena.id, marcadores, fuente: 'BodyParts3D, © The Database Center for Life Science (CC BY 4.0)' })

  doc.createExtension(KHRMeshQuantization).setRequired(true)
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.002, lockBorder: false }),
    prune(),
    // Sin normales: las calcula el visor al cargar (normales suaves sobre la malla soldada, archivo más chico).
    quantize({ quantizePosition: 14 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  doc.createExtension(EXTMeshoptCompression).setRequired(true).setEncoderOptions({ method: EXTMeshoptCompression.EncoderMethod.QUANTIZE })

  const archivo = resolve(salida, `${escena.id}.glb`)
  writeFileSync(archivo, await new NodeIO().registerExtensions([KHRMeshQuantization, EXTMeshoptCompression]).registerDependencies({ 'meshopt.encoder': MeshoptEncoder }).writeBinary(doc))
  const triFinal = doc.getRoot().listMeshes().reduce((s, m) => s + m.listPrimitives().reduce((t, pr) => t + (pr.getIndices()?.getCount() ?? 0) / 3, 0), 0)
  console.log(`✓ ${escena.id}: ${piezas.length} piezas, ${Math.round(totalTri)} → ${Math.round(triFinal)} triángulos, ${(statSync(archivo).size / 1e6).toFixed(2)} MB${marcadores.length ? `, ${marcadores.length} uréteres con estrechamientos` : ''}`)
  if (faltan.length) console.log(`  ⚠ sin malla en BodyParts3D: ${faltan.join(', ')}`)
}

// Créditos de cada modelo (exigidos por la licencia): se muestran en la pantalla "Créditos".
const creditos = {
  _nota: 'Generado por scripts/modelos/convertir.mjs. No editar a mano.',
  modelos: {
    fuente: 'BodyParts3D 4.0',
    autor: 'The Database Center for Life Science (DBCLS), Japón',
    licencia: 'CC BY 4.0',
    url: 'https://dbarchive.biosciencedbc.jp/en/bodyparts3d/',
    atribucion: 'BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International',
    cambios: 'Unión de elementos por estructura, cambio de ejes y escala, simplificación de mallas y compresión (meshopt).',
  },
  esquemas: { autor: 'Estudio Med (esquemas propios, no a escala)', escenas: escenas.filter((e) => e.tipo === 'esquema').map((e) => e.titulo) },
  escenas: escenas.filter((e) => e.tipo === 'modelo').map((e) => ({
    id: e.id, titulo: e.titulo,
    piezas: e.piezas.map((p) => ({ id: p.id, fma: p.fma, elementos: elementosDe(p.fma) })),
  })),
}
writeFileSync(resolve(raiz, 'src/atlas/creditos.json'), JSON.stringify(creditos, null, 2) + '\n')
console.log('✓ src/atlas/creditos.json')
