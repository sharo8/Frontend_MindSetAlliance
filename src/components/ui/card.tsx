import { cn } from '../../lib/utils'
import { isValidElement, type HTMLAttributes, type ReactNode } from 'react'

/**
 * Carte en argile : surface opaque légèrement bombée (reflet en haut, ombre douce).
 * `interactive` ajoute l'élévation au survol pour les cartes cliquables.
 */
export function Card({ className, interactive, ...props }: HTMLAttributes<HTMLDivElement> & { interactive?: boolean }) {
  return (
    <div
      className={cn(
        'clay relative rounded-[var(--radius-ma)] text-ink',
        'transition-[box-shadow,transform] duration-500 ease-[cubic-bezier(0.22,1.2,0.36,1)]',
        interactive && 'lg-sheen cursor-pointer hover:[box-shadow:var(--clay-2)] active:scale-[0.985] active:duration-150',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 pb-1 pt-4 sm:px-6 sm:pt-5', className)} {...props} />
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-5 py-4 sm:px-6', className)} {...props} />
}

/** Titre de carte : intitulé + sous-titre facultatif + action à droite. */
export function CardTitle({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-between gap-3', className)}>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (isValidElement(icon) && icon.type === IconTile ? icon : <IconTile>{icon}</IconTile>)}
        <div className="min-w-0">
          <h2 className="truncate text-[16px] font-semibold tracking-[-0.02em] text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{subtitle}</p>}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

const tileTones = {
  gold: 'from-[#f2c64f] to-[#d9a21c] text-white',
  navy: 'from-[#2b3a7c] to-[#16224f] text-[#f2c64f]',
  indigo: 'from-[#6476f0] to-[#3a4bd0] text-white',
  teal: 'from-[#34c7a8] to-[#14977f] text-white',
  violet: 'from-[#a184f7] to-[#7350e6] text-white',
  coral: 'from-[#f7875f] to-[#e2552f] text-white',
  sky: 'from-[#5ab8f1] to-[#2a86cc] text-white',
  neutral: 'from-[#a1a1a8] to-[#7c7c84] text-white dark:from-[#5a5a60] dark:to-[#46464b]',
}

export type IconTone = keyof typeof tileTones

/** Pastille d'icône en argile colorée (style icône iOS, propre à MA). */
export function IconTile({
  children,
  tone = 'navy',
  size = 'md',
  className,
}: {
  children: ReactNode
  tone?: IconTone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center bg-gradient-to-b shadow-[inset_0_0_0_0.5px_rgb(0_0_0/0.06),inset_0_1px_0_rgb(255_255_255/0.25)] [&_svg]:stroke-[2.1]',
        size === 'sm' && 'h-7 w-7 rounded-[8px] [&_svg]:h-4 [&_svg]:w-4',
        size === 'md' && 'h-9 w-9 rounded-[10px] [&_svg]:h-5 [&_svg]:w-5',
        size === 'lg' && 'h-12 w-12 rounded-[13px] [&_svg]:h-6 [&_svg]:w-6',
        tileTones[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
