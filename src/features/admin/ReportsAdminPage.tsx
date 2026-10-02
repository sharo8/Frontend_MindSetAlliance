import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { BarChart3, Briefcase, Check, FileDown, KeyRound, Loader2, Shield, Users } from 'lucide-react'
import { useEffect, useState, type ComponentType } from 'react'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { PageHeader } from '../../components/ui/page-header'
import { Toast } from '../../components/ui/toast'
import { ApiError } from '../../lib/api/client'
import { fetchDepartements } from '../../lib/api/iam-admin'
import {
  downloadAdminReport,
  fetchReportHistory,
  type ReportHistoryItem,
  type ReportKind,
} from '../../lib/api/reports'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { cn } from '../../lib/utils'

const REPORTS: {
  kind: ReportKind
  Icon: ComponentType<{ className?: string }>
  filters?: Array<'departement' | 'statut' | 'period'>
}[] = [
  { kind: 'utilisateurs', Icon: Users, filters: ['departement', 'statut'] },
  { kind: 'permissions', Icon: Shield },
  { kind: 'acces', Icon: KeyRound, filters: ['statut'] },
  { kind: 'organisation', Icon: Briefcase },
  { kind: 'statistiques', Icon: BarChart3, filters: ['period'] },
]

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

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'Africa/Kinshasa',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function ReportCard({
  report,
  delay,
  departements,
}: {
  report: (typeof REPORTS)[number]
  delay: number
  departements: Array<{ id: number; nom: string }>
}) {
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

  return (
    <Card
      className={cn(
        'ma-enter flex h-full flex-col border-ma-navy-900/10 transition duration-200',
        'hover:-translate-y-0.5 hover:border-ma-gold-500/50 hover:shadow-[0_16px_36px_rgba(22,33,92,0.12)]',
        'dark:hover:border-ma-gold-400/35 dark:hover:shadow-[0_16px_36px_rgba(0,0,0,0.35)]',
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardHeader className="flex flex-row items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ma-navy-950 text-ma-gold-400 shadow-[0_8px_18px_rgba(22,33,92,0.2)]">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="pt-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-ma-navy-800 dark:text-ma-gold-400">
          {t(`reports.kinds.${report.kind}.title`)}
        </h2>
      </CardHeader>
      <CardBody className="flex h-full flex-col space-y-4">
        <p className="text-sm text-ma-muted dark:text-ma-gray-300">{t(`reports.kinds.${report.kind}.description`)}</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>{t(`reports.kinds.${report.kind}.b1`)}</li>
          <li>{t(`reports.kinds.${report.kind}.b2`)}</li>
        </ul>
        {report.filters?.includes('departement') && (
          <label className="block text-sm">
                    <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ma-muted">{t('common.department')}</span>
            <select
              className="w-full rounded-lg border border-ma-line bg-white px-3 py-2 dark:border-white/15 dark:bg-ma-navy-800"
              value={departement}
              onChange={(e) => setDepartement(e.target.value)}
            >
                      <option value="">{t('common.allDepartments')}</option>
              {departements.map((d) => (
                <option key={d.id} value={d.id}>{d.nom}</option>
              ))}
            </select>
          </label>
        )}
        {report.filters?.includes('statut') && (
          <label className="block text-sm">
                    <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ma-muted">{t('common.status')}</span>
            <select
              className="w-full rounded-lg border border-ma-line bg-white px-3 py-2 dark:border-white/15 dark:bg-ma-navy-800"
              value={statut}
              onChange={(e) => setStatut(e.target.value)}
            >
                      <option value="">{t('common.allStatuses')}</option>
                      <option value="ACTIF">{t('common.active')}</option>
                      <option value="INACTIF">{t('common.suspended')}</option>
            </select>
          </label>
        )}
        {report.filters?.includes('period') && (
          <label className="block text-sm">
                    <span className="mb-1 block text-[11px] uppercase tracking-[0.14em] text-ma-muted">{t('common.period')}</span>
            <select
              className="w-full rounded-lg border border-ma-line bg-white px-3 py-2 dark:border-white/15 dark:bg-ma-navy-800"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            >
                      <option value="7">{t('stats.period.7')}</option>
                      <option value="30">{t('stats.period.30')}</option>
                      <option value="90">{t('stats.period.90')}</option>
                      <option value="ALL">{t('stats.period.ALL')}</option>
            </select>
          </label>
        )}
        {error && (
          <div className="space-y-2">
            <Feedback tone="danger">{error}</Feedback>
            <Button variant="outline" className="w-full" onClick={() => generate.mutate()}>
              {t('common.retry')}
            </Button>
          </div>
        )}
        <div className="mt-auto pt-1">
          <Button
            className="w-full"
            disabled={loading}
            onClick={() => generate.mutate()}
            variant={success ? 'navy' : 'gold'}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : success ? <Check className="h-4 w-4 text-status-success" /> : <FileDown className="h-4 w-4" />}
            {loading ? t('reports.generating') : success ? t('reports.generated') : t('reports.generate')}
          </Button>
        </div>
      </CardBody>
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

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-6">
        <PageHeader
          kicker={t('reports.kicker')}
          title={t('reports.title')}
          subtitle={t('reports.subtitle')}
        />
        <div className="grid items-stretch gap-4 lg:grid-cols-2">
          {REPORTS.map((report, i) => (
            <ReportCard
              key={report.kind}
              report={report}
              delay={i * 90}
              departements={departements.data ?? []}
            />
          ))}
        </div>
        <Card className="ma-enter" style={{ animationDelay: '480ms' }}>
          <CardHeader>
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-ma-navy-800 dark:text-ma-gold-400">
              {t('reports.historyTitle')}
            </h2>
          </CardHeader>
          <CardBody className="space-y-3">
            <p className="text-sm text-ma-muted">
              {t('reports.historyHint')}
            </p>
            {historyError && <Feedback tone="danger">{historyError}</Feedback>}
            {(history.data ?? []).length === 0 ? (
              <p className="text-sm text-ma-muted">{t('reports.historyEmpty')}</p>
            ) : (
              <ul className="divide-y divide-ma-line/80 dark:divide-white/10">
                {(history.data ?? []).map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-semibold text-ma-navy-900 dark:text-ma-gold-400">
                        {item.kind ? t(`reports.kinds.${item.kind}.title`) : item.titre}
                      </p>
                      <p className="text-ma-muted">
                        {formatWhen(item.createdAt)} · {item.administrateur}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      disabled={!item.kind || pendingHistoryId === item.id}
                      onClick={() => regenerate.mutate(item)}
                    >
                      {pendingHistoryId === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      {pendingHistoryId === item.id ? t('reports.generating') : t('reports.regenerate')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </RequirePermission>
  )
}
