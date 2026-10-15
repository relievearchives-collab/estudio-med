/** Íconos de trazo (24×24), dibujados a mano para no sumar dependencias. */
const PATHS: Record<string, string> = {
  hoy: 'M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 8a4 4 0 100 8 4 4 0 000-8z',
  biblioteca: 'M4 19.5A2.5 2.5 0 016.5 17H20M4 19.5A2.5 2.5 0 006.5 22H20V2H6.5A2.5 2.5 0 004 4.5v15z',
  chat: 'M21 12a8 8 0 01-11.6 7.1L4 21l1.9-5.4A8 8 0 1121 12z',
  nota: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6M8 13h8M8 17h5',
  buscar: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3',
  ajustes: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
  cerrar: 'M18 6L6 18M6 6l12 12',
  mic: 'M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zM19 10v2a7 7 0 01-14 0v-2M12 19v3',
  enviar: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
  subir: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12',
  bajar: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
  izq: 'M15 18l-6-6 6-6',
  der: 'M9 18l6-6-6-6',
  mas2: 'M12 5v14M5 12h14',
  basura: 'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  lapiz: 'M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4 12.5-12.5z',
  camara: 'M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2zM12 17a4 4 0 100-8 4 4 0 000 8z',
  pdf: 'M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6zM14 3v6h6',
  texto: 'M4 7V4h16v3M9 20h6M12 4v16',
  reloj: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
  check: 'M20 6L9 17l-5-5',
  alerta: 'M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0zM12 9v4M12 17h.01',
  estrella: 'M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z',
  grafico: 'M18 20V10M12 20V4M6 20v-6',
  info: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 16v-4M12 8h.01',
  zoomMas: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3M11 8v6M8 11h6',
  zoomMenos: 'M11 4a7 7 0 100 14 7 7 0 000-14zM21 21l-4.3-4.3M8 11h6',
  parlante: 'M11 5L6 9H2v6h4l5 4V5zM15.5 8.5a5 5 0 010 7M19 5a10 10 0 010 14',
  externo: 'M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3',
  tarjetas: 'M4 8h12a1 1 0 011 1v11a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1zM7 5h12a1 1 0 011 1v11',
  imagen: 'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM8.5 11a2 2 0 100-4 2 2 0 000 4zM21 15l-5-5L5 20',
  deshacer: 'M9 14L4 9l5-5M4 9h11a5 5 0 010 10h-3',
  fuego: 'M12 22a7 7 0 007-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 007 7z',
}

export function Icono({ nombre, className = 'h-5 w-5', titulo }: { nombre: keyof typeof PATHS | string; className?: string; titulo?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden={!titulo} role={titulo ? 'img' : undefined}>
      {titulo && <title>{titulo}</title>}
      <path d={PATHS[nombre] ?? PATHS.info} />
    </svg>
  )
}
