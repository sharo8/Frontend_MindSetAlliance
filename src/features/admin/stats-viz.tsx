import { motion, useReducedMotion } from 'motion/react'
import { useState, type ReactNode } from 'react'
import { fmtNumber } from '../../components/charts/chart-kit'
import { spring } from '../../components/motion/springs'
import { cn } from '../../lib/utils'

/** Mélange une couleur de série avec la surface : rampe à une seule teinte, opaque (pas d'empilement d'alpha). */
export function tint(color: string, percent: number, base: string) {
  return `color-mix(in oklab, ${color} ${Math.max(0, Math.min(100, Math.round(percent)))}%, ${base})`
}

export type BarRow = { key: string; label: string; value: number; meta?: ReactNode }

/**
 * Barres horizontales en HTML : libellé à gauche, valeur au bout de la barre.
 * Lisibles sur téléphone (les libellés longs ne tournent jamais), survol doux.
 */
export function HBarList({
  rows,
  color,
  track,
  max,
  format = fmtNumber,
  labelWidth = 'w-[38%]',
  stacked = false,
}: {
  rows: BarRow[]
  color: string
  track: string
  max?: number
  format?: (n: number) => string
  labelWidth?: string
  /** Libellé et valeur au-dessus d'une barre pleine largeur (cartes étroites). */
  stacked?: boolean
}) {
  const reduce = useReducedMotion()
  const [hover, setHover] = useState<string | null>(null)
  const top = max ?? Math.max(1, ...rows.map((row) => row.value))
  return (
    <ul className="flex flex-1 flex-col justify-center gap-1 px-2" onMouseLeave={() => setHover(null)}>
      {rows.map((row, i) => {
        const pct = top ? (row.value / top) * 100 : 0
        const dim = hover !== null && hover !== row.key
        const bar = (
          <span className={cn('relative block min-w-0', stacked ? 'mt-1.5 h-2.5 w-full' : 'h-3 flex-1')}>
            <span className="absolute inset-0 rounded-full" style={{ background: track }} />
            <motion.span
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ background: color, opacity: dim ? 0.4 : 1, transition: 'opacity 200ms ease' }}
              initial={reduce ? false : { width: 0 }}
              animate={{ width: `${Math.max(pct, row.value > 0 ? 2 : 0)}%` }}
              transition={reduce ? { duration: 0 } : { ...spring.page, delay: i * 0.03 }}
            />
          </span>
        )
        return (
          <li
            key={row.key}
            className={cn(
              'rounded-[10px] px-2 transition-colors duration-150 hover:bg-ink/[0.03] dark:hover:bg-white/[0.035]',
              stacked ? 'py-1.5' : 'flex items-center gap-3 py-[5px]',
            )}
            onMouseEnter={() => setHover(row.key)}
            title={`${row.label} : ${format(row.value)}`}
          >
            {stacked ? (
              <>
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink-2">{row.label}</span>
                  <span className="shrink-0 text-[13px] font-semibold tabular-nums text-ink">{format(row.value)}</span>
                  {row.meta && <span className="w-12 shrink-0 text-right text-[12px] tabular-nums text-ink-3">{row.meta}</span>}
                </span>
                {bar}
              </>
            ) : (
              <>
                <span className={cn('min-w-0 shrink-0 truncate text-[13px] text-ink-2', labelWidth)}>{row.label}</span>
                {bar}
                <span className="w-12 shrink-0 text-right text-[13px] font-semibold tabular-nums text-ink">{format(row.value)}</span>
                {row.meta && (
                  <span className="hidden w-16 shrink-0 text-right text-[12px] tabular-nums text-ink-3 sm:inline">{row.meta}</span>
                )}
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Petite légende (pastille + libellé), toujours en couleurs de texte neutres. */
export function Legend({ items, className }: { items: { color: string; label: ReactNode }[]; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[12.5px] text-ink-2', className)}>
      {items.map((item, i) => (
        <li key={i} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: item.color }} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
