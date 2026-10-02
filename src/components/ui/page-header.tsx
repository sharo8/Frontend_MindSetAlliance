import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?: string
  title: string
  subtitle?: string
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-4', className)}>
      <div className="min-w-0">
        {kicker && (
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-ma-gold-600 dark:text-ma-gold-400">
            {kicker}
          </p>
        )}
        <h1 className="font-display text-[1.65rem] leading-tight tracking-wide text-ma-navy-900 dark:text-ma-gold-400">
          {title}
        </h1>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-ma-muted dark:text-ma-gray-300">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
