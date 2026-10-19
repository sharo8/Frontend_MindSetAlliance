import { useEffect, useRef } from 'react'
import { useReducedMotion } from 'motion/react'

/**
 * « L'alliance » : des points lumineux qui dérivent et se relient quand ils se rapprochent.
 * Le pointeur attire doucement les points voisins. Canvas 2D léger, en pause hors de l'écran.
 */
export function Constellation({ dark, className }: { dark: boolean; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null)
  const reduce = useReducedMotion()

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const gold = dark ? [242, 195, 90] : [184, 131, 25]
    const blue = dark ? [120, 150, 255] : [40, 70, 190]
    let w = 0
    let h = 0
    let raf = 0
    let visible = true
    const pointer = { x: -9999, y: -9999 }
    type P = { x: number; y: number; vx: number; vy: number; r: number; g: boolean }
    let pts: P[] = []

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.round(Math.min(110, Math.max(38, (w * h) / 15000)))
      pts = Array.from({ length: count }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r: Math.random() * 1.6 + 0.8,
        g: i % 4 === 0,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      const link = Math.min(150, Math.max(100, w / 11))
      for (const p of pts) {
        if (!reduce) {
          const dx = pointer.x - p.x
          const dy = pointer.y - p.y
          const d = Math.hypot(dx, dy)
          if (d < 180 && d > 1) {
            p.vx += (dx / d) * 0.012
            p.vy += (dy / d) * 0.012
          }
          p.vx *= 0.995
          p.vy *= 0.995
          const speed = Math.hypot(p.vx, p.vy)
          if (speed > 0.9) {
            p.vx *= 0.9 / speed
            p.vy *= 0.9 / speed
          }
          p.x += p.vx
          p.y += p.vy
          if (p.x < -20) p.x = w + 20
          if (p.x > w + 20) p.x = -20
          if (p.y < -20) p.y = h + 20
          if (p.y > h + 20) p.y = -20
        }
      }
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i]
          const b = pts[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < link) {
            const c = a.g || b.g ? gold : blue
            ctx.strokeStyle = `rgba(${c[0]},${c[1]},${c[2]},${(1 - d / link) * (dark ? 0.32 : 0.26)})`
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      for (const p of pts) {
        const c = p.g ? gold : blue
        ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${p.g ? 0.95 : 0.7})`
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.g ? p.r + 0.6 : p.r, 0, Math.PI * 2)
        ctx.fill()
        if (p.g) {
          ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.12)`
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2)
          ctx.fill()
        }
      }
      if (visible && !reduce) raf = requestAnimationFrame(draw)
    }

    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = e.clientX - rect.left
      pointer.y = e.clientY - rect.top
    }
    const onLeave = () => {
      pointer.x = -9999
      pointer.y = -9999
    }
    const io = new IntersectionObserver(([entry]) => {
      const was = visible
      visible = entry.isIntersecting
      if (visible && !was && !reduce) raf = requestAnimationFrame(draw)
    })
    io.observe(canvas)
    resize()
    draw()
    window.addEventListener('resize', resize)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      window.removeEventListener('resize', resize)
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerleave', onLeave)
    }
  }, [dark, reduce])

  return <canvas ref={ref} aria-hidden className={className} />
}
