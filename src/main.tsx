import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './lib/i18n/i18n'
import { applyThemeClass, resolveTheme } from './lib/theme/theme-store'
import './index.css'

applyThemeClass(resolveTheme())

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
