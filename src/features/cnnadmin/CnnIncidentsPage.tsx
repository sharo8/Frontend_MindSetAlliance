import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Check, CheckCheck, Flag, Gavel, Pencil, PhoneCall, ReceiptText, Route, X } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Select, Textarea } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { CellStack, IconAction, Mono, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { cnnOps, useCnnRelay, type CnnEmergencyContact, type CnnMotardReport, type CnnRefund, type MotardReportCategory, type RefundStatus } from '../../lib/api/cnnAdmin'
import { CnnAdminHeader, ConfirmDialog, RelayNotice, fmtAmount, fmtDateTime, relayErrorMessage, useLocaleTag, useRelayMutation } from './shared'
import { FormModal } from './FormModal'
import { useDebounced } from './useDebounced'

type Tab = 'reports' | 'emergencies' | 'refunds'

const CATEGORIES: MotardReportCategory[] = ['BEHAVIOR', 'FRAUD', 'NO_SHOW', 'PARCEL_ISSUE', 'ACCIDENT', 'OTHER']
const REPORT_TONES = { OPEN: 'warning', RESOLVED: 'success', DISMISSED: 'muted' } as const
const REFUND_TONES: Record<RefundStatus, 'warning' | 'info' | 'danger' | 'success'> = { PENDING: 'warning', APPROVED: 'info', REJECTED: 'danger', COMPLETED: 'success' }

function usePaged<T>(rows: T[]) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  return {
    shown: rows.slice((current - 1) * pageSize, current * pageSize),
    footer: (unit: string) =>
      rows.length > 0 ? (
        <Pagination
          page={current}
          pageCount={pageCount}
          total={rows.length}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={(n) => {
            setPageSize(n)
            setPage(1)
          }}
          unit={unit}
        />
      ) : undefined,
    reset: () => setPage(1),
  }
}

/** Signalements de motards, appels d'urgence et remboursements : tout ce qui demande une décision. */
export function CnnIncidentsPage() {
  const { t } = useTranslation()
  const relay = useCnnRelay()
  const [chosen, setTab] = useState<Tab | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const allowed: Record<Tab, boolean> = {
    reports: relay.can('MANAGE_CNN_MOTARDS', 'VIEW'),
    emergencies: relay.can('MANAGE_CNN_ORDERS', 'VIEW'),
    refunds: relay.can('MANAGE_CNN_PAYMENTS', 'VIEW'),
  }
  const tabs = (['reports', 'emergencies', 'refunds'] as Tab[]).filter((k) => allowed[k])
  const tab = chosen && tabs.includes(chosen) ? chosen : tabs[0] ?? 'reports'
  return (
    <div className="space-y-6">
      <CnnAdminHeader
        title={t('cnnIncidents.title', 'Signalements et incidents')}
        subtitle={t('cnnIncidents.subtitle', 'Signalements des associations, appels d’urgence et demandes de remboursement des clients.')}
      />
      <RelayNotice />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        ariaLabel={t('cnnSubs.sections', 'Rubriques')}
        options={[
          { value: 'reports' as Tab, label: t('cnnIncidents.tabReports', 'Signalements'), icon: <Flag /> },
          { value: 'emergencies' as Tab, label: t('cnnIncidents.tabEmergencies', 'Urgences'), icon: <PhoneCall /> },
          { value: 'refunds' as Tab, label: t('cnnIncidents.tabRefunds', 'Remboursements'), icon: <ReceiptText /> },
        ].filter((o) => tabs.includes(o.value))}
      />
      {tab === 'reports' && <ReportsTab onNotice={setNotice} />}
      {tab === 'emergencies' && <EmergenciesTab onNotice={setNotice} />}
      {tab === 'refunds' && <RefundsTab onNotice={setNotice} />}
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}

// ── Signalements de motards ────────────────────────────────────────────────────

function ReportsTab({ onNotice }: { onNotice: (m: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [status, setStatus] = useState('OPEN')
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim().toLowerCase(), 250)
  const [deciding, setDeciding] = useState<CnnMotardReport | null>(null)
  const reports = useQuery({
    queryKey: ['cnn-ops', 'motard-reports', status],
    queryFn: () => cnnOps.motardReports(status || undefined),
    enabled: relay.writable && relay.can('MANAGE_CNN_MOTARDS', 'VIEW'),
  })
  const rows = useMemo(
    () =>
      (reports.data ?? [])
        .filter((r) => !category || r.category === category)
        .filter((r) => !q || [r.motardName, r.motardPhone, r.associationName, r.details].some((x) => (x ?? '').toLowerCase().includes(q)))
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [reports.data, category, q],
  )
  const paged = usePaged(rows)
  const canDecide = relay.can('MANAGE_CNN_MOTARDS', 'UPDATE')

  return (
    <>
      {reports.isError && <Feedback tone="danger">{relayErrorMessage(reports.error, (k, v) => t(k, v))}</Feedback>}
      <TableCard
        loading={reports.isLoading && reports.fetchStatus !== 'idle'}
        toolbar={
          <FilterBar>
            <SearchField
              value={search}
              onChange={(v) => {
                setSearch(v)
                paged.reset()
              }}
              placeholder={t('cnnIncidents.searchReport', 'Motard, association, détails…')}
            />
            <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)} active={status !== ''} aria-label={t('cnnAdmin.orders.status', 'Statut')}>
              <option value="">{t('cnnIncidents.allReports', 'Tous les signalements')}</option>
              {(['OPEN', 'RESOLVED', 'DISMISSED'] as const).map((s) => (
                <option key={s} value={s}>
                  {t(`cnnIncidents.reportStatus.${s}`, { defaultValue: s })}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect value={category} onChange={(e) => setCategory(e.target.value)} active={Boolean(category)} aria-label={t('cnnIncidents.categoryLabel', 'Motif')}>
              <option value="">{t('cnnIncidents.allCategories', 'Tous les motifs')}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`cnnIncidents.category.${c}`, { defaultValue: c })}
                </option>
              ))}
            </FilterSelect>
          </FilterBar>
        }
        empty={
          !reports.isLoading && rows.length === 0 ? (
            <EmptyState icon={<Flag />} title={status === 'OPEN' ? t('cnnIncidents.noOpen', 'Aucun signalement en attente') : t('cnnIncidents.noReports', 'Aucun signalement')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} />
          ) : undefined
        }
        footer={paged.footer(t('cnnIncidents.reportsUnit', 'signalements'))}
      >
        <Table minWidth={980}>
          <THead>
            <tr>
              <Th>{t('cnnIncidents.date', 'Date')}</Th>
              <Th>{t('cnnSubs.motard', 'Motard')}</Th>
              <Th>{t('cnnIncidents.categoryLabel', 'Motif')}</Th>
              <Th>{t('cnnIncidents.details', 'Détails')}</Th>
              <Th>{t('cnnAdmin.orders.status', 'Statut')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {paged.shown.map((r) => (
              <Tr key={r.id} className="group/row">
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(r.createdAt, locale)}</Td>
                <Td>
                  <CellStack title={r.motardName || r.motardPhone || '–'} meta={[r.motardPhone, r.associationName].filter(Boolean).join(' · ')} />
                </Td>
                <Td>
                  <Badge tone={r.category === 'ACCIDENT' || r.category === 'FRAUD' ? 'danger' : 'muted'}>{t(`cnnIncidents.category.${r.category}`, { defaultValue: r.category })}</Badge>
                </Td>
                <Td className="max-w-[340px]">
                  <p className="line-clamp-2 text-[13px] text-ink-2">{r.details || '–'}</p>
                  {r.adminDecision && <p className="mt-1 line-clamp-2 text-[12px] text-ink-3">{t('cnnIncidents.decision', 'Décision : {{d}}', { d: r.adminDecision })}</p>}
                </Td>
                <Td>
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={REPORT_TONES[r.status]} dot>
                      {t(`cnnIncidents.reportStatus.${r.status}`, { defaultValue: r.status })}
                    </Badge>
                    {r.motardDeactivated && <Badge tone="danger">{t('cnnIncidents.deactivated', 'Motard désactivé')}</Badge>}
                  </span>
                  {r.handledByName && <span className="mt-1 block text-[11.5px] text-ink-3">{t('cnnIncidents.by', 'par {{n}}, {{d}}', { n: r.handledByName, d: fmtDateTime(r.handledAt, locale) })}</span>}
                </Td>
                <Td align="right">
                  {canDecide && r.status === 'OPEN' && (
                    <RowActions>
                      <IconAction label={t('cnnIncidents.decide', 'Traiter le signalement')} onClick={() => setDeciding(r)}>
                        <Gavel />
                      </IconAction>
                    </RowActions>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
      <DecisionModal report={deciding} onClose={() => setDeciding(null)} onDone={(m) => {
        onNotice(m)
        setDeciding(null)
      }} />
    </>
  )
}

function DecisionModal({ report, onClose, onDone }: { report: CnnMotardReport | null; onClose: () => void; onDone: (m: string) => void }) {
  const { t } = useTranslation()
  const [status, setStatus] = useState<'RESOLVED' | 'DISMISSED'>('RESOLVED')
  const [decision, setDecision] = useState('')
  const [deactivate, setDeactivate] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const decide = useRelayMutation(
    (r: CnnMotardReport) => cnnOps.decideReport(r.id, { status, decision: decision.trim() || undefined, deactivateMotard: status === 'RESOLVED' && deactivate }),
    [['cnn-ops', 'motard-reports'], ['cnn-admin', 'motards']],
    (m, e) => {
      if (m) {
        setDecision('')
        setDeactivate(false)
        onDone(m)
      }
      setError(e)
    },
    t('cnnIncidents.decided', 'Décision enregistrée. L’association est notifiée.'),
  )
  return (
    <Modal
      open={report != null}
      onClose={() => {
        setError(null)
        onClose()
      }}
      kicker="Colis na Nga"
      title={t('cnnIncidents.decide', 'Traiter le signalement')}
      subtitle={report ? `${report.motardName ?? ''} · ${t(`cnnIncidents.category.${report.category}`, { defaultValue: report.category })}` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={decide.isPending}>
            {t('cnnAdmin.common.cancel', 'Annuler')}
          </Button>
          <Button variant={deactivate && status === 'RESOLVED' ? 'danger' : 'gold'} disabled={decide.isPending} onClick={() => report && decide.mutate(report)}>
            {decide.isPending ? t('cnnAdmin.common.working', 'Envoi…') : t('cnnIncidents.confirmDecision', 'Enregistrer la décision')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {report?.details && <p className="clay-field rounded-[12px] px-3.5 py-3 text-[13.5px] leading-relaxed text-ink-2">{report.details}</p>}
        <label className="block">
          <FieldLabel>{t('cnnIncidents.outcome', 'Issue')}</FieldLabel>
          <Select value={status} onChange={(e) => setStatus(e.target.value as 'RESOLVED' | 'DISMISSED')}>
            <option value="RESOLVED">{t('cnnIncidents.resolve', 'Fondé : mesure prise')}</option>
            <option value="DISMISSED">{t('cnnIncidents.dismiss', 'Classé sans suite')}</option>
          </Select>
        </label>
        <label className="block">
          <FieldLabel hint={t('cnnIncidents.decisionHint', 'Visible par l’association')}>{t('cnnIncidents.decisionLabel', 'Décision')}</FieldLabel>
          <Textarea rows={3} maxLength={2000} value={decision} onChange={(e) => setDecision(e.target.value)} />
        </label>
        {status === 'RESOLVED' && (
          <label className="flex items-center gap-2.5 text-[13.5px] text-ink-2">
            <input type="checkbox" className="h-4 w-4" checked={deactivate} onChange={(e) => setDeactivate(e.target.checked)} />
            {t('cnnIncidents.deactivateMotard', 'Désactiver le compte du motard')}
          </label>
        )}
        {error && <Feedback tone="danger">{error}</Feedback>}
      </div>
    </Modal>
  )
}

// ── Appels d'urgence ───────────────────────────────────────────────────────────

function EmergenciesTab({ onNotice }: { onNotice: (m: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const navigate = useNavigate()
  const [role, setRole] = useState('')
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const enabled = relay.writable && relay.can('MANAGE_CNN_ORDERS', 'VIEW')
  const calls = useQuery({ queryKey: ['cnn-ops', 'emergency-calls'], queryFn: cnnOps.emergencyCalls, enabled })
  const contact = useQuery({ queryKey: ['cnn-ops', 'emergency-contact'], queryFn: cnnOps.emergencyContact, enabled })
  const rows = useMemo(
    () => (calls.data ?? []).filter((c) => !role || c.callerRole === role).sort((a, b) => (b.calledAt ?? '').localeCompare(a.calledAt ?? '')),
    [calls.data, role],
  )
  const roles = useMemo(() => Array.from(new Set((calls.data ?? []).map((c) => c.callerRole).filter(Boolean))) as string[], [calls.data])
  const paged = usePaged(rows)
  const save = useRelayMutation(
    (v: Record<string, string>) => cnnOps.updateEmergencyContact({ phone: v.phone, secondaryPhone: v.secondaryPhone || null, whatsapp: v.whatsapp || null, hours: v.hours || null, script: v.script || null } as CnnEmergencyContact),
    [['cnn-ops', 'emergency-contact']],
    (m, e) => {
      if (m) {
        onNotice(m)
        setEditing(false)
      }
      setError(e)
    },
    t('cnnIncidents.contactSaved', 'Contact d’urgence mis à jour dans l’application.'),
  )
  const c = contact.data
  const canEdit = relay.can('MANAGE_CNN_ORDERS', 'UPDATE')

  return (
    <>
      {(calls.isError || contact.isError) && <Feedback tone="danger">{relayErrorMessage(calls.error ?? contact.error, (k, v) => t(k, v))}</Feedback>}
      <div className="clay flex flex-wrap items-start gap-4 rounded-[var(--radius-ma)] p-5">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-status-danger/12 text-status-danger">
          <PhoneCall className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-ink">{t('cnnIncidents.contactTitle', 'Numéro d’urgence affiché dans l’application')}</p>
          {contact.isLoading && enabled ? (
            <p className="mt-1 text-[13px] text-ink-3">{t('cnnMap.loading', 'Connexion…')}</p>
          ) : c ? (
            <dl className="mt-1.5 grid gap-x-6 gap-y-1 text-[13px] sm:grid-cols-2">
              <div><dt className="inline text-ink-3">{t('cnnIncidents.phone', 'Téléphone')} : </dt><dd className="inline font-semibold text-ink">{c.phone || '–'}</dd></div>
              <div><dt className="inline text-ink-3">{t('cnnIncidents.secondary', 'Second numéro')} : </dt><dd className="inline text-ink-2">{c.secondaryPhone || '–'}</dd></div>
              <div><dt className="inline text-ink-3">WhatsApp : </dt><dd className="inline text-ink-2">{c.whatsapp || '–'}</dd></div>
              <div><dt className="inline text-ink-3">{t('cnnIncidents.hours', 'Horaires')} : </dt><dd className="inline text-ink-2">{c.hours || '–'}</dd></div>
              {c.script && <div className="sm:col-span-2"><dt className="inline text-ink-3">{t('cnnIncidents.script', 'Consigne')} : </dt><dd className="inline text-ink-2">{c.script}</dd></div>}
            </dl>
          ) : null}
        </div>
        {canEdit && c && (
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="h-4 w-4" />
            {t('cnnAdmin.common.edit', 'Modifier')}
          </Button>
        )}
      </div>
      <TableCard
        loading={calls.isLoading && calls.fetchStatus !== 'idle'}
        toolbar={
          <FilterBar>
            <FilterSelect value={role} onChange={(e) => setRole(e.target.value)} active={Boolean(role)} aria-label={t('cnnIncidents.caller', 'Appelant')}>
              <option value="">{t('cnnIncidents.allCallers', 'Tous les appelants')}</option>
              {roles.map((r) => (
                <option key={r} value={r}>
                  {t(`cnnTrace.role.${r}`, { defaultValue: r })}
                </option>
              ))}
            </FilterSelect>
            {rows.length > 0 && <p className="ml-auto text-[12.5px] text-ink-3">{t('cnnIncidents.callsCount', '{{n}} appel(s)', { n: rows.length })}</p>}
          </FilterBar>
        }
        empty={!calls.isLoading && rows.length === 0 ? <EmptyState icon={<PhoneCall />} title={t('cnnIncidents.noCalls', 'Aucun appel d’urgence')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={paged.footer(t('cnnIncidents.callsUnit', 'appels'))}
      >
        <Table minWidth={860}>
          <THead>
            <tr>
              <Th>{t('cnnIncidents.date', 'Date')}</Th>
              <Th>{t('cnnIncidents.caller', 'Appelant')}</Th>
              <Th>{t('cnnIncidents.reason', 'Motif')}</Th>
              <Th>{t('cnnIncidents.dialed', 'Numéro composé')}</Th>
              <Th>{t('cnnIncidents.order', 'Commande')}</Th>
            </tr>
          </THead>
          <TBody>
            {paged.shown.map((e) => (
              <Tr key={e.id}>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(e.calledAt, locale)}</Td>
                <Td>
                  <CellStack title={e.callerName || '–'} meta={e.callerRole ? t(`cnnTrace.role.${e.callerRole}`, { defaultValue: e.callerRole }) : undefined} />
                </Td>
                <Td className="max-w-[320px] text-ink-2">{e.reason || '–'}</Td>
                <Td><Mono>{e.phoneDialed || '–'}</Mono></Td>
                <Td>
                  {e.orderId ? (
                    <button type="button" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-ink hover:underline" onClick={() => navigate(`/colis-na-nga/carte?commande=${e.orderId}`)}>
                      <Route className="h-3.5 w-3.5" />
                      {e.orderId.slice(0, 8).toUpperCase()}
                    </button>
                  ) : (
                    '–'
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
      <FormModal
        open={editing}
        title={t('cnnIncidents.contactTitle', 'Numéro d’urgence affiché dans l’application')}
        fields={[
          { name: 'phone', label: t('cnnIncidents.phone', 'Téléphone'), type: 'tel', required: true, half: true },
          { name: 'secondaryPhone', label: t('cnnIncidents.secondary', 'Second numéro'), type: 'tel', half: true },
          { name: 'whatsapp', label: 'WhatsApp', type: 'tel', half: true },
          { name: 'hours', label: t('cnnIncidents.hours', 'Horaires'), half: true },
          { name: 'script', label: t('cnnIncidents.script', 'Consigne'), type: 'textarea' },
        ]}
        initial={c ? { phone: c.phone ?? '', secondaryPhone: c.secondaryPhone ?? '', whatsapp: c.whatsapp ?? '', hours: c.hours ?? '', script: c.script ?? '' } : undefined}
        submitLabel={t('cnnAdmin.common.save', 'Enregistrer')}
        busy={save.isPending}
        error={error}
        onSubmit={(v) => save.mutate(v)}
        onClose={() => {
          setEditing(false)
          setError(null)
        }}
      />
    </>
  )
}

// ── Remboursements ─────────────────────────────────────────────────────────────

function RefundsTab({ onNotice }: { onNotice: (m: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const navigate = useNavigate()
  const [status, setStatus] = useState('PENDING')
  const [pending, setPending] = useState<{ kind: 'approve' | 'reject' | 'complete'; refund: CnnRefund } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const refunds = useQuery({ queryKey: ['cnn-ops', 'refunds'], queryFn: cnnOps.refunds, enabled: relay.writable && relay.can('MANAGE_CNN_PAYMENTS', 'VIEW') })
  const rows = useMemo(() => (refunds.data ?? []).filter((r) => !status || r.status === status).sort((a, b) => (b.requestedAt ?? '').localeCompare(a.requestedAt ?? '')), [refunds.data, status])
  const paged = usePaged(rows)
  const done = (m: string | null, e: string | null) => {
    if (m) {
      onNotice(m)
      setPending(null)
    }
    setError(e)
  }
  const keys = [['cnn-ops', 'refunds']]
  const approve = useRelayMutation((id: string) => cnnOps.approveRefund(id), keys, done, t('cnnIncidents.approved', 'Remboursement approuvé.'))
  const reject = useRelayMutation(({ id, reason }: { id: string; reason: string }) => cnnOps.rejectRefund(id, reason), keys, done, t('cnnIncidents.rejected', 'Demande rejetée.'))
  const complete = useRelayMutation((id: string) => cnnOps.completeRefund(id), keys, done, t('cnnIncidents.completed', 'Remboursement marqué comme versé.'))
  const canUpdate = relay.can('MANAGE_CNN_PAYMENTS', 'UPDATE')
  const busy = approve.isPending || reject.isPending || complete.isPending

  return (
    <>
      {refunds.isError && <Feedback tone="danger">{relayErrorMessage(refunds.error, (k, v) => t(k, v))}</Feedback>}
      <TableCard
        loading={refunds.isLoading && refunds.fetchStatus !== 'idle'}
        toolbar={
          <FilterBar>
            <FilterSelect
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                paged.reset()
              }}
              active={status !== ''}
              aria-label={t('cnnAdmin.orders.status', 'Statut')}
            >
              <option value="">{t('cnnIncidents.allRefunds', 'Toutes les demandes')}</option>
              {(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED'] as RefundStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(`cnnIncidents.refundStatus.${s}`, { defaultValue: s })}
                </option>
              ))}
            </FilterSelect>
          </FilterBar>
        }
        empty={!refunds.isLoading && rows.length === 0 ? <EmptyState icon={<ReceiptText />} title={t('cnnIncidents.noRefunds', 'Aucune demande de remboursement')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={paged.footer(t('cnnIncidents.refundsUnit', 'demandes'))}
      >
        <Table minWidth={940}>
          <THead>
            <tr>
              <Th>{t('cnnIncidents.requested', 'Demandée le')}</Th>
              <Th>{t('cnnIncidents.for', 'Objet')}</Th>
              <Th align="right">{t('cnnSubs.amount', 'Montant')}</Th>
              <Th>{t('cnnIncidents.reason', 'Motif')}</Th>
              <Th>{t('cnnAdmin.orders.status', 'Statut')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {paged.shown.map((r) => (
              <Tr key={r.id} className="group/row">
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(r.requestedAt, locale)}</Td>
                <Td>
                  {r.orderId ? (
                    <button type="button" className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-accent-ink hover:underline" onClick={() => navigate(`/colis-na-nga/carte?commande=${r.orderId}`)}>
                      <Route className="h-3.5 w-3.5" />
                      {t('cnnIncidents.orderRef', 'Commande {{id}}', { id: r.orderId.slice(0, 8).toUpperCase() })}
                    </button>
                  ) : (
                    <span className="text-ink-2">{r.subscriptionPaymentId ? t('cnnIncidents.subscriptionPayment', 'Paiement d’abonnement') : '–'}</span>
                  )}
                </Td>
                <Td align="right" className="whitespace-nowrap font-semibold tabular-nums">{fmtAmount(r.amount, r.currency, locale)}</Td>
                <Td className="max-w-[300px]">
                  <p className="line-clamp-2 text-[13px] text-ink-2">{r.reason || '–'}</p>
                  {r.adminNote && <p className="mt-1 line-clamp-2 text-[12px] text-ink-3">{t('cnnIncidents.note', 'Note : {{n}}', { n: r.adminNote })}</p>}
                </Td>
                <Td>
                  <Badge tone={REFUND_TONES[r.status] ?? 'muted'} dot>
                    {t(`cnnIncidents.refundStatus.${r.status}`, { defaultValue: r.status })}
                  </Badge>
                </Td>
                <Td align="right">
                  {canUpdate && (
                    <RowActions>
                      {r.status === 'PENDING' && (
                        <>
                          <IconAction label={t('cnnIncidents.approve', 'Approuver')} onClick={() => setPending({ kind: 'approve', refund: r })}>
                            <Check />
                          </IconAction>
                          <IconAction tone="danger" label={t('cnnIncidents.reject', 'Rejeter')} onClick={() => setPending({ kind: 'reject', refund: r })}>
                            <X />
                          </IconAction>
                        </>
                      )}
                      {r.status === 'APPROVED' && (
                        <IconAction label={t('cnnIncidents.complete', 'Marquer comme versé')} onClick={() => setPending({ kind: 'complete', refund: r })}>
                          <CheckCheck />
                        </IconAction>
                      )}
                    </RowActions>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
      <ConfirmDialog
        open={pending?.kind === 'approve'}
        title={t('cnnIncidents.approveTitle', 'Approuver ce remboursement ?')}
        message={t('cnnIncidents.approveMessage', '{{amount}} seront à reverser au client. Marquez ensuite le remboursement comme versé une fois l’argent envoyé.', { amount: pending ? fmtAmount(pending.refund.amount, pending.refund.currency, locale) : '' })}
        confirmLabel={t('cnnIncidents.approve', 'Approuver')}
        busy={busy}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && approve.mutate(pending.refund.id)}
      />
      <ConfirmDialog
        open={pending?.kind === 'reject'}
        title={t('cnnIncidents.rejectTitle', 'Rejeter cette demande ?')}
        message={t('cnnIncidents.rejectMessage', 'Le client verra le motif du rejet dans l’application.')}
        confirmLabel={t('cnnIncidents.reject', 'Rejeter')}
        danger
        reason="required"
        busy={busy}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={(reason) => pending && reject.mutate({ id: pending.refund.id, reason })}
      />
      <ConfirmDialog
        open={pending?.kind === 'complete'}
        title={t('cnnIncidents.completeTitle', 'Confirmer le versement ?')}
        message={t('cnnIncidents.completeMessage', 'Confirmez que {{amount}} ont bien été reversés au client (hors application).', { amount: pending ? fmtAmount(pending.refund.amount, pending.refund.currency, locale) : '' })}
        confirmLabel={t('cnnIncidents.complete', 'Marquer comme versé')}
        busy={busy}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && complete.mutate(pending.refund.id)}
      />
    </>
  )
}
