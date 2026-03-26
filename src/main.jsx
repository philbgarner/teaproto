import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { GameRoot } from './GameRoot.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GameRoot />
  </StrictMode>,
)
