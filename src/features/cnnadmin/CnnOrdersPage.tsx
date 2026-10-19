import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Ban, Eye, Package, Route, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Modal } from '../../components/ui/modal'
import { EmptyState } from '../../components/ui/scope-empty'
import { CellStack, IconAction, Mono, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { DetailList, FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { cnnAdmin, useCnnRelay, type CnnOrder } from '../../lib/api/cnnAdmin'
import {
  CnnAdminHeader,
  ConfirmDialog,
  ORDER_STATUSES,
  OrderStatusBadge,
  RelayNotice,
  fmtDateTime,
  fmtMoney,
  isFinalOrder,
  relayErrorMessage,
  useLocaleTag,
  useRelayMutation,
} from './shared'
import { useDebounced } from './useDebounced'

type Pending = { kind: 'cancel' | 'delete'; order: CnnOrder } | null

export function CnnOrdersPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [status, setStatus] = useState('')
  const [searchParams] = useSearchParams()
  const [search, setSearch] = useState(() => searchParams.get('q') ?? '')
  const q = useDebounced(search, 350)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [detail, setDetail] = useState<CnnOrder | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const orders = useQuery({
    queryKey: ['cnn-admin', 'orders', status, q],
    queryFn: () => cnnAdmin.orders(status || undefined, q || undefined),
    enabled: relay.can('MANAGE_CNN_ORDERS', 'VIEW'),
    refetchInterval: 20_000,
  })

  const rows = useMemo(
    () => [...(orders.data ?? [])].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? '')),
    [orders.data],
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const shown = rows.slice((current - 1) * pageSize, current * pageSize)

  const done = (message: string | null, err: string | null) => {
    if (message) {
      setNotice(message)
      setPending(null)
      setDetail(null)
    }
    setError(err)
  }
  const cancel = useRelayMutation((id: string) => cnnAdmin.cancelOrder(id), [['cnn-admin', 'orders'], ['cnn-admin', 'dashboard']], done, t('cnnAdmin.orders.cancelled', 'Commande annulée.'))
  const remove = useRelayMutation((id: string) => cnnAdmin.deleteOrder(id), [['cnn-admin', 'orders'], ['cnn-admin', 'dashboard']], done, t('cnnAdmin.orders.deleted', 'Commande supprimée.'))

  const canCancel = relay.can('MANAGE_CNN_ORDERS', 'UPDATE')
  const canDelete = relay.can('MANAGE_CNN_ORDERS', 'DELETE')

  return (
    <div className="space-y-6">
      <CnnAdminHeader
        title={t('cnnAdmin.tabs.orders', 'Commandes')}
        subtitle={t('cnnAdmin.orders.subtitle', 'Toutes les commandes passées sur Colis na Nga, en temps réel.')}
      />
      <RelayNotice />
      {orders.isError && <Feedback tone="danger">{relayErrorMessage(orders.error, (k, v) => t(k, v))}</Feedback>}

      <TableCard
        loading={orders.isLoading}
        toolbar={
          <FilterBar>
            <SearchField value={search} onChange={(v) => {
                setSearch(v)
                setPage(1)
              }} placeholder={t('cnnAdmin.orders.search', 'Adresse de départ ou d’arrivée…')} />
            <FilterSelect value={status} onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }} active={Boolean(status)} aria-label={t('cnnAdmin.common.status', 'Statut')}>
              <option value="">{t('cnnAdmin.orders.allStatuses', 'Tous les statuts')}</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`cnnAdmin.orderStatus.${s}`, { defaultValue: s })}
                </option>
              ))}
            </FilterSelect>
          </FilterBar>
        }
        empty={
          !orders.isLoading && rows.length === 0 ? (
            <EmptyState icon={<Package />} title={t('cnnAdmin.orders.empty', 'Aucune commande')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} />
          ) : undefined
        }
        footer={
          rows.length > 0 ? (
            <Pagination page={current} pageCount={pageCount} total={rows.length} pageSize={pageSize} onPage={setPage} onPageSize={(n) => {
                  setPageSize(n)
                  setPage(1)
                }} unit={t('cnnAdmin.orders.unit', 'commandes')} />
          ) : undefined
        }
      >
        <Table minWidth={980}>
          <THead>
            <tr>
              <Th>{t('cnnAdmin.orders.ref', 'Réf.')}</Th>
              <Th>{t('cnnAdmin.orders.client', 'Client')}</Th>
              <Th>{t('cnnAdmin.orders.route', 'Trajet')}</Th>
              <Th>{t('cnnAdmin.orders.courier', 'Coursier')}</Th>
              <Th align="right">{t('cnnAdmin.orders.price', 'Prix')}</Th>
              <Th>{t('cnnAdmin.common.status', 'Statut')}</Th>
              <Th>{t('cnnAdmin.orders.created', 'Créée')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {shown.map((o) => (
              <Tr key={o.id} onClick={() => setDetail(o)} className="group/row">
                <Td>
                  <Mono>{o.id.slice(0, 8).toUpperCase()}</Mono>
                </Td>
                <Td>
                  <CellStack title={o.clientFirstName || '–'} meta={o.clientPhone ?? undefined} />
                </Td>
                <Td className="max-w-[300px]">
                  <CellStack title={<span className="block truncate">{o.pickupAddress || '–'}</span>} meta={<span className="block truncate">→ {o.deliveryAddress || '–'}</span>} />
                </Td>
                <Td>
                  {o.courierType === 'PARTNER_MOTARD' ? (
                    <Badge tone="teal">{t('cnnAdmin.orders.motard', 'Motard')}</Badge>
                  ) : o.courierType === 'COMPANY_AGENT' ? (
                    <Badge tone="info">{t('cnnAdmin.orders.agent', 'Livreur')}</Badge>
                  ) : (
                    <span className="text-ink-3">–</span>
                  )}
                </Td>
                <Td align="right" className="tabular-nums">
                  {fmtMoney(o.estimatedPrice, locale)}
                </Td>
                <Td>
                  <OrderStatusBadge status={o.orderStatus} />
                </Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(o.createdAt, locale)}</Td>
                <Td align="right">
                  <RowActions>
                    <IconAction label={t('cnnTrace.follow', 'Suivre l’itinéraire')} onClick={() => navigate(`/colis-na-nga/carte?commande=${o.id}`)}>
                      <Route />
                    </IconAction>
                    <IconAction label={t('cnnAdmin.common.view', 'Voir')} onClick={() => setDetail(o)}>
                      <Eye />
                    </IconAction>
                    {canCancel && !isFinalOrder(o.orderStatus) && (
                      <IconAction label={t('cnnAdmin.orders.cancel', 'Annuler la commande')} onClick={() => setPending({ kind: 'cancel', order: o })}>
                        <Ban />
                      </IconAction>
                    )}
                    {canDelete && (
                      <IconAction tone="danger" label={t('cnnAdmin.common.delete', 'Supprimer')} onClick={() => setPending({ kind: 'delete', order: o })}>
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

      <Modal
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        kicker="Colis na Nga"
        title={detail ? `${t('cnnAdmin.orders.order', 'Commande')} ${detail.id.slice(0, 8).toUpperCase()}` : ''}
        size="lg"
        footer={
          detail && (
            <>
              {canDelete && (
                <Button variant="ghost" className="mr-auto text-status-danger" onClick={() => setPending({ kind: 'delete', order: detail })}>
                  <Trash2 className="h-4 w-4" />
                  {t('cnnAdmin.common.delete', 'Supprimer')}
                </Button>
              )}
              {canCancel && !isFinalOrder(detail.orderStatus) && (
                <Button variant="outline" onClick={() => setPending({ kind: 'cancel', order: detail })}>
                  {t('cnnAdmin.orders.cancel', 'Annuler la commande')}
                </Button>
              )}
              <Button variant="gold" onClick={() => setDetail(null)}>
                {t('cnnAdmin.common.close', 'Fermer')}
              </Button>
            </>
          )
        }
      >
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <OrderStatusBadge status={detail.orderStatus} />
              {detail.isSecret && <Badge tone="violet">{t('cnnAdmin.orders.secret', 'Colis secret')}</Badge>}
              {detail.requiresReturnTrip && <Badge tone="info">{t('cnnAdmin.orders.returnTrip', 'Aller-retour')}</Badge>}
              {detail.thirdPartyOrder && <Badge tone="gold">{t('cnnAdmin.orders.thirdParty', 'Pour un tiers')}</Badge>}
            </div>
            <DetailList
              columns={2}
              items={[
                { label: t('cnnAdmin.orders.client', 'Client'), value: [detail.clientFirstName, detail.clientPhone].filter(Boolean).join(' · ') || '–' },
                { label: t('cnnAdmin.orders.recipient', 'Destinataire'), value: [detail.recipientName, detail.recipientPhone].filter(Boolean).join(' · ') || '–' },
                { label: t('cnnAdmin.orders.pickup', 'Enlèvement'), value: detail.pickupAddress || '–' },
                { label: t('cnnAdmin.orders.delivery', 'Livraison'), value: detail.deliveryAddress || '–' },
                { label: t('cnnAdmin.orders.pickupContact', 'Contact enlèvement'), value: [detail.pickupContactName, detail.pickupContactPhone].filter(Boolean).join(' · ') || '–' },
                { label: t('cnnAdmin.orders.parcel', 'Colis'), value: [detail.parcelType, detail.parcelDescription].filter(Boolean).join(' · ') || '–' },
                { label: t('cnnAdmin.orders.distance', 'Distance'), value: detail.estimatedDistanceKm != null ? `${Number(detail.estimatedDistanceKm).toFixed(1)} km` : '–' },
                { label: t('cnnAdmin.orders.price', 'Prix'), value: fmtMoney(detail.estimatedPrice, locale) },
                { label: t('cnnAdmin.orders.payment', 'Paiement'), value: [detail.paymentMode, detail.paymentTiming && t(`cnnAdmin.paymentTiming.${detail.paymentTiming}`, { defaultValue: detail.paymentTiming })].filter(Boolean).join(' · ') || '–' },
                { label: t('cnnAdmin.orders.created', 'Créée'), value: fmtDateTime(detail.createdAt, locale) },
              ]}
            />
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={pending?.kind === 'cancel'}
        title={t('cnnAdmin.orders.cancelTitle', 'Annuler cette commande ?')}
        message={t('cnnAdmin.orders.cancelMessage', 'Le client et le coursier seront prévenus par l’application, comme pour une annulation faite par un administrateur.')}
        confirmLabel={t('cnnAdmin.orders.cancel', 'Annuler la commande')}
        danger
        busy={cancel.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && cancel.mutate(pending.order.id)}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={t('cnnAdmin.orders.deleteTitle', 'Supprimer cette commande ?')}
        message={t('cnnAdmin.orders.deleteMessage', 'La commande disparaîtra de l’historique Colis na Nga. Cette action est définitive.')}
        confirmLabel={t('cnnAdmin.common.delete', 'Supprimer')}
        danger
        busy={remove.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && remove.mutate(pending.order.id)}
      />
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}
