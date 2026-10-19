import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'motion/react'
import {
  ArrowRight,
  ArrowRightLeft,
  Ban,
  ChevronLeft,
  Download,
  FileText,
  Info,
  Link2,
  ListChecks,
  MessageSquareText,
  Paperclip,
  RotateCcw,
  SearchX,
  Upload,
  Workflow,
} from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Select, Textarea } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { Mono } from '../../components/ui/table'
import { DetailList, SectionCard } from '../../components/ui/toolbar'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { ApiError } from '../../lib/api/client'
import {
  assignTicket,
  attachTicketFile,
  changeTicketStatus,
  commentTicket,
  getTicket,
  listTicketAgents,
  listTicketReattributions,
} from '../../lib/api/tickets'
import { hasFullAccess } from '../../lib/rbac/rbac'
import { useAuthStore } from '../../lib/auth/auth-store'
import { readSession } from '../../lib/auth/session'
import { cn } from '../../lib/utils'
import { TicketLifecycle } from './TicketLifecycle'
import {
  CommentComposer,
  CommentThread,
  fmtDate,
  fmtDateTime,
  isOverdue,
  objetLieLabel,
  Person,
  personName,
  PriorityBadge,
  prettyCategory,
  prettyStatus,
  prettyType,
  StatusBadge,
  TRANSITIONS,
} from './ticket-ui'

/** Étape « naturelle » suivante, mise en avant en doré. */
const PRIMARY_NEXT: Record<string, string> = { OUVERT: 'EN_COURS', EN_COURS: 'RESOLU', EN_ATTENTE: 'EN_COURS', RESOLU: 'CLOTURE' }

const STATUS_DOT: Record<string, string> = {
  OUVERT: 'bg-status-info',
  EN_COURS: 'bg-status-warning',
  EN_ATTENTE: 'bg-ink-3',
  RESOLU: 'bg-status-success',
  CLOTURE: 'bg-status-success',
}

export function TicketDetailPage() {
  const { t: tr } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const ticketId = Number(id)
  const queryClient = useQueryClient()
  const roles = useAuthStore((s) => s.roles)
  const responsable = hasFullAccess(roles)
  const [comment, setComment] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [motif, setMotif] = useState('')
  const [cancelOpen, setCancelOpen] = useState(false)
  const [assignee, setAssignee] = useState('')
  const agents = useQuery({ queryKey: ['ticket-agents'], queryFn: listTicketAgents })
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId),
    enabled: Number.isFinite(ticketId),
  })
  const history = useQuery({
    queryKey: ['ticket-reattributions', ticketId],
    queryFn: () => listTicketReattributions(ticketId),
    enabled: Number.isFinite(ticketId),
  })
  const statut = useMutation({
    mutationFn: (next: string) => changeTicketStatus(ticketId, next, next === 'ANNULE' ? motif : undefined),
    onSuccess: () => {
      setNotice('Statut enregistré.')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : 'Le changement de statut a échoué.')
    },
  })
  const attribuer = useMutation({
    mutationFn: () => assignTicket(ticketId, Number(assignee)),
    onSuccess: () => {
      setNotice('Ticket réattribué.')
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
      void queryClient.invalidateQueries({ queryKey: ['ticket-reattributions', ticketId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Réattribution impossible.'),
  })
  const commenter = useMutation({
    mutationFn: () => commentTicket(ticketId, comment),
    onSuccess: () => {
      setComment('')
      setNotice('Commentaire enregistré.')
      setError(null)
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : 'L’enregistrement du commentaire a échoué.')
    },
  })
  const attach = useMutation({
    mutationFn: (file: File) => attachTicketFile(ticketId, file),
    onSuccess: () => {
      setNotice('Pièce jointe enregistrée.')
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticketId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Envoi de la pièce jointe impossible.'),
  })

  const t = ticket.data
  if (ticket.isLoading) return <DetailSkeleton />
  if (!t) {
    return (
      <div className="space-y-6">
        <BackLink />
        <Card>
          <EmptyState
            icon={<SearchX />}
            title={tr('ticketsUi.detail.notFound', 'Ticket introuvable')}
            hint={tr('ticketsUi.detail.notFoundHint', 'Il a peut-être été retiré de la file, ou vous n’y avez pas accès.')}
            action={
              <Button variant="outline" size="sm" onClick={() => navigate('/tickets')}>
                <ChevronLeft className="h-4 w-4" />
                {tr('ticketsUi.detail.back', 'Tous les tickets')}
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  const locked = t.statut === 'CLOTURE' || t.statut === 'ANNULE'
  const nexts = TRANSITIONS[t.statut] ?? []
  const overdue = isOverdue(t)
  const comments = t.commentaires ?? []
  const pieces = t.piecesJointes ?? []
  const reattributions = history.data ?? []

  async function downloadPiece(pieceId: number, nom?: string) {
    const session = readSession()
    const res = await fetch(`/api/tickets/${ticketId}/pieces-jointes/${pieceId}`, {
      headers: session ? { Authorization: `Bearer ${session.accessToken}` } : {},
    })
    if (!res.ok) {
      setError('Téléchargement impossible.')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = nom || 'piece'
    a.click()
    URL.revokeObjectURL(url)
  }

  const infoItems = [
    { label: tr('adminUi.type'), value: prettyType(t.type, t.typeAutrePrecision) },
    ...(t.type === 'INCIDENT' ? [{ label: 'Catégorie', value: prettyCategory(t.categorie) }] : []),
    { label: tr('common.project'), value: t.project?.nom ?? t.project?.code ?? '–' },
    { label: tr('common.department'), value: t.departementDestinataire?.nom ?? '–' },
    { label: tr('ticketsUi.detail.requester', 'Demandeur'), value: <Person person={t.demandeur} /> },
    { label: tr('ticketsUi.detail.assignee', 'Attribué à'), value: <Person person={t.attributaire} fallback={tr('ticketsUi.detail.unassigned', 'Non attribué')} /> },
    { label: tr('ticketsUi.detail.created', 'Créé le'), value: <span className="tabular-nums">{fmtDateTime(t.createdAt)}</span> },
    {
      label: 'Échéance souhaitée',
      value: <span className={cn('tabular-nums', overdue && 'text-status-danger')}>{fmtDateTime(t.echeance)}</span>,
    },
    ...(t.sla?.engagementHeures != null ? [{ label: 'Engagement SLA', value: <span className="tabular-nums">{t.sla.engagementHeures} h</span> }] : []),
  ]

  return (
    <div className="space-y-6">
      <BackLink />

      {/* En-tête */}
      <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 max-w-3xl">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex h-[22px] items-center rounded-full bg-ink/[0.05] px-2.5 ring-1 ring-inset ring-hairline dark:bg-white/[0.06]">
              <Mono className="text-[11.5px] font-medium text-ink-2">{t.reference}</Mono>
            </span>
            <StatusBadge statut={t.statut} />
            <PriorityBadge priorite={t.priorite} />
            {overdue && (
              <Badge tone="danger" dot>
                SLA dépassé
              </Badge>
            )}
          </div>
          <h1 className="text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-ink sm:text-[32px]">{t.titre}</h1>
          <p className="mt-2 text-[13.5px] text-ink-3">
            {prettyType(t.type, t.typeAutrePrecision)}
            {t.departementDestinataire?.nom && <> · {t.departementDestinataire.nom}</>}
            {personName(t.demandeur) && (
              <>
                {' · '}
                {tr('ticketsUi.detail.openedBy', 'ouvert par {{name}}', { name: personName(t.demandeur) })}
              </>
            )}
            {t.createdAt && <> · {fmtDate(t.createdAt)}</>}
          </p>
        </div>
        {(nexts.length > 0 || (locked && responsable)) && (
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center [&>*:only-child]:col-span-2">
            {nexts.includes('ANNULE') && (
              <Button variant="ghost" className="order-last col-span-2 text-status-danger sm:order-none hover:bg-status-danger/10 hover:text-status-danger" onClick={() => setCancelOpen(true)}>
                <Ban className="h-4 w-4" />
                Annuler le ticket
              </Button>
            )}
            {nexts
              .filter((s) => s !== 'ANNULE')
              .sort((a, b) => Number(a === PRIMARY_NEXT[t.statut]) - Number(b === PRIMARY_NEXT[t.statut]))
              .map((s) => (
                <Button
                  key={s}
                  variant={s === PRIMARY_NEXT[t.statut] ? 'gold' : 'outline'}
                  disabled={statut.isPending}
                  onClick={() => statut.mutate(s)}
                  title={tr('ticketsUi.detail.moveTo', 'Passer au statut « {{s}} »', { s: prettyStatus(s) })}
                >
                  {s === PRIMARY_NEXT[t.statut] ? (
                    <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
                  ) : (
                    <span className={cn('h-2 w-2 rounded-full', STATUS_DOT[s] ?? 'bg-ink-3')} aria-hidden />
                  )}
                  {prettyStatus(s)}
                </Button>
              ))}
            {locked && responsable && (
              <Button variant="outline" disabled={statut.isPending} onClick={() => statut.mutate('OUVERT')}>
                <RotateCcw className="h-4 w-4" />
                Rouvrir
              </Button>
            )}
          </div>
        )}
      </header>

      {(notice || error) && (
        <div className="space-y-2">
          {notice && <Feedback tone="success">{notice}</Feedback>}
          {error && <Feedback tone="danger">{error}</Feedback>}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-5">
        {/* Colonne principale */}
        <Stagger className="min-w-0 space-y-4 lg:space-y-5">
          <StaggerItem>
            <SectionCard
              title={tr('common.description')}
              icon={<FileText />}
              tone="navy"
              className={overdue ? 'ring-status-danger/30' : undefined}
            >
              <div className="space-y-4">
                <p className={cn('whitespace-pre-wrap text-[14.5px] leading-relaxed', t.description ? 'text-ink-2' : 'text-ink-3')}>
                  {t.description || 'Sans description.'}
                </p>
                {t.objetLieType && (
                  <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-ink/[0.04] py-1 pl-2 pr-3 text-[12.5px] text-ink-2 ring-1 ring-inset ring-hairline dark:bg-white/[0.05]">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-ink-3" />
                    <span className="text-ink-3">Objet lié</span>
                    <span className="truncate font-medium">
                      {objetLieLabel(t.objetLieType)} {t.objetLieId && <Mono className="text-[11.5px]">{t.objetLieId}</Mono>}
                      {t.objetLieLibelle ? ` · ${t.objetLieLibelle}` : ''}
                    </span>
                  </div>
                )}
                {t.motifAnnulation && (
                  <Feedback tone="danger">
                    <span className="font-semibold">Motif d’annulation :</span> {t.motifAnnulation}
                  </Feedback>
                )}
                {locked && (
                  <Feedback tone="warning">
                    Ticket {prettyStatus(t.statut).toLowerCase()}. Champs non modifiables
                    {responsable ? `, sauf réouverture par un responsable (${t.sla?.reouvertureJours ?? 30} jours).` : '.'}
                  </Feedback>
                )}
              </div>
            </SectionCard>
          </StaggerItem>

          <StaggerItem>
            <SectionCard title={tr('ticketsUi.lifecycle.title', 'Cycle de vie')} subtitle={tr('ticketsUi.detail.lifecycleHint', 'Étapes, historique et respect du SLA')} icon={<Workflow />} tone="gold">
              <TicketLifecycle ticket={t} />
            </SectionCard>
          </StaggerItem>

          <StaggerItem>
            <SectionCard
              title={tr('ticketsUi.comments.title', 'Commentaires')}
              subtitle={
                comments.length
                  ? tr('ticketsUi.comments.count', '{{count}} message(s)', { count: comments.length })
                  : tr('ticketsUi.comments.none', 'Aucun message pour l’instant')
              }
              icon={<MessageSquareText />}
              tone="indigo"
            >
              <CommentThread comments={comments} />
              {!locked && (
                <div className="mt-5 border-t border-hairline pt-5">
                  <CommentComposer value={comment} onChange={setComment} onSubmit={() => commenter.mutate()} pending={commenter.isPending} />
                </div>
              )}
            </SectionCard>
          </StaggerItem>
        </Stagger>

        {/* Panneau latéral */}
        <Stagger className="min-w-0 space-y-4 lg:sticky lg:top-24 lg:space-y-5" delay={0.08}>
          <StaggerItem>
            <SectionCard title={tr('ticketsUi.detail.info', 'Informations')} icon={<Info />} tone="neutral" bodyClassName="pt-2">
              <DetailList items={infoItems} />
            </SectionCard>
          </StaggerItem>

          {!locked && (
            <StaggerItem>
              <SectionCard title={tr('ticketsUi.detail.reassign', 'Réattribuer')} icon={<ArrowRightLeft />} tone="teal">
                <div className="space-y-3">
                  <label className="block">
                    <FieldLabel>{tr('ticketsUi.detail.newAssignee', 'Nouvel agent')}</FieldLabel>
                    <Select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
                      <option value="">Réattribuer à…</option>
                      {(agents.data ?? []).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.prenom} {a.nom}
                          {a.departementNom ? ` · ${a.departementNom}` : ''}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <Button variant="navy" className="w-full" disabled={!assignee || attribuer.isPending} onClick={() => attribuer.mutate()}>
                    {tr('common.confirm')}
                  </Button>
                </div>
              </SectionCard>
            </StaggerItem>
          )}

          <StaggerItem>
            <SectionCard
              title={tr('ticketsUi.detail.attachments', 'Pièces jointes')}
              icon={<Paperclip />}
              tone="sky"
              action={pieces.length ? <span className="text-[12.5px] tabular-nums text-ink-3">{pieces.length}</span> : undefined}
            >
              {pieces.length === 0 && (
                <p className="text-[13px] text-ink-3">{tr('ticketsUi.detail.noAttachment', 'Aucune pièce jointe.')}</p>
              )}
              {pieces.length > 0 && (
                <ul className="-mx-2 space-y-0.5">
                  {pieces.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="press group flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left hover:bg-ink/[0.04] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:hover:bg-white/[0.05]"
                        onClick={() => void downloadPiece(p.id, p.nomFichier)}
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.05] text-ink-2 dark:bg-white/[0.07]">
                          <FileText className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-medium text-ink">{p.nomFichier ?? `Fichier ${p.id}`}</span>
                          {p.typeMime && <span className="block truncate text-[11.5px] text-ink-3">{p.typeMime}</span>}
                        </span>
                        <Download className="h-4 w-4 shrink-0 text-ink-3 transition-colors group-hover:text-ink" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!locked && (
                <label
                  className={cn(
                    'mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-[13px] border border-dashed border-ink/15 px-3 py-2.5 text-[13px] font-medium text-ink-2 transition-colors hover:border-ma-gold-500/60 hover:bg-ma-gold-500/[0.05] hover:text-ink focus-within:[box-shadow:var(--ring-focus)] dark:border-white/15',
                    attach.isPending && 'pointer-events-none opacity-60',
                  )}
                >
                  <Upload className="h-4 w-4" />
                  {attach.isPending ? tr('ticketsUi.detail.uploading', 'Envoi…') : tr('ticketsUi.detail.addFile', 'Ajouter un fichier')}
                  <input
                    type="file"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0]
                      if (f) attach.mutate(f)
                      e.target.value = ''
                    }}
                  />
                </label>
              )}
            </SectionCard>
          </StaggerItem>

          <StaggerItem>
            <SectionCard title={tr('ticketsUi.detail.reassignHistory', 'Historique de réattribution')} icon={<ListChecks />} tone="violet">
              {history.isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : reattributions.length === 0 ? (
                <p className="text-[13px] text-ink-3">Aucune réattribution.</p>
              ) : (
                <ReassignTimeline items={reattributions} />
              )}
            </SectionCard>
          </StaggerItem>
        </Stagger>
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => setCancelOpen(false)}
        kicker={t.reference}
        title="Annuler le ticket"
        subtitle={tr('ticketsUi.detail.cancelSubtitle', 'Le motif est obligatoire et restera visible dans la fiche.')}
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              {tr('common.close')}
            </Button>
            <Button
              variant="danger"
              disabled={!motif.trim() || statut.isPending}
              onClick={() => {
                statut.mutate('ANNULE')
                setCancelOpen(false)
              }}
            >
              <Ban className="h-4 w-4" />
              Confirmer l’annulation
            </Button>
          </>
        }
      >
        <label className="block pb-1">
          <FieldLabel>Motif d’annulation</FieldLabel>
          <Textarea
            rows={3}
            autoFocus
            placeholder="Ex. doublon du ticket TCK-2026-00398"
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
          />
        </label>
      </Modal>
    </div>
  )
}

function BackLink() {
  const { t } = useTranslation()
  return (
    <Link
      to="/tickets"
      className="press -ml-1.5 inline-flex h-8 items-center gap-1 rounded-full pl-1 pr-3 text-[13.5px] font-medium text-accent-ink hover:bg-ma-gold-500/10 focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
    >
      <ChevronLeft className="h-[18px] w-[18px]" strokeWidth={2.4} />
      {t('ticketsUi.detail.back', 'Tous les tickets')}
    </Link>
  )
}

type Reattribution = Awaited<ReturnType<typeof listTicketReattributions>>[number]

function ReassignTimeline({ items }: { items: Reattribution[] }) {
  const reduce = useReducedMotion()
  return (
    <ol className="space-y-4">
      {items.map((h, i) => (
        <motion.li
          key={h.id}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 30, delay: reduce ? 0 : 0.15 + i * 0.05 }}
          className="space-y-1.5"
        >
          <div className="flex min-w-0 items-center gap-2 text-[13px]">
            <span className={cn('min-w-0 truncate', h.ancienAgent ? 'text-ink-2' : 'text-ink-3')}>{personName(h.ancienAgent) ?? 'Non assigné'}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-ink-3" />
            <span className="min-w-0 flex-1 truncate font-medium text-ink">
              <Person person={h.nouvelAgent} />
            </span>
          </div>
          <p className="text-[11.5px] tabular-nums text-ink-3">
            {fmtDateTime(h.createdAt)}
            {personName(h.auteur) ? ` · par ${personName(h.auteur)}` : ''}
          </p>
        </motion.li>
      ))}
    </ol>
  )
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-label="Chargement">
      <Skeleton className="h-5 w-32" />
      <div className="space-y-3">
        <div className="flex gap-2">
          <Skeleton className="h-[22px] w-28 rounded-full" />
          <Skeleton className="h-[22px] w-20 rounded-full" />
          <Skeleton className="h-[22px] w-16 rounded-full" />
        </div>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <Skeleton className="h-40 w-full rounded-[var(--radius-ma)]" />
          <Skeleton className="h-72 w-full rounded-[var(--radius-ma)]" />
        </div>
        <div className="space-y-5">
          <Skeleton className="h-80 w-full rounded-[var(--radius-ma)]" />
          <Skeleton className="h-32 w-full rounded-[var(--radius-ma)]" />
        </div>
      </div>
    </div>
  )
}
