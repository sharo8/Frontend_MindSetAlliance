import { useEffect, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../../lib/motion'
import { cn } from '../../lib/utils'
import { IconTile, type IconTone } from './card'

/** Compteur animé (ralenti en fin de course, comme un compteur iOS). */
export function useCount(value: number, duration = 900) {
  const reduce = useReducedMotion()
  const [n, setN] = useState(reduce ? value : 0)
  useEffect(() => {
    if (reduce) {
      setN(value)
      return
    }
    const start = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - (1 - t) ** 4
      setN(value * eased)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, reduce, duration])
  return n
}

const accentTone: Record<string, IconTone> = { gold: 'gold', info: 'indigo', warn: 'coral', ok: 'teal', danger: 'coral' }

/** Tuile chiffre clé : argile, grand chiffre net, pastille d'icône facultative. */
export function StatCard({
  label,
  value,
  hint,
  accent = 'gold',
  icon,
  format,
  suffix,
  className,
}: {
  label: string
  value: number
  hint?: ReactNode
  accent?: 'gold' | 'info' | 'warn' | 'ok' | 'danger'
  icon?: ReactNode
  format?: (n: number) => string
  suffix?: string
  className?: string
}) {
  const n = useCount(value)
  const shown = format ? format(n) : Math.round(n).toLocaleString('fr-FR')
  return (
    <div
      className={cn(
        'clay group relative flex min-h-[128px] flex-col overflow-hidden rounded-[var(--radius-ma)] p-[18px]',
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <IconTile tone={accentTone[accent]} size="sm">
            {icon}
          </IconTile>
        )}
        <p className="min-w-0 truncate text-[13px] font-semibold tracking-[-0.01em] text-ink-2">{label}</p>
      </div>
      <p className="mt-auto pt-4 text-[34px] font-bold leading-none tracking-[-0.04em] text-ink tabular">
        {shown}
        {suffix && <span className="ml-1 text-base font-medium tracking-normal text-ink-3">{suffix}</span>}
      </p>
      {hint && <p className="mt-1.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>}
    </div>
  )
}
