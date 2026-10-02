import { useEffect, useState } from 'react'
import { useReducedMotion } from '../../lib/motion'
import { cn } from '../../lib/utils'

function useCount(value: number) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setN(value)
      return
    }
    const start = performance.now()
    const from = 0
    const dur = 420
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - (1 - t) ** 3
      setN(Math.round(from + (value - from) * eased))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce])
  return n
}

export function StatCard({
  label,
  value,
  hint,
  accent = 'gold',
}: {
  label: string
  value: number
  hint?: string
  accent?: 'gold' | 'info' | 'warn' | 'ok' | 'danger'
}) {
  const n = useCount(value)
  const bar =
    accent === 'ok'
      ? 'from-status-success/80 to-status-success/20'
      : accent === 'warn'
        ? 'from-status-warning/80 to-status-warning/20'
        : accent === 'info'
          ? 'from-status-info/80 to-status-info/20'
          : accent === 'danger'
            ? 'from-status-danger/80 to-status-danger/20'
            : 'from-ma-gold-400 to-ma-gold-600/30'
  return (
    <div
      className={cn(
        'ma-enter relative overflow-hidden rounded-[14px] border border-ma-line bg-white p-4 shadow-[var(--shadow-ma-sm)]',
        'dark:border-white/12 dark:bg-ma-navy-700/90',
      )}
    >
      <div className={cn('absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r', bar)} />
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ma-muted dark:text-ma-gray-300">{label}</p>
      <p className="mt-2 font-display text-3xl text-ma-navy-900 dark:text-ma-white">{n}</p>
      {hint && <p className="mt-1 text-xs text-ma-muted dark:text-ma-gray-300">{hint}</p>}
    </div>
  )
}
