import { Grid, Html, OrbitControls, PerformanceMonitor } from '@react-three/drei'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Bloom, EffectComposer } from '@react-three/postprocessing'
import { forwardRef, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import type { OrbitControls as TOrbitControls } from 'three-stdlib'
import type { EscenaAtlas, VistaRapida } from './datos'
import { ESQUEMAS } from './esquemas'
import { colorRealista, HOLO, materialHolograma, materialRealista } from './material'

export type EjeCorte = 'coronal' | 'sagital' | 'transversal'
export type Estilo = 'holograma' | 'realista'

export interface VisorAtlasRef {
  vista: (v: VistaRapida) => void
  centrar: (id: string) => void
  /** Imagen de la vista actual y el rectángulo (0..1) que ocupa la pieza en ella. */
  capturar: (id?: string) => Promise<{ imagen: Blob; rect?: { x: number; y: number; w: number; h: number } }>
  /** Vuelve a su lugar las piezas arrastradas. */
  reacomodar: () => void
}

export interface PropsVisor {
  escena: EscenaAtlas
  estilo: Estilo
  /** 0..1 */
  desarmar: number
  capasOcultas: Set<string>
  corte: { eje: EjeCorte; pos: number } | null
  rotulos: 'todos' | 'ninguno' | 'seleccionado'
  nombres: Record<string, string>
  seleccion: string | null
  alSeleccionar: (id: string | null) => void
  /** Colores especiales por pieza (acierto/error, paso de un recorrido). */
  destacadas?: Record<string, string>
  /** Modo Museo: alfiler sobre una pieza y sin rótulos. */
  pin?: string | null
  /** Permite arrastrar piezas sueltas. */
  moverPiezas?: boolean
  /** Rompecabezas: las piezas empiezan desordenadas y se arrastran a su lugar. */
  armar?: { semilla: number; colocadas: Set<string>; alSoltar: (id: string, encajo: boolean, cerca: boolean) => void }
  /** Escena de esquema: mostrar marcas de los estrechamientos del uréter. */
  mostrarEstrechamientos?: boolean
  alCambiarCalidad?: (baja: boolean) => void
}

interface Pieza {
  id: string
  geometria: THREE.BufferGeometry
  centro: THREE.Vector3
  color: string
  capa: string
}

interface Marcador { ureter: string; pieloureteral: number[]; iliaco: number[]; vesical: number[] }

const urlModelo = (archivo: string) => `${import.meta.env.BASE_URL}${archivo}`

/** Pasa la geometría cuantizada del GLB a Float32 en coordenadas de la escena y calcula normales suaves. */
function geometriaDeMalla(m: THREE.Mesh) {
  m.updateWorldMatrix(true, false)
  const pos = m.geometry.getAttribute('position')
  const arr = new Float32Array(pos.count * 3)
  const p = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld)
    arr.set([p.x, p.y, p.z], i * 3)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(arr, 3))
  if (m.geometry.index) g.setIndex(m.geometry.index.clone())
  g.computeVertexNormals()
  g.computeBoundingBox()
  g.computeBoundingSphere()
  return g
}

function centroDe(g: THREE.BufferGeometry) {
  if (!g.boundingBox) g.computeBoundingBox()
  return g.boundingBox!.getCenter(new THREE.Vector3())
}

/**
 * Carga de un .glb con suspense (caché por URL). Se usa GLTFLoader con el decodificador meshopt
 * oficial de three.js: con useGLTF de drei la carga quedaba colgada.
 */
const modelos = new Map<string, { promesa: Promise<void>; gltf?: GLTF; error?: unknown }>()
function usarModelo(url: string): GLTF {
  let m = modelos.get(url)
  if (!m) {
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder)
    const nuevo: { promesa: Promise<void>; gltf?: GLTF; error?: unknown } = { promesa: Promise.resolve() }
    nuevo.promesa = loader.loadAsync(url).then((g) => { nuevo.gltf = g }, (e) => { console.error("[atlas] no se pudo cargar", url, e); nuevo.error = e; modelos.delete(url) })
    modelos.set(url, nuevo)
    m = nuevo
  }
  if (m.error) throw m.error
  if (!m.gltf) throw m.promesa
  return m.gltf
}

function usePiezasModelo(escena: EscenaAtlas) {
  const gltf = usarModelo(urlModelo(escena.archivo!))
  return useMemo(() => {
    const porId = new Map(escena.piezas.map((p) => [p.id, p]))
    const piezas: Pieza[] = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const id = m.name || m.parent?.name || ''
      const p = porId.get(id)
      if (!p || piezas.some((x) => x.id === id)) return
      const geometria = geometriaDeMalla(m)
      piezas.push({ id, geometria, centro: centroDe(geometria), color: colorRealista(p), capa: p.capa })
    })
    const marcadores = ((gltf.scene.userData?.marcadores ?? gltf.scene.children[0]?.userData?.marcadores ?? []) as Marcador[])
    return { piezas, referencias: [] as Pieza[], zonas: [] as { texto: string; pos: [number, number, number] }[], marcadores, flujo: undefined as THREE.Vector3[] | undefined }
  }, [gltf, escena])
}

function usePiezasEsquema(escena: EscenaAtlas) {
  return useMemo(() => {
    const e = ESQUEMAS[escena.esquema!]()
    const capa = new Map(escena.piezas.map((p) => [p.id, p.capa]))
    const conv = (x: { id: string; geometria: THREE.BufferGeometry; color: string }): Pieza => {
      x.geometria.computeBoundingBox()
      x.geometria.computeBoundingSphere()
      return { id: x.id, geometria: x.geometria, centro: centroDe(x.geometria), color: x.color, capa: capa.get(x.id) ?? 'referencia' }
    }
    return { piezas: e.piezas.map(conv), referencias: e.referencias.map(conv), zonas: e.zonas, marcadores: [] as Marcador[], flujo: e.flujo }
  }, [escena])
}

/** Dirección del "desarme" de cada pieza: desde el centro de la escena hacia la pieza (mínimo un tercio del radio). */
function direccionDesarme(c: THREE.Vector3, radio: number) {
  const d = c.clone()
  const largo = d.length()
  if (largo < 1e-3) return new THREE.Vector3(0, 0, radio * 0.6)
  return d.multiplyScalar(Math.max(largo, radio * 0.35) / largo)
}

/** Generador pseudoaleatorio con semilla (rompecabezas reproducible). */
function aleatorio(semilla: number) {
  let s = semilla >>> 0 || 1
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}

const POS_VISTA: Record<VistaRapida, [number, number, number]> = {
  anterior: [0, 0.05, 1], posterior: [0, 0.05, -1], lateral: [1, 0.05, 0], superior: [0, 1, 0.0001], inferior: [0, -1, 0.0001],
}

const Escena = forwardRef<VisorAtlasRef, PropsVisor & { datos: ReturnType<typeof usePiezasEsquema> }>(function Escena(props, ref) {
  const { datos, escena, estilo, desarmar, capasOcultas, corte, rotulos, nombres, seleccion, alSeleccionar, destacadas, pin, moverPiezas, armar } = props
  const { camera, gl, scene, size } = useThree()
  const controles = useThree((s) => s.controls) as unknown as TOrbitControls | null
  const piezas = datos.piezas
  const radio = useMemo(() => {
    const caja = new THREE.Box3()
    for (const p of [...piezas, ...datos.referencias]) caja.union(p.geometria.boundingBox!)
    return Math.max(0.5, caja.getBoundingSphere(new THREE.Sphere()).radius)
  }, [piezas, datos.referencias])

  // Materiales (uno por pieza, se actualizan sin recrear)
  const materiales = useMemo(() => {
    const m = new Map<string, { holo: THREE.ShaderMaterial; real: THREE.MeshStandardMaterial }>()
    for (const p of [...piezas, ...datos.referencias]) m.set(p.id, { holo: materialHolograma(), real: materialRealista(p.color) })
    return m
  }, [piezas, datos.referencias])
  useEffect(() => () => { for (const x of materiales.values()) { x.holo.dispose(); x.real.dispose() } }, [materiales])

  // Plano de corte
  const plano = useMemo(() => new THREE.Plane(), [])
  useEffect(() => { gl.localClippingEnabled = true }, [gl])
  useEffect(() => {
    if (!corte) return
    const n = corte.eje === 'coronal' ? new THREE.Vector3(0, 0, -1) : corte.eje === 'sagital' ? new THREE.Vector3(-1, 0, 0) : new THREE.Vector3(0, -1, 0)
    plano.set(n, corte.pos * radio)
  }, [corte, plano, radio])
  useEffect(() => {
    for (const x of materiales.values()) {
      x.holo.clippingPlanes = corte ? [plano] : []
      x.real.clippingPlanes = corte ? [plano] : []
      x.holo.needsUpdate = true
      x.real.needsUpdate = true
    }
  }, [corte, plano, materiales])

  // Posiciones: desarme + arrastre del usuario + desorden del rompecabezas (animadas)
  const usuario = useRef(new Map<string, THREE.Vector3>())
  const [, refrescar] = useState(0)
  useEffect(() => {
    usuario.current.clear()
    if (armar) {
      const r = aleatorio(armar.semilla)
      for (const p of piezas) {
        if (armar.colocadas.has(p.id)) continue
        // En un anillo alrededor del conjunto, casi en el plano de la pantalla (se arrastra en 2D).
        const a = r() * Math.PI * 2
        const destino = new THREE.Vector3(Math.cos(a) * radio * (1.25 + r() * 0.35), Math.sin(a) * radio * (1.0 + r() * 0.3), (r() - 0.5) * radio * 0.2)
        usuario.current.set(p.id, destino.sub(p.centro))
      }
    }
    refrescar((n) => n + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [armar?.semilla, piezas, radio])
  const nodos = useRef(new Map<string, THREE.Object3D>())
  const objetivo = (p: Pieza) => {
    const o = direccionDesarme(p.centro, radio).multiplyScalar(armar ? 0 : desarmar * 1.3)
    const u = usuario.current.get(p.id)
    return u ? o.add(u) : o
  }

  const tiempo = useRef(0)
  useFrame((_, dt) => {
    tiempo.current += dt
    for (const x of materiales.values()) x.holo.uniforms.uTiempo.value = tiempo.current
    for (const p of piezas) {
      const n = nodos.current.get(p.id)
      if (!n) continue
      const t = objetivo(p)
      if (arrastre.current?.id === p.id) n.position.copy(t)
      else n.position.lerp(t, Math.min(1, dt * 7))
    }
  })

  // Estado visual de cada pieza (selección, destacadas, atenuadas)
  useEffect(() => {
    const haySel = !!seleccion || !!pin
    for (const p of [...piezas, ...datos.referencias]) {
      const m = materiales.get(p.id)!
      const esRef = p.capa === 'referencia'
      const destacada = destacadas?.[p.id]
      const elegida = p.id === seleccion || p.id === pin
      const colorHolo = destacada ?? (elegida ? HOLO.seleccion : HOLO.base)
      m.holo.uniforms.uColor.value.set(colorHolo)
      m.holo.uniforms.uOpacidad.value = esRef ? 0.35 : haySel && !elegida && !destacada ? 0.35 : 1
      m.holo.uniforms.uBrillo.value = elegida || destacada ? 1.5 : 1
      m.real.color.set(destacada ?? p.color)
      m.real.emissive.set(elegida ? '#f59e0b' : destacada ? destacada : '#000000')
      m.real.emissiveIntensity = elegida ? 0.45 : destacada ? 0.35 : 0
      m.real.opacity = esRef ? 0.45 : haySel && !elegida && !destacada ? 0.28 : 1
      m.real.depthWrite = m.real.opacity > 0.9
    }
  }, [seleccion, pin, destacadas, piezas, datos.referencias, materiales])

  // Arrastre de piezas sobre un plano perpendicular a la cámara
  const arrastre = useRef<{ id: string; plano: THREE.Plane; inicio: THREE.Vector3; desde: THREE.Vector3; movio: boolean } | null>(null)
  const puedeArrastrar = !!moverPiezas || !!armar
  const alBajar = (e: ThreeEvent<PointerEvent>, p: Pieza) => {
    if (!puedeArrastrar || (armar && armar.colocadas.has(p.id))) return
    e.stopPropagation()
    const n = nodos.current.get(p.id)!
    const normal = camera.getWorldDirection(new THREE.Vector3()).negate()
    const punto = p.centro.clone().add(n.position)
    const pl = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, punto)
    const inicio = e.ray.intersectPlane(pl, new THREE.Vector3()) ?? punto
    arrastre.current = { id: p.id, plano: pl, inicio, desde: (usuario.current.get(p.id) ?? new THREE.Vector3()).clone(), movio: false }
    if (controles) controles.enabled = false
    ;(e.target as Element)?.setPointerCapture?.(e.pointerId)
  }
  useEffect(() => {
    const raycaster = new THREE.Raycaster()
    const mover = (ev: PointerEvent) => {
      const a = arrastre.current
      if (!a) return
      const r = gl.domElement.getBoundingClientRect()
      raycaster.setFromCamera(new THREE.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1), camera)
      const pt = raycaster.ray.intersectPlane(a.plano, new THREE.Vector3())
      if (!pt) return
      a.movio = true
      usuario.current.set(a.id, a.desde.clone().add(pt.sub(a.inicio)))
    }
    const soltar = () => {
      const a = arrastre.current
      if (!a) return
      arrastre.current = null
      if (controles) controles.enabled = true
      if (armar && a.movio) {
        const u = usuario.current.get(a.id) ?? new THREE.Vector3()
        // Distancia en el plano de la pantalla: la profundidad no se controla al arrastrar con el dedo.
        const dirCam = camera.getWorldDirection(new THREE.Vector3())
        const enPlano = u.clone().sub(dirCam.multiplyScalar(u.dot(dirCam))).length()
        const encajo = enPlano < radio * 0.15
        if (encajo) usuario.current.delete(a.id)
        armar.alSoltar(a.id, encajo, enPlano < radio * 0.4)
      }
    }
    window.addEventListener('pointermove', mover)
    window.addEventListener('pointerup', soltar)
    return () => { window.removeEventListener('pointermove', mover); window.removeEventListener('pointerup', soltar) }
  }, [gl, camera, controles, armar, radio])

  // Cámara
  const irA = (v: VistaRapida) => {
    // Con FOV de 40°, una esfera de radio r entra entera a ≈ r / sen(20°) ≈ 2,9 r (en el rompecabezas, con las piezas alrededor, más lejos)
    const d = radio * (armar ? 4.6 : 2.95)
    const [x, y, z] = POS_VISTA[v]
    const objetivoCam = controles?.target ?? new THREE.Vector3()
    camera.position.set(objetivoCam.x + x * d, objetivoCam.y + y * d, objetivoCam.z + z * d)
    camera.lookAt(objetivoCam)
    controles?.update()
  }
  const centrar = (id: string) => {
    const p = piezas.find((x) => x.id === id)
    const n = nodos.current.get(id)
    if (!p || !n || !controles) return
    const destino = p.centro.clone().add(n.position)
    const delta = destino.clone().sub(controles.target)
    controles.target.copy(destino)
    camera.position.add(delta)
    controles.update()
  }
  useEffect(() => {
    if (!controles) return
    controles.target.set(0, 0, 0)
    irA(armar ? 'anterior' : escena.vista ?? 'anterior')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controles, escena.id, radio, !!armar])

  useImperativeHandle(ref, () => ({
    vista: irA,
    centrar,
    reacomodar: () => { usuario.current.clear(); refrescar((n) => n + 1) },
    capturar: async (id) => {
      gl.render(scene, camera)
      const imagen = await new Promise<Blob>((ok, mal) => gl.domElement.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo capturar la vista.'))), 'image/png'))
      const n = id ? nodos.current.get(id) : undefined
      const p = id ? piezas.find((x) => x.id === id) : undefined
      if (!n || !p) return { imagen }
      const caja = p.geometria.boundingBox!.clone().translate(n.position)
      const esquinas = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => new THREE.Vector3(i & 1 ? caja.max.x : caja.min.x, i & 2 ? caja.max.y : caja.min.y, i & 4 ? caja.max.z : caja.min.z).project(camera))
      const xs = esquinas.map((q) => (q.x + 1) / 2)
      const ys = esquinas.map((q) => (1 - q.y) / 2)
      const lim = (x: number) => Math.min(1, Math.max(0, x))
      const x0 = lim(Math.min(...xs)), x1 = lim(Math.max(...xs)), y0 = lim(Math.min(...ys)), y1 = lim(Math.max(...ys))
      return { imagen, rect: { x: x0, y: y0, w: Math.max(0.02, x1 - x0), h: Math.max(0.02, y1 - y0) } }
    },
  }))

  const visibles = piezas.filter((p) => !capasOcultas.has(p.capa))
  const sombra = useMemo(() => new THREE.MeshBasicMaterial({ color: '#67e8f9', wireframe: true, transparent: true, opacity: 0.07, depthWrite: false }), [])
  const mostrarRotulo = (id: string) => !pin && (rotulos === 'todos' || (rotulos === 'seleccionado' && id === seleccion))

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[3, 5, 6]} intensity={1.4} />
      <directionalLight position={[-4, -2, -5]} intensity={0.5} />
      {estilo === 'holograma' && <Grid position={[0, -radio * 1.05, 0]} args={[radio * 8, radio * 8]} cellSize={radio / 6} sectionSize={radio / 1.5} cellColor="#0e7490" sectionColor="#22d3ee" fadeDistance={radio * 7} infiniteGrid={false} cellThickness={0.5} sectionThickness={0.8} />}

      {visibles.map((p) => {
        const m = materiales.get(p.id)!
        return (
          <group key={p.id} ref={(n) => { if (n) nodos.current.set(p.id, n); else nodos.current.delete(p.id) }}>
            <mesh
              geometry={p.geometria}
              material={estilo === 'holograma' ? m.holo : m.real}
              renderOrder={p.id === seleccion ? 2 : 1}
              onClick={(e) => { if (e.delta > 6 || arrastre.current?.movio) return; e.stopPropagation(); alSeleccionar(p.id) }}
              onDoubleClick={(e) => { e.stopPropagation(); centrar(p.id) }}
              onPointerDown={(e) => alBajar(e, p)}
              onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = puedeArrastrar ? 'grab' : 'pointer' }}
              onPointerOut={() => { document.body.style.cursor = '' }}
            />
            {/* Estrechamientos del uréter: hijos del grupo de la pieza, así acompañan al desarmar o arrastrar */}
            {props.mostrarEstrechamientos && !pin && datos.marcadores.filter((mk) => mk.ureter === p.id).flatMap((mk) => (['pieloureteral', 'iliaco', 'vesical'] as const).map((k, i) => (
              <group key={k} position={mk[k] as [number, number, number]}>
                <mesh raycast={() => null}><sphereGeometry args={[radio * 0.018, 12, 8]} /><meshBasicMaterial color="#f97316" /></mesh>
                {(rotulos === 'todos' || seleccion === p.id) && (
                  <Html zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                    <span className="ml-2 whitespace-nowrap rounded bg-orange-500/90 px-1 text-[10px] font-semibold text-white">{i + 1}.º estrechamiento{i === 0 ? ' (pieloureteral)' : i === 1 ? ' (vasos ilíacos)' : ' (ureterovesical)'}</span>
                  </Html>
                )}
              </group>
            )))}
            {mostrarRotulo(p.id) && (
              <Html position={(p.geometria.userData.ancla as THREE.Vector3 | undefined) ?? p.centro} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
                <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium shadow ${p.id === seleccion ? 'bg-amber-400 text-black' : 'bg-slate-900/80 text-cyan-100'}`}>{nombres[p.id] ?? p.id}</span>
              </Html>
            )}
          </group>
        )
      })}

      {/* Rompecabezas: sombra tenue del lugar de cada pieza que falta colocar */}
      {armar && visibles.filter((p) => !armar.colocadas.has(p.id)).map((p) => (
        <mesh key={'sombra-' + p.id} geometry={p.geometria} material={sombra} raycast={() => null} />
      ))}

      {datos.referencias.map((p) => (
        <mesh key={p.id} geometry={p.geometria} material={estilo === 'holograma' ? materiales.get(p.id)!.holo : materiales.get(p.id)!.real} raycast={() => null} />
      ))}
      {datos.zonas.map((z) => (
        <Html key={z.texto} position={z.pos} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
          <span className="whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-cyan-200/80">{z.texto}</span>
        </Html>
      ))}

      {pin && (() => {
        const p = piezas.find((x) => x.id === pin)
        const n = nodos.current.get(pin)
        if (!p) return null
        const tope = new THREE.Vector3(p.centro.x, p.geometria.boundingBox!.max.y, p.centro.z).add(n?.position ?? new THREE.Vector3())
        return <Alfiler posicion={tope} radio={radio} />
      })()}

      {datos.flujo && !capasOcultas.has('tubulo') && <Particulas camino={datos.flujo} />}

      {corte && <PlanoCorte eje={corte.eje} pos={corte.pos * radio} radio={radio} />}
      <mesh visible={false} onClick={() => alSeleccionar(null)} scale={size.width ? 1 : 1} />
    </>
  )
})

/** Flecha que señala la estructura a reconocer, como el alfiler del museo. */
function Alfiler({ posicion, radio }: { posicion: THREE.Vector3; radio: number }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => { if (ref.current) ref.current.position.y = posicion.y + radio * (0.12 + 0.03 * Math.sin(clock.elapsedTime * 4)) })
  return (
    <group ref={ref} position={[posicion.x, posicion.y + radio * 0.12, posicion.z]}>
      <mesh rotation={[Math.PI, 0, 0]} position={[0, radio * 0.04, 0]}>
        <coneGeometry args={[radio * 0.035, radio * 0.09, 16]} />
        <meshBasicMaterial color="#f43f5e" />
      </mesh>
      <mesh position={[0, radio * 0.12, 0]}>
        <cylinderGeometry args={[radio * 0.008, radio * 0.008, radio * 0.12, 8]} />
        <meshBasicMaterial color="#f43f5e" />
      </mesh>
    </group>
  )
}

/** Partículas del filtrado recorriendo la nefrona. */
function Particulas({ camino }: { camino: THREE.Vector3[] }) {
  const curva = useMemo(() => new THREE.CatmullRomCurve3(camino, false, 'catmullrom', 0.3), [camino])
  const N = 70
  const geo = useMemo(() => new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)), [])
  useFrame(({ clock }) => {
    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    const p = new THREE.Vector3()
    for (let i = 0; i < N; i++) {
      curva.getPointAt(((clock.elapsedTime * 0.035 + i / N) % 1), p)
      pos.setXYZ(i, p.x, p.y, p.z)
    }
    pos.needsUpdate = true
  })
  return (
    <points geometry={geo} raycast={() => null}>
      <pointsMaterial color="#fde68a" size={0.07} transparent opacity={0.9} depthWrite={false} />
    </points>
  )
}

function PlanoCorte({ eje, pos, radio }: { eje: EjeCorte; pos: number; radio: number }) {
  const rot: [number, number, number] = eje === 'coronal' ? [0, 0, 0] : eje === 'sagital' ? [0, Math.PI / 2, 0] : [-Math.PI / 2, 0, 0]
  const p: [number, number, number] = eje === 'coronal' ? [0, 0, pos] : eje === 'sagital' ? [pos, 0, 0] : [0, pos, 0]
  return (
    <mesh position={p} rotation={rot} raycast={() => null}>
      <planeGeometry args={[radio * 2.6, radio * 2.6]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.06} side={THREE.DoubleSide} depthWrite={false} />
    </mesh>
  )
}

const CargarModelo = forwardRef<VisorAtlasRef, PropsVisor>(function CargarModelo(props, ref) {
  const datos = usePiezasModelo(props.escena)
  return <Escena {...props} ref={ref} datos={datos} />
})
const CargarEsquema = forwardRef<VisorAtlasRef, PropsVisor>(function CargarEsquema(props, ref) {
  const datos = usePiezasEsquema(props.escena)
  return <Escena {...props} ref={ref} datos={datos} />
})

/**
 * Visor 3D de una escena del atlas (modelo de BodyParts3D o esquema hecho en código).
 * Baja la calidad sola (resolución y brillo) si el dispositivo no sostiene los cuadros por segundo.
 */
export const VisorAtlas = forwardRef<VisorAtlasRef, PropsVisor>(function VisorAtlas(props, ref) {
  const [dpr, setDpr] = useState(() => Math.min(2, window.devicePixelRatio || 1))
  const [bajo, setBajo] = useState(false)
  const [cargando, setCargando] = useState(false)
  const { alCambiarCalidad } = props
  useEffect(() => { alCambiarCalidad?.(bajo) }, [bajo, alCambiarCalidad])
  return (
    <div className="relative h-full w-full">
    {cargando && <p className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center text-sm text-cyan-200">Cargando modelo…</p>}
    <Canvas
      dpr={dpr}
      camera={{ fov: 40, near: 0.05, far: 200, position: [0, 0, 8] }}
      gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
      onPointerMissed={(e) => { if (e.type === 'click') props.alSeleccionar(null) }}
      style={{ background: props.estilo === 'holograma' ? '#020617' : '#1e293b', touchAction: 'none' }}
    >
      <PerformanceMonitor onDecline={() => { setDpr(1); setBajo(true) }} onIncline={() => setDpr(Math.min(2, window.devicePixelRatio || 1))} flipflops={3} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.12} rotateSpeed={0.8} />
      <Suspense fallback={<AvisarCarga alCambiar={setCargando} />}>
        {props.escena.tipo === 'modelo' ? <CargarModelo {...props} ref={ref} /> : <CargarEsquema {...props} ref={ref} />}
      </Suspense>
      {props.estilo === 'holograma' && !bajo && (
        <EffectComposer multisampling={0}>
          <Bloom intensity={0.85} luminanceThreshold={0.15} luminanceSmoothing={0.3} mipmapBlur />
        </EffectComposer>
      )}
    </Canvas>
    </div>
  )
})

/** Fallback de Suspense dentro del canvas: avisa afuera que el modelo se está cargando. */
function AvisarCarga({ alCambiar }: { alCambiar: (v: boolean) => void }) {
  useEffect(() => { alCambiar(true); return () => alCambiar(false) }, [alCambiar])
  return null
}
