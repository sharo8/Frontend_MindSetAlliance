import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, Inbox, MessageCircle, MoreHorizontal, Pencil, Plus, Send, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/ui/avatar'
import { Badge, prioriteTone, statutTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { TableSkeleton } from '../../components/ui/skeleton'
import { StatCard } from '../../components/ui/stat-card'
import { Toast } from '../../components/ui/toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { fetchProjects } from '../../lib/api/domain'
import { ApiError } from '../../lib/api/client'
import {
  archiveTicket,
  attachTicketFile,
  changeTicketStatus,
  commentTicket,
  createTicket,
  exportTickets,
  getTicket,
  listTicketAgents,
  listTickets,
  updateTicket,
  type Ticket,
} from '../../lib/api/tickets'
import { useProjectStore } from '../../lib/projects/project-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { hasFullAccess, hasPermission, visibleProjectCodes } from '../../lib/rbac/rbac'
import { useAuthStore } from '../../lib/auth/auth-store'
import { cn } from '../../lib/utils'
import { TicketLifecycle } from './TicketLifecycle'

const INCIDENT_CATEGORIES = [
  ['REFUS_COURSE', 'Refus de course'],
  ['RETARD', 'Retard'],
  ['LITIGE_PAIEMENT', 'Litige de paiement'],
  ['DESTINATAIRE_INJOIGNABLE', 'Destinataire injoignable'],
] as const

const TICKET_TYPES = [
  ['DEMANDE_TRAVAIL', 'Demande de travail'],
  ['INCIDENT', 'Incident'],
  ['ANOMALIE_TECHNIQUE', 'Anomalie technique'],
  ['RECLAMATION_CLIENT', 'Réclamation client'],
  ['DEMANDE_ADMINISTRATIVE', 'Demande administrative'],
  ['DEMANDE_ACHAT', 'Demande d’achat'],
  ['AUTRE', 'Autre'],
] as const

const OBJET_LIES = [
  ['', 'Aucun objet lié'],
  ['FICHE_APPEL', 'Fiche d’appel'],
  ['COURSE', 'Course'],
  ['CLIENT', 'Client'],
  ['COURSIER', 'Coursier'],
  ['FACTURE', 'Facture'],
  ['EMPLOYE', 'Employé'],
] as const

const PRIORITES = [
  ['CRITIQUE', 'Critique'],
  ['ELEVEE', 'Élevée'],
  ['NORMALE', 'Normale'],
  ['FAIBLE', 'Faible'],
] as const

const STATUS_FILTERS = [
  { value: '', label: 'Tous' },
  { value: 'OUVERT', label: 'Ouverts' },
  { value: 'EN_COURS', label: 'En cours' },
  { value: 'EN_ATTENTE', label: 'En attente' },
  { value: 'RESOLU', label: 'Résolus' },
  { value: 'CLOTURE', label: 'Clôturés' },
  { value: 'ANNULE', label: 'Annulés' },
] as const

const ticketSchema = z
  .object({
    titre: z.string().min(3, 'Le titre doit contenir au moins 3 caractères.'),
    type: z.string().min(1, 'Le type est obligatoire.'),
    categorie: z.string().optional(),
    priorite: z.string().min(1, 'La priorité est obligatoire.'),
    projectCode: z.string().min(1, 'Le projet est obligatoire.'),
    departementDestinataireId: z.string().min(1, 'Le département destinataire est obligatoire.'),
    echeance: z.string().min(1, 'L’échéance souhaitée est obligatoire.'),
    description: z.string().min(1, 'La description est obligatoire.'),
    objetLieType: z.string().optional(),
    objetLieId: z.string().optional(),
    objetLieLibelle: z.string().optional(),
    typeAutrePrecision: z.string().optional(),
    statut: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type === 'INCIDENT' && !values.categorie) {
      ctx.addIssue({ code: 'custom', path: ['categorie'], message: 'La catégorie d’incident est obligatoire.' })
    }
    if (values.type === 'AUTRE' && !values.typeAutrePrecision?.trim()) {
      ctx.addIssue({ code: 'custom', path: ['typeAutrePrecision'], message: 'Précisez le type.' })
    }
  })

type TicketForm = z.infer<typeof ticketSchema>

const STATUS_LABELS: Record<string, string> = {
  OUVERT: 'Ouvert',
  EN_COURS: 'En cours',
  EN_ATTENTE: 'En attente',
  RESOLU: 'Résolu',
  CLOTURE: 'Clôturé',
  ANNULE: 'Annulé',
}

function prettyStatus(value: string) {
  return STATUS_LABELS[value] ?? value.replaceAll('_', ' ')
}

function prettyPriority(value: string) {
  return PRIORITES.find(([v]) => v === value)?.[1] ?? value
}

function prettyType(value: string | undefined, extra?: string) {
  const label = TICKET_TYPES.find(([v]) => v === value)?.[1] ?? value ?? '—'
  if (value === 'AUTRE' && extra) return `${label} (${extra})`
  return label
}

const TRANSITIONS: Record<string, string[]> = {
  OUVERT: ['EN_COURS', 'EN_ATTENTE', 'ANNULE'],
  EN_COURS: ['EN_ATTENTE', 'RESOLU', 'ANNULE'],
  EN_ATTENTE: ['EN_COURS', 'ANNULE'],
  RESOLU: ['CLOTURE', 'EN_COURS'],
  CLOTURE: [],
  ANNULE: [],
}

function FieldLabel({ children }: { children: string }) {
  return <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ma-muted">{children}</span>
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-0">
      <FieldLabel>{label}</FieldLabel>
      {children}
    </label>
  )
}

function prettyCategory(value: string | undefined) {
  return INCIDENT_CATEGORIES.find(([v]) => v === value)?.[1] ?? value?.replaceAll('_', ' ') ?? '—'
}

function agentName(ticket: Ticket) {
  const a = ticket.attributaire ?? ticket.demandeur
  if (!a) return null
  return [a.prenom, a.nom].filter(Boolean).join(' ') || a.emailPro || null
}

function fieldClass(invalid?: boolean) {
  return cn(
    'w-full rounded-xl border bg-white px-3 py-2 text-sm text-ma-navy-950 dark:bg-ma-navy-900 dark:text-ma-white',
    invalid ? 'border-status-danger' : 'border-ma-line dark:border-ma-navy-700',
  )
}

export function TicketsPage() {
  const { t } = useTranslation()
  return (
    <TicketsWorkspace
      permission="VIEW_TICKETS"
      managePermission="MANAGE_TICKETS"
      kicker={t('pages.tickets.kicker')}
      title={t('pages.tickets.title')}
      subtitle={t('pages.tickets.subtitle')}
    />
  )
}

export function TechTicketsPage() {
  const { t } = useTranslation()
  return (
    <TicketsWorkspace
      permission="MANAGE_BUG_TICKETS"
      managePermission="MANAGE_BUG_TICKETS"
      defaultType="ANOMALIE_TECHNIQUE"
      kicker={t('pages.bugs.kicker')}
      title={t('pages.bugs.title')}
      subtitle={t('pages.bugs.subtitle')}
    />
  )
}

function TicketsWorkspace({
  permission,
  managePermission,
  defaultType,
  kicker,
  title,
  subtitle,
}: {
  permission: 'VIEW_TICKETS' | 'MANAGE_BUG_TICKETS'
  managePermission: 'MANAGE_TICKETS' | 'MANAGE_BUG_TICKETS'
  defaultType?: string
  kicker: string
  title: string
  subtitle: string
}) {
  const { t } = useTranslation()
  const currentProject = useProjectStore((s) => s.currentProject)
  const roles = useAuthStore((s) => s.roles)
  const permissionOverrides = useAuthStore((s) => s.permissionOverrides)
  const accessToken = useAuthStore((s) => s.accessToken)
  const projectCode = currentProject === 'ENTREPRISE' ? undefined : currentProject
  const [statut, setStatut] = useState('')
  const [type, setType] = useState(defaultType ?? '')
  const [categorie, setCategorie] = useState('')
  const [priorite, setPriorite] = useState('')
  const [departementId, setDepartementId] = useState('')
  const [agentId, setAgentId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<Ticket | null>(null)
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [deleting, setDeleting] = useState<Ticket | null>(null)
  const [menuFor, setMenuFor] = useState<number | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const canManage = hasPermission(roles, managePermission, projectCode, permissionOverrides)
  const canDelete = hasFullAccess(roles)

  const tickets = useQuery({
    queryKey: ['tickets', projectCode, defaultType],
    queryFn: () => listTickets({ projectCode, type: defaultType }),
    enabled: Boolean(accessToken),
  })
  const agents = useQuery({ queryKey: ['ticket-agents'], queryFn: listTicketAgents, enabled: Boolean(accessToken) })
  const deptOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const a of agents.data ?? []) {
      if (a.departementId) map.set(a.departementId, a.departementNom ?? `Département ${a.departementId}`)
    }
    return [...map.entries()].map(([id, nom]) => ({ id, nom }))
  }, [agents.data])

  const rows = useMemo(() => {
    const all = tickets.data ?? []
    return all.filter((t) => {
      if (statut && t.statut !== statut) return false
      if (type && t.type !== type) return false
      if (categorie && t.categorie !== categorie) return false
      if (priorite && t.priorite !== priorite) return false
      if (departementId && String(t.departementDestinataire?.id ?? '') !== departementId) return false
      if (agentId && String(t.attributaire?.id ?? t.demandeur?.id ?? '') !== agentId) return false
      if (from && (t.createdAt ?? '') < from) return false
      if (to && (t.createdAt ?? '') > `${to}T23:59:59`) return false
      return true
    })
  }, [tickets.data, statut, type, categorie, priorite, departementId, agentId, from, to])

  const stats = useMemo(() => {
    const all = tickets.data ?? []
    return {
      total: all.length,
      open: all.filter((t) => t.statut === 'OUVERT').length,
      progress: all.filter((t) => t.statut === 'EN_COURS' || t.statut === 'EN_ATTENTE').length,
      done: all.filter((t) => t.statut === 'RESOLU' || t.statut === 'CLOTURE').length,
    }
  }, [tickets.data])

  return (
    <RequirePermission permission={permission}>
      <div className="space-y-5">
        <PageHeader
          kicker={kicker}
          title={title}
          subtitle={subtitle}
          actions={
            <>
              <Button variant="outline" onClick={() => void exportTickets(projectCode)}>
                <Download size={15} />
                {t('adminUi.export')}
              </Button>
              <RequirePermission permission={managePermission} fallback={null}>
                <Button onClick={() => setOpen(true)}>
                  <Plus size={15} />
                  {t('adminUi.newTicket')}
                </Button>
              </RequirePermission>
            </>
          }
        />

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('adminUi.total')} value={stats.total} hint={t('common.allStatuses')} accent="gold" />
          <StatCard label={t('adminUi.open')} value={stats.open} hint={t('adminUi.toHandle')} accent="info" />
          <StatCard label={t('adminUi.inProgress')} value={stats.progress} hint={t('adminUi.waitingIncluded')} accent="warn" />
          <StatCard label={t('adminUi.resolved')} value={stats.done} hint={t('adminUi.closedIncluded')} accent="ok" />
        </div>

        <div
          className="flex gap-1 overflow-x-auto rounded-2xl border border-ma-line bg-white/80 p-1 transition duration-200 dark:border-white/10 dark:bg-ma-navy-800/60"
          role="tablist"
          aria-label={t('adminUi.filterByStatus')}
        >
          {STATUS_FILTERS.map((f) => {
            const active = statut === f.value
            return (
              <button
                key={f.value || 'all'}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setStatut(f.value)}
                className={cn(
                  'relative shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium text-ma-muted transition duration-200',
                  'hover:text-ma-navy-900 dark:text-ma-gray-300 dark:hover:text-ma-white',
                )}
              >
                {active && (
                  <span className="absolute inset-0 rounded-xl bg-ma-navy-900 transition duration-200 dark:bg-ma-gold-500/20" />
                )}
                <span className={cn('relative z-10', active && 'text-white dark:text-ma-gold-400')}>
                  {f.value === ''
                    ? t('ticketsUi.status.all')
                    : f.value === 'OUVERT'
                      ? t('adminUi.open')
                      : f.value === 'EN_COURS'
                        ? t('adminUi.inProgress')
                        : f.value === 'EN_ATTENTE'
                          ? t('ticketsUi.status.waiting')
                          : f.value === 'RESOLU'
                            ? t('adminUi.resolved')
                            : f.value === 'CLOTURE'
                              ? t('ticketsUi.status.closed')
                              : t('ticketsUi.status.cancelled')}
                </span>
              </button>
            )
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <select className={fieldClass()} value={type} onChange={(e) => { setType(e.target.value); if (e.target.value !== 'INCIDENT') setCategorie('') }}>
            <option value="">{t('adminUi.allTypes')}</option>
            {TICKET_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className={fieldClass()} value={priorite} onChange={(e) => setPriorite(e.target.value)}>
            <option value="">{t('adminUi.allPriorities')}</option>
            {PRIORITES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <select className={fieldClass()} value={departementId} onChange={(e) => setDepartementId(e.target.value)}>
            <option value="">{t('common.allDepartments')}</option>
            {(deptOptions).map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
          <select className={fieldClass()} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            <option value="">{t('adminUi.allAgents')}</option>
            {(agents.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.prenom} {a.nom}
              </option>
            ))}
          </select>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Période du" />
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} aria-label="Période au" />
        </div>

        {type === 'INCIDENT' && (
          <div className="flex gap-1 overflow-x-auto rounded-2xl border border-ma-line bg-white/80 p-1 dark:border-white/10 dark:bg-ma-navy-800/60" role="tablist" aria-label="Catégorie d’incident">
            <button
              type="button"
              role="tab"
              aria-selected={categorie === ''}
              onClick={() => setCategorie('')}
              className="relative shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium text-ma-muted"
            >
              {categorie === '' && <span className="absolute inset-0 rounded-xl bg-ma-navy-900 dark:bg-ma-gold-500/20" />}
              <span className={cn('relative z-10', categorie === '' && 'text-white dark:text-ma-gold-400')}>{t('adminUi.allCategories')}</span>
            </button>
            {INCIDENT_CATEGORIES.map(([value, label]) => {
              const active = categorie === value
              return (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setCategorie(value)}
                  className="relative shrink-0 rounded-xl px-3 py-1.5 text-sm font-medium text-ma-muted"
                >
                  {active && <span className="absolute inset-0 rounded-xl bg-ma-navy-900 dark:bg-ma-gold-500/20" />}
                  <span className={cn('relative z-10', active && 'text-white dark:text-ma-gold-400')}>{label}</span>
                </button>
              )
            })}
          </div>
        )}

        <Card>
          <CardBody className="overflow-x-auto p-0">
            {tickets.isLoading && <TableSkeleton />}
            {!tickets.isLoading && (
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted dark:text-ma-gray-300">
                  <tr>
                    <th className="px-4 py-3 font-medium">{t('adminUi.reference')}</th>
                    <th className="px-4 py-3 font-medium">{t('common.title')}</th>
                    <th className="px-4 py-3 font-medium">{t('adminUi.type')}</th>
                    <th className="px-4 py-3 font-medium">{t('adminUi.priority')}</th>
                    <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                    <th className="px-4 py-3 font-medium">SLA</th>
                    <th className="px-4 py-3 font-medium">{t('adminUi.agent')}</th>
                    <th className="px-4 py-3 font-medium">{t('common.project')}</th>
                    <th className="px-4 py-3 font-medium">{t('common.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((ticket, i) => {
                    const overdue = ticket.sla?.echeanceDepassee || ticket.sla?.depassement
                    return (
                      <tr
                        key={ticket.id}
                        className={cn(
                          'ma-enter border-t border-ma-line/80 transition duration-200 hover:-translate-y-px hover:bg-ma-navy-950/[0.04] hover:shadow-sm dark:border-white/8 dark:hover:bg-white/4',
                          i % 2 === 1 && 'bg-ma-navy-950/[0.018] dark:bg-white/[0.02]',
                          overdue && 'border-l-4 border-l-status-danger',
                        )}
                        style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
                      >
                        <td className="px-4 py-3">
                          <Link className="font-mono text-[13px] text-ma-gold-600 hover:underline dark:text-ma-gold-400" to={`/tickets/${ticket.id}`}>
                            {ticket.reference}
                          </Link>
                        </td>
                        <td className="px-4 py-3 font-medium">{ticket.titre}</td>
                        <td className="px-4 py-3">
                          <Badge tone="gold">{prettyType(ticket.type, ticket.typeAutrePrecision)}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="ma-enter inline-block" style={{ animationDelay: `${Math.min(i, 12) * 40 + 40}ms` }}>
                            <Badge tone={prioriteTone(ticket.priorite)}>{prettyPriority(ticket.priorite)}</Badge>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="ma-enter inline-block" style={{ animationDelay: `${Math.min(i, 12) * 40 + 80}ms` }}>
                            <Badge tone={statutTone(ticket.statut)}>{prettyStatus(ticket.statut)}</Badge>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={overdue ? 'danger' : ticket.sla?.respecte ? 'success' : 'warning'}>
                            {overdue ? 'Dépassé' : ticket.sla?.respecte ? 'Respecté' : `${ticket.sla?.engagementHeures ?? '—'} h`}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-2">
                            <Avatar
                              name={agentName(ticket)}
                              agentId={(ticket.attributaire ?? ticket.demandeur)?.id}
                              hasPhoto={(ticket.attributaire ?? ticket.demandeur)?.hasPhoto}
                            />
                            <span className="max-w-[9rem] truncate text-ma-muted dark:text-ma-gray-300">{agentName(ticket) ?? '—'}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-ma-muted dark:text-ma-gray-300">{ticket.project?.code ?? '—'}</td>
                        <td className="px-4 py-3">
                          <TicketActions
                            canManage={canManage}
                            canDelete={canDelete}
                            menuOpen={menuFor === ticket.id}
                            onMenu={() => setMenuFor(menuFor === ticket.id ? null : ticket.id)}
                            onView={() => { setMenuFor(null); setViewing(ticket) }}
                            onEdit={() => { setMenuFor(null); setEditing(ticket) }}
                            onDelete={() => { setMenuFor(null); setDeleting(ticket) }}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            {tickets.isError && (
              <div className="p-4">
                <Feedback tone="danger">
                  {tickets.error instanceof ApiError
                    ? tickets.error.message
                    : 'Impossible de charger les tickets. Réessayez.'}
                </Feedback>
              </div>
            )}
            {!tickets.isLoading && !tickets.isError && rows.length === 0 && (
              <div className="flex flex-col items-center gap-3 px-6 py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-ma-navy-900 text-ma-gold-400">
                  <Inbox size={28} />
                </div>
                <p className="font-display text-lg text-ma-navy-900 dark:text-ma-gold-400">Aucune donnée pour ce contexte</p>
                <p className="max-w-sm text-sm text-ma-muted dark:text-ma-gray-300">
                  Aucun ticket pour ce filtre ou ce projet. Changez le sélecteur en haut à gauche, ou ouvrez une demande.
                </p>
                <Button onClick={() => setOpen(true)}>
                  <Plus size={15} />
                  Créer un ticket
                </Button>
              </div>
            )}
          </CardBody>
        </Card>
        <CreateTicketDialog
          open={open}
          defaultType={defaultType ?? 'DEMANDE_TRAVAIL'}
          defaultProject={projectCode ?? visibleProjectCodes(roles).find((c) => c !== '*') ?? ''}
          onClose={() => setOpen(false)}
          onSaved={(reference) => {
            setOpen(false)
            setNotice(`Ticket enregistré : ${reference}.`)
            void queryClient.invalidateQueries({ queryKey: ['tickets'] })
          }}
        />
        <CreateTicketDialog
          open={Boolean(editing)}
          ticket={editing ?? undefined}
          canReopen={canDelete}
          defaultType={editing?.type ?? defaultType ?? 'DEMANDE_TRAVAIL'}
          defaultProject={editing?.project?.code ?? projectCode ?? visibleProjectCodes(roles).find((c) => c !== '*') ?? ''}
          onClose={() => setEditing(null)}
          onSaved={(reference) => {
            setEditing(null)
            setNotice(`Ticket mis à jour : ${reference}.`)
            void queryClient.invalidateQueries({ queryKey: ['tickets'] })
          }}
        />
        <TicketViewModal
          ticketId={viewing?.id ?? null}
          onClose={() => setViewing(null)}
        />
        <Modal
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          title="Retirer le ticket"
          footer={(
            <>
              <Button variant="outline" onClick={() => setDeleting(null)}>Annuler</Button>
              <Button
                className="bg-status-danger text-white hover:bg-status-danger/90"
                disabled={!deleting}
                onClick={() => {
                  if (!deleting) return
                  void archiveTicket(deleting.id, `Retrait du ticket ${deleting.reference}`).then(
                    () => {
                      setNotice(`Ticket ${deleting.reference} retiré de la file.`)
                      setDeleting(null)
                      void queryClient.invalidateQueries({ queryKey: ['tickets'] })
                    },
                    (err) => setNotice(err instanceof ApiError ? err.message : 'Retrait impossible.'),
                  )
                }}
              >
                Confirmer la suppression
              </Button>
            </>
          )}
        >
          <p className="text-sm">
            Voulez-vous vraiment supprimer le ticket {deleting?.reference} ? Cette action est irréversible.
          </p>
          <p className="mt-2 text-xs text-ma-muted">L’historique est conservé (aucune suppression physique en base).</p>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}

function valuesFromTicket(ticket: Ticket | undefined, defaultType: string, defaultProject: string): TicketForm {
  return {
    titre: ticket?.titre ?? '',
    type: ticket?.type ?? defaultType,
    categorie: ticket?.categorie ?? '',
    priorite: ticket?.priorite ?? 'NORMALE',
    projectCode: ticket?.project?.code ?? defaultProject,
    departementDestinataireId: ticket?.departementDestinataire?.id ? String(ticket.departementDestinataire.id) : '',
    echeance: ticket?.echeance ? ticket.echeance.slice(0, 10) : new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    description: ticket?.description ?? '',
    objetLieType: ticket?.objetLieType ?? '',
    objetLieId: ticket?.objetLieId ?? '',
    objetLieLibelle: ticket?.objetLieLibelle ?? '',
    typeAutrePrecision: ticket?.typeAutrePrecision ?? '',
    statut: ticket?.statut ?? 'OUVERT',
  }
}

function CreateTicketDialog({
  open,
  ticket,
  canReopen,
  defaultType,
  defaultProject,
  onClose,
  onSaved,
}: {
  open: boolean
  ticket?: Ticket
  canReopen?: boolean
  defaultType: string
  defaultProject: string
  onClose: () => void
  onSaved: (reference: string) => void
}) {
  const agents = useQuery({ queryKey: ['ticket-agents'], queryFn: listTicketAgents, enabled: open })
  const deptOptions = useMemo(() => {
    const map = new Map<number, string>()
    for (const a of agents.data ?? []) {
      if (a.departementId) map.set(a.departementId, a.departementNom ?? `Département ${a.departementId}`)
    }
    return [...map.entries()].map(([id, nom]) => ({ id, nom }))
  }, [agents.data])
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects, enabled: open })
  const [file, setFile] = useState<File | null>(null)
  const [transitionError, setTransitionError] = useState<string | null>(null)
  const form = useForm<TicketForm>({
    resolver: zodResolver(ticketSchema),
    defaultValues: valuesFromTicket(ticket, defaultType, defaultProject),
  })
  const selectedType = form.watch('type')
  const errors = form.formState.errors
  const locked = Boolean(ticket && (ticket.statut === 'CLOTURE' || ticket.statut === 'ANNULE') && !canReopen)
  const fieldsLocked = Boolean(ticket && (ticket.statut === 'CLOTURE' || ticket.statut === 'ANNULE'))

  useEffect(() => {
    if (!open) return
    form.reset(valuesFromTicket(ticket, defaultType, defaultProject))
    setFile(null)
    setTransitionError(null)
  }, [open, ticket, defaultType, defaultProject, form])

  const mutation = useMutation({
    mutationFn: async (values: TicketForm) => {
      setTransitionError(null)
      const payload = {
        projectCode: values.projectCode,
        type: values.type,
        categorie: values.type === 'INCIDENT' ? values.categorie : undefined,
        priorite: values.priorite,
        titre: values.titre,
        description: values.description,
        departementDestinataireId: Number(values.departementDestinataireId),
        echeance: `${values.echeance}T12:00:00.000Z`,
        objetLieType: values.objetLieType || undefined,
        objetLieId: values.objetLieId || undefined,
        objetLieLibelle: values.objetLieLibelle || undefined,
        typeAutrePrecision: values.type === 'AUTRE' ? values.typeAutrePrecision : undefined,
      }
      if (!ticket) {
        const created = await createTicket(payload)
        if (file) await attachTicketFile(created.id, file)
        return created
      }
      if (values.statut && values.statut !== ticket.statut) {
        const allowed = ticket.statut === 'CLOTURE' || ticket.statut === 'ANNULE'
          ? canReopen && (values.statut === 'OUVERT' || values.statut === 'EN_COURS')
          : (TRANSITIONS[ticket.statut] ?? []).includes(values.statut)
        if (!allowed) {
          throw new ApiError(`Transition interdite : ${prettyStatus(ticket.statut)} → ${prettyStatus(values.statut)}`, 400)
        }
        await changeTicketStatus(ticket.id, values.statut, values.statut === 'ANNULE' ? 'Modification depuis le formulaire' : undefined)
      }
      const updated = await updateTicket(ticket.id, payload)
      if (file) await attachTicketFile(updated.id, file)
      return updated
    },
    onSuccess: (row) => onSaved(row.reference),
    onError: (err) => {
      setTransitionError(err instanceof ApiError ? err.message : 'Enregistrement impossible.')
    },
  })

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={ticket ? `Modifier ${ticket.reference}` : 'Nouveau ticket'}
      size="lg"
      footer={(
        <>
          <Button type="button" variant="outline" onClick={onClose}>Fermer</Button>
          <Button type="submit" form="ma-ticket-form" disabled={mutation.isPending || (fieldsLocked && !canReopen)}>
            {mutation.isPending ? 'Enregistrement…' : 'Enregistrer'}
          </Button>
        </>
      )}
    >
      <form id="ma-ticket-form" className="space-y-4" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        <Field label="Titre">
          <Input disabled={fieldsLocked} className={errors.titre ? 'border-status-danger' : ''} placeholder="Titre" {...form.register('titre')} />
        </Field>
        {errors.titre && <p className="text-sm text-status-danger">{errors.titre.message}</p>}

        <Field label="Type">
          <select disabled={fieldsLocked} className={fieldClass(Boolean(errors.type))} {...form.register('type')}>
            {TICKET_TYPES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        {errors.type && <p className="text-sm text-status-danger">{errors.type.message}</p>}

        <div className={cn('ma-reveal', selectedType === 'AUTRE' && 'ma-reveal-open')}>
          <div className="ma-reveal-inner">
            <Field label="Précisez le type">
              <Input
                disabled={fieldsLocked}
                className={errors.typeAutrePrecision ? 'border-status-danger' : ''}
                placeholder="Ex : audit interne, formation, événement..."
                {...form.register('typeAutrePrecision')}
              />
            </Field>
            {errors.typeAutrePrecision && <p className="mt-1 text-sm text-status-danger">{errors.typeAutrePrecision.message}</p>}
          </div>
        </div>

        <div className={cn('ma-reveal', selectedType === 'INCIDENT' && 'ma-reveal-open')}>
          <div className="ma-reveal-inner">
            <Field label="Catégorie d’incident">
              <select disabled={fieldsLocked} className={fieldClass(Boolean(errors.categorie))} {...form.register('categorie')}>
                <option value="">Catégorie d’incident</option>
                {INCIDENT_CATEGORIES.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </Field>
            {errors.categorie && <p className="mt-1 text-sm text-status-danger">{errors.categorie.message}</p>}
          </div>
        </div>

        {ticket && (
          <Field label="Statut">
            <select disabled={locked} className={fieldClass()} {...form.register('statut')}>
              <option value={ticket.statut}>{prettyStatus(ticket.statut)}</option>
              {(TRANSITIONS[ticket.statut] ?? []).map((s) => (
                <option key={s} value={s}>
                  {prettyStatus(s)}
                </option>
              ))}
              {canReopen && (ticket.statut === 'CLOTURE' || ticket.statut === 'ANNULE') && (
                <>
                  <option value="OUVERT">Rouvrir — Ouvert</option>
                  <option value="EN_COURS">Rouvrir — En cours</option>
                </>
              )}
            </select>
          </Field>
        )}

        <Field label="Priorité">
          <select disabled={fieldsLocked} className={fieldClass(Boolean(errors.priorite))} {...form.register('priorite')}>
            {PRIORITES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Projet">
          <select disabled={fieldsLocked} className={fieldClass(Boolean(errors.projectCode))} {...form.register('projectCode')}>
            {(projects.data ?? []).map((p) => (
              <option key={p.code} value={p.code}>
                {p.code} — {p.nom ?? p.code}
              </option>
            ))}
            {(projects.data ?? []).length === 0 && <option value={defaultProject}>{defaultProject}</option>}
          </select>
        </Field>
        {errors.projectCode && <p className="text-sm text-status-danger">{errors.projectCode.message}</p>}

        <Field label="Département destinataire">
          <select disabled={fieldsLocked} className={fieldClass(Boolean(errors.departementDestinataireId))} {...form.register('departementDestinataireId')}>
            <option value="">Département destinataire</option>
            {deptOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nom}
              </option>
            ))}
          </select>
        </Field>
        {errors.departementDestinataireId && (
          <p className="text-sm text-status-danger">{errors.departementDestinataireId.message}</p>
        )}

        <Field label="Échéance souhaitée">
          <Input disabled={fieldsLocked} type="date" className={errors.echeance ? 'border-status-danger' : ''} {...form.register('echeance')} />
        </Field>
        {errors.echeance && <p className="text-sm text-status-danger">{errors.echeance.message}</p>}

        <Field label="Description">
          <textarea disabled={fieldsLocked} className={fieldClass(Boolean(errors.description))} rows={4} placeholder="Description" {...form.register('description')} />
        </Field>
        {errors.description && <p className="text-sm text-status-danger">{errors.description.message}</p>}

        <Field label="Objet lié">
          <select disabled={fieldsLocked} className={fieldClass()} {...form.register('objetLieType')}>
            {OBJET_LIES.map(([v, l]) => (
              <option key={v || 'none'} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Identifiant lié">
          <Input disabled={fieldsLocked} placeholder="Identifiant de l’objet lié (optionnel)" {...form.register('objetLieId')} />
        </Field>
        <Field label="Libellé lié">
          <Input disabled={fieldsLocked} placeholder="Libellé de l’objet lié (optionnel)" {...form.register('objetLieLibelle')} />
        </Field>

        <Field label="Pièce jointe">
          <input disabled={fieldsLocked} type="file" className="w-full text-sm" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </Field>

        {fieldsLocked && (
          <Feedback tone="warning">
            Ticket {prettyStatus(ticket?.statut ?? '')}. Les champs sont figés
            {canReopen ? ', sauf réouverture du statut par un responsable.' : '.'}
          </Feedback>
        )}
        {(mutation.isError || transitionError) && (
          <Feedback tone="danger">
            {transitionError ??
              (mutation.error instanceof ApiError ? mutation.error.message : 'La création du ticket a échoué.')}
          </Feedback>
        )}
      </form>
    </Modal>
  )
}

function TicketActions({
  canManage,
  canDelete,
  menuOpen,
  onMenu,
  onView,
  onEdit,
  onDelete,
}: {
  canManage: boolean
  canDelete: boolean
  menuOpen: boolean
  onMenu: () => void
  onView: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  const iconBtn =
    'rounded-lg p-1.5 text-slate-400 transition duration-150 hover:-translate-y-px focus:outline-none focus-visible:ring-2 focus-visible:ring-ma-gold-400/40'
  return (
    <div className="relative flex items-center justify-end gap-0.5">
      <div className="hidden items-center gap-0.5 sm:flex">
        <button type="button" title="Voir" aria-label="Voir" className={cn(iconBtn, 'hover:text-sky-600')} onClick={onView}>
          <Eye size={16} />
        </button>
        {canManage && (
          <button type="button" title="Modifier" aria-label="Modifier" className={cn(iconBtn, 'hover:text-ma-gold-600')} onClick={onEdit}>
            <Pencil size={16} />
          </button>
        )}
        {canDelete ? (
          <button type="button" title="Supprimer" aria-label="Supprimer" className={cn(iconBtn, 'hover:text-status-danger')} onClick={onDelete}>
            <Trash2 size={16} />
          </button>
        ) : (
          <button type="button" title="Suppression réservée aux responsables" aria-label="Supprimer indisponible" disabled className="rounded-lg p-1.5 text-slate-300">
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <button type="button" title="Actions" aria-label="Actions" className={cn(iconBtn, 'sm:hidden hover:text-ma-navy-900')} onClick={onMenu}>
        <MoreHorizontal size={16} />
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-8 z-20 min-w-[9rem] rounded-xl border border-ma-line bg-white py-1 text-sm shadow-lg dark:border-white/10 dark:bg-ma-navy-800 sm:hidden">
          <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/5" onClick={onView}>
            Voir
          </button>
          {canManage && (
            <button type="button" className="block w-full px-3 py-1.5 text-left hover:bg-slate-50 dark:hover:bg-white/5" onClick={onEdit}>
              Modifier
            </button>
          )}
          {canDelete && (
            <button type="button" className="block w-full px-3 py-1.5 text-left text-status-danger hover:bg-slate-50 dark:hover:bg-white/5" onClick={onDelete}>
              Supprimer
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function TicketViewModal({ ticketId, onClose }: { ticketId: number | null; onClose: () => void }) {
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId!),
    enabled: ticketId != null,
  })
  const t = ticket.data
  return (
    <Modal open={ticketId != null} onClose={onClose} title={t?.reference ?? 'Ticket'} size="xl">
      {ticket.isLoading && <p className="text-sm text-ma-muted">Chargement…</p>}
      {t && (
        <div className="space-y-8 text-sm">
          <section>
            <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ma-muted">État actuel</p>
            <div className="flex flex-wrap gap-2">
              <Badge tone="gold">{prettyType(t.type, t.typeAutrePrecision)}</Badge>
              <Badge tone={prioriteTone(t.priorite)}>{prettyPriority(t.priorite)}</Badge>
              <Badge tone={statutTone(t.statut)}>{prettyStatus(t.statut)}</Badge>
            </div>
            <h3 className="mt-3 font-display text-lg text-ma-navy-900 dark:text-ma-gold-400">{t.titre}</h3>
            <p className="mt-2 text-ma-navy-800 dark:text-ma-gray-200">{t.description || 'Sans description.'}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <p>Agent : {agentName(t) ?? '—'}</p>
              <p>Projet : {t.project?.code ?? '—'}</p>
              <p>Département : {t.departementDestinataire?.nom ?? '—'}</p>
              <p>Échéance : {t.echeance ? new Date(t.echeance).toLocaleString() : '—'}</p>
            </div>
          </section>
          <TicketLifecycle ticket={t} />
          <TicketComments ticket={t} />
        </div>
      )}
    </Modal>
  )
}

function TicketComments({ ticket }: { ticket: Ticket }) {
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const locked = ticket.statut === 'CLOTURE' || ticket.statut === 'ANNULE'
  const comments = ticket.commentaires ?? []
  const commenter = useMutation({
    mutationFn: () => commentTicket(ticket.id, draft.trim()),
    onSuccess: () => {
      setDraft('')
      void queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] })
    },
  })
  return (
    <section>
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-ma-muted">Commentaires</p>
      {comments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center text-ma-muted">
          <MessageCircle className="h-7 w-7 opacity-40" />
          <p className="text-sm font-light">Aucun commentaire.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => {
            const name = c.auteur ? `${c.auteur.prenom ?? ''} ${c.auteur.nom ?? ''}`.trim() || 'Agent' : 'Agent'
            return (
              <li key={c.id} className="flex gap-3">
                <Avatar name={name} agentId={c.auteur?.id} hasPhoto={c.auteur?.hasPhoto} />
                <div className="min-w-0 flex-1 rounded-2xl border border-ma-line bg-slate-50/80 px-3 py-2 dark:border-white/10 dark:bg-white/5">
                  <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-sm font-medium">{name}</span>
                    <span className="text-[11px] text-ma-muted">
                      {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
                    </span>
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-ma-navy-800 dark:text-ma-gray-200">{c.contenu}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {!locked && (
        <div className="mt-4 flex items-end gap-2">
          <textarea
            className="min-h-[4.5rem] flex-1 rounded-xl border border-ma-line bg-white px-3 py-2 text-sm text-ma-navy-950 dark:border-white/10 dark:bg-ma-navy-900 dark:text-ma-white"
            rows={2}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ajouter un commentaire…"
          />
          <Button
            className="shrink-0"
            disabled={!draft.trim() || commenter.isPending}
            onClick={() => commenter.mutate()}
          >
            <Send className="h-4 w-4" />
            Envoyer
          </Button>
        </div>
      )}
    </section>
  )
}

