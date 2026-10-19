import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Bike, CheckCircle2, Pencil, Power, PowerOff, Trash2, XCircle } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Feedback } from '../../components/ui/feedback'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { Mono, IconAction, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { FilterBar, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { cnnAdmin, useCnnRelay, type CnnMotard } from '../../lib/api/cnnAdmin'
import { ActiveBadge, CnnAdminHeader, ConfirmDialog, DutyBadge, MotardStatusBadge, PersonCell, RelayNotice, fullName, relayErrorMessage, useRelayMutation } from './shared'
import { FormModal, compact, type FormField } from './FormModal'
import { useDebounced } from './useDebounced'

type Filter = 'TO_REVIEW' | 'APPROVED' | 'REJECTED' | 'ALL'
type Pending = { kind: 'approve' | 'reject' | 'toggle' | 'delete'; motard: CnnMotard } | null

const toReview = (m: CnnMotard) => m.validationStatus === 'PENDING_VALIDATION' || m.validationStatus === 'ASSOCIATION_VALIDATED'

export function CnnMotardsPage() {
  const { t } = useTranslation()
  const relay = useCnnRelay()
  const [filter, setFilter] = useState<Filter>('TO_REVIEW')
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 350)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [editing, setEditing] = useState<CnnMotard | null>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Liste complète (filtrée côté écran) : les compteurs des onglets restent justes.
  const motards = useQuery({
    queryKey: ['cnn-admin', 'motards', q],
    queryFn: () => cnnAdmin.motards(undefined, q || undefined),
    enabled: relay.can('MANAGE_CNN_MOTARDS', 'VIEW'),
    refetchInterval: 30_000,
  })

  const all = useMemo(() => motards.data ?? [], [motards.data])
  const counts = {
    TO_REVIEW: all.filter(toReview).length,
    APPROVED: all.filter((m) => m.validationStatus === 'APPROVED').length,
    REJECTED: all.filter((m) => m.validationStatus === 'REJECTED').length,
    ALL: all.length,
  }
  const rows = useMemo(
    () =>
      all
        .filter((m) => (filter === 'ALL' ? true : filter === 'TO_REVIEW' ? toReview(m) : m.validationStatus === filter))
        .sort((a, b) => fullName(a.firstName, a.lastName, a.phone).localeCompare(fullName(b.firstName, b.lastName, b.phone))),
    [all, filter],
  )
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const shown = rows.slice((current - 1) * pageSize, current * pageSize)

  const done = (message: string | null, err: string | null) => {
    if (message) {
      setNotice(message)
      setPending(null)
      setEditing(null)
    }
    setError(err)
  }
  const keys = [['cnn-admin', 'motards'], ['cnn-admin', 'dashboard']]
  const approve = useRelayMutation((id: string) => cnnAdmin.approveMotard(id), keys, done, t('cnnAdmin.motards.approved', 'Motard approuvé. Il peut maintenant se connecter.'))
  const reject = useRelayMutation(({ id, reason }: { id: string; reason: string }) => cnnAdmin.rejectMotard(id, reason), keys, done, t('cnnAdmin.motards.rejected', 'Inscription refusée.'))
  const toggle = useRelayMutation((m: CnnMotard) => cnnAdmin.setMotardActive(m.id, !m.active), keys, done, t('cnnAdmin.common.statusChanged', 'Statut mis à jour.'))
  const update = useRelayMutation(({ id, v }: { id: string; v: Record<string, string> }) => cnnAdmin.updateMotard(id, v), keys, done, t('cnnAdmin.common.saved', 'Modifications enregistrées.'))
  const remove = useRelayMutation((id: string) => cnnAdmin.deleteMotard(id), keys, done, t('cnnAdmin.motards.deleted', 'Motard supprimé.'))

  const canUpdate = relay.can('MANAGE_CNN_MOTARDS', 'UPDATE')
  const canDelete = relay.can('MANAGE_CNN_MOTARDS', 'DELETE')

  const editFields: FormField[] = [
    { name: 'firstName', label: t('cnnAdmin.fields.firstName', 'Prénom'), required: true, half: true },
    { name: 'lastName', label: t('cnnAdmin.fields.lastName', 'Nom'), required: true, half: true },
    { name: 'phone', label: t('cnnAdmin.fields.phone', 'Téléphone'), type: 'tel', required: true, half: true },
    { name: 'email', label: t('cnnAdmin.fields.email', 'E-mail'), type: 'email', half: true },
    { name: 'motoRegistrationNumber', label: t('cnnAdmin.fields.plate', 'Plaque de la moto'), required: true, half: true },
    { name: 'emergencyPhone', label: t('cnnAdmin.fields.emergencyPhone', 'Téléphone d’urgence'), type: 'tel', half: true },
  ]

  const close = () => {
    setPending(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <CnnAdminHeader title={t('cnnAdmin.tabs.motards', 'Motards')} subtitle={t('cnnAdmin.motards.subtitle', 'Motards partenaires des associations : inscriptions, validation et comptes.')} />
      <RelayNotice />
      {motards.isError && <Feedback tone="danger">{relayErrorMessage(motards.error, (k, v) => t(k, v))}</Feedback>}

      <TableCard
        loading={motards.isLoading}
        toolbar={
          <FilterBar>
            <Segmented<Filter>
              value={filter}
              onChange={(v) => {
                setFilter(v)
                setPage(1)
              }}
              size="sm"
              ariaLabel={t('cnnAdmin.common.status', 'Statut')}
              options={[
                { value: 'TO_REVIEW', label: `${t('cnnAdmin.motards.toReview', 'À valider')} · ${counts.TO_REVIEW}` },
                { value: 'APPROVED', label: `${t('cnnAdmin.motards.approvedTab', 'Approuvés')} · ${counts.APPROVED}` },
                { value: 'REJECTED', label: `${t('cnnAdmin.motards.rejectedTab', 'Refusés')} · ${counts.REJECTED}` },
                { value: 'ALL', label: `${t('cnnAdmin.common.all', 'Tous')} · ${counts.ALL}` },
              ]}
            />
            <SearchField value={search} onChange={(v) => {
                setSearch(v)
                setPage(1)
              }} placeholder={t('cnnAdmin.motards.search', 'Nom, téléphone, plaque…')} />
          </FilterBar>
        }
        empty={!motards.isLoading && rows.length === 0 ? <EmptyState icon={<Bike />} title={t('cnnAdmin.motards.empty', 'Aucun motard ici')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={rows.length > 0 ? <Pagination page={current} pageCount={pageCount} total={rows.length} pageSize={pageSize} onPage={setPage} onPageSize={(n) => {
                  setPageSize(n)
                  setPage(1)
                }} unit={t('cnnAdmin.motards.unit', 'motards')} /> : undefined}
      >
        <Table minWidth={1000}>
          <THead>
            <tr>
              <Th>{t('cnnAdmin.motards.motard', 'Motard')}</Th>
              <Th>{t('cnnAdmin.motards.association', 'Association')}</Th>
              <Th>{t('cnnAdmin.fields.plate', 'Plaque de la moto')}</Th>
              <Th>{t('cnnAdmin.motards.validation', 'Validation')}</Th>
              <Th>{t('cnnAdmin.common.duty', 'Service')}</Th>
              <Th align="right">{t('cnnAdmin.motards.credits', 'Crédits')}</Th>
              <Th>{t('cnnAdmin.common.account', 'Compte')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {shown.map((m) => (
              <Tr key={m.id} className="group/row" accent={toReview(m) ? 'warning' : undefined}>
                <Td>
                  <PersonCell first={m.firstName} last={m.lastName} phone={m.phone} photo={m.profilePhotoUrl} />
                </Td>
                <Td className="text-ink-2">{m.associationName || '–'}</Td>
                <Td>{m.motoRegistrationNumber ? <Mono>{m.motoRegistrationNumber}</Mono> : '–'}</Td>
                <Td>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <MotardStatusBadge status={m.validationStatus} />
                    {m.pendingDeletionRequestId && <Badge tone="danger">{t('cnnAdmin.motards.deletionRequested', 'Suppression demandée')}</Badge>}
                  </div>
                </Td>
                <Td>
                  <DutyBadge status={m.status} />
                </Td>
                <Td align="right" className="tabular-nums">
                  {m.creditBalance ?? 0}
                </Td>
                <Td>
                  <ActiveBadge active={m.active} />
                </Td>
                <Td align="right">
                  <RowActions>
                    {canUpdate && m.validationStatus !== 'APPROVED' && (
                      <IconAction label={t('cnnAdmin.motards.approve', 'Approuver')} onClick={() => setPending({ kind: 'approve', motard: m })}>
                        <CheckCircle2 />
                      </IconAction>
                    )}
                    {canUpdate && toReview(m) && (
                      <IconAction tone="danger" label={t('cnnAdmin.motards.reject', 'Refuser')} onClick={() => setPending({ kind: 'reject', motard: m })}>
                        <XCircle />
                      </IconAction>
                    )}
                    {canUpdate && (
                      <>
                        <IconAction label={t('cnnAdmin.common.edit', 'Modifier')} onClick={() => setEditing(m)}>
                          <Pencil />
                        </IconAction>
                        <IconAction label={m.active ? t('cnnAdmin.common.deactivate', 'Désactiver') : t('cnnAdmin.common.activate', 'Activer')} onClick={() => setPending({ kind: 'toggle', motard: m })}>
                          {m.active ? <PowerOff /> : <Power />}
                        </IconAction>
                      </>
                    )}
                    {canDelete && (
                      <IconAction tone="danger" label={t('cnnAdmin.common.delete', 'Supprimer')} onClick={() => setPending({ kind: 'delete', motard: m })}>
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

      <FormModal
        open={Boolean(editing)}
        title={editing ? fullName(editing.firstName, editing.lastName, editing.phone) : ''}
        subtitle={t('cnnAdmin.motards.editHint', 'Coordonnées et moto du motard')}
        fields={editFields}
        initial={
          editing
            ? {
                firstName: editing.firstName ?? '',
                lastName: editing.lastName ?? '',
                phone: editing.phone ?? '',
                email: editing.email ?? '',
                motoRegistrationNumber: editing.motoRegistrationNumber ?? '',
                emergencyPhone: editing.emergencyPhone ?? '',
              }
            : undefined
        }
        submitLabel={t('cnnAdmin.common.save', 'Enregistrer')}
        busy={update.isPending}
        error={error}
        onSubmit={(v) => editing && update.mutate({ id: editing.id, v: compact(v) })}
        onClose={() => {
          setEditing(null)
          setError(null)
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'approve'}
        title={t('cnnAdmin.motards.approveTitle', 'Approuver ce motard ?')}
        message={t('cnnAdmin.motards.approveMessage', 'Il pourra se connecter et recevoir des courses. Il est prévenu par l’application.')}
        confirmLabel={t('cnnAdmin.motards.approve', 'Approuver')}
        busy={approve.isPending}
        error={error}
        onClose={close}
        onConfirm={() => pending && approve.mutate(pending.motard.id)}
      />
      <ConfirmDialog
        open={pending?.kind === 'reject'}
        title={t('cnnAdmin.motards.rejectTitle', 'Refuser cette inscription ?')}
        message={t('cnnAdmin.motards.rejectMessage', 'Le motard et son association verront le motif.')}
        confirmLabel={t('cnnAdmin.motards.reject', 'Refuser')}
        reason="required"
        danger
        busy={reject.isPending}
        error={error}
        onClose={close}
        onConfirm={(reason) => pending && reject.mutate({ id: pending.motard.id, reason })}
      />
      <ConfirmDialog
        open={pending?.kind === 'toggle'}
        title={pending?.motard.active ? t('cnnAdmin.motards.deactivateTitle', 'Désactiver ce motard ?') : t('cnnAdmin.motards.activateTitle', 'Réactiver ce motard ?')}
        message={
          pending?.motard.active
            ? t('cnnAdmin.agents.deactivateMessage', 'Il ne pourra plus se connecter ni recevoir de courses.')
            : t('cnnAdmin.agents.activateMessage', 'Il pourra de nouveau se connecter et recevoir des courses.')
        }
        confirmLabel={pending?.motard.active ? t('cnnAdmin.common.deactivate', 'Désactiver') : t('cnnAdmin.common.activate', 'Activer')}
        danger={Boolean(pending?.motard.active)}
        busy={toggle.isPending}
        error={error}
        onClose={close}
        onConfirm={() => pending && toggle.mutate(pending.motard)}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={t('cnnAdmin.motards.deleteTitle', 'Supprimer ce motard ?')}
        message={t('cnnAdmin.motards.deleteMessage', 'Son compte sera supprimé de Colis na Nga et son association en sera informée.')}
        confirmLabel={t('cnnAdmin.common.delete', 'Supprimer')}
        danger
        busy={remove.isPending}
        error={error}
        onClose={close}
        onConfirm={() => pending && remove.mutate(pending.motard.id)}
      />
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}
