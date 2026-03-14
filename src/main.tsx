import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 等比缩放：以 1440px 设计稿为基准，随视口宽度自动缩放
function applyScale() {
  const scale = Math.min(1, window.innerWidth / 1440);
  document.documentElement.style.setProperty('--vp-scale', String(scale));
}
applyScale();
window.addEventListener('resize', applyScale);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
