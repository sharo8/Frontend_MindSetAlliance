import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart3,
  Briefcase,
  Check,
  CircleCheck,
  FileDown,
  History,
  KeyRound,
  Loader2,
  RotateCw,
  Shield,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardTitle, IconTile, type IconTone } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Select } from '../../components/ui/input'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { CellStack, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { Toast } from '../../components/ui/toast'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { spring } from '../../components/motion/springs'
import { ApiError } from '../../lib/api/client'
import { fetchDepartements } from '../../lib/api/iam-admin'
import { downloadAdminReport, fetchReportHistory, type ReportHistoryItem, type ReportKind } from '../../lib/api/reports'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { cn } from '../../lib/utils'
import { Field, formatDay, formatTime } from './admin-kit'

const REPORTS: {
  kind: ReportKind
  Icon: LucideIcon
  tone: IconTone
  filters?: Array<'departement' | 'statut' | 'period'>
}[] = [
  { kind: 'utilisateurs', Icon: Users, tone: 'sky', filters: ['departement', 'statut'] },
  { kind: 'permissions', Icon: Shield, tone: 'violet' },
  { kind: 'acces', Icon: KeyRound, tone: 'gold', filters: ['statut'] },
  { kind: 'organisation', Icon: Briefcase, tone: 'teal' },
  { kind: 'statistiques', Icon: BarChart3, tone: 'indigo', filters: ['period'] },
]

const KIND_META = Object.fromEntries(REPORTS.map((r) => [r.kind, r])) as Record<ReportKind, (typeof REPORTS)[number]>

function paramsFor(kind: ReportKind, filters: { departement: string; statut: string; period: string }) {
  const params: Record<string, string> = {}
  if (kind === 'utilisateurs') {
    if (filters.departement) params.departement = filters.departement
    if (filters.statut) params.statut = filters.statut
  }
  if (kind === 'acces' && filters.statut) params.statut = filters.statut
  if (kind === 'statistiques') params.period = filters.period
  return params
}

function historyParams(item: ReportHistoryItem) {
  const details = item.details ?? {}
  const params: Record<string, string> = {}
  const dept = details.departementId
  const statut = details.statut
  const period = details.period
  if (dept !== undefined && dept !== null && String(dept) !== '') params.departement = String(dept)
  if (statut !== undefined && statut !== null && String(statut) !== '') params.statut = String(statut)
  if (period !== undefined && period !== null && String(period) !== '') params.period = String(period)
  return params
}

const TZ = 'Africa/Kinshasa'

function ReportCard({ report, departements }: { report: (typeof REPORTS)[number]; departements: Array<{ id: number; nom: string }> }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [departement, setDepartement] = useState('')
  const [statut, setStatut] = useState('')
  const [period, setPeriod] = useState('30')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!success) return
    const timer = window.setTimeout(() => setSuccess(false), 1800)
    return () => window.clearTimeout(timer)
  }, [success])

  const generate = useMutation({
    mutationFn: () => downloadAdminReport(report.kind, paramsFor(report.kind, { departement, statut, period })),
    onMutate: () => setError(null),
    onSuccess: () => {
      setSuccess(true)
      setToast(t('reports.toast'))
      void queryClient.invalidateQueries({ queryKey: ['admin-report-history'] })
    },
    onError: (err) => {
      setSuccess(false)
      setError(err instanceof ApiError ? err.message : t('reports.failed'))
    },
  })

  const Icon = report.Icon
  const loading = generate.isPending
  const filters = report.filters ?? []

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="flex items-start gap-3.5">
        <IconTile tone={report.tone} size="lg">
          <Icon />
        </IconTile>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{t(`reports.kinds.${report.kind}.title`)}</h2>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-3">{t(`reports.kinds.${report.kind}.description`)}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2">
        {(['b1', 'b2'] as const).map((b) => (
          <li key={b} className="flex items-start gap-2.5 text-[13px] leading-snug text-ink-2">
            <CircleCheck className="mt-px h-4 w-4 shrink-0 text-accent-ink" strokeWidth={2} />
            <span>{t(`reports.kinds.${report.kind}.${b}`)}</span>
          </li>
        ))}
      </ul>
      {filters.length > 0 && (
        <div className={cn('mt-5 grid gap-3', filters.length > 1 && 'sm:grid-cols-2')}>
          {filters.includes('departement') && (
            <Field label={t('common.department')}>
              <Select value={departement} onChange={(e) => setDepartement(e.target.value)}>
                <option value="">{t('common.allDepartments')}</option>
                {departements.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          {filters.includes('statut') && (
            <Field label={t('common.status')}>
              <Select value={statut} onChange={(e) => setStatut(e.target.value)}>
                <option value="">{t('common.allStatuses')}</option>
                <option value="ACTIF">{t('common.active')}</option>
                <option value="INACTIF">{t('common.suspended')}</option>
              </Select>
            </Field>
          )}
          {filters.includes('period') && (
            <Field label={t('common.period')}>
              <Select value={period} onChange={(e) => setPeriod(e.target.value)}>
                <option value="7">{t('stats.period.7')}</option>
                <option value="30">{t('stats.period.30')}</option>
                <option value="90">{t('stats.period.90')}</option>
                <option value="ALL">{t('stats.period.ALL')}</option>
              </Select>
            </Field>
          )}
        </div>
      )}
      {error && (
        <div className="mt-4">
          <Feedback tone="danger">{error}</Feedback>
        </div>
      )}
      <div className="mt-auto pt-5">
        <Button
          className="w-full"
          disabled={loading}
          onClick={() => generate.mutate()}
          variant={success ? 'navy' : error ? 'outline' : 'soft'}
          aria-live="polite"
        >
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={loading ? 'l' : success ? 's' : error ? 'e' : 'i'}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.6 }}
              transition={spring.snappy}
              className="inline-flex"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : success ? (
                <Check className="h-4 w-4 text-ma-gold-300" strokeWidth={2.6} />
              ) : error ? (
                <RotateCw className="h-4 w-4" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
            </motion.span>
          </AnimatePresence>
          {loading ? t('reports.generating') : success ? t('reports.generated') : error ? t('common.retry') : t('reports.generate')}
        </Button>
      </div>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </Card>
  )
}

export function ReportsAdminPage() {
  const { t } = useTranslation()
  const departements = useQuery({ queryKey: ['departements'], queryFn: fetchDepartements })
  const history = useQuery({ queryKey: ['admin-report-history'], queryFn: fetchReportHistory })
  const queryClient = useQueryClient()
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [pendingHistoryId, setPendingHistoryId] = useState<number | null>(null)

  const regenerate = useMutation({
    mutationFn: (item: ReportHistoryItem) => {
      if (!item.kind) throw new Error(t('reports.unknownType'))
      return downloadAdminReport(item.kind, historyParams(item))
    },
    onMutate: (item) => {
      setHistoryError(null)
      setPendingHistoryId(item.id)
    },
    onSettled: () => setPendingHistoryId(null),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-report-history'] })
    },
    onError: (err) => setHistoryError(err instanceof ApiError ? err.message : t('reports.regenerateFail')),
  })

  const deptName = (id: string) => (departements.data ?? []).find((d) => String(d.id) === id)?.nom ?? `#${id}`

  function describeParams(item: ReportHistoryItem) {
    const p = historyParams(item)
    const parts: string[] = []
    if (p.departement) parts.push(deptName(p.departement))
    if (p.statut) parts.push(p.statut === 'ACTIF' ? t('common.active') : p.statut === 'INACTIF' ? t('common.suspended') : p.statut)
    if (p.period) parts.push(t(`stats.period.${p.period}`, { defaultValue: p.period }))
    return parts.length ? parts.join(' · ') : t('reportsUi.noFilter', 'Sans filtre')
  }

  const rows = history.data ?? []

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-8">
        <PageHeader kicker={t('reports.kicker')} title={t('nav.rapports')} subtitle={t('reports.subtitle')} />

        <Stagger className="grid items-stretch gap-4 lg:grid-cols-2 lg:[&>*:last-child:nth-child(odd)]:col-span-2">
          {REPORTS.map((report) => (
            <StaggerItem key={report.kind} className="min-w-0">
              <ReportCard report={report} departements={departements.data ?? []} />
            </StaggerItem>
          ))}
        </Stagger>

        <TableCard
          loading={history.isLoading}
          toolbar={
            <div className="space-y-3">
              <CardTitle
                icon={<History />}
                title={t('reports.historyTitle')}
                subtitle={t('reportsUi.historySub', '5 dernières générations, d’après le journal d’audit')}
              />
              <p className="max-w-3xl text-[12.5px] leading-relaxed text-ink-3">{t('reports.historyHint')}</p>
              {historyError && <Feedback tone="danger">{historyError}</Feedback>}
            </div>
          }
          empty={
            history.isError ? (
              <div className="py-3">
                <Feedback tone="danger">{history.error instanceof ApiError ? history.error.message : t('crud.loadFail')}</Feedback>
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<FileDown />}
                title={t('reports.historyEmpty')}
                hint={t('reportsUi.emptyHint', 'Générez un rapport ci-dessus : il apparaîtra ici.')}
              />
            ) : undefined
          }
        >
          <Table minWidth={760}>
            <THead>
              <tr>
                <Th>{t('reportsUi.report', 'Rapport')}</Th>
                <Th>{t('reportsUi.by', 'Généré par')}</Th>
                <Th>{t('reportsUi.date', 'Date')}</Th>
                <Th>{t('common.status')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('common.actions')}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((item) => {
                const meta = item.kind ? KIND_META[item.kind] : undefined
                const Icon = meta?.Icon ?? FileDown
                const pending = pendingHistoryId === item.id
                return (
                  <Tr key={item.id}>
                    <Td>
                      <div className="flex min-w-0 items-center gap-3">
                        <IconTile tone={meta?.tone ?? 'neutral'} size="sm">
                          <Icon />
                        </IconTile>
                        <CellStack title={item.kind ? t(`reports.kinds.${item.kind}.title`) : item.titre} meta={describeParams(item)} />
                      </div>
                    </Td>
                    <Td>
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Avatar name={item.administrateur} />
                        <span className="truncate text-ink-2">{item.administrateur}</span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap">
                      <span className="text-ink">{formatDay(item.createdAt) ?? item.createdAt}</span>
                      <span className="ml-2 tabular-nums text-ink-3">{formatTime(item.createdAt, TZ)}</span>
                    </Td>
                    <Td>
                      {item.kind ? (
                        <Badge tone="success" dot>
                          {t('reportsUi.ready', 'Régénérable')}
                        </Badge>
                      ) : (
                        <Badge tone="muted" dot>
                          {t('reports.unknownType')}
                        </Badge>
                      )}
                    </Td>
                    <Td align="right" className="w-[1%] whitespace-nowrap">
                      <RowActions className="[@media(hover:hover)]:opacity-100">
                        <Button variant="outline" size="sm" disabled={!item.kind || pending} onClick={() => regenerate.mutate(item)}>
                          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
                          {pending ? t('reports.generating') : t('reports.regenerate')}
                        </Button>
                      </RowActions>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        </TableCard>
      </div>
    </RequirePermission>
  )
}
