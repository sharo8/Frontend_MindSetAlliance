import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Coins, CreditCard, FileText, Pencil, Plus, Power, PowerOff, Trash2, Users } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { CellStack, IconAction, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import {
  PAYMENT_MODES,
  cnnAdmin,
  cnnOps,
  useCnnRelay,
  type CnnInvoice,
  type CnnSubscribedClient,
  type CnnSubscription,
  type CnnSubscriptionInput,
  type InvoiceStatus,
  type PaymentMode,
  type SubscriptionStatus,
} from '../../lib/api/cnnAdmin'
import { CnnAdminHeader, ConfirmDialog, RelayNotice, fmtAmount, fmtDateTime, fmtDay, relayErrorMessage, useLocaleTag, useRelayMutation } from './shared'
import { FormModal } from './FormModal'
import { SubscriptionPlanModal } from './SubscriptionPlanModal'
import { useDebounced } from './useDebounced'

type Tab = 'plans' | 'clients' | 'invoices' | 'credits'

const SUB_TONES: Record<SubscriptionStatus, 'success' | 'info' | 'warning' | 'gold' | 'danger' | 'muted'> = {
  ACTIVE: 'success',
  VALIDATED: 'info',
  PENDING: 'warning',
  SUSPENDED: 'gold',
  CANCELLED: 'danger',
  EXPIRED: 'muted',
}
const SUB_STATUSES = Object.keys(SUB_TONES) as SubscriptionStatus[]
const INVOICE_TONES: Record<InvoiceStatus, 'success' | 'warning' | 'danger'> = { PAID: 'success', PENDING: 'warning', UNPAID: 'danger' }

function SubBadge({ status }: { status: SubscriptionStatus }) {
  const { t } = useTranslation()
  return (
    <Badge tone={SUB_TONES[status] ?? 'muted'} dot>
      {t(`cnnSubs.status.${status}`, { defaultValue: status })}
    </Badge>
  )
}

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

/** Abonnements des entreprises, factures et crédits des motards. */
export function CnnSubscriptionsPage() {
  const { t } = useTranslation()
  const relay = useCnnRelay()
  const [chosen, setTab] = useState<Tab | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const allowed: Record<Tab, boolean> = {
    plans: relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'VIEW'),
    clients: relay.can('MANAGE_CNN_CLIENTS', 'VIEW'),
    invoices: relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'VIEW'),
    credits: relay.can('MANAGE_CNN_MOTARDS', 'VIEW'),
  }
  const tabs = (['plans', 'clients', 'invoices', 'credits'] as Tab[]).filter((k) => allowed[k])
  const tab = chosen && tabs.includes(chosen) ? chosen : tabs[0] ?? 'plans'
  return (
    <div className="space-y-6">
      <CnnAdminHeader
        title={t('cnnSubs.title', 'Abonnements et crédits')}
        subtitle={t('cnnSubs.subtitle', 'Formules des entreprises, clients abonnés, factures et crédits des motards partenaires.')}
      />
      <RelayNotice />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        ariaLabel={t('cnnSubs.sections', 'Rubriques')}
        options={[
          { value: 'plans' as Tab, label: t('cnnSubs.tabPlans', 'Formules'), icon: <CreditCard /> },
          { value: 'clients' as Tab, label: t('cnnSubs.tabClients', 'Clients abonnés'), icon: <Users /> },
          { value: 'invoices' as Tab, label: t('cnnSubs.tabInvoices', 'Factures'), icon: <FileText /> },
          { value: 'credits' as Tab, label: t('cnnSubs.tabCredits', 'Crédits motards'), icon: <Coins /> },
        ].filter((o) => tabs.includes(o.value))}
      />
      {tab === 'plans' && <PlansTab onNotice={setNotice} />}
      {tab === 'clients' && <ClientsTab onNotice={setNotice} />}
      {tab === 'invoices' && <InvoicesTab onNotice={setNotice} />}
      {tab === 'credits' && <CreditsTab onNotice={setNotice} />}
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}

// ── Formules ───────────────────────────────────────────────────────────────────

function PlansTab({ onNotice }: { onNotice: (m: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [editor, setEditor] = useState<{ mode: 'create' } | { mode: 'edit'; plan: CnnSubscription } | null>(null)
  const [pending, setPending] = useState<CnnSubscription | null>(null)
  const [error, setError] = useState<string | null>(null)
  const plans = useQuery({ queryKey: ['cnn-ops', 'subscriptions'], queryFn: cnnOps.subscriptions, enabled: relay.writable && relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'VIEW') })
  const rows = useMemo(() => [...(plans.data ?? [])].sort((a, b) => (a.planType ?? '').localeCompare(b.planType ?? '')), [plans.data])
  const paged = usePaged(rows)

  const done = (message: string | null, err: string | null) => {
    if (message) {
      onNotice(message)
      setEditor(null)
      setPending(null)
    }
    setError(err)
  }
  const keys = [['cnn-ops', 'subscriptions']]
  const save = useRelayMutation(
    ({ id, body }: { id?: string; body: CnnSubscriptionInput }) => (id ? cnnOps.updateSubscription(id, body) : cnnOps.createSubscription(body)),
    keys,
    done,
    t('cnnAdmin.common.saved', 'Modifications enregistrées.'),
  )
  const remove = useRelayMutation((id: string) => cnnOps.deleteSubscription(id), keys, done, t('cnnSubs.deleted', 'Formule supprimée.'))

  const canCreate = relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'CREATE')
  const canUpdate = relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'UPDATE')
  const canDelete = relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'DELETE')
  const plan = editor?.mode === 'edit' ? editor.plan : null

  return (
    <>
      {plans.isError && <Feedback tone="danger">{relayErrorMessage(plans.error, (k, v) => t(k, v))}</Feedback>}
      <TableCard
        loading={plans.isLoading && plans.fetchStatus !== 'idle'}
        toolbar={
          <FilterBar>
            <p className="text-[13px] text-ink-3">{t('cnnSubs.plansHint', 'Les formules proposées aux entreprises clientes.')}</p>
            {canCreate && (
              <Button size="sm" className="ml-auto" onClick={() => setEditor({ mode: 'create' })}>
                <Plus className="h-4 w-4" />
                {t('cnnSubs.createTitle', 'Créer un abonnement')}
              </Button>
            )}
          </FilterBar>
        }
        empty={!plans.isLoading && rows.length === 0 ? <EmptyState icon={<CreditCard />} title={t('cnnSubs.noPlans', 'Aucune formule')} hint={t('cnnSubs.noPlansHint', 'Créez la première formule d’abonnement.')} /> : undefined}
        footer={paged.footer(t('cnnSubs.plansUnit', 'formules'))}
      >
        <Table minWidth={900}>
          <THead>
            <tr>
              <Th>{t('cnnSubs.plan', 'Nom de la formule')}</Th>
              <Th align="right">{t('cnnSubs.monthlyPrice', 'Prix mensuel')}</Th>
              <Th align="right">{t('cnnSubs.coursesLimit', 'Courses incluses')}</Th>
              <Th>{t('cnnSubs.validity', 'Validité')}</Th>
              <Th>{t('cnnAdmin.orders.status', 'Statut')}</Th>
              <Th align="right">{t('cnnSubs.clients', 'Clients')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {paged.shown.map((p) => (
              <Tr key={p.id} className="group/row">
                <Td>
                  <CellStack title={p.planType || '–'} meta={p.allowCustomDuration ? t('cnnSubs.customDuration', 'Durée libre') : undefined} />
                </Td>
                <Td align="right" className="whitespace-nowrap tabular-nums">
                  {fmtAmount(p.monthlyPrice, p.currency, locale)}
                  {p.pricePerCourse != null && <span className="block text-[11.5px] text-ink-3">{t('cnnSubs.perCourse', '{{p}} / course', { p: fmtAmount(p.pricePerCourse, p.currency, locale) })}</span>}
                </Td>
                <Td align="right" className="tabular-nums">{p.coursesLimit ?? t('cnnSubs.unlimited', 'Illimité')}</Td>
                <Td className="whitespace-nowrap text-ink-2">
                  {p.startDate || p.expirationDate ? `${fmtDay(p.startDate, locale)} → ${fmtDay(p.expirationDate, locale)}` : '–'}
                </Td>
                <Td>
                  <SubBadge status={p.status} />
                </Td>
                <Td align="right" className="tabular-nums">{p.clientCount}</Td>
                <Td align="right">
                  <RowActions>
                    {canUpdate && (
                      <IconAction label={t('cnnAdmin.common.edit', 'Modifier')} onClick={() => setEditor({ mode: 'edit', plan: p })}>
                        <Pencil />
                      </IconAction>
                    )}
                    {canDelete && (
                      <IconAction tone="danger" label={t('cnnAdmin.common.delete', 'Supprimer')} onClick={() => setPending(p)}>
                        <Trash2 />
                      </IconAction>
                    )}
                  </RowActions>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
      <SubscriptionPlanModal
        open={editor != null}
        plan={plan}
        plans={plans.data ?? []}
        busy={save.isPending}
        error={error}
        onSubmit={(body) => save.mutate({ id: plan?.id, body })}
        onClose={() => {
          setEditor(null)
          setError(null)
        }}
      />
      <ConfirmDialog
        open={pending != null}
        title={t('cnnSubs.deleteTitle', 'Supprimer cette formule ?')}
        message={t('cnnSubs.deleteMessage', 'La formule « {{name}} » sera supprimée de Colis na Nga. Les clients qui l’utilisent doivent d’abord changer de formule.', { name: pending?.planType ?? '' })}
        confirmLabel={t('cnnAdmin.common.delete', 'Supprimer')}
        danger
        busy={remove.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && remove.mutate(pending.id)}
      />
    </>
  )
}

// ── Clients abonnés ────────────────────────────────────────────────────────────

function ClientsTab({ onNotice }: { onNotice: (m: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim().toLowerCase(), 250)
  const [pending, setPending] = useState<{ kind: 'validate' | 'toggle'; client: CnnSubscribedClient } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const clients = useQuery({ queryKey: ['cnn-ops', 'subscribed-clients'], queryFn: cnnOps.subscribedClients, enabled: relay.writable && relay.can('MANAGE_CNN_CLIENTS', 'VIEW') })
  const rows = useMemo(
    () =>
      (clients.data ?? [])
        .filter((c) => !status || c.status === status)
        .filter((c) => !q || [c.companyName, c.phone, c.email].some((x) => (x ?? '').toLowerCase().includes(q)))
        .sort((a, b) => (a.companyName ?? '').localeCompare(b.companyName ?? '')),
    [clients.data, status, q],
  )
  const paged = usePaged(rows)
  const done = (message: string | null, err: string | null) => {
    if (message) {
      onNotice(message)
      setPending(null)
    }
    setError(err)
  }
  const keys = [['cnn-ops', 'subscribed-clients']]
  const validate = useRelayMutation((id: string) => cnnOps.validateClient(id), keys, done, t('cnnSubs.validated', 'Abonnement validé.'))
  const toggle = useRelayMutation((c: CnnSubscribedClient) => cnnOps.setClientSubscriptionActive(c.id, !c.active), keys, done, t('cnnAdmin.common.statusChanged', 'Statut mis à jour.'))
  const canUpdate = relay.can('MANAGE_CNN_CLIENTS', 'UPDATE')

  return (
    <>
      {clients.isError && <Feedback tone="danger">{relayErrorMessage(clients.error, (k, v) => t(k, v))}</Feedback>}
      <TableCard
        loading={clients.isLoading && clients.fetchStatus !== 'idle'}
        toolbar={
          <FilterBar>
            <SearchField
              value={search}
              onChange={(v) => {
                setSearch(v)
                paged.reset()
              }}
              placeholder={t('cnnSubs.searchClient', 'Entreprise, téléphone, e-mail…')}
            />
            <FilterSelect value={status} onChange={(e) => setStatus(e.target.value)} active={Boolean(status)} aria-label={t('cnnAdmin.orders.status', 'Statut')}>
              <option value="">{t('cnnSubs.allStatuses', 'Tous les statuts')}</option>
              {SUB_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`cnnSubs.status.${s}`, { defaultValue: s })}
                </option>
              ))}
            </FilterSelect>
          </FilterBar>
        }
        empty={!clients.isLoading && rows.length === 0 ? <EmptyState icon={<Users />} title={t('cnnSubs.noClients', 'Aucun client abonné')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={paged.footer(t('cnnSubs.clientsUnit', 'clients'))}
      >
        <Table minWidth={860}>
          <THead>
            <tr>
              <Th>{t('cnnSubs.company', 'Entreprise')}</Th>
              <Th>{t('cnnSubs.contact', 'Contact')}</Th>
              <Th>{t('cnnSubs.billing', 'Facturation')}</Th>
              <Th>{t('cnnAdmin.orders.status', 'Statut')}</Th>
              <Th>{t('cnnSubs.validatedAt', 'Validé le')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {paged.shown.map((c) => (
              <Tr key={c.id} className="group/row">
                <Td>
                  <CellStack title={c.companyName || '–'} meta={c.companyInfo ?? undefined} />
                </Td>
                <Td>
                  <CellStack title={c.phone || '–'} meta={c.email ?? undefined} />
                </Td>
                <Td className="max-w-[220px] truncate text-ink-2">{c.billingTerms || '–'}</Td>
                <Td>
                  <span className="flex flex-wrap gap-1.5">
                    <SubBadge status={c.status} />
                    {c.active === false && <Badge tone="muted">{t('cnnAdmin.common.inactive', 'Désactivé')}</Badge>}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(c.validatedAt, locale)}</Td>
                <Td align="right">
                  {canUpdate && (
                    <RowActions>
                      {c.status === 'PENDING' && (
                        <IconAction label={t('cnnSubs.validate', 'Valider l’abonnement')} onClick={() => setPending({ kind: 'validate', client: c })}>
                          <BadgeCheck />
                        </IconAction>
                      )}
                      <IconAction label={c.active ? t('cnnAdmin.common.deactivate', 'Désactiver') : t('cnnAdmin.common.activate', 'Activer')} onClick={() => setPending({ kind: 'toggle', client: c })}>
                        {c.active ? <PowerOff /> : <Power />}
                      </IconAction>
                    </RowActions>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
      <ConfirmDialog
        open={pending?.kind === 'validate'}
        title={t('cnnSubs.validateTitle', 'Valider cet abonnement ?')}
        message={t('cnnSubs.validateMessage', '{{name}} pourra commander avec les conditions de son abonnement.', { name: pending?.client.companyName ?? '' })}
        confirmLabel={t('cnnSubs.validate', 'Valider l’abonnement')}
        busy={validate.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && validate.mutate(pending.client.id)}
      />
      <ConfirmDialog
        open={pending?.kind === 'toggle'}
        title={pending?.client.active ? t('cnnSubs.deactivateTitle', 'Suspendre cet abonnement ?') : t('cnnSubs.activateTitle', 'Réactiver cet abonnement ?')}
        message={
          pending?.client.active
            ? t('cnnSubs.deactivateMessage', 'Le client repassera aux tarifs normaux tant que l’abonnement est suspendu.')
            : t('cnnSubs.activateMessage', 'Le client retrouvera les conditions de son abonnement.')
        }
        confirmLabel={pending?.client.active ? t('cnnAdmin.common.deactivate', 'Désactiver') : t('cnnAdmin.common.activate', 'Activer')}
        danger={Boolean(pending?.client.active)}
        busy={toggle.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && toggle.mutate(pending.client)}
      />
    </>
  )
}

// ── Factures ───────────────────────────────────────────────────────────────────

function InvoicesTab({ onNotice }: { onNotice: (m: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [status, setStatus] = useState('')
  const [editing, setEditing] = useState<CnnInvoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const invoices = useQuery({ queryKey: ['cnn-ops', 'invoices', status], queryFn: () => cnnOps.invoices(status || undefined), enabled: relay.writable && relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'VIEW') })
  const rows = useMemo(() => [...(invoices.data ?? [])].sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? '')), [invoices.data])
  const paged = usePaged(rows)
  const unpaid = rows.filter((r) => r.status !== 'PAID')
  const done = (message: string | null, err: string | null) => {
    if (message) {
      onNotice(message)
      setEditing(null)
    }
    setError(err)
  }
  const setStatusMut = useRelayMutation(({ id, s }: { id: string; s: InvoiceStatus }) => cnnOps.setInvoiceStatus(id, s), [['cnn-ops', 'invoices']], done, t('cnnSubs.invoiceUpdated', 'Facture mise à jour.'))
  const canUpdate = relay.can('MANAGE_CNN_SUBSCRIPTIONS', 'UPDATE')

  return (
    <>
      {invoices.isError && <Feedback tone="danger">{relayErrorMessage(invoices.error, (k, v) => t(k, v))}</Feedback>}
      <TableCard
        loading={invoices.isLoading && invoices.fetchStatus !== 'idle'}
        toolbar={
          <FilterBar>
            <FilterSelect
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                paged.reset()
              }}
              active={Boolean(status)}
              aria-label={t('cnnAdmin.orders.status', 'Statut')}
            >
              <option value="">{t('cnnSubs.allInvoices', 'Toutes les factures')}</option>
              {(['PAID', 'PENDING', 'UNPAID'] as InvoiceStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(`cnnSubs.invoiceStatus.${s}`, { defaultValue: s })}
                </option>
              ))}
            </FilterSelect>
            {!status && rows.length > 0 && (
              <p className="ml-auto text-[12.5px] text-ink-3">{t('cnnSubs.unpaidCount', '{{n}} facture(s) non réglée(s)', { n: unpaid.length })}</p>
            )}
          </FilterBar>
        }
        empty={!invoices.isLoading && rows.length === 0 ? <EmptyState icon={<FileText />} title={t('cnnSubs.noInvoices', 'Aucune facture')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={paged.footer(t('cnnSubs.invoicesUnit', 'factures'))}
      >
        <Table minWidth={960}>
          <THead>
            <tr>
              <Th>{t('cnnSubs.client', 'Client')}</Th>
              <Th>{t('cnnSubs.planShort', 'Formule')}</Th>
              <Th align="right">{t('cnnSubs.amount', 'Montant')}</Th>
              <Th>{t('cnnSubs.paymentMode', 'Paiement')}</Th>
              <Th>{t('cnnSubs.issued', 'Émise le')}</Th>
              <Th>{t('cnnSubs.due', 'Échéance')}</Th>
              <Th>{t('cnnAdmin.orders.status', 'Statut')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {paged.shown.map((i) => (
              <Tr key={i.id} className="group/row">
                <Td>
                  <CellStack title={i.clientName || '–'} meta={i.exclusiveCourier ? t('cnnSubs.exclusive', 'Coursier dédié') : undefined} />
                </Td>
                <Td className="text-ink-2">{i.planLabel || '–'}</Td>
                <Td align="right" className="whitespace-nowrap tabular-nums">
                  {fmtAmount(i.amount, i.currency, locale)}
                  {i.exclusivitySurcharge ? <span className="block text-[11.5px] text-ink-3">{t('cnnSubs.surcharge', 'dont {{p}} d’exclusivité', { p: fmtAmount(i.exclusivitySurcharge, i.currency, locale) })}</span> : null}
                </Td>
                <Td className="text-ink-2">{i.paymentMode ? t(`cnnStats.payment.${i.paymentMode}`, { defaultValue: i.paymentMode }) : '–'}</Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(i.issuedAt, locale)}</Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDay(i.dueAt, locale)}</Td>
                <Td>
                  <Badge tone={INVOICE_TONES[i.status] ?? 'muted'} dot>
                    {t(`cnnSubs.invoiceStatus.${i.status}`, { defaultValue: i.status })}
                  </Badge>
                </Td>
                <Td align="right">
                  <RowActions>
                    {i.pdfUrl && (
                      <IconAction label={t('cnnSubs.openPdf', 'Ouvrir le PDF')} onClick={() => window.open(i.pdfUrl!, '_blank', 'noopener')}>
                        <FileText />
                      </IconAction>
                    )}
                    {canUpdate && (
                      <IconAction label={t('cnnSubs.changeStatus', 'Changer le statut')} onClick={() => setEditing(i)}>
                        <Pencil />
                      </IconAction>
                    )}
                  </RowActions>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
      <FormModal
        open={editing != null}
        title={t('cnnSubs.changeStatus', 'Changer le statut')}
        subtitle={editing ? `${editing.clientName ?? ''} · ${fmtAmount(editing.amount, editing.currency, locale)}` : undefined}
        fields={[
          {
            name: 'status',
            label: t('cnnAdmin.orders.status', 'Statut'),
            type: 'select',
            required: true,
            options: (['PAID', 'PENDING', 'UNPAID'] as InvoiceStatus[]).map((s) => ({ value: s, label: t(`cnnSubs.invoiceStatus.${s}`, { defaultValue: s }) })),
          },
        ]}
        initial={editing ? { status: editing.status } : undefined}
        submitLabel={t('cnnAdmin.common.save', 'Enregistrer')}
        busy={setStatusMut.isPending}
        error={error}
        onSubmit={(v) => editing && setStatusMut.mutate({ id: editing.id, s: v.status as InvoiceStatus })}
        onClose={() => {
          setEditing(null)
          setError(null)
        }}
      />
    </>
  )
}

// ── Crédits des motards ────────────────────────────────────────────────────────

function CreditsTab({ onNotice }: { onNotice: (m: string) => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim().toLowerCase(), 250)
  const [assigning, setAssigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canView = relay.can('MANAGE_CNN_MOTARDS', 'VIEW')
  const credits = useQuery({ queryKey: ['cnn-ops', 'credits'], queryFn: cnnOps.credits, enabled: canView })
  const motards = useQuery({ queryKey: ['cnn-admin', 'motards', 'APPROVED', ''], queryFn: () => cnnAdmin.motards('APPROVED'), enabled: canView && assigning })
  const rows = useMemo(
    () => (credits.data ?? []).filter((c) => !q || [c.motardName, c.motardPhone, c.associationName].some((x) => (x ?? '').toLowerCase().includes(q))),
    [credits.data, q],
  )
  const paged = usePaged(rows)
  const totals = useMemo(() => {
    const bought = (credits.data ?? []).filter((c) => !c.isFreeStarter && Number(c.amountPaid ?? 0) > 0)
    return {
      credits: bought.reduce((s, c) => s + c.creditsPurchased, 0),
      amount: bought.reduce((s, c) => s + Number(c.amountPaid ?? 0), 0),
      association: bought.reduce((s, c) => s + Number(c.associationRevenue ?? 0), 0),
    }
  }, [credits.data])
  const done = (message: string | null, err: string | null) => {
    if (message) {
      onNotice(message)
      setAssigning(false)
    }
    setError(err)
  }
  const assign = useRelayMutation(
    (v: Record<string, string>) => cnnOps.assignCredits(v.motardId, { creditCount: Number(v.creditCount), paymentMode: v.paymentMode as PaymentMode, offered: v.offered === 'true' }),
    [['cnn-ops', 'credits'], ['cnn-admin', 'motards']],
    done,
    t('cnnSubs.creditsAssigned', 'Crédits attribués au motard.'),
  )
  const canAssign = relay.can('MANAGE_CNN_MOTARDS', 'UPDATE')
  const kind = (c: (typeof rows)[number]) =>
    c.isFreeStarter ? t('cnnSubs.starter', 'Offerts à l’inscription') : Number(c.amountPaid ?? 0) === 0 ? t('cnnSubs.offered', 'Offerts') : t('cnnSubs.bought', 'Achetés')

  return (
    <>
      {credits.isError && <Feedback tone="danger">{relayErrorMessage(credits.error, (k, v) => t(k, v))}</Feedback>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Total label={t('cnnSubs.creditsSold', 'Crédits vendus')} value={totals.credits.toLocaleString(locale)} />
        <Total label={t('cnnSubs.creditsRevenue', 'Montant encaissé')} value={fmtAmount(totals.amount, 'CDF', locale)} />
        <Total label={t('cnnSubs.creditsAssociations', 'Part des associations')} value={fmtAmount(totals.association, 'CDF', locale)} />
      </div>
      <TableCard
        loading={credits.isLoading && credits.fetchStatus !== 'idle'}
        toolbar={
          <FilterBar>
            <SearchField
              value={search}
              onChange={(v) => {
                setSearch(v)
                paged.reset()
              }}
              placeholder={t('cnnSubs.searchMotard', 'Motard, téléphone, association…')}
            />
            {canAssign && (
              <Button size="sm" className="ml-auto" onClick={() => setAssigning(true)}>
                <Plus className="h-4 w-4" />
                {t('cnnSubs.assign', 'Attribuer des crédits')}
              </Button>
            )}
          </FilterBar>
        }
        empty={!credits.isLoading && rows.length === 0 ? <EmptyState icon={<Coins />} title={t('cnnSubs.noCredits', 'Aucun achat de crédits')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={paged.footer(t('cnnSubs.creditsUnit', 'opérations'))}
      >
        <Table minWidth={900}>
          <THead>
            <tr>
              <Th>{t('cnnSubs.date', 'Date')}</Th>
              <Th>{t('cnnSubs.motard', 'Motard')}</Th>
              <Th>{t('cnnSubs.association', 'Association')}</Th>
              <Th align="right">{t('cnnSubs.credits', 'Crédits')}</Th>
              <Th align="right">{t('cnnSubs.amount', 'Montant')}</Th>
              <Th>{t('cnnSubs.paymentMode', 'Paiement')}</Th>
              <Th>{t('cnnSubs.kind', 'Type')}</Th>
            </tr>
          </THead>
          <TBody>
            {paged.shown.map((c) => (
              <Tr key={c.id}>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(c.purchasedAt, locale)}</Td>
                <Td>
                  <CellStack title={c.motardName || '–'} meta={c.motardPhone ?? undefined} />
                </Td>
                <Td className="text-ink-2">{c.associationName || '–'}</Td>
                <Td align="right" className="tabular-nums font-semibold">{c.creditsPurchased.toLocaleString(locale)}</Td>
                <Td align="right" className="whitespace-nowrap tabular-nums">
                  {fmtAmount(c.amountPaid, 'CDF', locale)}
                  {Number(c.associationRevenue ?? 0) > 0 && <span className="block text-[11.5px] text-ink-3">{t('cnnSubs.assoShare', 'dont {{p}} pour l’association', { p: fmtAmount(c.associationRevenue, 'CDF', locale) })}</span>}
                </Td>
                <Td className="text-ink-2">{c.paymentMode ? t(`cnnStats.payment.${c.paymentMode}`, { defaultValue: c.paymentMode }) : '–'}</Td>
                <Td>
                  <Badge tone={c.isFreeStarter || Number(c.amountPaid ?? 0) === 0 ? 'violet' : 'success'}>{kind(c)}</Badge>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      </TableCard>
      <FormModal
        open={assigning}
        title={t('cnnSubs.assign', 'Attribuer des crédits')}
        subtitle={t('cnnSubs.assignHint', 'Ajoute des crédits au solde d’un motard partenaire approuvé.')}
        fields={[
          {
            name: 'motardId',
            label: t('cnnSubs.motard', 'Motard'),
            type: 'select',
            required: true,
            options: (motards.data ?? []).map((m) => ({
              value: m.id,
              label: `${[m.firstName, m.lastName].filter(Boolean).join(' ') || m.phone} · ${m.associationName ?? ''} · ${t('cnnSubs.balance', 'solde {{n}}', { n: m.creditBalance ?? 0 })}`,
            })),
          },
          { name: 'creditCount', label: t('cnnSubs.creditCount', 'Nombre de crédits'), type: 'number', required: true, half: true, min: '2', step: '1', hint: t('cnnSubs.min2', 'Au moins 2') },
          { name: 'paymentMode', label: t('cnnSubs.paymentMode', 'Paiement'), type: 'select', required: true, half: true, options: PAYMENT_MODES.map((m) => ({ value: m, label: t(`cnnStats.payment.${m}`, { defaultValue: m }) })) },
          { name: 'offered', label: t('cnnSubs.offeredLabel', 'Gratuit'), type: 'checkbox', hint: t('cnnSubs.offeredHint', 'Crédits offerts : aucun montant encaissé, pas de part pour l’association') },
        ]}
        initial={{ paymentMode: 'CASH', creditCount: '10' }}
        submitLabel={t('cnnSubs.assignSubmit', 'Attribuer')}
        busy={assign.isPending}
        error={error ?? (motards.isError ? relayErrorMessage(motards.error, (k, v) => t(k, v)) : null)}
        onSubmit={(v) => {
          if (Number(v.creditCount) < 2) {
            setError(t('cnnSubs.min2Error', 'Attribuez au moins 2 crédits.'))
            return
          }
          assign.mutate(v)
        }}
        onClose={() => {
          setAssigning(false)
          setError(null)
        }}
      />
    </>
  )
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="clay rounded-[var(--radius-ma)] px-4 py-3.5">
      <p className="text-[12.5px] text-ink-3">{label}</p>
      <p className="mt-0.5 text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value}</p>
    </div>
  )
}


