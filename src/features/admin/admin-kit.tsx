import type { ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Card, IconTile, type IconTone } from '../../components/ui/card'
import { cn } from '../../lib/utils'

/** Petits éléments de présentation partagés par les pages d'administration. */

export function formatDay(iso?: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(iso?: string | null, timeZone?: string) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone })
}

const markTones: IconTone[] = ['navy', 'gold', 'teal', 'violet', 'sky', 'coral', 'indigo']

/** Couleur stable dérivée d'un code (CNN, MDR…). */
export function toneFromCode(code: string): IconTone {
  if (code === 'CNN') return 'gold'
  if (code === 'MDR') return 'violet'
  if (code === 'MA') return 'navy'
  let hash = 0
  for (const ch of code) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return markTones[hash % markTones.length]
}

/** Pastille de société : monogramme du code dans une tuile d'argile colorée. */
export function CompanyMark({ code, muted, size = 'md' }: { code: string; muted?: boolean; size?: 'sm' | 'md' }) {
  const short = code.slice(0, 4)
  return (
    <IconTile
      tone={muted ? 'neutral' : toneFromCode(code)}
      size={size}
      className={cn('font-bold tracking-[-0.02em]', size === 'md' ? (short.length > 3 ? 'text-[10px]' : 'text-[11.5px]') : 'text-[9.5px]')}
    >
      {short}
    </IconTile>
  )
}

/** Cellule vide normalisée. */
export function Dash() {
  return <span className="text-ink-3">–</span>
}

/** Encart d'avertissement pour les confirmations (désactivation, archivage…). */
export function ConfirmNotice({ tone = 'coral', icon, children }: { tone?: IconTone; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3.5 rounded-[16px] bg-sunken/70 p-4 ring-1 ring-inset ring-hairline">
      <IconTile tone={tone} size="sm" className="mt-0.5">
        {icon ?? <AlertTriangle />}
      </IconTile>
      <div className="min-w-0 text-[13.5px] leading-relaxed text-ink-2">{children}</div>
    </div>
  )
}

/** Libellé + champ, avec message d'erreur facultatif. */
export function Field({
  label,
  hint,
  error,
  children,
}: {
  label: ReactNode
  hint?: ReactNode
  error?: string | null
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between gap-2 text-[12.5px] font-medium text-ink-2">
        <span>{label}</span>
        {hint && <span className="text-[11.5px] font-normal text-ink-3">{hint}</span>}
      </span>
      {children}
      {error && <span className="mt-1.5 block text-[12px] font-medium text-status-danger">{error}</span>}
    </label>
  )
}

/**
 * Carte de section (équivalent local de SectionCard) : la version partagée emballe l'icône
 * deux fois (IconTile dans IconTile), d'où ce remplaçant.
 */
export function PanelCard({
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
      <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {icon && <IconTile tone={tone}>{icon}</IconTile>}
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold tracking-[-0.015em] text-ink">{title}</h2>
            {subtitle && <p className="mt-0.5 truncate text-[12.5px] text-ink-3">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className={cn('px-5 pb-5 pt-4 sm:px-6', bodyClassName)}>{children}</div>
    </Card>
  )
}
