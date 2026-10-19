import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { MessageCircle, Send } from 'lucide-react'
import { Avatar } from '../../components/ui/avatar'
import { Badge, prioriteLabel, prioriteTone, sentence, statutTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/input'
import { EmptyState } from '../../components/ui/scope-empty'
import { spring } from '../../components/motion/springs'
import type { Ref, Ticket } from '../../lib/api/tickets'
import { cn } from '../../lib/utils'

/* Libellés partagés par la liste, la fiche et la vue rapide des tickets. */

export const INCIDENT_CATEGORIES = [
  ['REFUS_COURSE', 'Refus de course'],
  ['RETARD', 'Retard'],
  ['LITIGE_PAIEMENT', 'Litige de paiement'],
  ['DESTINATAIRE_INJOIGNABLE', 'Destinataire injoignable'],
] as const

export const TICKET_TYPES = [
  ['DEMANDE_TRAVAIL', 'Demande de travail'],
  ['INCIDENT', 'Incident'],
  ['ANOMALIE_TECHNIQUE', 'Anomalie technique'],
  ['RECLAMATION_CLIENT', 'Réclamation client'],
  ['DEMANDE_ADMINISTRATIVE', 'Demande administrative'],
  ['DEMANDE_ACHAT', 'Demande d’achat'],
  ['AUTRE', 'Autre'],
] as const

export const PRIORITES = [
  ['CRITIQUE', 'Critique'],
  ['ELEVEE', 'Élevée'],
  ['NORMALE', 'Normale'],
  ['FAIBLE', 'Faible'],
] as const

export const OBJET_LIES = [
  ['', 'Aucun objet lié'],
  ['FICHE_APPEL', 'Fiche d’appel'],
  ['COURSE', 'Course'],
  ['CLIENT', 'Client'],
  ['COURSIER', 'Coursier'],
  ['FACTURE', 'Facture'],
  ['EMPLOYE', 'Employé'],
] as const

export function objetLieLabel(value?: string) {
  if (!value) return '–'
  return OBJET_LIES.find(([v]) => v === value)?.[1] ?? sentence(value.replaceAll('_', ' '))
}

export const STATUS_LABELS: Record<string, string> = {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
  ANNULE: 'Annulé',
}

export const TRANSITIONS: Record<string, string[]> = {
  OUVERT: ['EN_COURS', 'EN_ATTENTE', 'ANNULE'],
  EN_COURS: ['EN_ATTENTE', 'RESOLU', 'ANNULE'],
  EN_ATTENTE: ['EN_COURS', 'ANNULE'],
  RESOLU: ['CLOTURE', 'EN_COURS'],
  CLOTURE: [],
  ANNULE: [],
}

export function prettyStatus(value: string) {
  return STATUS_LABELS[value] ?? sentence(value.replaceAll('_', ' '))
}

export function prettyPriority(value: string) {
  return PRIORITES.find(([v]) => v === value)?.[1] ?? prioriteLabel(value)
}

export function prettyType(value: string | undefined, extra?: string) {
  const label = TICKET_TYPES.find(([v]) => v === value)?.[1] ?? (value ? sentence(value.replaceAll('_', ' ')) : '–')
  if (value === 'AUTRE' && extra) return `${label} (${extra})`
  return label
}

export function prettyCategory(value: string | undefined) {
  if (!value) return '–'
  return INCIDENT_CATEGORIES.find(([v]) => v === value)?.[1] ?? sentence(value.replaceAll('_', ' '))
}

/** Ton de badge de priorité, avec les variantes héritées (HAUTE, BASSE). */
export function prioTone(priorite: string) {
  const p = (priorite ?? '').toUpperCase()
  if (p === 'HAUTE') return 'warning' as const
  if (p === 'BASSE') return 'info' as const
  return prioriteTone(p)
}

/** Liseré de ligne selon la priorité. */
export function prioAccent(priorite: string): 'danger' | 'warning' | undefined {
  const p = (priorite ?? '').toUpperCase()
  if (p === 'CRITIQUE' || p === 'HIGH') return 'danger'
  if (p === 'ELEVEE' || p === 'HAUTE' || p === 'MEDIUM') return 'warning'
  return undefined
}

export function StatusBadge({ statut, className }: { statut: string; className?: string }) {
  return (
    <Badge tone={statutTone(statut)} dot className={className}>
      {prettyStatus(statut)}
    </Badge>
  )
}

export function PriorityBadge({ priorite }: { priorite: string }) {
  return <Badge tone={prioTone(priorite)}>{prettyPriority(priorite)}</Badge>
}

export function personName(ref?: Ref | null) {
  if (!ref) return null
  return [ref.prenom, ref.nom].filter(Boolean).join(' ') || ref.emailPro || null
}

export function fmtDate(iso?: string) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso?: string) {
  if (!iso) return '–'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '–'
  return `${fmtDate(iso)}, ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

export function isOverdue(ticket: Ticket) {
  return Boolean(ticket.sla?.echeanceDepassee || ticket.sla?.depassement)
}

/** Personne : avatar + nom (ou tiret court discret). */
export function Person({ person, fallback, size = 'sm' }: { person?: Ref | null; fallback?: string; size?: 'sm' | 'md' }) {
  const name = personName(person)
  if (!name) return <span className="text-ink-3">{fallback ?? '–'}</span>
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <Avatar name={name} agentId={person?.id} hasPhoto={person?.hasPhoto} size={size} />
      <span className="truncate">{name}</span>
    </span>
  )
}

/* ── Fil de commentaires ───────────────────────────────────────────────── */

type Comment = NonNullable<Ticket['commentaires']>[number]

export function CommentThread({ comments }: { comments: Comment[] }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  if (comments.length === 0) {
    return (
      <EmptyState
        icon={<MessageCircle />}
        title={t('ticketsUi.comments.emptyTitle', 'Aucun commentaire')}
        hint={t('ticketsUi.comments.emptyHint', 'Partagez une information utile avec l’équipe qui traite ce ticket.')}
      />
    )
  }
  return (
    <ul className="space-y-4">
      <AnimatePresence initial={false}>
        {comments.map((c) => {
          const name = personName(c.auteur) ?? 'Agent'
          return (
            <motion.li
              key={c.id}
              layout={!reduce}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={spring.page}
              className="flex gap-3"
            >
              <Avatar name={name} agentId={c.auteur?.id} hasPhoto={c.auteur?.hasPhoto} size="md" className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[13.5px] font-semibold text-ink">{name}</span>
                  <time className="text-[12px] tabular-nums text-ink-3" dateTime={c.createdAt}>
                    {fmtDateTime(c.createdAt)}
                  </time>
                </div>
                <p className="mt-1.5 inline-block max-w-full whitespace-pre-wrap rounded-[16px] rounded-tl-[6px] bg-ink/[0.04] px-3.5 py-2.5 text-[14px] leading-relaxed text-ink-2 ring-1 ring-inset ring-hairline dark:bg-white/[0.04]">
                  {c.contenu}
                </p>
              </div>
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}

export function CommentComposer({
  value,
  onChange,
  onSubmit,
  pending,
  className,
  children,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  pending?: boolean
  className?: string
  children?: ReactNode
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('space-y-2.5', className)}>
      <Textarea
        rows={3}
        className="min-h-[88px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && value.trim() && !pending) onSubmit()
        }}
        placeholder={t('ticketsUi.comments.placeholder', 'Ajouter un commentaire…')}
        aria-label={t('ticketsUi.comments.placeholder', 'Ajouter un commentaire…')}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="hidden text-[12px] text-ink-3 sm:inline">{t('ticketsUi.comments.shortcut', 'Ctrl + Entrée pour envoyer')}</span>
        {children}
        <Button size="sm" className="ml-auto" disabled={!value.trim() || pending} onClick={onSubmit}>
          <Send className="h-3.5 w-3.5" />
          {pending ? t('ticketsUi.comments.sending', 'Envoi…') : t('ticketsUi.comments.send', 'Publier')}
        </Button>
      </div>
    </div>
  )
}
