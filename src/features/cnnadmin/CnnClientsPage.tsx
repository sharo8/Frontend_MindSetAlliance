import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { BadgeCheck, Eye, Pencil, Power, PowerOff, Route, Trash2, Users } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Feedback } from '../../components/ui/feedback'
import { Modal } from '../../components/ui/modal'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { Skeleton } from '../../components/ui/skeleton'
import { CellStack, IconAction, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { cnnClients, useCnnRelay, type CnnClient } from '../../lib/api/cnnAdmin'
import { ActiveBadge, CnnAdminHeader, ConfirmDialog, OrderStatusBadge, PersonCell, RelayNotice, fmtDateTime, fmtMoney, fullName, relayErrorMessage, useLocaleTag, useRelayMutation } from './shared'
import { FormModal, compact } from './FormModal'
import { useDebounced } from './useDebounced'

type Kind = 'ALL' | 'SUBSCRIBED' | 'ONE_TIME'
type Pending = { kind: 'toggle' | 'delete'; client: CnnClient } | null

/** Tous les clients Colis na Nga : abonnés (entreprises) et ponctuels, avec leur activité. */
export function CnnClientsPage() {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [kind, setKind] = useState<Kind>('ALL')
  const [account, setAccount] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search.trim(), 350)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [detail, setDetail] = useState<CnnClient | null>(null)
  const [editing, setEditing] = useState<CnnClient | null>(null)
  const [subscribing, setSubscribing] = useState<CnnClient | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const clients = useQuery({
    queryKey: ['cnn-admin', 'clients', q],
    queryFn: () => cnnClients.list(undefined, q || undefined),
    enabled: relay.can('MANAGE_CNN_CLIENTS', 'VIEW'),
  })
  const all = useMemo(() => clients.data ?? [], [clients.data])
  const rows = useMemo(
    () =>
      all
        .filter((c) => kind === 'ALL' || c.type === kind)
        .filter((c) => !account || (account === 'ACTIVE' ? c.active !== false : c.active === false)),
    [all, kind, account],
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const shown = rows.slice((current - 1) * pageSize, current * pageSize)
  const totals = {
    all: all.length,
    subscribed: all.filter((c) => c.type === 'SUBSCRIBED').length,
    oneTime: all.filter((c) => c.type === 'ONE_TIME').length,
    active: all.filter((c) => c.active !== false).length,
  }

  const done = (message: string | null, err: string | null) => {
    if (message) {
      setNotice(message)
      setEditing(null)
      setSubscribing(null)
      setPending(null)
    }
    setError(err)
  }
  const keys = [['cnn-admin', 'clients'], ['cnn-ops', 'subscribed-clients'], ['cnn-synthese']]
  const update = useRelayMutation(({ id, v }: { id: string; v: Record<string, string> }) => cnnClients.update(id, v), keys, done, t('cnnAdmin.common.saved', 'Modifications enregistrées.'))
  const toggle = useRelayMutation((c: CnnClient) => cnnClients.setActive(c.id, c.active === false), keys, done, t('cnnAdmin.common.statusChanged', 'Statut mis à jour.'))
  const subscribe = useRelayMutation(
    ({ id, v }: { id: string; v: Record<string, string> }) => cnnClients.subscribe(id, { companyName: v.companyName, companyInfo: v.companyInfo || undefined, billingTerms: v.billingTerms || undefined }),
    keys,
    done,
    t('cnnClients.subscribed', 'Client passé en abonné. Validez son abonnement dans Abonnements et crédits.'),
  )
  const remove = useRelayMutation((id: string) => cnnClients.remove(id), keys, done, t('cnnClients.deleted', 'Client supprimé.'))
  const canUpdate = relay.can('MANAGE_CNN_CLIENTS', 'UPDATE')
  const canSubscribe = relay.can('MANAGE_CNN_CLIENTS', 'UPDATE')
  const canDelete = relay.can('MANAGE_CNN_CLIENTS', 'DELETE')

  return (
    <div className="space-y-6">
      <CnnAdminHeader title={t('cnnClients.title', 'Clients')} subtitle={t('cnnClients.subtitle', 'Tous les clients de Colis na Nga : abonnés (entreprises) et ponctuels, avec leurs commandes.')} />
      <RelayNotice />
      {clients.isError && <Feedback tone="danger">{relayErrorMessage(clients.error, (k, v) => t(k, v))}</Feedback>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Total label={t('cnnClients.total', 'Clients')} value={totals.all} loading={clients.isLoading} />
        <Total label={t('cnnClients.subscribedCount', 'Abonnés')} value={totals.subscribed} loading={clients.isLoading} />
        <Total label={t('cnnClients.oneTimeCount', 'Ponctuels')} value={totals.oneTime} loading={clients.isLoading} />
        <Total label={t('cnnClients.activeCount', 'Comptes actifs')} value={totals.active} loading={clients.isLoading} />
      </div>

      <TableCard
        loading={clients.isLoading}
        toolbar={
          <FilterBar>
            <SearchField
              value={search}
              onChange={(v) => {
                setSearch(v)
                setPage(1)
              }}
              placeholder={t('cnnClients.search', 'Nom, téléphone, e-mail, entreprise…')}
            />
            <Segmented<Kind>
              size="sm"
              value={kind}
              onChange={(v) => {
                setKind(v)
                setPage(1)
              }}
              ariaLabel={t('cnnClients.kind', 'Type de client')}
              options={[
                { value: 'ALL', label: t('cnnClients.all', 'Tous') },
                { value: 'SUBSCRIBED', label: t('cnnClients.subscribedCount', 'Abonnés') },
                { value: 'ONE_TIME', label: t('cnnClients.oneTimeCount', 'Ponctuels') },
              ]}
            />
            <FilterSelect
              value={account}
              onChange={(e) => {
                setAccount(e.target.value)
                setPage(1)
              }}
              active={Boolean(account)}
              aria-label={t('cnnAdmin.common.account', 'Compte')}
            >
              <option value="">{t('cnnClients.allAccounts', 'Actifs et désactivés')}</option>
              <option value="ACTIVE">{t('cnnAdmin.common.active', 'Actif')}</option>
              <option value="INACTIVE">{t('cnnAdmin.common.inactive', 'Désactivé')}</option>
            </FilterSelect>
          </FilterBar>
        }
        empty={!clients.isLoading && rows.length === 0 ? <EmptyState icon={<Users />} title={t('cnnClients.empty', 'Aucun client')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={
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
              unit={t('cnnClients.unit', 'clients')}
            />
          ) : undefined
        }
      >
        <Table minWidth={1040}>
          <THead>
            <tr>
              <Th>{t('cnnClients.client', 'Client')}</Th>
              <Th>{t('cnnClients.kind', 'Type de client')}</Th>
              <Th align="right">{t('cnnClients.orders', 'Commandes')}</Th>
              <Th align="right">{t('cnnClients.spent', 'Dépensé')}</Th>
              <Th>{t('cnnClients.lastOrder', 'Dernière commande')}</Th>
              <Th>{t('cnnClients.since', 'Inscrit le')}</Th>
              <Th>{t('cnnAdmin.common.account', 'Compte')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {shown.map((c) => (
              <Tr key={c.id} className="group/row">
                <Td>
                  <PersonCell first={c.firstName} last={c.lastName} phone={c.phone} photo={c.profilePhotoUrl} />
                </Td>
                <Td>
                  {c.type === 'SUBSCRIBED' ? (
                    <CellStack
                      title={
                        <Badge tone="gold" dot>
                          {t('cnnClients.subscribedOne', 'Abonné')}
                        </Badge>
                      }
                      meta={[c.companyName, c.planType, c.subscriptionStatus ? t(`cnnSubs.status.${c.subscriptionStatus}`, { defaultValue: c.subscriptionStatus }) : null].filter(Boolean).join(' · ')}
                    />
                  ) : (
                    <Badge tone="muted">{t('cnnClients.oneTimeOne', 'Ponctuel')}</Badge>
                  )}
                </Td>
                <Td align="right" className="whitespace-nowrap tabular-nums">
                  <span className="font-semibold text-ink">{c.orders.toLocaleString(locale)}</span>
                  <span className="block text-[11.5px] text-ink-3">{t('cnnClients.deliveredN', '{{n}} livrées', { n: c.delivered })}</span>
                </Td>
                <Td align="right" className="whitespace-nowrap tabular-nums">{fmtMoney(c.spent, locale)}</Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(c.lastOrderAt, locale)}</Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(c.createdAt, locale)}</Td>
                <Td>
                  <ActiveBadge active={c.active !== false} />
                </Td>
                <Td align="right">
                  <RowActions>
                    <IconAction label={t('cnnAdmin.common.view', 'Voir')} onClick={() => setDetail(c)}>
                      <Eye />
                    </IconAction>
                    {canUpdate && (
                      <>
                        <IconAction label={t('cnnAdmin.common.edit', 'Modifier')} onClick={() => setEditing(c)}>
                          <Pencil />
                        </IconAction>
                        <IconAction label={c.active === false ? t('cnnAdmin.common.activate', 'Activer') : t('cnnAdmin.common.deactivate', 'Désactiver')} onClick={() => setPending({ kind: 'toggle', client: c })}>
                          {c.active === false ? <Power /> : <PowerOff />}
                        </IconAction>
                      </>
                    )}
                    {canSubscribe && c.type === 'ONE_TIME' && (
                      <IconAction label={t('cnnClients.makeSubscribed', 'Passer en abonné')} onClick={() => setSubscribing(c)}>
                        <BadgeCheck />
                      </IconAction>
                    )}
                    {canDelete && (
                      <IconAction tone="danger" label={t('cnnAdmin.common.delete', 'Supprimer')} onClick={() => setPending({ kind: 'delete', client: c })}>
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

      <ClientDetail client={detail} onClose={() => setDetail(null)} />
      <FormModal
        open={editing != null}
        title={editing ? fullName(editing.firstName, editing.lastName, editing.phone) : ''}
        subtitle={t('cnnClients.editHint', 'Coordonnées du client')}
        fields={[
          { name: 'firstName', label: t('cnnAdmin.fields.firstName', 'Prénom'), half: true },
          { name: 'lastName', label: t('cnnAdmin.fields.lastName', 'Nom'), half: true },
          { name: 'phone', label: t('cnnAdmin.fields.phone', 'Téléphone'), type: 'tel', required: true, half: true },
          { name: 'email', label: t('cnnAdmin.fields.email', 'E-mail'), type: 'email', half: true },
        ]}
        initial={editing ? { firstName: editing.firstName ?? '', lastName: editing.lastName ?? '', phone: editing.phone ?? '', email: editing.email ?? '' } : undefined}
        submitLabel={t('cnnAdmin.common.save', 'Enregistrer')}
        busy={update.isPending}
        error={error}
        onSubmit={(v) => editing && update.mutate({ id: editing.id, v: compact(v) })}
        onClose={() => {
          setEditing(null)
          setError(null)
        }}
      />
      <FormModal
        open={subscribing != null}
        title={t('cnnClients.makeSubscribed', 'Passer en abonné')}
        subtitle={subscribing ? fullName(subscribing.firstName, subscribing.lastName, subscribing.phone) : undefined}
        fields={[
          { name: 'companyName', label: t('cnnSubs.company', 'Entreprise'), required: true },
          { name: 'companyInfo', label: t('cnnClients.companyInfo', 'Informations sur l’entreprise'), type: 'textarea' },
          { name: 'billingTerms', label: t('cnnSubs.billing', 'Facturation'), hint: t('cnnClients.billingHint', 'Ex. mensuel, fin de mois') },
        ]}
        submitLabel={t('cnnClients.makeSubscribedSubmit', 'Passer en abonné')}
        busy={subscribe.isPending}
        error={error}
        onSubmit={(v) => subscribing && subscribe.mutate({ id: subscribing.id, v })}
        onClose={() => {
          setSubscribing(null)
          setError(null)
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'toggle'}
        title={pending?.client.active === false ? t('cnnClients.activateTitle', 'Réactiver ce client ?') : t('cnnClients.deactivateTitle', 'Désactiver ce client ?')}
        message={
          pending?.client.active === false
            ? t('cnnClients.activateMessage', 'Il pourra de nouveau se connecter et commander.')
            : t('cnnClients.deactivateMessage', 'Il ne pourra plus se connecter ni commander. Ses commandes passées restent consultables.')
        }
        confirmLabel={pending?.client.active === false ? t('cnnAdmin.common.activate', 'Activer') : t('cnnAdmin.common.deactivate', 'Désactiver')}
        danger={pending?.client.active !== false}
        busy={toggle.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && toggle.mutate(pending.client)}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={t('cnnClients.deleteTitle', 'Supprimer ce client ?')}
        message={t('cnnClients.deleteMessage', 'Son compte sera supprimé de Colis na Nga. Cette action est définitive.')}
        confirmLabel={t('cnnAdmin.common.delete', 'Supprimer')}
        danger
        busy={remove.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && remove.mutate(pending.client.id)}
      />
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}

function Total({ label, value, loading }: { label: string; value: number; loading?: boolean }) {
  return (
    <div className="clay rounded-[var(--radius-ma)] px-4 py-3.5">
      <p className="text-[12.5px] text-ink-3">{label}</p>
      {loading ? <Skeleton className="mt-1.5 h-6 w-16 rounded-[8px]" /> : <p className="mt-0.5 text-[22px] font-semibold tabular-nums tracking-[-0.02em] text-ink">{value.toLocaleString()}</p>}
    </div>
  )
}

/** Fiche client : coordonnées, abonnement et toutes ses commandes (avec lien vers l'itinéraire). */
function ClientDetail({ client, onClose }: { client: CnnClient | null; onClose: () => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const navigate = useNavigate()
  const orders = useQuery({ queryKey: ['cnn-admin', 'client-orders', client?.id], queryFn: () => cnnClients.orders(client!.id), enabled: Boolean(client) })
  return (
    <Modal open={client != null} onClose={onClose} kicker="Colis na Nga" size="lg" title={client ? fullName(client.firstName, client.lastName, client.phone) : ''} subtitle={client ? [client.phone, client.email].filter(Boolean).join(' · ') : undefined}>
      {client && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {client.type === 'SUBSCRIBED' ? <Badge tone="gold" dot>{t('cnnClients.subscribedOne', 'Abonné')}</Badge> : <Badge tone="muted">{t('cnnClients.oneTimeOne', 'Ponctuel')}</Badge>}
            <ActiveBadge active={client.active !== false} />
            {client.companyName && <Badge tone="info">{client.companyName}</Badge>}
            {client.planType && <Badge tone="violet">{client.planType}</Badge>}
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Mini label={t('cnnClients.orders', 'Commandes')} value={client.orders.toLocaleString(locale)} />
            <Mini label={t('cnnClients.deliveredLabel', 'Livrées')} value={client.delivered.toLocaleString(locale)} />
            <Mini label={t('cnnClients.spent', 'Dépensé')} value={fmtMoney(client.spent, locale)} />
          </div>
          <div>
            <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-[0.06em] text-ink-3">{t('cnnClients.ordersTitle', 'Commandes')}</h3>
            {orders.isLoading && <Skeleton className="h-24 w-full rounded-[12px]" />}
            {orders.isError && <Feedback tone="danger">{relayErrorMessage(orders.error, (k, v) => t(k, v))}</Feedback>}
            {!orders.isLoading && (orders.data ?? []).length === 0 && <p className="text-[13px] text-ink-3">{t('cnnClients.noOrders', 'Aucune commande pour ce client.')}</p>}
            <ul className="divide-y divide-hairline">
              {(orders.data ?? []).map((o) => (
                <li key={o.id} className="flex items-start gap-3 py-2.5">
                  <span className="min-w-0 flex-1">
                    <span className="mb-1 flex flex-wrap items-center gap-1.5">
                      <span className="font-mono text-[12px] font-semibold text-ink">{o.id.slice(0, 8).toUpperCase()}</span>
                      <OrderStatusBadge status={o.orderStatus} />
                      <span className="text-[11.5px] text-ink-3">{fmtDateTime(o.createdAt, locale)}</span>
                    </span>
                    <span className="block truncate text-[12.5px] text-ink-2">{o.pickupAddress || '–'}</span>
                    <span className="block truncate text-[12.5px] text-ink-3">→ {o.deliveryAddress || '–'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[12.5px] font-semibold tabular-nums text-ink">{fmtMoney(o.estimatedPrice, locale)}</span>
                    <button type="button" onClick={() => navigate(`/colis-na-nga/carte?commande=${o.id}`)} className="mt-1 inline-flex items-center gap-1 text-[12px] font-semibold text-accent-ink hover:underline">
                      <Route className="h-3.5 w-3.5" />
                      {t('cnnTrace.follow', 'Suivre l’itinéraire')}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="clay-field rounded-[12px] px-2 py-2.5">
      <p className="truncate text-[11.5px] text-ink-3">{label}</p>
      <p className="truncate text-[15px] font-semibold tabular-nums text-ink">{value}</p>
    </div>
  )
}
