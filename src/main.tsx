import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { aplicarMarca } from './marca'
import { reanudarProcesamiento } from './procesamiento/cola'
import { sembrarTemas } from './repositorio'

aplicarMarca()
sembrarTemas().then(() => reanudarProcesamiento()).catch((e) => console.error(e))
// Pedir almacenamiento persistente: evita que el navegador borre la base si falta espacio.
navigator.storage?.persist?.().catch(() => {})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
