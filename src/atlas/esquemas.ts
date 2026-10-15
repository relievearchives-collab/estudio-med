import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * Esquemas hechos en código ("Esquema – no a escala") para lo que BodyParts3D no trae:
 * riñón por dentro, nefrona y plexo lumbar. Devuelven geometrías con el id de cada pieza
 * (los mismos ids que src/atlas/escenas.json), así el visor las trata igual que un modelo.
 */

export interface PiezaGeom {
  id: string
  geometria: THREE.BufferGeometry
  /** Color en modo realista. */
  color: string
}

export interface Esquema {
  piezas: PiezaGeom[]
  /** Geometría de referencia (no se puede tocar ni preguntar). */
  referencias: PiezaGeom[]
  /** Rótulos fijos de zonas (corteza, médula…). */
  zonas: { texto: string; pos: [number, number, number] }[]
  /** Camino de las partículas del filtrado (nefrona). */
  flujo?: THREE.Vector3[]
}

const v = (x: number, y: number, z = 0) => new THREE.Vector3(x, y, z)

/** Tubo sobre una curva suave. Guarda en userData.ancla un punto del recorrido para el rótulo (no el centro de la caja). */
function tubo(puntos: THREE.Vector3[], radio: number, segmentos = 64, cerrado = false, ancla = 0.65) {
  const curva = new THREE.CatmullRomCurve3(puntos, cerrado, 'catmullrom', 0.4)
  const g = new THREE.TubeGeometry(curva, segmentos, radio, 10, cerrado)
  g.userData.ancla = curva.getPoint(ancla)
  return g
}

function extruir(forma: THREE.Shape, espesor: number, z = 0) {
  const g = new THREE.ExtrudeGeometry(forma, { depth: espesor, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, curveSegments: 24 })
  g.translate(0, 0, z - espesor / 2)
  return g
}

function unir(gs: THREE.BufferGeometry[]) {
  // mergeGeometries necesita los mismos atributos en todas: se quitan uv/normales y se recalculan.
  const limpias = gs.map((g) => {
    const n = g.index ? g.toNonIndexed() : g.clone()
    for (const a of Object.keys(n.attributes)) if (a !== 'position') n.deleteAttribute(a)
    return n
  })
  const m = mergeGeometries(limpias)
  m.computeVertexNormals()
  return m
}

/** Contorno de un riñón en corte coronal (borde medial cóncavo, hilio a la izquierda del dibujo). */
function contornoRinon(escala = 1) {
  const s = new THREE.Shape()
  const k = escala
  s.moveTo(-0.55 * k, 1.1 * k)
  s.bezierCurveTo(0.2 * k, 1.75 * k, 1.35 * k, 1.35 * k, 1.35 * k, 0)
  s.bezierCurveTo(1.35 * k, -1.35 * k, 0.2 * k, -1.75 * k, -0.55 * k, -1.1 * k)
  s.bezierCurveTo(-0.95 * k, -0.85 * k, -0.85 * k, -0.45 * k, -0.6 * k, -0.35 * k)
  s.bezierCurveTo(-0.45 * k, -0.15 * k, -0.45 * k, 0.15 * k, -0.6 * k, 0.35 * k)
  s.bezierCurveTo(-0.85 * k, 0.45 * k, -0.95 * k, 0.85 * k, -0.55 * k, 1.1 * k)
  return s
}

/** Pirámide renal: triángulo curvo con la base hacia la corteza y el vértice (papila) hacia el seno. */
function piramide(angulo: number) {
  const base = 0.86
  const ancho = 0.28
  const s = new THREE.Shape()
  const dir = v(Math.cos(angulo), Math.sin(angulo))
  const perp = v(-dir.y, dir.x)
  const p = (r: number, lado: number) => dir.clone().multiplyScalar(r).add(perp.clone().multiplyScalar(lado))
  const a = p(base, -ancho), b = p(base, ancho), c = p(0.42, 0.04), d = p(0.42, -0.04)
  s.moveTo(a.x, a.y)
  s.quadraticCurveTo(p(base + 0.08, 0).x, p(base + 0.08, 0).y, b.x, b.y)
  s.lineTo(c.x, c.y)
  s.lineTo(d.x, d.y)
  s.lineTo(a.x, a.y)
  return { forma: s, vertice: p(0.36, 0), dir }
}

// ───────────────────────── Riñón por dentro ─────────────────────────

export function rinonInterior(): Esquema {
  const centro = v(0.25, 0)
  const angulos = [70, 38, 8, -22, -52, -80, 100].map((g) => (g * Math.PI) / 180)
  const pirs = angulos.map(piramide)
  const mover = (g: THREE.BufferGeometry) => g.translate(centro.x, centro.y, 0)

  // Corteza: contorno interno con un hueco donde está el seno renal (las columnas son la corteza entre pirámides).
  // El seno es un óvalo centrado cerca del hilio; por el hueco se ven cálices, pelvis y la grasa del seno al fondo.
  const senoOvalo = (rx: number, ry: number) => {
    const f = new THREE.Shape()
    f.absellipse(0.12, 0, rx, ry, 0, Math.PI * 2, false, 0)
    return f
  }
  const corteza = contornoRinon(0.94)
  corteza.holes.push(senoOvalo(0.5, 0.8))
  const capsulaForma = contornoRinon(1)
  capsulaForma.holes.push(contornoRinon(0.94) as unknown as THREE.Path)

  const piramidesGeo = pirs.map((p) => mover(extruir(p.forma, 0.3, 0.01)))
  const papilas = pirs.map((p) => mover(new THREE.SphereGeometry(0.075, 12, 8).translate(p.vertice.x, p.vertice.y, 0.02)))
  // Columnas renales: franjas de corteza entre pirámides vecinas.
  const columnas = angulos.slice(0, -1).map((a, i) => {
    const m = (a + angulos[i + 1]) / 2
    const g = new THREE.BoxGeometry(0.55, 0.12, 0.3).translate(0.72, 0, 0.012)
    g.rotateZ(m)
    return mover(g)
  })
  // Cálices menores: copas alrededor de cada papila.
  const calicesMenores = pirs.map((p) => {
    const g = new THREE.CylinderGeometry(0.12, 0.06, 0.18, 14, 1, true)
    g.rotateZ(-Math.PI / 2)
    g.rotateZ(Math.atan2(p.dir.y, p.dir.x))
    const pos = p.vertice.clone().sub(p.dir.clone().multiplyScalar(0.08))
    return mover(g.translate(pos.x, pos.y, 0.03))
  })
  const pelvisCentro = v(-0.35, 0)
  // Cálices mayores: superior, medio e inferior, de los cálices menores a la pelvis.
  const mayorDe = (idxs: number[]) => unir(idxs.map((i) => {
    const desde = pirs[i].vertice.clone().sub(pirs[i].dir.clone().multiplyScalar(0.16)).add(centro)
    return tubo([desde, desde.clone().lerp(pelvisCentro, 0.5).add(v(0, 0, 0.02)), pelvisCentro.clone().add(v(0.08, 0, 0))], 0.06, 20)
  }))
  const calizMayor = unir([mayorDe([0, 1, 6]), mayorDe([2, 3]), mayorDe([4, 5])])
  const pelvis = new THREE.SphereGeometry(0.22, 20, 14).scale(1.2, 1, 0.6).translate(pelvisCentro.x, pelvisCentro.y, 0.03)
  const ureter = tubo([pelvisCentro.clone().add(v(-0.15, -0.05)), v(-0.75, -0.4, 0.03), v(-0.8, -1.2, 0.03), v(-0.75, -2.0, 0.03)], 0.07, 40)
  // Seno renal (grasa): lámina al fondo del hueco, detrás de cálices y pelvis.
  const senoGeo = mover(extruir(senoOvalo(0.52, 0.82), 0.04, -0.12))
  // Hilio: arco en el borde medial.
  const hilio = new THREE.TorusGeometry(0.42, 0.035, 8, 24, Math.PI * 0.55).rotateZ(Math.PI * 0.72).translate(-0.05, 0, 0.16)
  // Vasos del hilio: arteria (rojo) y vena (azul) que se ramifican hacia el seno.
  const ramas = (y0: number, z: number) => unir([
    tubo([v(-1.5, y0, z), v(-0.8, y0, z), v(-0.4, y0 + 0.05, z)], 0.07, 20),
    tubo([v(-0.4, y0 + 0.05, z), v(0.0, 0.45, z), v(0.4, 0.9, z)], 0.035, 20),
    tubo([v(-0.4, y0 + 0.05, z), v(0.05, y0, z), v(0.55, y0 - 0.05, z)], 0.035, 20),
    tubo([v(-0.4, y0 + 0.05, z), v(0.0, -0.45, z), v(0.4, -0.9, z)], 0.035, 20),
  ])

  return {
    piezas: [
      { id: 'capsula-renal', geometria: mover(extruir(capsulaForma, 0.32, 0)), color: '#d9c7b8' },
      { id: 'corteza-renal', geometria: mover(extruir(corteza, 0.28, -0.005)), color: '#b5493d' },
      { id: 'medula-renal', geometria: unir(piramidesGeo.slice(1)), color: '#7a2a24' },
      { id: 'piramide-renal', geometria: piramidesGeo[0], color: '#8f3129' },
      { id: 'columna-renal', geometria: unir(columnas), color: '#c25a4c' },
      { id: 'papila-renal', geometria: unir(papilas), color: '#e0a39a' },
      { id: 'caliz-menor', geometria: unir(calicesMenores), color: '#e9c46a' },
      { id: 'caliz-mayor', geometria: calizMayor, color: '#e3b44f' },
      { id: 'pelvis-renal', geometria: pelvis, color: '#dca43c' },
      { id: 'ureter-proximal', geometria: ureter, color: '#d4973a' },
      { id: 'seno-renal', geometria: senoGeo, color: '#f1dca0' },
      { id: 'hilio-renal', geometria: hilio, color: '#9ca3af' },
      { id: 'arteria-renal-esq', geometria: ramas(0.12, 0.09), color: '#d32f2f' },
      { id: 'vena-renal-esq', geometria: ramas(-0.12, 0.12), color: '#1e5bd6' },
    ],
    referencias: [],
    zonas: [
      { texto: 'Corte coronal', pos: [0.3, 2.0, 0] },
    ],
  }
}

// ───────────────────────── Nefrona ─────────────────────────

export function nefrona(): Esquema {
  const glom = v(-1.2, 2.2, 0)
  // Recorrido del líquido tubular, de la cápsula de Bowman al colector.
  const tcpPts = [v(-0.85, 2.05), v(-0.4, 2.5, 0.3), v(0.1, 2.2, -0.3), v(-0.3, 1.8, 0.35), v(0.2, 1.5, -0.2), v(-0.1, 1.15, 0.2), v(0.05, 0.8)]
  const descPts = [v(0.05, 0.8), v(0.05, -0.6), v(0.08, -2.2), v(0.25, -2.75)]
  const ascDelgPts = [v(0.25, -2.75), v(0.42, -2.2), v(0.45, -1.2)]
  const ascGruesaPts = [v(0.45, -1.2), v(0.45, 0.5), v(0.3, 1.6), v(-0.7, 2.0)]
  const tcdPts = [v(-0.7, 2.0), v(-0.2, 2.75, 0.3), v(0.5, 2.6, -0.3), v(0.9, 2.95, 0.2), v(1.25, 2.6)]
  const colPts = [v(1.25, 2.6), v(1.4, 2.8), v(1.5, 1.0), v(1.5, -1.5), v(1.5, -3.3)]

  const afPts = [v(-2.6, 3.0), v(-1.9, 2.6), v(-1.38, 2.32)]
  const efPts = [v(-1.32, 2.42), v(-1.6, 3.0, 0.3), v(-0.8, 3.3), v(0.6, 3.25, -0.4)]
  // Vasos rectos: horquilla que acompaña al asa (de la eferente yuxtamedular).
  const rectos = unir([
    tubo([v(-0.35, 1.0, -0.35), v(-0.3, -1.0, -0.35), v(-0.2, -2.9, -0.35), v(0.15, -3.1, -0.35), v(0.75, -2.9, -0.35), v(0.85, -1.0, -0.35), v(0.85, 1.0, -0.35)], 0.028, 80),
    tubo([v(-1.32, 2.42), v(-0.9, 1.6, -0.35), v(-0.35, 1.0, -0.35)], 0.028, 20),
  ])
  // Glomérulo: ovillo de asas capilares.
  const asas: THREE.BufferGeometry[] = []
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2
    const pts = [glom.clone().add(v(-0.12, 0.08)), glom.clone().add(v(Math.cos(a) * 0.22, Math.sin(a) * 0.22, Math.sin(a * 2) * 0.18)), glom.clone().add(v(Math.cos(a + 0.6) * 0.15, Math.sin(a + 0.6) * 0.15, -0.12)), glom.clone().add(v(-0.1, 0.2))]
    asas.push(tubo(pts, 0.035, 20))
  }
  const bowman = new THREE.SphereGeometry(0.36, 24, 16, 0, Math.PI * 2, 0.55, Math.PI - 0.55).rotateZ(Math.PI * 0.75).translate(glom.x, glom.y, 0)
  const macula = new THREE.SphereGeometry(0.11, 14, 10).scale(1, 0.55, 1).translate(-0.98, 2.18, 0.02)
  const yuxta = new THREE.SphereGeometry(0.09, 12, 8).scale(1.3, 1, 1).translate(-1.55, 2.5, 0.05)

  const flujo = [...afPts.slice(0, 1).map(() => glom.clone()), ...tcpPts, ...descPts.slice(1), ...ascDelgPts.slice(1), ...ascGruesaPts.slice(1), ...tcdPts.slice(1), ...colPts.slice(1)]

  return {
    piezas: [
      { id: 'arteriola-aferente', geometria: tubo(afPts, 0.07, 30), color: '#d32f2f' },
      { id: 'arteriola-eferente', geometria: tubo(efPts, 0.055, 30), color: '#e0533d' },
      { id: 'glomerulo', geometria: unir(asas), color: '#c62828' },
      { id: 'capsula-bowman', geometria: bowman, color: '#e9c46a' },
      { id: 'tcp', geometria: tubo(tcpPts, 0.075, 90), color: '#e5a54a' },
      { id: 'asa-descendente-delgada', geometria: tubo(descPts, 0.035, 50), color: '#f2d08a' },
      { id: 'asa-ascendente-delgada', geometria: tubo(ascDelgPts, 0.035, 30), color: '#f0c36d' },
      { id: 'asa-ascendente-gruesa', geometria: tubo(ascGruesaPts, 0.06, 50), color: '#d98c2b' },
      { id: 'tcd', geometria: tubo(tcdPts, 0.065, 70), color: '#c97b22' },
      { id: 'macula-densa', geometria: macula, color: '#7c3aed' },
      { id: 'aparato-yuxtaglomerular', geometria: yuxta, color: '#a855f7' },
      { id: 'tubulo-colector', geometria: tubo(colPts, 0.1, 60), color: '#9a6a1e' },
      { id: 'vasos-rectos', geometria: rectos, color: '#1e5bd6' },
    ],
    referencias: [
      // Límites de zonas: corteza / médula externa / médula interna
      { id: 'limite-corteza', geometria: new THREE.PlaneGeometry(5.2, 0.012).translate(0, 0.6, -0.6), color: '#94a3b8' },
      { id: 'limite-medula', geometria: new THREE.PlaneGeometry(5.2, 0.012).translate(0, -1.3, -0.6), color: '#94a3b8' },
    ],
    zonas: [
      { texto: 'Corteza', pos: [-2.4, 1.2, -0.6] },
      { texto: 'Médula externa', pos: [-2.4, -0.3, -0.6] },
      { texto: 'Médula interna', pos: [-2.4, -2.3, -0.6] },
    ],
    flujo,
  }
}

// ───────────────────────── Plexo lumbar y autónomo ─────────────────────────

export function plexoLumbar(): Esquema {
  // Columna de referencia: T12 a L5 (de arriba abajo), cuerpos a lo largo del eje Y.
  const niveles = ['T12', 'L1', 'L2', 'L3', 'L4', 'L5']
  const y = (i: number) => 2.5 - i * 0.85
  const cuerpos = niveles.map((_, i) => new THREE.CylinderGeometry(0.42, 0.42, 0.6, 20).scale(1.25, 1, 0.9).translate(0, y(i), 0))
  const psoas = (lado: number) => tubo([v(0.55 * lado, y(0) - 0.2, -0.1), v(0.75 * lado, y(2), 0.05), v(1.0 * lado, y(4), 0.2), v(1.25 * lado, y(5) - 0.9, 0.4), v(1.4 * lado, y(5) - 2.0, 0.7)], 0.32, 40)
  const aorta = tubo([v(-0.25, y(0) + 0.6, 0.8), v(-0.25, y(4), 0.8)], 0.17, 20)
  const iliacas = unir([tubo([v(-0.25, y(4), 0.8), v(-0.8, y(5) - 0.6, 0.85)], 0.12, 12), tubo([v(-0.25, y(4), 0.8), v(0.35, y(5) - 0.6, 0.85)], 0.12, 12)])
  // Nervios del lado izquierdo del paciente (+X), saliendo por los forámenes (a la altura del disco).
  const salida = (i: number) => v(0.5, y(i) - 0.42, -0.25)
  const L = 1
  return {
    piezas: [
      { id: 'nervio-iliohipogastrico', geometria: tubo([salida(0), v(1.1 * L, y(0.6), -0.1), v(2.0, y(1.2), 0.2), v(2.8, y(2.3), 0.9)], 0.045, 40), color: '#f2c94c' },
      { id: 'nervio-ilioinguinal', geometria: tubo([salida(1), v(1.2, y(1.5), -0.05), v(2.0, y(2.5), 0.3), v(2.6, y(4), 1.0)], 0.04, 40), color: '#f7d774' },
      { id: 'nervio-genitofemoral', geometria: tubo([salida(1).clone().add(v(0, -0.4, 0)), v(0.8, y(2.4), 0.35), v(0.95, y(3.6), 0.55), v(1.15, y(5) - 0.6, 0.75)], 0.04, 40), color: '#eab308' },
      { id: 'nervio-cutaneo-femoral-lateral', geometria: tubo([salida(2), v(1.3, y(3), -0.1), v(2.0, y(4.2), 0.3), v(2.3, y(5) - 1.0, 0.9)], 0.045, 40), color: '#facc15' },
      { id: 'nervio-femoral', geometria: tubo([salida(3), v(1.3, y(4), 0.0), v(1.55, y(5) - 0.6, 0.35), v(1.65, y(5) - 2.0, 0.8)], 0.08, 40), color: '#f59e0b' },
      { id: 'nervio-obturador', geometria: tubo([salida(3).clone().add(v(-0.05, -0.2, 0)), v(0.7, y(4.6), -0.15), v(0.65, y(5) - 1.0, 0.0), v(0.95, y(5) - 1.9, 0.35)], 0.06, 40), color: '#fbbf24' },
      {
        id: 'tronco-simpatico-lumbar',
        geometria: unir([tubo([v(0.4, y(0), 0.45), v(0.42, y(5) - 0.4, 0.5)], 0.025, 30), ...niveles.slice(1).map((_, i) => new THREE.SphereGeometry(0.07, 10, 8).translate(0.41, y(i + 1), 0.48))]),
        color: '#fb923c',
      },
      {
        id: 'plexo-celiaco',
        geometria: unir([new THREE.TorusGeometry(0.3, 0.035, 8, 30).rotateX(Math.PI / 2).translate(-0.25, y(0) + 0.1, 0.8), new THREE.SphereGeometry(0.1, 10, 8).translate(0.08, y(0) + 0.1, 0.95), new THREE.SphereGeometry(0.1, 10, 8).translate(-0.58, y(0) + 0.1, 0.95)]),
        color: '#f97316',
      },
      {
        id: 'plexo-hipogastrico-superior',
        geometria: unir([tubo([v(-0.25, y(4) - 0.1, 1.0), v(-0.2, y(5), 1.05), v(-0.25, y(5) - 0.5, 1.0)], 0.05, 20), tubo([v(-0.25, y(5) - 0.5, 1.0), v(-0.75, y(5) - 1.2, 0.9)], 0.03, 12), tubo([v(-0.25, y(5) - 0.5, 1.0), v(0.3, y(5) - 1.2, 0.9)], 0.03, 12)]),
        color: '#ea580c',
      },
    ],
    referencias: [
      { id: 'columna', geometria: unir(cuerpos), color: '#efe6cf' },
      { id: 'psoas', geometria: unir([psoas(1), psoas(-1)]), color: '#b5413a' },
      { id: 'aorta', geometria: unir([aorta, iliacas]), color: '#d32f2f' },
    ],
    zonas: niveles.map((n, i) => ({ texto: n, pos: [-0.75, y(i), 0.3] as [number, number, number] })),
  }
}

// ───────────────────────── Vejiga abierta ─────────────────────────

/** Polígono (lista de puntos x,y) → forma de three. */
function poligono(pts: [number, number][]) {
  const s = new THREE.Shape()
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)))
  s.closePath()
  return s
}

/** Vejiga con la pared anterior abierta (vista anterior): trígono, orificios y cuello. Modelo masculino. */
export function vejigaAbierta(): Esquema {
  const RX = 1.4, RY = 1.2
  // Punto sobre la cara interna posterior de la pared (elipsoide)
  const posterior = (x: number, y: number, k = 0.97) => v(x, y, -RX * Math.sqrt(Math.max(0.02, 1 - (x * x) / (RX * RX) - (y * y) / (RY * RY))) * k)
  // Pared: elipsoide abierto adelante (falta una franja de 160°) y abajo (cuello)
  const pared = new THREE.SphereGeometry(1, 48, 32, Math.PI / 2 + 1.4, Math.PI * 2 - 2.8, 0, Math.PI * 0.94).scale(RX, RY, RX)
  // Trígono: parche triangular apoyado sobre la pared posterior
  const ureteralDer = posterior(-0.5, -0.5), ureteralIzq = posterior(0.5, -0.5), uretral = v(0, -RY * 0.97, -0.12)
  const tri: number[] = []
  const N = 12
  const punto = (a: number, b: number) => {
    const c = 1 - a - b
    return posterior(ureteralDer.x * a + ureteralIzq.x * b + uretral.x * c, ureteralDer.y * a + ureteralIzq.y * b + uretral.y * c, 0.95)
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < N - i; j++) {
    const p1 = punto(i / N, j / N), p2 = punto((i + 1) / N, j / N), p3 = punto(i / N, (j + 1) / N)
    tri.push(...p1.toArray(), ...p2.toArray(), ...p3.toArray())
    if (j < N - i - 1) {
      const p4 = punto((i + 1) / N, (j + 1) / N)
      tri.push(...p2.toArray(), ...p4.toArray(), ...p3.toArray())
    }
  }
  const trigono = new THREE.BufferGeometry()
  trigono.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3))
  trigono.computeVertexNormals()
  const orificio = (p: THREE.Vector3, r: number) => {
    const g = new THREE.TorusGeometry(r, r * 0.35, 8, 20)
    g.lookAt(p.clone().negate())
    return g.translate(p.x, p.y, p.z)
  }
  const uretraPts = [v(0, -RY, 0), v(0, -1.6, 0.02), v(0, -2.3, 0.08)]
  // Próstata abierta adelante, para ver la uretra prostática y el colículo seminal
  const prostata = new THREE.SphereGeometry(0.62, 32, 20, Math.PI / 2 + 1.3, Math.PI * 2 - 2.6).scale(1.1, 0.85, 0.9).translate(0, -1.85, 0)
  return {
    piezas: [
      { id: 'pared-vesical', geometria: pared, color: '#d8a28c' },
      { id: 'trigono-vesical', geometria: trigono, color: '#e8b4a0' },
      { id: 'orificio-ureteral-der', geometria: orificio(ureteralDer, 0.09), color: '#e0b04a' },
      { id: 'orificio-ureteral-izq', geometria: orificio(ureteralIzq, 0.09), color: '#e0b04a' },
      { id: 'pliegue-interureteral', geometria: tubo([ureteralDer, posterior(0, -0.42, 0.94), ureteralIzq], 0.035, 30), color: '#c98a74' },
      { id: 'orificio-uretral-interno', geometria: orificio(uretral, 0.12), color: '#e2b48f' },
      { id: 'cuello-vesical', geometria: new THREE.TorusGeometry(0.3, 0.07, 10, 28).rotateX(Math.PI / 2).translate(0, -RY * 0.93, 0), color: '#b9786a' },
      { id: 'ureter-intramural-der', geometria: tubo([v(-1.5, 0.2, -1.6), v(-1.05, -0.2, -1.25), ureteralDer], 0.08, 30), color: '#e0b04a' },
      { id: 'ureter-intramural-izq', geometria: tubo([v(1.5, 0.2, -1.6), v(1.05, -0.2, -1.25), ureteralIzq], 0.08, 30), color: '#e0b04a' },
      { id: 'uretra-prostatica-esq', geometria: tubo(uretraPts, 0.1, 30), color: '#e2b48f' },
      { id: 'prostata-esq', geometria: prostata, color: '#c8838f' },
      { id: 'coliculo-seminal', geometria: new THREE.SphereGeometry(0.08, 12, 8).scale(1, 1.6, 0.8).translate(0, -1.9, -0.09), color: '#a85d6a' },
      { id: 'uraco', geometria: tubo([v(0, RY * 0.98, 0.15), v(0, 1.8, 0.45), v(0, 2.5, 0.9)], 0.06, 20), color: '#cbb6a6' },
    ],
    referencias: [],
    zonas: [{ texto: 'Pared anterior abierta', pos: [0, 1.6, 1.0] }],
  }
}

// ───────────────────────── Triángulos lumbares ─────────────────────────

/** Región lumbar izquierda vista desde atrás, por capas: triángulos de Petit (inferior) y de Grynfeltt (superior). */
export function triangulosLumbares(): Esquema {
  const lamina = (pts: [number, number][], z: number, espesor = 0.05) => extruir(poligono(pts), espesor, z)
  const cresta = tubo([v(0.2, -2.0, 0.1), v(1.2, -2.15, 0.12), v(2.3, -2.05, 0.15), v(3.3, -1.6, 0.2)], 0.09, 40)
  const costilla12 = tubo([v(0.35, 1.7, 0.05), v(1.2, 1.5, 0.1), v(2.1, 1.15, 0.15)], 0.08, 30)
  const espinosas = [2.1, 1.3, 0.5, -0.3, -1.1].map((y) => new THREE.BoxGeometry(0.22, 0.38, 0.3).translate(0, y, 0.1))
  return {
    piezas: [
      { id: 'cuadrado-lumbar-esq', geometria: lamina([[0.95, -2.0], [1.75, -1.95], [1.85, 1.3], [1.05, 1.5]], -0.25), color: '#a33a33' },
      { id: 'aponeurosis-transverso', geometria: lamina([[1.25, -0.1], [2.05, -0.2], [2.1, 1.35], [1.3, 1.45]], -0.12, 0.03), color: '#e5e7eb' },
      { id: 'iliocostal-esq', geometria: lamina([[0.3, -2.0], [1.25, -2.0], [1.3, 2.6], [0.3, 2.6]], 0.0, 0.12), color: '#b5413a' },
      { id: 'oblicuo-interno-esq', geometria: lamina([[1.6, -2.05], [3.3, -1.6], [3.4, 0.9], [2.0, 1.05], [1.95, -0.1]], 0.05), color: '#c4564b' },
      { id: 'serrato-esq', geometria: lamina([[0.3, 2.1], [0.3, 1.35], [2.3, 1.45], [2.4, 2.25]], 0.14), color: '#c96a5c' },
      { id: 'oblicuo-externo-esq', geometria: lamina([[2.3, -2.05], [3.4, -1.6], [3.5, 1.6], [3.05, 1.6], [2.65, -0.4]], 0.2), color: '#cf6f61' },
      { id: 'dorsal-ancho-esq', geometria: lamina([[0.2, -2.05], [1.7, -2.05], [2.0, -0.9], [2.9, 2.6], [0.2, 2.6]], 0.28), color: '#b23b34' },
      { id: 'triangulo-petit', geometria: lamina([[1.72, -2.0], [2.28, -2.0], [2.0, -0.95]], 0.36, 0.02), color: '#facc15' },
      { id: 'triangulo-grynfeltt', geometria: lamina([[1.3, 1.38], [2.05, 1.28], [2.0, -0.05], [1.32, 0.05]], 0.36, 0.02), color: '#38bdf8' },
      { id: 'cresta-iliaca', geometria: cresta, color: '#efe6cf' },
      { id: 'costilla-12-esq', geometria: costilla12, color: '#efe6cf' },
    ],
    referencias: [{ id: 'apofisis-espinosas', geometria: unir(espinosas), color: '#efe6cf' }],
    zonas: [
      { texto: 'Vista posterior · lado izquierdo', pos: [1.7, 3.0, 0.3] },
      { texto: 'Línea media', pos: [0, -2.55, 0.3] },
    ],
  }
}

// ───────────────────────── Fosa isquioanal ─────────────────────────

/** Corte coronal de la pelvis a la altura del conducto anal: fosas isquioanales y conducto pudendo. */
export function fosaIsquioanal(): Esquema {
  const E = 0.5 // espesor del corte
  const lamina = (pts: [number, number][], z = 0, espesor = E) => extruir(poligono(pts), espesor, z)
  const espejo = (pts: [number, number][]) => pts.map(([x, y]) => [-x, y] as [number, number]).reverse()
  const doble = (pts: [number, number][], z = 0, espesor = E) => unir([lamina(pts, z, espesor), lamina(espejo(pts), z, espesor)])
  const elevador: [number, number][] = [[0.28, -0.25], [1.62, 1.25], [1.62, 1.45], [0.3, -0.05]]
  const obturador: [number, number][] = [[1.65, 1.9], [1.95, 1.9], [1.95, -1.05], [1.65, -0.9]]
  const fosa: [number, number][] = [[0.42, -1.15], [1.6, -1.1], [1.6, 1.18], [0.38, -0.12]]
  const isquion: [number, number][] = [[1.7, -0.95], [2.3, -0.95], [2.4, -1.7], [1.75, -1.55]]
  const pudendo = (x: number) => [v(x, -0.55, -0.3), v(x, -0.5, 0.3)]
  // Las piezas pares están en una sola malla: el rótulo va sobre uno de los lados, no en la línea media.
  const ancla = (g: THREE.BufferGeometry, x: number, y: number) => { g.userData.ancla = v(x, y, E / 2); return g }
  return {
    piezas: [
      { id: 'fosa-isquioanal', geometria: ancla(doble(fosa, 0, E * 0.9), 1.05, -0.55), color: '#f1dca0' },
      { id: 'elevador-ano', geometria: ancla(doble(elevador, 0, E * 1.02), -0.95, 0.65), color: '#b5413a' },
      { id: 'obturador-interno', geometria: ancla(doble(obturador), -1.8, 0.9), color: '#a33a33' },
      { id: 'tuberosidad-isquiatica', geometria: ancla(doble(isquion), 2.05, -1.35), color: '#efe6cf' },
      { id: 'conducto-anal', geometria: ancla(new THREE.CylinderGeometry(0.22, 0.22, 1.2, 20, 1, true).translate(0, -0.65, 0), 0, -0.3), color: '#c4775a' },
      { id: 'esfinter-externo-ano-esq', geometria: ancla(unir([0, 1, 2].map((i) => new THREE.TorusGeometry(0.3, 0.07, 10, 28).rotateX(Math.PI / 2).translate(0, -1.05 + i * 0.2, 0))), 0, -1.1), color: '#9f2f2a' },
      { id: 'recto-esq', geometria: new THREE.SphereGeometry(0.6, 24, 16).scale(1, 1.1, 0.8).translate(0, 0.75, 0), color: '#c4775a' },
      { id: 'conducto-pudendo', geometria: ancla(unir([1, -1].map((s) => new THREE.CylinderGeometry(0.13, 0.13, 0.62, 16, 1, true).rotateX(Math.PI / 2).translate(1.58 * s, -0.52, 0))), 1.58, -0.3), color: '#94a3b8' },
      { id: 'nervio-pudendo', geometria: ancla(unir([1, -1].map((s) => tubo(pudendo(1.53 * s), 0.035, 8))), -1.53, -0.5), color: '#f2c94c' },
      { id: 'arteria-pudenda-interna', geometria: ancla(unir([1, -1].map((s) => tubo(pudendo(1.63 * s).map((p) => p.clone().add(v(0, 0.05, 0))), 0.03, 8))), 1.63, -0.75), color: '#c62828' },
    ],
    referencias: [
      { id: 'piel-perine', geometria: new THREE.BoxGeometry(5, 0.04, E).translate(0, -1.75, 0), color: '#e8c4a8' },
    ],
    zonas: [
      { texto: 'Corte coronal (vista anterior)', pos: [0, 2.3, 0.3] },
      { texto: 'Pelvis menor', pos: [0, 1.75, 0.3] },
      { texto: 'Periné', pos: [0, -1.95, 0.3] },
    ],
  }
}

export const ESQUEMAS: Record<string, () => Esquema> = { rinonInterior, nefrona, plexoLumbar, vejigaAbierta, triangulosLumbares, fosaIsquioanal }
