import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Ban,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  KeyRound,
  LogIn,
  LogOut,
  Pencil,
  Plus,
  ScrollText,
  ShieldCheck,
  ShieldX,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { Avatar } from '../../components/ui/avatar'
import { Badge, auditActionTone, sentence } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, IconTile, type IconTone } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { DetailList, FilterBar, FilterChip, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Mono } from '../../components/ui/table'
import { spring } from '../../components/motion/springs'
import { ApiError } from '../../lib/api/client'
import { fetchAudit, type AuditRow } from '../../lib/api/ops'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { cn } from '../../lib/utils'
import { formatTime } from './admin-kit'

type Kind = 'auth' | 'create' | 'update' | 'remove' | 'deny' | 'grant' | 'export' | 'other'

/** Famille d'une action d'audit : libellé humain, icône et couleur de pastille. */
function actionKind(action: string): Kind {
  const a = action.toUpperCase()
  if (a === 'LOGIN' || a === 'LOGOUT' || a.startsWith('PASSWORD')) return 'auth'
  if (a === 'DENY' || a.endsWith('_DENY')) return 'deny'
  if (/(DELETE|ARCHIVE|REVOKE|DISABLE|CANCEL|REMOVE)/.test(a)) return 'remove'
  if (a === 'GRANT' || a.endsWith('_GRANT')) return 'grant'
  if (/(CREATE|ASSIGN|VALIDATE)/.test(a)) return 'create'
  if (/(UPDATE|CHANGE|OVERRIDE)/.test(a)) return 'update'
  if (/(EXPORT|ASK)/.test(a)) return 'export'
  return 'other'
}

function actionLabel(action: string, t: (k: string, d: string) => string) {
  const a = action.toUpperCase()
  if (a === 'LOGIN') return t('auditUi.act.login', 'Connexion')
  if (a === 'LOGOUT') return t('auditUi.act.logout', 'Déconnexion')
  if (a.startsWith('PASSWORD')) return t('auditUi.act.password', 'Mot de passe')
  if (a === 'DENY' || a.endsWith('_DENY')) return t('auditUi.act.deny', 'Refus')
  if (a === 'GRANT' || a.endsWith('_GRANT')) return t('auditUi.act.grant', 'Autorisation')
  if (a.includes('ARCHIVE')) return t('auditUi.act.archive', 'Archivage')
  if (a.includes('DELETE') || a.includes('REMOVE')) return t('auditUi.act.remove', 'Retrait')
  if (a.includes('REVOKE')) return t('auditUi.act.revoke', 'Révocation')
  if (a.includes('DISABLE')) return t('auditUi.act.disable', 'Désactivation')
  if (a.includes('CANCEL')) return t('auditUi.act.cancel', 'Annulation')
  if (a.includes('ASSIGN')) return t('auditUi.act.assign', 'Attribution')
  if (a.includes('VALIDATE')) return t('auditUi.act.validate', 'Validation')
  if (a.includes('CREATE')) return t('auditUi.act.create', 'Création')
  if (/(UPDATE|CHANGE|OVERRIDE)/.test(a)) return t('auditUi.act.update', 'Modification')
  if (a.includes('EXPORT')) return t('auditUi.act.export', 'Export')
  if (a.includes('ASK')) return t('auditUi.act.ask', 'Question IA')
  return sentence(action.replaceAll('_', ' '))
}

const KIND_ICON: Record<Kind, { icon: LucideIcon; tone: IconTone }> = {
  auth: { icon: KeyRound, tone: 'sky' },
  create: { icon: Plus, tone: 'teal' },
  update: { icon: Pencil, tone: 'gold' },
  remove: { icon: Ban, tone: 'coral' },
  deny: { icon: ShieldX, tone: 'coral' },
  grant: { icon: ShieldCheck, tone: 'teal' },
  export: { icon: Download, tone: 'navy' },
  other: { icon: ScrollText, tone: 'neutral' },
}

function rowIcon(row: AuditRow) {
  const a = row.action.toUpperCase()
  if (a === 'LOGIN') return LogIn
  if (a === 'LOGOUT') return LogOut
  if (a.includes('ASK')) return Sparkles
  return KIND_ICON[actionKind(row.action)].icon
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : d.toLocaleDateString('fr-CA')
}

function dayTitle(iso: string, t: (k: string, d: string) => string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return t('auditUi.today', 'Aujourd’hui')
  if (d.toDateString() === yesterday.toDateString()) return t('auditUi.yesterday', 'Hier')
  const label = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function fullStamp(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })}`
}

function stringify(value: unknown) {
  if (value === null || value === undefined || value === '') return '–'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

const FILTERS: { value: 'ALL' | Kind; label: [string, string] }[] = [
  { value: 'ALL', label: ['auditUi.f.all', 'Toutes les actions'] },
  { value: 'auth', label: ['auditUi.f.auth', 'Connexions'] },
  { value: 'create', label: ['auditUi.f.create', 'Créations et attributions'] },
  { value: 'update', label: ['auditUi.f.update', 'Modifications'] },
  { value: 'remove', label: ['auditUi.f.remove', 'Retraits et désactivations'] },
  { value: 'deny', label: ['auditUi.f.deny', 'Refus'] },
  { value: 'grant', label: ['auditUi.f.grant', 'Autorisations'] },
  { value: 'export', label: ['auditUi.f.export', 'Exports et assistant'] },
]

function AuditEntry({ row, open, onToggle }: { row: AuditRow; open: boolean; onToggle: () => void }) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const kind = actionKind(row.action)
  const Icon = rowIcon(row)
  const author = row.agent?.nom || row.agent?.emailPro || null
  const entity = typeof row.valeurApres?.entite === 'string' ? row.valeurApres.entite : null
  const extra = Object.entries(row.valeurApres ?? {}).filter(([k]) => k !== 'entite')

  return (
    <li className={cn('relative', row.highlighted && 'bg-ma-gold-500/[0.07] dark:bg-ma-gold-400/[0.06]')}>
      {row.highlighted && <span className="absolute inset-y-3 left-1.5 w-[3px] rounded-full bg-ma-gold-500" aria-hidden />}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group/entry flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-ink/[0.025] focus-visible:bg-ink/[0.04] focus-visible:outline-none dark:hover:bg-white/[0.03] sm:gap-4 sm:px-5"
      >
        <span className="hidden w-11 shrink-0 pt-2 text-right text-[12.5px] font-medium tabular-nums text-ink-3 sm:block">
          {formatTime(row.createdAt)}
        </span>
        <span className="relative z-[1] pt-0.5">
          <IconTile tone={KIND_ICON[kind].tone} size="sm">
            <Icon />
          </IconTile>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-[14px] font-medium leading-snug text-ink">{row.actionLibelle || actionLabel(row.action, t)}</span>
            {row.highlighted && (
              <Badge tone="gold" className="h-5 px-2 text-[10.5px]">
                {t('auditUi.targeted', 'Entrée ciblée')}
              </Badge>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-ink-3">
            <span className="tabular-nums sm:hidden">{formatTime(row.createdAt)}</span>
            <span className="sm:hidden" aria-hidden>
              ·
            </span>
            {author ? (
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Avatar name={author} className="h-5 w-5 text-[8px] ring-1" />
                <span className="truncate text-ink-2">{author}</span>
              </span>
            ) : (
              <span>{t('auditUi.system', 'Système')}</span>
            )}
            <span aria-hidden>·</span>
            <span>
              {entity ?? sentence(row.objetType.replaceAll('_', ' '))}
              {row.objetId != null && <span className="tabular-nums"> #{row.objetId}</span>}
            </span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-2 pt-0.5">
          <Badge tone={auditActionTone(row.action)} dot className="hidden sm:inline-flex">
            {actionLabel(row.action, t)}
          </Badge>
          <ChevronDown
            className={cn('h-4 w-4 text-ink-3 transition-transform duration-300 ease-[var(--ease-ma)]', open && 'rotate-180')}
            strokeWidth={2.2}
            aria-hidden
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ ...spring.snappy, opacity: { duration: 0.18 } }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 sm:pl-[7.25rem] sm:pr-5">
              <div className="rounded-[16px] bg-sunken/70 px-4 py-1.5 ring-1 ring-inset ring-hairline">
                <DetailList
                  columns={2}
                  items={[
                    {
                      label: t('auditUi.d.type', 'Type'),
                      value: (
                        <Badge tone={auditActionTone(row.action)} dot>
                          {actionLabel(row.action, t)}
                        </Badge>
                      ),
                    },
                    { label: t('auditUi.d.code', 'Code technique'), value: <Mono>{row.action}</Mono> },
                    { label: t('auditUi.d.when', 'Horodatage'), value: <span className="tabular-nums">{fullStamp(row.createdAt)}</span> },
                    { label: t('auditUi.d.author', 'Auteur'), value: row.agent?.emailPro || author || '–' },
                    { label: t('auditUi.d.object', 'Objet'), value: sentence(row.objetType.replaceAll('_', ' ')) },
                    { label: t('auditUi.d.id', 'Identifiant'), value: row.objetId != null ? <Mono>#{row.objetId}</Mono> : '–' },
                    ...(entity ? [{ label: t('auditUi.d.entity', 'Entité'), value: entity }] : []),
                    ...extra.map(([k, v]) => ({
                      label: sentence(k.replaceAll('_', ' ')),
                      value: <span className="break-all">{stringify(v)}</span>,
                    })),
                    { label: t('auditUi.d.log', 'N° d’entrée'), value: <Mono>#{row.id}</Mono> },
                  ]}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  )
}

function TimelineSkeleton() {
  return (
    <Card className="divide-y divide-hairline overflow-hidden" aria-busy>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4" style={{ opacity: 1 - i * 0.12 }}>
          <Skeleton className="hidden h-3 w-10 sm:block" />
          <Skeleton className="h-7 w-7 rounded-[9px]" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="hidden h-5 w-24 rounded-full sm:block" />
        </div>
      ))}
    </Card>
  )
}

export function AuditJournalPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [params, setParams] = useSearchParams()
  const logId = params.get('logId') ?? undefined
  const objetId = params.get('objetId') ?? undefined
  const logs = useQuery({
    queryKey: ['audit', page, logId, objetId],
    queryFn: () => fetchAudit(page, { logId, objetId }),
  })
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<'ALL' | Kind>('ALL')
  const [openIds, setOpenIds] = useState<Set<number>>(new Set())

  const content = useMemo(() => logs.data?.content ?? [], [logs.data])
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return content.filter((row) => {
      if (kind !== 'ALL' && actionKind(row.action) !== kind) return false
      if (!q) return true
      return [
        row.action,
        row.actionLibelle ?? '',
        row.objetType,
        String(row.objetId ?? ''),
        row.agent?.nom ?? '',
        row.agent?.emailPro ?? '',
      ].some((v) => v.toLowerCase().includes(q))
    })
  }, [content, search, kind])

  const groups = useMemo(() => {
    const out: { key: string; title: string; rows: AuditRow[] }[] = []
    for (const row of visible) {
      const key = dayKey(row.createdAt)
      const last = out[out.length - 1]
      if (last && last.key === key) last.rows.push(row)
      else out.push({ key, title: dayTitle(row.createdAt, t), rows: [row] })
    }
    return out
  }, [visible, t])

  const totalPages = logs.data?.totalPages ?? 1
  const current = (logs.data?.number ?? page) + 1
  const isOpen = (row: AuditRow) => openIds.has(row.id) !== Boolean(row.highlighted)

  function toggle(id: number) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearParam(key: 'logId' | 'objetId') {
    const next = new URLSearchParams(params)
    next.delete(key)
    setParams(next)
    setPage(0)
  }

  const filtered = search.trim() !== '' || kind !== 'ALL'

  return (
    <RequirePermission permission="VIEW_AUDIT">
      <div className="space-y-6">
        <PageHeader
          kicker={t('pages.audit.kicker')}
          title={t('pages.audit.title')}
          subtitle={t('auditUi.subtitle', 'Traçabilité des écritures, en lecture seule. Ouvrez une entrée pour voir son détail.')}
        />

        <FilterBar>
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={t('auditUi.search', 'Rechercher un auteur, un objet, une action…')}
          />
          <FilterSelect
            value={kind}
            onChange={(e) => setKind(e.target.value as 'ALL' | Kind)}
            active={kind !== 'ALL'}
            aria-label={t('auditUi.filterLabel', 'Type d’action')}
          >
            {FILTERS.map((f) => (
              <option key={f.value} value={f.value}>
                {t(f.label[0], f.label[1])}
              </option>
            ))}
          </FilterSelect>
          {logId && <FilterChip onRemove={() => clearParam('logId')}>{t('auditUi.chipLog', 'Entrée #{{id}}', { id: logId })}</FilterChip>}
          {objetId && (
            <FilterChip onRemove={() => clearParam('objetId')}>{t('auditUi.chipObject', 'Objet #{{id}}', { id: objetId })}</FilterChip>
          )}
          <span className="ml-auto hidden text-[12.5px] text-ink-3 md:inline">
            {t('auditUi.pageScope', 'Les filtres s’appliquent à la page affichée.')}
          </span>
        </FilterBar>

        {logs.isError ? (
          <Feedback tone="danger">{logs.error instanceof ApiError ? logs.error.message : t('crud.loadFail')}</Feedback>
        ) : logs.isLoading ? (
          <TimelineSkeleton />
        ) : groups.length === 0 ? (
          <Card>
            <EmptyState
              icon={<ScrollText />}
              title={filtered ? t('auditUi.noMatch', 'Aucune entrée ne correspond') : t('auditUi.empty', 'Aucune action journalisée')}
              hint={
                filtered
                  ? t('auditUi.noMatchHint', 'Élargissez la recherche ou changez le type d’action.')
                  : t('auditUi.emptyHint', 'Les écritures apparaîtront ici dès qu’une action sera effectuée.')
              }
            />
          </Card>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <section key={group.key} className="space-y-2.5">
                <h2 className="flex items-baseline gap-2 px-1 text-[13px] font-semibold text-ink-2">
                  {group.title}
                  <span className="text-[12px] font-normal tabular-nums text-ink-3">
                    {t('auditUi.count', '{{count}} entrée(s)', { count: group.rows.length })}
                  </span>
                </h2>
                <Card className="overflow-hidden">
                  <ul className="divide-y divide-hairline">
                    {group.rows.map((row) => (
                      <AuditEntry key={row.id} row={row} open={isOpen(row)} onToggle={() => toggle(row.id)} />
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13px] tabular-nums text-ink-3">
            {t('auditUi.page', 'Page {{current}} sur {{total}}', { current, total: Math.max(1, totalPages) })}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" />
              {t('adminUi.previous')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={(logs.data?.number ?? 0) + 1 >= (logs.data?.totalPages ?? 1)}
              onClick={() => setPage((p) => p + 1)}
            >
              {t('adminUi.next')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </RequirePermission>
  )
}
