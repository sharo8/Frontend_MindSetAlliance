import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Eye, ShieldCheck } from 'lucide-react'
import { Avatar } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Textarea } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { CellStack } from '../../components/ui/table'
import { ProjectLogo } from '../../components/ui/brand-marks'
import { ApiError } from '../../lib/api/client'
import { useCnnRelay, type OrderStatus, type MotardValidationStatus } from '../../lib/api/cnnAdmin'

export function useLocaleTag() {
  const { i18n } = useTranslation()
  return i18n.language?.startsWith('en') ? 'en-GB' : 'fr-FR'
}

/**
 * Date reçue de Colis na Nga. L'API admin renvoie des dates sans fuseau, enregistrées en UTC
 * (serveur Cloud Run) : on les lit comme UTC pour les afficher à l'heure locale.
 */
export function parseCnnDate(iso: string | null | undefined) {
  if (!iso) return null
  const zoned = /([zZ]|[+-]\d{2}:?\d{2})$/.test(iso) || /^\d{4}-\d{2}-\d{2}$/.test(iso)
  const d = new Date(zoned ? iso : `${iso}Z`)
  return Number.isNaN(d.getTime()) ? null : d
}

export function fmtDateTime(iso: string | null | undefined, locale: string) {
  if (!iso) return '–'
  const d = parseCnnDate(iso) ?? new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString(locale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

/** Date seule (AAAA-MM-JJ), affichée sans décalage de fuseau. */
export function fmtDay(day: string | null | undefined, locale: string) {
  if (!day) return '–'
  const d = new Date(`${day.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return day
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** Montant dans une devise donnée (USD, CDF…) ; FC par défaut. */
export function fmtAmount(value: number | null | undefined, currency: string | null | undefined, locale: string) {
  if (value == null) return '–'
  const cur = (currency || 'CDF').toUpperCase()
  if (cur === 'CDF' || cur === 'FC') return `${Math.round(Number(value)).toLocaleString(locale)} FC`
  return `${Number(value).toLocaleString(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${cur}`
}

export function fmtMoney(value: number | null | undefined, locale: string) {
  if (value == null) return '–'
  return `${Math.round(Number(value)).toLocaleString(locale)} FC`
}

export function fullName(first?: string | null, last?: string | null, fallback?: string | null) {
  const name = [first, last].filter(Boolean).join(' ').trim()
  return name || fallback || '–'
}

/** Personne : avatar, nom, téléphone. */
export function PersonCell({ first, last, phone, photo }: { first?: string | null; last?: string | null; phone?: string | null; photo?: string | null }) {
  const name = fullName(first, last, phone)
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar name={name} src={photo ?? undefined} size="md" />
      <CellStack title={name} meta={phone ?? undefined} />
    </div>
  )
}

const ORDER_TONES: Record<OrderStatus, 'muted' | 'info' | 'warning' | 'success' | 'danger' | 'gold' | 'violet'> = {
  PENDING: 'muted',
  PENDING_MOTARD_ACCEPTANCE: 'warning',
  AGENT_EN_ROUTE: 'info',
  LIVREUR_EN_ROUTE: 'info',
  COURIER_AT_PICKUP: 'info',
  AWAITING_PICKUP_PAYMENT: 'gold',
  COLLECTED: 'violet',
  IN_TRANSIT: 'violet',
  AWAITING_DELIVERY_PAYMENT: 'gold',
  DELIVERED: 'success',
  CANCELLED: 'danger',
}

export const ORDER_STATUSES = Object.keys(ORDER_TONES) as OrderStatus[]

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useTranslation()
  return (
    <Badge tone={ORDER_TONES[status] ?? 'muted'} dot>
      {t(`cnnAdmin.orderStatus.${status}`, { defaultValue: status })}
    </Badge>
  )
}

export function isFinalOrder(status: OrderStatus) {
  return status === 'DELIVERED' || status === 'CANCELLED'
}

const MOTARD_TONES: Record<MotardValidationStatus, 'warning' | 'info' | 'success' | 'danger'> = {
  PENDING_VALIDATION: 'warning',
  ASSOCIATION_VALIDATED: 'info',
  APPROVED: 'success',
  REJECTED: 'danger',
}

export function MotardStatusBadge({ status }: { status: MotardValidationStatus }) {
  const { t } = useTranslation()
  return (
    <Badge tone={MOTARD_TONES[status] ?? 'muted'} dot>
      {t(`cnnAdmin.motardStatus.${status}`, { defaultValue: status })}
    </Badge>
  )
}

export function ActiveBadge({ active }: { active: boolean | null | undefined }) {
  const { t } = useTranslation()
  return active ? (
    <Badge tone="success" dot>
      {t('cnnAdmin.common.active', 'Actif')}
    </Badge>
  ) : (
    <Badge tone="muted" dot>
      {t('cnnAdmin.common.inactive', 'Désactivé')}
    </Badge>
  )
}

export function DutyBadge({ status }: { status: 'ON_DUTY' | 'OFF_DUTY' | null }) {
  const { t } = useTranslation()
  return status === 'ON_DUTY' ? (
    <Badge tone="teal" dot>
      {t('cnnAdmin.common.onDuty', 'En service')}
    </Badge>
  ) : (
    <Badge tone="muted">{t('cnnAdmin.common.offDuty', 'Hors service')}</Badge>
  )
}


/** En-tête commun : logo Colis na Nga, titre, état du relais et onglets de domaine. */
export function CnnAdminHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  const { t } = useTranslation()
  const relay = useCnnRelay()
  return (
    <div className="space-y-5">
      <PageHeader
        kicker="Colis na Nga"
        title={
          <span className="flex items-center gap-3">
            <ProjectLogo code="CNN" size="md" />
            <span>{title}</span>
          </span>
        }
        subtitle={subtitle}
        actions={
          <>
            {!relay.isLoading &&
              (relay.writable ? (
                <Badge tone="success" className="h-7 px-3 text-[12px]">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('cnnAdmin.relay.on', 'Administration sécurisée')}
                </Badge>
              ) : (
                <Badge tone="info" className="h-7 px-3 text-[12px]">
                  <Eye className="h-3.5 w-3.5" />
                  {t('cnnAdmin.relay.readOnly', 'Consultation en direct')}
                </Badge>
              ))}
            {actions}
          </>
        }
      />
    </div>
  )
}

/** Message d'erreur lisible pour une réponse du relais. */
export function relayErrorMessage(error: unknown, t: (key: string, def: string) => string) {
  if (error instanceof ApiError) {
    if (error.status === 403) return t('cnnAdmin.errors.forbidden', 'Vous n’avez pas la permission pour cette action.')
    if (error.status === 502 || error.status === 504) return t('cnnAdmin.errors.unreachable', 'Colis na Nga ne répond pas. Réessayez dans un instant.')
    if (error.status === 503) return t('cnnAdmin.errors.notConfigured', 'Le relais Colis na Nga n’est pas encore configuré.')
    return error.message
  }
  return t('cnnAdmin.errors.generic', 'Une erreur est survenue.')
}

/** Mutation relayée : rafraîchit les listes concernées et renvoie un message prêt à afficher. */
export function useRelayMutation<TVars>(
  fn: (vars: TVars) => Promise<unknown>,
  invalidate: string[][],
  onDone: (message: string | null, error: string | null) => void,
  successMessage: string,
) {
  const { t } = useTranslation()
  const client = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: async () => {
      await Promise.all(invalidate.map((key) => client.invalidateQueries({ queryKey: key })))
      onDone(successMessage, null)
    },
    onError: (error) => onDone(null, relayErrorMessage(error, (k, d) => t(k, d))),
  })
}

/** Confirmation (avec motif facultatif ou obligatoire). */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  danger,
  reason,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  message: ReactNode
  confirmLabel: string
  danger?: boolean
  reason?: 'required' | 'optional'
  busy?: boolean
  error?: string | null
  onConfirm: (reason: string) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const missing = reason === 'required' && text.trim().length < 3
  return (
    <Modal
      open={open}
      onClose={() => {
        setText('')
        onClose()
      }}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('cnnAdmin.common.cancel', 'Annuler')}
          </Button>
          <Button variant={danger ? 'danger' : 'gold'} disabled={busy || missing} onClick={() => onConfirm(text.trim())}>
            {busy ? t('cnnAdmin.common.working', 'Envoi…') : confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="text-[14px] leading-relaxed text-ink-2">{message}</div>
        {reason && (
          <label className="block">
            <FieldLabel hint={reason === 'required' ? t('cnnAdmin.common.required', 'Obligatoire') : undefined}>
              {t('cnnAdmin.common.reason', 'Motif')}
            </FieldLabel>
            <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} />
          </label>
        )}
        {error && <Feedback tone="danger">{error}</Feedback>}
      </div>
    </Modal>
  )
}

/** Bandeau quand le relais n'est pas prêt : explique quoi faire sans jargon. */
export function RelayNotice() {
  const { t } = useTranslation()
  const relay = useCnnRelay()
  if (relay.isLoading || relay.writable) return null
  return (
    <Feedback tone="warning">
      {t(
        'cnnAdmin.relay.notice',
        'Données en direct depuis Colis na Nga. Les modifications (créer, valider, désactiver, supprimer) seront disponibles dès que la nouvelle version du backend Colis na Nga sera déployée.',
      )}
      {relay.data?.relayReason && (
        <span className="mt-1 block font-mono text-[11.5px] opacity-80">{relay.data.relayReason}</span>
      )}
    </Feedback>
  )
}
