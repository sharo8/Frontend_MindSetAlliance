import { useEffect, useState, type ReactNode } from 'react'
import { BarChart3 } from 'lucide-react'
import { Card, CardTitle } from '../ui/card'
import { Skeleton } from '../ui/skeleton'
import { useThemeStore } from '../../lib/theme/theme-store'
import { cn } from '../../lib/utils'

export type VizPalette = {
  series: string[]
  grid: string
  axis: string
  surface: string
  ink: string
  ink3: string
  dark: boolean
}

const FALLBACK: VizPalette = {
  series: ['#3346c9', '#cf9410', '#139c85', '#7c4ee8', '#e05b39', '#2f93d6'],
  grid: 'rgba(17,27,63,0.07)',
  axis: '#7a849f',
  surface: '#ffffff',
  ink: '#0b1430',
  ink3: '#6b7592',
  dark: false,
}

/**
 * Couleurs des graphiques lues dans les variables CSS du thème (--viz-1…6).
 * Palette validée : écart ≥ 12 ΔE pour les daltonismes, ordre fixe, jamais recyclée.
 */
export function useViz(): VizPalette {
  const theme = useThemeStore((s) => s.theme)
  const [palette, setPalette] = useState<VizPalette>(FALLBACK)
  useEffect(() => {
    const read = () => {
      const css = getComputedStyle(document.documentElement)
      const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback
      setPalette({
        series: [1, 2, 3, 4, 5, 6].map((i) => v(`--viz-${i}`, FALLBACK.series[i - 1])),
        grid: v('--viz-grid', FALLBACK.grid),
        axis: v('--viz-axis', FALLBACK.axis),
        surface: v('--ma-surface', FALLBACK.surface),
        ink: v('--ma-ink-1', FALLBACK.ink),
        ink3: v('--ma-ink-3', FALLBACK.ink3),
        dark: document.documentElement.classList.contains('dark'),
      })
    }
    read()
    const id = requestAnimationFrame(read)
    return () => cancelAnimationFrame(id)
  }, [theme])
  return palette
}

export const axisTick = (color: string) => ({ fill: color, fontSize: 12, fontWeight: 500, fontFamily: 'Inter Variable, Inter, sans-serif' })

/** Info-bulle en verre commune à tous les graphiques. */
export function GlassTooltip({
  active,
  title,
  rows,
}: {
  active?: boolean
  title?: ReactNode
  rows: { color?: string; label: ReactNode; value: ReactNode }[]
}) {
  if (!active) return null
  return (
    <div className="glass-strong min-w-[150px] rounded-[14px] px-3.5 py-2.5 text-ink">
      {title && <p className="mb-1.5 text-[12px] font-semibold text-ink-3">{title}</p>}
      <div className="space-y-1">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2 text-[13px]">
            {row.color && <span className="h-2.5 w-2.5 shrink-0 rounded-[4px]" style={{ background: row.color }} />}
            <span className="min-w-0 flex-1 text-ink-2">{row.label}</span>
            <span className="font-semibold tabular-nums text-ink">{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/** Cadre de graphique : carte argile, titre, résumé à droite, états chargement / vide. */
export function ChartFrame({
  title,
  subtitle,
  summary,
  loading,
  empty,
  emptyMessage = 'Aucune donnée disponible pour cette période',
  footnote,
  children,
  className,
  bodyClassName,
}: {
  title: string
  subtitle?: ReactNode
  summary?: ReactNode
  loading?: boolean
  empty?: boolean
  emptyMessage?: ReactNode
  footnote?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={cn('flex h-full min-h-0 min-w-0 flex-col', className)}>
      <div className="shrink-0 px-5 pt-5 sm:px-6">
        <CardTitle title={title} subtitle={subtitle} action={summary} />
      </div>
      <div className={cn('flex min-h-0 flex-1 flex-col px-3 pb-4 pt-3 sm:px-4', bodyClassName)}>
        {loading && <Skeleton className="mx-2 h-full min-h-[160px] flex-1 rounded-[16px]" />}
        {!loading && empty && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-4 py-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink/[0.05] text-ink-3 dark:bg-white/[0.06]">
              <BarChart3 className="h-[18px] w-[18px]" />
            </span>
            <p className="max-w-[18rem] text-[13px] leading-relaxed text-ink-3">{emptyMessage}</p>
          </div>
        )}
        {!loading && !empty && children}
      </div>
      {!loading && footnote && <p className="shrink-0 border-t border-hairline px-5 py-3 text-[12.5px] leading-relaxed text-ink-3 sm:px-6">{footnote}</p>}
    </Card>
  )
}

/** Petit résumé chiffré en haut à droite d'un graphique. */
export function ChartSummary({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="text-right">
      <p className="text-[11px] font-medium text-ink-3">{label}</p>
      <p className="text-[19px] font-semibold leading-tight tracking-[-0.02em] text-ink tabular-nums">{value}</p>
    </div>
  )
}

export const fmtNumber = (n: number) => Math.round(n).toLocaleString('fr-FR')
