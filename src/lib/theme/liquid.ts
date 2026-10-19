import { create } from 'zustand'

/**
 * Verre liquide « Liquid Mindset » (inspiré d'iOS 27).
 * - Niveau de transparence réglable (de « ultra clair » à « teinté »), mémorisé.
 * - Reflet spéculaire qui suit le pointeur sur chaque élément en verre.
 * - Réfraction de lentille (filtre SVG) sur les navigateurs Chromium.
 */

const LEVEL_KEY = 'ma-glass-level'
export const GLASS_DEFAULT = 0.5

function readLevel(): number {
  try {
    const raw = window.localStorage.getItem(LEVEL_KEY)
    const n = raw == null ? NaN : Number(raw)
    return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : GLASS_DEFAULT
  } catch {
    return GLASS_DEFAULT
  }
}

function applyLevel(level: number) {
  document.documentElement.style.setProperty('--lg-level', String(level))
}

type GlassState = {
  level: number
  setLevel: (level: number) => void
}

export const useGlassStore = create<GlassState>((set) => ({
  level: typeof window === 'undefined' ? GLASS_DEFAULT : readLevel(),
  setLevel: (level) => {
    const v = Math.min(1, Math.max(0, level))
    applyLevel(v)
    try {
      window.localStorage.setItem(LEVEL_KEY, String(v))
    } catch {
      /* ignore */
    }
    set({ level: v })
  },
}))

/** Carte de déplacement : neutre au centre, la lumière se courbe sur les bords (R = x, G = y). */
function displacementMap() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200" preserveAspectRatio="none">
<defs>
<linearGradient id="x" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#000"/><stop offset=".16" stop-color="#800000"/><stop offset=".84" stop-color="#800000"/><stop offset="1" stop-color="#f00"/></linearGradient>
<linearGradient id="y" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".22" stop-color="#008000"/><stop offset=".78" stop-color="#008000"/><stop offset="1" stop-color="#0f0"/></linearGradient>
</defs>
<rect width="200" height="200" fill="url(#x)"/>
<rect width="200" height="200" fill="url(#y)" style="mix-blend-mode:screen"/>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

function injectFilters() {
  if (document.getElementById('ma-lg-defs')) return
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('id', 'ma-lg-defs')
  svg.setAttribute('aria-hidden', 'true')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.innerHTML = `<defs>
<filter id="ma-lg-refract" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB" primitiveUnits="objectBoundingBox">
<feImage href="${displacementMap()}" x="0" y="0" width="1" height="1" preserveAspectRatio="none" result="map"/>
<feDisplacementMap in="SourceGraphic" in2="map" scale="0.06" xChannelSelector="R" yChannelSelector="G"/>
</filter>
</defs>`
  document.body.appendChild(svg)
}

function isChromium() {
  const nav = navigator as Navigator & { userAgentData?: { brands?: { brand: string }[] } }
  const brands = nav.userAgentData?.brands?.map((b) => b.brand) ?? []
  return brands.some((b) => /Chromium|Google Chrome|Microsoft Edge|Brave|Opera/.test(b))
}

const GLASS_SELECTOR = '.glass, .glass-strong, .lg-sheen'

/** Reflet qui suit le pointeur : on écrit --mx/--my sur le verre survolé (une fois par image). */
function trackSpecular() {
  let frame = 0
  let last: HTMLElement | null = null
  let pending: PointerEvent | null = null

  const flush = () => {
    frame = 0
    const e = pending
    pending = null
    if (!e) return
    const target = e.target instanceof Element ? (e.target.closest(GLASS_SELECTOR) as HTMLElement | null) : null
    if (last && last !== target) {
      last.style.removeProperty('--mx')
      last.style.removeProperty('--my')
    }
    last = target
    if (!target) return
    const r = target.getBoundingClientRect()
    target.style.setProperty('--mx', `${e.clientX - r.left}px`)
    target.style.setProperty('--my', `${e.clientY - r.top}px`)
  }

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return
      pending = e
      if (!frame) frame = requestAnimationFrame(flush)
    },
    { passive: true },
  )
  document.addEventListener('pointerleave', () => {
    if (last) {
      last.style.removeProperty('--mx')
      last.style.removeProperty('--my')
      last = null
    }
  })
}

let started = false

export function initLiquidGlass() {
  if (started || typeof window === 'undefined') return
  started = true
  applyLevel(readLevel())
  const reduce = window.matchMedia('(prefers-reduced-transparency: reduce)').matches
  if (!reduce && isChromium()) {
    injectFilters()
    document.documentElement.classList.add('lg-refract')
  }
  trackSpecular()
}
