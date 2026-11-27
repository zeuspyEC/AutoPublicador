import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import './placas.css'
import { ConsultaPlacas } from './ConsultaPlacas'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ConsultaPlacas />
  </StrictMode>,
)
