import * as THREE from 'three'

/** Colores del holograma. */
export const HOLO = { base: '#22d3ee', seleccion: '#fbbf24', acierto: '#34d399', error: '#f87171' }

/**
 * Material "holograma": borde brillante tipo Fresnel, cuerpo semitransparente, líneas de
 * escaneo y un leve parpadeo. Compatible con planos de corte (clipping).
 */
export function materialHolograma(color = HOLO.base) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uTiempo: { value: 0 },
      uOpacidad: { value: 1 },
      uBrillo: { value: 1 },
    },
    vertexShader: /* glsl */ `
      #include <clipping_planes_pars_vertex>
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        #include <begin_vertex>
        #include <project_vertex>
        #include <clipping_planes_vertex>
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mvPosition.xyz);
        vY = (modelMatrix * vec4(transformed, 1.0)).y;
      }`,
    fragmentShader: /* glsl */ `
      #include <clipping_planes_pars_fragment>
      uniform vec3 uColor;
      uniform float uTiempo;
      uniform float uOpacidad;
      uniform float uBrillo;
      varying vec3 vN;
      varying vec3 vV;
      varying float vY;
      void main() {
        #include <clipping_planes_fragment>
        float fresnel = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2);
        float escaneo = 0.82 + 0.18 * sin(vY * 55.0 - uTiempo * 2.5);
        float parpadeo = 0.96 + 0.04 * sin(uTiempo * 11.0 + vY * 3.0);
        vec3 c = uColor * (0.22 + 1.7 * fresnel) * escaneo * parpadeo * uBrillo;
        float a = clamp((0.10 + 0.9 * fresnel) * uOpacidad, 0.0, 1.0);
        gl_FragColor = vec4(c, a);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    clipping: true,
  })
}

/** Colores anatómicos convencionales (modo realista). */
const POR_TONO: Record<string, string> = { arteria: '#c62828', vena: '#1e4fd6', porta: '#7c3aed' }
const POR_CAPA: Record<string, string> = {
  urinario: '#9b3b2f', suprarrenal: '#d9a03f', vascular: '#c62828', arterial: '#c62828', venoso: '#1e4fd6', portal: '#7c3aed',
  oseo: '#efe6cf', muscular: '#b5413a', genital: '#d48a8f', digestivo: '#c4775a', somatico: '#f2c94c', autonomo: '#f59e0b',
}
/** Algunas estructuras con su color propio dentro de su capa. */
const POR_FICHA: Record<string, string> = { ureter: '#e0b04a', vejiga: '#d8a28c', 'uretra-masculina': '#e2b48f', 'disco-intervertebral': '#cfd8dc', diafragma: '#c0544a' }

export function colorRealista(p: { ficha: string; capa: string; tono?: string }, porDefecto = '#cbd5e1') {
  return POR_FICHA[p.ficha] ?? (p.tono ? POR_TONO[p.tono] : undefined) ?? POR_CAPA[p.capa] ?? porDefecto
}

export function materialRealista(color: string) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: true })
}

export const NOMBRE_CAPA: Record<string, string> = {
  urinario: 'Urinario', suprarrenal: 'Suprarrenal', vascular: 'Vascular', arterial: 'Arterias', venoso: 'Venas', portal: 'Sistema porta',
  oseo: 'Óseo', muscular: 'Muscular', genital: 'Genital', digestivo: 'Digestivo', parenquima: 'Parénquima', excretor: 'Vía excretora',
  tubulo: 'Túbulo', somatico: 'Plexo lumbar', autonomo: 'Autónomo', limites: 'Triángulos', espacios: 'Espacios', vasculonervioso: 'Vasos y nervios',
}
