import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleDot,
  Download,
  Eye,
  Inbox,
  Paperclip,
  Pencil,
  Plus,
  RotateCcw,
  SearchX,
  Ticket as TicketIcon,
  Timer,
  Trash2,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Input, Select, Textarea } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { Skeleton } from '../../components/ui/skeleton'
import { StatCard } from '../../components/ui/stat-card'
import { CellStack, IconAction, Mono, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { DateField, DetailList, FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
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
import {
  CommentComposer,
  CommentThread,
  fmtDate,
  INCIDENT_CATEGORIES,
  isOverdue,
  OBJET_LIES,
  Person,
  PRIORITES,
  PriorityBadge,
  prettyCategory,
  prettyStatus,
  prettyType,
  prioAccent,
  StatusBadge,
  TICKET_TYPES,
  TRANSITIONS,
} from './ticket-ui'


const STATUS_FILTERS = ['', 'OUVERT', 'EN_COURS', 'EN_ATTENTE', 'RESOLU', 'CLOTURE', 'ANNULE'] as const

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

/** Champ de formulaire : libellé, contrôle, message d'erreur. */
function Field({ label, error, hint, children, className }: { label: string; error?: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn('block min-w-0', className)}>
      <FieldLabel hint={hint}>{label}</FieldLabel>
      {children}
      {error && <span className="ma-fact-in mt-1.5 block text-[12.5px] text-status-danger">{error}</span>}
    </label>
  )
}

/** Sur téléphone, les filtres se répartissent deux par ligne. */
const grow = 'min-w-0 flex-1 basis-[8.5rem] sm:flex-none sm:basis-auto'

const dateGrow = 'min-w-0 flex-1 basis-full sm:flex-none sm:basis-auto [&_input]:flex-1'

function agentOf(ticket: Ticket) {
  return ticket.attributaire ?? ticket.demandeur
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
  const navigate = useNavigate()
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
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const [viewing, setViewing] = useState<Ticket | null>(null)
  const [editing, setEditing] = useState<Ticket | null>(null)
  const [deleting, setDeleting] = useState<Ticket | null>(null)
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

  // Tous les filtres sauf le statut : sert aussi aux compteurs des onglets.
  const filtered = useMemo(() => {
    const all = tickets.data ?? []
    const q = search.trim().toLocaleLowerCase('fr')
    return all.filter((t) => {
      if (type && t.type !== type) return false
      if (categorie && t.categorie !== categorie) return false
      if (priorite && t.priorite !== priorite) return false
      if (departementId && String(t.departementDestinataire?.id ?? '') !== departementId) return false
      if (agentId && String(t.attributaire?.id ?? t.demandeur?.id ?? '') !== agentId) return false
      if (from && (t.createdAt ?? '') < from) return false
      if (to && (t.createdAt ?? '') > `${to}T23:59:59`) return false
      if (q) {
        const a = agentOf(t)
        const hay = `${t.reference} ${t.titre} ${a?.prenom ?? ''} ${a?.nom ?? ''}`.toLocaleLowerCase('fr')
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [tickets.data, type, categorie, priorite, departementId, agentId, from, to, search])

  const rows = useMemo(() => (statut ? filtered.filter((t) => t.statut === statut) : filtered), [filtered, statut])
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const visible = rows.slice((page - 1) * pageSize, page * pageSize)
  const filterKey = [statut, type, categorie, priorite, departementId, agentId, from, to, search, pageSize].join('|')

  useEffect(() => {
    setPage(1)
  }, [filterKey])

  const counts = useMemo(() => {
    const map: Record<string, number> = { '': filtered.length }
    for (const t of filtered) map[t.statut] = (map[t.statut] ?? 0) + 1
    return map
  }, [filtered])

  const stats = useMemo(() => {
    const all = tickets.data ?? []
    return {
      total: all.length,
      open: all.filter((t) => t.statut === 'OUVERT').length,
      progress: all.filter((t) => t.statut === 'EN_COURS' || t.statut === 'EN_ATTENTE').length,
      done: all.filter((t) => t.statut === 'RESOLU' || t.statut === 'CLOTURE').length,
    }
  }, [tickets.data])

  const statusLabel: Record<string, string> = {
    '': t('ticketsUi.status.all'),
    OUVERT: t('adminUi.open'),
    EN_COURS: t('adminUi.inProgress'),
    EN_ATTENTE: t('ticketsUi.status.waiting'),
    RESOLU: t('adminUi.resolved'),
    CLOTURE: t('ticketsUi.status.closed'),
    ANNULE: t('ticketsUi.status.cancelled'),
  }

  const filtersActive = Boolean((type && type !== (defaultType ?? '')) || categorie || priorite || departementId || agentId || from || to || search)
  function resetFilters() {
    setType(defaultType ?? '')
    setCategorie('')
    setPriorite('')
    setDepartementId('')
    setAgentId('')
    setFrom('')
    setTo('')
    setSearch('')
  }

  return (
    <RequirePermission permission={permission}>
      <div className="space-y-6">
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
                  <Plus size={16} strokeWidth={2.4} />
                  {t('adminUi.newTicket')}
                </Button>
              </RequirePermission>
            </>
          }
        />

        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StaggerItem>
            <StatCard label={t('adminUi.total')} value={stats.total} hint={t('common.allStatuses')} accent="gold" icon={<TicketIcon />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label={t('adminUi.open')} value={stats.open} hint={t('adminUi.toHandle')} accent="info" icon={<CircleDot />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label={t('adminUi.inProgress')} value={stats.progress} hint={t('adminUi.waitingIncluded')} accent="warn" icon={<Timer />} />
          </StaggerItem>
          <StaggerItem>
            <StatCard label={t('adminUi.resolved')} value={stats.done} hint={t('adminUi.closedIncluded')} accent="ok" icon={<CheckCircle2 />} />
          </StaggerItem>
        </Stagger>

        <TableCard
          loading={tickets.isLoading}
          toolbar={
            <div className="space-y-3">
              <Segmented
                ariaLabel={t('adminUi.filterByStatus')}
                value={statut}
                onChange={setStatut}
                className="w-full sm:w-auto"
                options={STATUS_FILTERS.map((value) => ({
                  value,
                  label: (
                    <>
                      {statusLabel[value]}
                      <span
                        className={cn(
                          'min-w-[1.25rem] rounded-full px-1.5 text-center text-[11px] font-semibold tabular-nums leading-[18px]',
                          statut === value ? 'bg-ma-gold-500/18 text-accent-ink' : 'bg-ink/[0.06] text-ink-3 dark:bg-white/[0.07]',
                        )}
                      >
                        {counts[value] ?? 0}
                      </span>
                    </>
                  ),
                }))}
              />
              <FilterBar>
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder={t('ticketsUi.list.search', 'Référence, titre ou agent')}
                  className="w-full sm:w-auto"
                />
                {!defaultType && (
                  <FilterSelect
                    className={grow}
                    active={Boolean(type)}
                    value={type}
                    aria-label={t('adminUi.type')}
                    onChange={(e) => {
                      setType(e.target.value)
                      if (e.target.value !== 'INCIDENT') setCategorie('')
                    }}
                  >
                    <option value="">{t('adminUi.allTypes')}</option>
                    {TICKET_TYPES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </FilterSelect>
                )}
                <FilterSelect className={grow} active={Boolean(priorite)} value={priorite} aria-label={t('adminUi.priority')} onChange={(e) => setPriorite(e.target.value)}>
                  <option value="">{t('adminUi.allPriorities')}</option>
                  {PRIORITES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect
                  className={grow}
                  active={Boolean(departementId)}
                  value={departementId}
                  aria-label={t('common.department')}
                  onChange={(e) => setDepartementId(e.target.value)}
                >
                  <option value="">{t('common.allDepartments')}</option>
                  {deptOptions.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.nom}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect className={grow} active={Boolean(agentId)} value={agentId} aria-label={t('adminUi.agent')} onChange={(e) => setAgentId(e.target.value)}>
                  <option value="">{t('adminUi.allAgents')}</option>
                  {(agents.data ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.prenom} {a.nom}
                    </option>
                  ))}
                </FilterSelect>
                <DateField className={dateGrow} label={t('ticketsUi.list.from', 'Du')} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Période du" />
                <DateField className={dateGrow} label={t('ticketsUi.list.to', 'Au')} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Période au" />
                {filtersActive && (
                  <Button variant="ghost" size="sm" onClick={resetFilters}>
                    <RotateCcw className="h-3.5 w-3.5" />
                    {t('ticketsUi.list.reset', 'Réinitialiser')}
                  </Button>
                )}
              </FilterBar>
              {type === 'INCIDENT' && (
                <div className="ma-fact-in flex flex-wrap items-center gap-2">
                  <span className="text-[12.5px] text-ink-3">{t('ticketsUi.list.incidentCategory', 'Catégorie d’incident')}</span>
                  <Segmented
                    size="sm"
                    ariaLabel="Catégorie d’incident"
                    value={categorie}
                    onChange={setCategorie}
                    options={[{ value: '', label: t('adminUi.allCategories') }, ...INCIDENT_CATEGORIES.map(([value, label]) => ({ value, label }))]}
                  />
                </div>
              )}
            </div>
          }
          empty={
            tickets.isError ? (
              <div className="p-3">
                <Feedback tone="danger">
                  {tickets.error instanceof ApiError ? tickets.error.message : 'Impossible de charger les tickets. Réessayez.'}
                </Feedback>
              </div>
            ) : rows.length === 0 ? (
              (tickets.data ?? []).length === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title={t('ticketsUi.list.emptyTitle', 'Aucun ticket pour ce contexte')}
                  hint={t('ticketsUi.list.emptyHint', 'Changez le sélecteur en haut à gauche, ou ouvrez une nouvelle demande.')}
                  action={
                    canManage ? (
                      <Button size="sm" onClick={() => setOpen(true)}>
                        <Plus className="h-3.5 w-3.5" strokeWidth={2.4} />
                        {t('ticketsUi.list.create', 'Créer un ticket')}
                      </Button>
                    ) : undefined
                  }
                />
              ) : (
                <EmptyState
                  icon={<SearchX />}
                  title={t('ticketsUi.list.noMatchTitle', 'Aucun ticket ne correspond')}
                  hint={t('ticketsUi.list.noMatchHint', 'Élargissez la recherche ou retirez un filtre.')}
                  action={
                    filtersActive || statut ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          resetFilters()
                          setStatut('')
                        }}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t('ticketsUi.list.reset', 'Réinitialiser')}
                      </Button>
                    ) : undefined
                  }
                />
              )
            ) : undefined
          }
          footer={
            !tickets.isLoading && rows.length > 0 ? (
              <Pagination
                page={page}
                pageCount={pageCount}
                total={rows.length}
                pageSize={pageSize}
                onPage={setPage}
                onPageSize={setPageSize}
                unit={t('ticketsUi.list.unit', 'tickets')}
              />
            ) : undefined
          }
        >
          <Table minWidth={960}>
            <THead>
              <tr>
                <Th>{t('ticketsUi.list.ticket', 'Ticket')}</Th>
                <Th>{t('adminUi.type')}</Th>
                <Th>{t('adminUi.priority')}</Th>
                <Th>{t('common.status')}</Th>
                <Th>{t('ticketsUi.list.dueSla', 'Échéance et SLA')}</Th>
                <Th>{t('adminUi.agent')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('common.actions')}</span>
                </Th>
              </tr>
            </THead>
            <TBody key={`${filterKey}|${page}`}>
              {visible.map((ticket, i) => {
                const overdue = isOverdue(ticket)
                const finished = ['RESOLU', 'CLOTURE', 'ANNULE'].includes(ticket.statut)
                const lateDue = !finished && ticket.echeance ? new Date(ticket.echeance).getTime() < Date.now() : false
                return (
                  <Tr
                    key={ticket.id}
                    accent={prioAccent(ticket.priorite)}
                    onClick={() => navigate(`/tickets/${ticket.id}`)}
                    className="ma-enter"
                    style={{ animationDelay: `${Math.min(i, 14) * 28}ms` }}
                  >
                    <Td className="max-w-[19rem]">
                      <CellStack
                        title={ticket.titre}
                        meta={
                          <>
                            <Mono className="text-[11.5px] text-ink-3">{ticket.reference}</Mono>
                            {ticket.project?.code && <span> · {ticket.project.code}</span>}
                            {ticket.departementDestinataire?.nom && <span> · {ticket.departementDestinataire.nom}</span>}
                          </>
                        }
                      />
                    </Td>
                    <Td>
                      <CellStack
                        className="max-w-[11rem] [&>div:first-child]:font-normal [&>div:first-child]:text-ink-2"
                        title={prettyType(ticket.type, ticket.typeAutrePrecision)}
                        meta={ticket.type === 'INCIDENT' && ticket.categorie ? prettyCategory(ticket.categorie) : undefined}
                      />
                    </Td>
                    <Td>
                      <PriorityBadge priorite={ticket.priorite} />
                    </Td>
                    <Td>
                      <StatusBadge statut={ticket.statut} />
                    </Td>
                    <Td className="whitespace-nowrap">
                      <div className={cn('text-[13px] tabular-nums', lateDue ? 'font-medium text-status-danger' : 'text-ink-2')}>{fmtDate(ticket.echeance)}</div>
                      <div className="mt-0.5">
                        <SlaCell ticket={ticket} overdue={Boolean(overdue)} />
                      </div>
                    </Td>
                    <Td className="max-w-[12rem] text-ink-2">
                      <Person person={agentOf(ticket)} />
                    </Td>
                    <Td align="right">
                      <RowActions>
                        <IconAction label="Aperçu" onClick={() => setViewing(ticket)}>
                          <Eye />
                        </IconAction>
                        {canManage && (
                          <IconAction label="Modifier" onClick={() => setEditing(ticket)}>
                            <Pencil />
                          </IconAction>
                        )}
                        <IconAction
                          label={canDelete ? 'Supprimer' : 'Suppression réservée aux responsables'}
                          tone="danger"
                          disabled={!canDelete}
                          onClick={() => setDeleting(ticket)}
                        >
                          <Trash2 />
                        </IconAction>
                      </RowActions>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        </TableCard>

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
        <TicketViewModal ticketId={viewing?.id ?? null} onClose={() => setViewing(null)} onOpenPage={(id) => navigate(`/tickets/${id}`)} />
        <Modal
          open={Boolean(deleting)}
          onClose={() => setDeleting(null)}
          kicker={deleting?.reference}
          title="Retirer le ticket"
          subtitle={deleting?.titre}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleting(null)}>
                Annuler
              </Button>
              <Button
                variant="danger"
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
                <Trash2 className="h-4 w-4" />
                Confirmer la suppression
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p className="text-[14px] leading-relaxed text-ink-2">
              Voulez-vous vraiment supprimer le ticket <Mono className="text-[13px] text-ink">{deleting?.reference}</Mono> ? Cette action est irréversible.
            </p>
            <p className="text-[12.5px] text-ink-3">L’historique est conservé (aucune suppression physique en base).</p>
          </div>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}

function SlaCell({ ticket, overdue }: { ticket: Ticket; overdue: boolean }) {
  if (overdue) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-status-danger">
        <AlertTriangle className="h-3 w-3" />
        SLA dépassé
      </span>
    )
  }
  if (ticket.sla?.respecte) {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] font-medium text-status-success">
        <CheckCircle2 className="h-3 w-3" />
        SLA respecté
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-[12px] tabular-nums text-ink-3">
      <Timer className="h-3 w-3" />
      SLA {ticket.sla?.engagementHeures ?? '–'} h
    </span>
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

function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 space-y-4">
      <legend className="mb-3 text-[13px] font-semibold tracking-[-0.01em] text-ink">{title}</legend>
      {children}
    </fieldset>
  )
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
  const { t } = useTranslation()
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
        const allowed =
          ticket.statut === 'CLOTURE' || ticket.statut === 'ANNULE'
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
      kicker={ticket ? ticket.reference : t('pages.tickets.kicker')}
      title={ticket ? t('ticketsUi.form.editTitle', 'Modifier le ticket') : t('adminUi.newTicket')}
      subtitle={ticket ? ticket.titre : t('ticketsUi.form.subtitle', 'Décrivez la demande : elle sera transmise au département choisi.')}
      size="lg"
      footer={
        <>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" form="ma-ticket-form" disabled={mutation.isPending || (fieldsLocked && !canReopen)}>
            {mutation.isPending ? t('common.saving') : ticket ? t('common.save') : t('ticketsUi.form.create', 'Créer le ticket')}
          </Button>
        </>
      }
    >
      <form id="ma-ticket-form" className="space-y-7 pb-1" onSubmit={form.handleSubmit((v) => mutation.mutate(v))}>
        {fieldsLocked && (
          <Feedback tone="warning">
            Ticket {prettyStatus(ticket?.statut ?? '').toLowerCase()}. Les champs sont figés
            {canReopen ? ', sauf réouverture du statut par un responsable.' : '.'}
          </Feedback>
        )}

        <FormSection title={t('ticketsUi.form.request', 'La demande')}>
          <Field label={t('common.title')} error={errors.titre?.message}>
            <Input
              disabled={fieldsLocked}
              aria-invalid={Boolean(errors.titre)}
              placeholder={t('ticketsUi.form.titlePlaceholder', 'Ex. Paiement Mobile Money non reçu')}
              {...form.register('titre')}
            />
          </Field>
          <div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t('adminUi.type')} error={errors.type?.message}>
                <Select disabled={fieldsLocked} aria-invalid={Boolean(errors.type)} {...form.register('type')}>
                  {TICKET_TYPES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('adminUi.priority')} error={errors.priorite?.message}>
                <Select disabled={fieldsLocked} aria-invalid={Boolean(errors.priorite)} {...form.register('priorite')}>
                  {PRIORITES.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <div className={cn('ma-reveal', selectedType === 'AUTRE' && 'ma-reveal-open')}>
              <div className="ma-reveal-inner -mx-1 px-1 pb-1 pt-4">
                <Field label="Précisez le type" error={errors.typeAutrePrecision?.message}>
                  <Input
                    disabled={fieldsLocked}
                    aria-invalid={Boolean(errors.typeAutrePrecision)}
                    placeholder="Ex. audit interne, formation, événement…"
                    {...form.register('typeAutrePrecision')}
                  />
                </Field>
              </div>
            </div>

            <div className={cn('ma-reveal', selectedType === 'INCIDENT' && 'ma-reveal-open')}>
              <div className="ma-reveal-inner -mx-1 px-1 pb-1 pt-4">
                <Field label="Catégorie d’incident" error={errors.categorie?.message}>
                  <Select disabled={fieldsLocked} aria-invalid={Boolean(errors.categorie)} {...form.register('categorie')}>
                    <option value="">{t('ticketsUi.form.chooseCategory', 'Choisir une catégorie')}</option>
                    {INCIDENT_CATEGORIES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
            </div>
          </div>

          <Field label={t('common.description')} error={errors.description?.message}>
            <Textarea
              disabled={fieldsLocked}
              aria-invalid={Boolean(errors.description)}
              rows={4}
              placeholder={t('ticketsUi.form.descriptionPlaceholder', 'Contexte, étapes, montant concerné, personnes à contacter…')}
              {...form.register('description')}
            />
          </Field>
        </FormSection>

        <FormSection title={t('ticketsUi.form.routing', 'Acheminement')}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t('common.project')} error={errors.projectCode?.message}>
              <Select disabled={fieldsLocked} aria-invalid={Boolean(errors.projectCode)} {...form.register('projectCode')}>
                {(projects.data ?? []).length > 0 && <option value="">{t('ticketsUi.form.chooseProject', 'Choisir un projet')}</option>}
                {(projects.data ?? []).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.nom ? `${p.nom} (${p.code})` : p.code}
                  </option>
                ))}
                {(projects.data ?? []).length === 0 && <option value={defaultProject}>{defaultProject}</option>}
              </Select>
            </Field>
            <Field label="Département destinataire" error={errors.departementDestinataireId?.message}>
              <Select disabled={fieldsLocked} aria-invalid={Boolean(errors.departementDestinataireId)} {...form.register('departementDestinataireId')}>
                <option value="">{t('ticketsUi.form.chooseDept', 'Choisir un département')}</option>
                {deptOptions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Échéance souhaitée" error={errors.echeance?.message}>
              <Input
                disabled={fieldsLocked}
                type="date"
                aria-invalid={Boolean(errors.echeance)}
                className="[color-scheme:light] dark:[color-scheme:dark]"
                {...form.register('echeance')}
              />
            </Field>
            {ticket && (
              <Field label={t('common.status')}>
                <Select disabled={locked} {...form.register('statut')}>
                  <option value={ticket.statut}>{prettyStatus(ticket.statut)}</option>
                  {(TRANSITIONS[ticket.statut] ?? []).map((s) => (
                    <option key={s} value={s}>
                      {prettyStatus(s)}
                    </option>
                  ))}
                  {canReopen && (ticket.statut === 'CLOTURE' || ticket.statut === 'ANNULE') && (
                    <>
                      <option value="OUVERT">Rouvrir : ouvert</option>
                      <option value="EN_COURS">Rouvrir : en cours</option>
                    </>
                  )}
                </Select>
              </Field>
            )}
          </div>
        </FormSection>

        <FormSection title={t('ticketsUi.form.context', 'Contexte (facultatif)')}>
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Field label="Objet lié">
              <Select disabled={fieldsLocked} {...form.register('objetLieType')}>
                {OBJET_LIES.map(([v, l]) => (
                  <option key={v || 'none'} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Identifiant lié">
              <Input disabled={fieldsLocked} placeholder="Ex. CRS-20931" {...form.register('objetLieId')} />
            </Field>
            <Field label="Libellé lié" className="sm:col-span-2">
              <Input disabled={fieldsLocked} placeholder="Libellé de l’objet lié" {...form.register('objetLieLibelle')} />
            </Field>
          </div>
          <div>
            <FieldLabel>{t('ticketsUi.form.attachment', 'Pièce jointe')}</FieldLabel>
            <FilePicker file={file} disabled={fieldsLocked} onChange={setFile} />
          </div>
        </FormSection>

        {(mutation.isError || transitionError) && (
          <Feedback tone="danger">
            {transitionError ?? (mutation.error instanceof ApiError ? mutation.error.message : 'La création du ticket a échoué.')}
          </Feedback>
        )}
      </form>
    </Modal>
  )
}

function FilePicker({ file, disabled, onChange }: { file: File | null; disabled?: boolean; onChange: (f: File | null) => void }) {
  const { t } = useTranslation()
  if (file) {
    return (
      <div className="ma-fact-in clay-field flex items-center gap-3 rounded-[13px] px-3.5 py-2.5">
        <Paperclip className="h-4 w-4 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-ink">{file.name}</span>
        <span className="shrink-0 text-[12px] tabular-nums text-ink-3">{Math.max(1, Math.round(file.size / 1024))} Ko</span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label={t('ticketsUi.form.removeFile', 'Retirer le fichier')}
          className="press flex h-6 w-6 items-center justify-center rounded-full bg-ink/[0.08] text-ink-2 hover:bg-ink/[0.14] dark:bg-white/[0.1]"
        >
          <X className="h-3 w-3" strokeWidth={2.6} />
        </button>
      </div>
    )
  }
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-[13px] border border-dashed border-ink/15 px-3.5 py-3 text-[13.5px] text-ink-2 transition-colors hover:border-ma-gold-500/60 hover:bg-ma-gold-500/[0.05] focus-within:[box-shadow:var(--ring-focus)] dark:border-white/15',
        disabled && 'pointer-events-none opacity-60',
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-ink/[0.05] text-ink-2 dark:bg-white/[0.07]">
        <Paperclip className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium text-ink">{t('ticketsUi.form.chooseFile', 'Joindre un fichier')}</span>
        <span className="block text-[12px] text-ink-3">{t('ticketsUi.form.fileHint', 'Capture, PDF ou reçu, un seul fichier')}</span>
      </span>
      <input disabled={disabled} type="file" className="sr-only" onChange={(e) => onChange(e.target.files?.[0] ?? null)} />
    </label>
  )
}

function TicketViewModal({ ticketId, onClose, onOpenPage }: { ticketId: number | null; onClose: () => void; onOpenPage: (id: number) => void }) {
  const { t: tr } = useTranslation()
  const ticket = useQuery({
    queryKey: ['ticket', ticketId],
    queryFn: () => getTicket(ticketId!),
    enabled: ticketId != null,
  })
  const t = ticket.data
  return (
    <Modal
      open={ticketId != null}
      onClose={onClose}
      kicker={t?.reference}
      title={t?.titre ?? 'Ticket'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {tr('common.close')}
          </Button>
          {t && (
            <Button onClick={() => onOpenPage(t.id)}>
              <ArrowUpRight className="h-4 w-4" />
              {tr('ticketsUi.view.openPage', 'Ouvrir la fiche')}
            </Button>
          )}
        </>
      }
    >
      {ticket.isLoading && (
        <div className="space-y-4 py-2" role="status" aria-label="Chargement">
          <div className="flex gap-2">
            <Skeleton className="h-[22px] w-20 rounded-full" />
            <Skeleton className="h-[22px] w-16 rounded-full" />
          </div>
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      )}
      {t && (
        <div className="space-y-7 pb-1">
          <section className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <StatusBadge statut={t.statut} />
              <PriorityBadge priorite={t.priorite} />
              <Badge tone="navy">{prettyType(t.type, t.typeAutrePrecision)}</Badge>
            </div>
            <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink-2">{t.description || 'Sans description.'}</p>
            <DetailList
              columns={2}
              className="rounded-[16px] bg-ink/[0.025] px-4 dark:bg-white/[0.03]"
              items={[
                { label: tr('adminUi.agent'), value: <Person person={agentOf(t)} /> },
                { label: tr('common.project'), value: t.project?.nom ?? t.project?.code ?? '–' },
                { label: tr('common.department'), value: t.departementDestinataire?.nom ?? '–' },
                { label: tr('ticketsUi.list.due', 'Échéance'), value: <span className="tabular-nums">{fmtDate(t.echeance)}</span> },
              ]}
            />
          </section>
          <div className="h-px bg-hairline" />
          <TicketLifecycle ticket={t} />
          <div className="h-px bg-hairline" />
          <TicketComments ticket={t} />
        </div>
      )}
    </Modal>
  )
}

function TicketComments({ ticket }: { ticket: Ticket }) {
  const { t } = useTranslation()
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
      <h3 className="mb-4 text-[13.5px] font-semibold tracking-[-0.01em] text-ink">
        {t('ticketsUi.comments.title', 'Commentaires')}
        {comments.length > 0 && <span className="ml-1.5 font-normal tabular-nums text-ink-3">{comments.length}</span>}
      </h3>
      <CommentThread comments={comments} />
      {!locked && <CommentComposer className="mt-5" value={draft} onChange={setDraft} onSubmit={() => commenter.mutate()} pending={commenter.isPending} />}
    </section>
  )
}
