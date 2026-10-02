import type { ReactNode } from 'react'
import { cn } from '../../lib/utils'

const tones: Record<string, string> = {
  success: 'bg-status-success/12 text-status-success ring-status-success/20',
  warning: 'bg-status-warning/12 text-status-warning ring-status-warning/20',
  danger: 'bg-status-danger/12 text-status-danger ring-status-danger/20',
  info: 'bg-status-info/12 text-status-info ring-status-info/20',
  gold: 'bg-ma-gold-500/15 text-ma-gold-600 ring-ma-gold-500/25 dark:text-ma-gold-400',
  violet: 'bg-violet-500/15 text-violet-700 ring-violet-500/25 dark:text-violet-300',
  muted: 'bg-slate-100 text-ma-muted ring-slate-200/80 dark:bg-white/8 dark:text-ma-gray-300 dark:ring-white/10',
  navy: 'bg-ma-navy-800/10 text-ma-navy-800 ring-ma-navy-800/20 dark:bg-ma-navy-700 dark:text-ma-gold-300 dark:ring-ma-gold-500/20',
  teal: 'bg-teal-500/12 text-teal-800 ring-teal-500/25 dark:text-teal-300',
}

export function Badge({ children, tone = 'muted', className }: { children: ReactNode; tone?: keyof typeof tones; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ring-1',
        tones[tone],
        className,
      )}
    >
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
      return priorite?.replaceAll('_', ' ') || '—'
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
      return statut.replaceAll('_', ' ')
  }
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
