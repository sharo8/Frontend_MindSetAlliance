import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

/** En-tête de page « grand titre » (style iOS) : surtitre doré, titre net, sous-titre. */
export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  className,
}: {
  kicker?: string
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-6 gap-y-4', className)}>
      <div className="min-w-0">
        {kicker && (
          <p className="mb-1 text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-3">{kicker}</p>
        )}
        <h1 className="text-[30px] font-bold leading-[1.08] tracking-[-0.038em] text-ink sm:text-[36px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/** Titre de section à l'intérieur d'une page. */
export function SectionHeader({ title, subtitle, actions, className }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2 className="text-[22px] font-bold tracking-[-0.03em] text-ink">{title}</h2>
        {subtitle && <p className="mt-0.5 text-[13px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
