import { forwardRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'
import { CalendarDays, Search, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Card, CardTitle, IconTile, type IconTone } from './card'

/**
 * Barre de filtres : une rangée qui passe à la ligne proprement.
 * Placer d'abord la recherche (elle prend la place restante), puis les sélecteurs, puis les actions.
 */
export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex flex-wrap items-center gap-2', className)}>{children}</div>
}

/** Champ de recherche en pilule, loupe à gauche, bouton d'effacement. */
export const SearchField = forwardRef<
  HTMLInputElement,
  Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & { value: string; onChange: (value: string) => void }
>(function SearchField({ value, onChange, className, placeholder = 'Rechercher…', ...props }, ref) {
  return (
    <div className={cn('relative min-w-[12rem] flex-1 sm:max-w-[22rem]', className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" strokeWidth={2.2} />
      <input
        ref={ref}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={props['aria-label'] ?? placeholder}
        className="clay-field h-10 w-full rounded-full border-0 pl-10 pr-9 text-[14px] text-ink outline-none placeholder:text-ink-3/80 [&::-webkit-search-cancel-button]:hidden"
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Effacer la recherche"
          className="press absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-ink/[0.08] text-ink-2 hover:bg-ink/[0.14] dark:bg-white/[0.1]"
        >
          <X className="h-3 w-3" strokeWidth={2.6} />
        </button>
      )}
    </div>
  )
})

const chevron =
  "bg-[url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%237a849f' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m7 10 5 5 5-5'/%3E%3C/svg%3E\")]"

/**
 * Sélecteur compact pour les filtres (pilule). `active` le met en évidence quand
 * une valeur autre que « Tous » est choisie.
 */
export const FilterSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { active?: boolean }>(function FilterSelect(
  { className, active, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        'h-10 max-w-full cursor-pointer appearance-none rounded-full border-0 bg-[length:15px] bg-[right_0.7rem_center] bg-no-repeat pl-3.5 pr-8 text-[13.5px] font-medium outline-none transition-[box-shadow,background-color,color] duration-200 focus-visible:[box-shadow:var(--ring-focus)]',
        chevron,
        active
          ? 'bg-ma-gold-500/14 text-accent-ink ring-1 ring-inset ring-ma-gold-500/30 dark:bg-ma-gold-400/12'
          : 'glass-strong text-ink-2 hover:text-ink',
        className,
      )}
      {...props}
    />
  )
})

/** Champ date natif habillé (icône calendrier, même hauteur que les filtres). */
export const DateField = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { label?: string }>(function DateField(
  { className, label, ...props },
  ref,
) {
  return (
    <label className={cn('glass-strong relative inline-flex h-10 items-center gap-2 rounded-full pl-3.5 pr-3 text-[13.5px] text-ink-2', className)}>
      <CalendarDays className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
      {label && <span className="whitespace-nowrap text-ink-3">{label}</span>}
      <input
        ref={ref}
        type="date"
        className="min-w-0 bg-transparent font-medium text-ink outline-none [color-scheme:light] dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-50"
        {...props}
      />
    </label>
  )
})

/** Pastille filtre active, retirable. */
export function FilterChip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full bg-ma-gold-500/12 pl-2.5 pr-1 text-[12.5px] font-medium text-accent-ink ring-1 ring-inset ring-ma-gold-500/25">
      {children}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label="Retirer le filtre" className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-ma-gold-500/20">
          <X className="h-3 w-3" strokeWidth={2.6} />
        </button>
      )}
    </span>
  )
}

/** Carte de section avec en-tête (icône colorée, titre, sous-titre, action). */
export function SectionCard({
  title,
  subtitle,
  icon,
  tone = 'navy',
  action,
  children,
  className,
  bodyClassName,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  tone?: IconTone
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <div className="px-5 pb-1 pt-5 sm:px-6">
        <CardTitle
          title={title}
          subtitle={subtitle}
          icon={icon ? <IconTile tone={tone} size="sm">{icon}</IconTile> : undefined}
          action={action}
        />
      </div>
      <div className={cn('px-5 pb-5 pt-4 sm:px-6', bodyClassName)}>{children}</div>
    </Card>
  )
}

/** Liste « libellé : valeur » (fiches détail). */
export function DetailList({ items, className, columns = 1 }: { items: { label: ReactNode; value: ReactNode }[]; className?: string; columns?: 1 | 2 }) {
  return (
    <dl className={cn('grid gap-x-6', columns === 2 ? 'sm:grid-cols-2' : 'grid-cols-1', className)}>
      {items.map((item, i) => (
        <div
          key={i}
          className={cn(
            'flex items-baseline justify-between gap-4 border-b border-hairline py-2.5 last:border-b-0',
            columns === 2 && items.length % 2 === 0 && 'sm:[&:nth-last-child(2)]:border-b-0',
          )}
        >
          <dt className="shrink-0 text-[13px] text-ink-3">{item.label}</dt>
          <dd className="min-w-0 text-right text-[13.5px] font-medium text-ink">{item.value}</dd>
        </div>
      ))}
    </dl>
  )
}
