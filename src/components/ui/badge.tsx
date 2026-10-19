import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

const tones: Record<string, string> = {
  success: 'bg-status-success/12 text-[#0f7a37] ring-status-success/20 dark:text-[#4ade80] [--dot:#16a34a]',
  warning: 'bg-status-warning/12 text-[#a85a04] ring-status-warning/22 dark:text-[#fbbf24] [--dot:#d97706]',
  danger: 'bg-status-danger/10 text-[#b91c1c] ring-status-danger/20 dark:text-[#f87171] [--dot:#dc2626]',
  info: 'bg-status-info/10 text-[#1d4ed8] ring-status-info/20 dark:text-[#93b4ff] [--dot:#2563eb]',
  gold: 'bg-ma-gold-500/14 text-ma-gold-700 ring-ma-gold-500/25 dark:text-ma-gold-300 [--dot:#dcaa28]',
  violet: 'bg-violet-500/12 text-violet-700 ring-violet-500/22 dark:text-violet-300 [--dot:#7c4ee8]',
  muted: 'bg-ink/[0.05] text-ink-2 ring-hairline dark:bg-white/[0.06] [--dot:#8a94b3]',
  navy: 'bg-ma-navy-700/10 text-ma-navy-700 ring-ma-navy-700/18 dark:bg-white/[0.1] dark:text-ink dark:ring-white/10 [--dot:#2f42a0]',
  teal: 'bg-teal-500/12 text-teal-800 ring-teal-500/22 dark:text-teal-300 [--dot:#139c85]',
}

export function Badge({
  children,
  tone = 'muted',
  dot,
  className,
}: {
  children: ReactNode
  tone?: keyof typeof tones
  /** Point de couleur devant le libellé (statuts). */
  dot?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 text-[11px] font-semibold tracking-[0.01em] ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--dot)]" aria-hidden />}
      {children}
    </span>
  )
}

export function prioriteTone(priorite: string): keyof typeof tones {
  if (priorite === 'CRITIQUE' || priorite === 'HIGH') return 'danger'
  if (priorite === 'ELEVEE' || priorite === 'MEDIUM') return 'warning'
  if (priorite === 'FAIBLE' || priorite === 'LOW') return 'info'
  return 'muted'
}

/** Libellé FR affiché pour une priorité ticket. */
export function prioriteLabel(priorite: string): string {
  switch (priorite?.toUpperCase()) {
    case 'CRITIQUE':
    case 'HIGH':
      return 'Critique'
    case 'ELEVEE':
    case 'MEDIUM':
      return 'Élevée'
    case 'FAIBLE':
    case 'LOW':
      return 'Faible'
    case 'NORMALE':
    case 'NORMAL':
      return 'Normale'
    default:
      return priorite ? sentence(priorite.replaceAll('_', ' ')) : '–'
  }
}

export function statutTone(statut: string): keyof typeof tones {
  if (['RESOLU', 'CLOTURE', 'VALIDEE', 'ACTIF'].includes(statut)) return 'success'
  if (['ANNULE', 'ANNULEE', 'DESACTIVE', 'INACTIF'].includes(statut)) return 'danger'
  if (['EN_COURS', 'EN_ATTENTE', 'BROUILLON', 'EN_PREPARATION'].includes(statut)) return 'warning'
  return 'info'
}

/** Code couleur des actions du journal d'audit, partagé avec l'assistant IA. */
export function auditActionTone(action: string): keyof typeof tones {
  const a = action.toUpperCase()
  if (a === 'LOGIN' || a === 'LOGOUT' || a.startsWith('PASSWORD')) return 'info'
  if (a === 'DENY' || a.endsWith('_DENY') || /(DELETE|ARCHIVE|REVOKE|DISABLE|CANCEL|REMOVE)/.test(a)) return 'danger'
  if (a === 'GRANT' || a.endsWith('_GRANT') || /(CREATE|ASSIGN|VALIDATE)/.test(a)) return 'success'
  if (/(UPDATE|CHANGE|OVERRIDE)/.test(a)) return 'gold'
  if (/(EXPORT|ASK)/.test(a)) return 'navy'
  return 'muted'
}

export function statutLabel(statut: string) {
  switch (statut) {
    case 'EN_PREPARATION':
      return 'En préparation'
    case 'ACTIF':
      return 'Actif'
    case 'INACTIF':
      return 'Inactif'
    default:
      return sentence(statut.replaceAll('_', ' '))
  }
}

/** « EN_ATTENTE » → « En attente » (les badges ne crient plus en majuscules). */
export function sentence(text: string) {
  const lower = text.toLocaleLowerCase('fr')
  return lower.charAt(0).toLocaleUpperCase('fr') + lower.slice(1)
}

export function roleTone(role: string): keyof typeof tones {
  switch (role) {
    case 'FINANCE':
      return 'teal'
    case 'MARKETING':
      return 'violet'
    case 'SUPPORT':
      return 'warning'
    case 'DEV':
      return 'info'
    case 'RH':
      return 'success'
    case 'COMMERCIAL':
      return 'gold'
    case 'DIRECTION':
    case 'CONSEIL_ADMINISTRATION':
      return 'navy'
    case 'JURIDIQUE':
      return 'muted'
    case 'ADMIN_SYSTEME':
      return 'danger'
    default:
      return 'gold'
  }
}
