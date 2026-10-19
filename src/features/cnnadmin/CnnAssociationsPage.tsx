import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2, Eye, KeyRound, Pencil, Plus, Power, PowerOff, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Modal } from '../../components/ui/modal'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { CellStack, IconAction, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { DetailList, FilterBar, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { Avatar } from '../../components/ui/avatar'
import { cnnAdmin, useCnnRelay, type CnnAssociation } from '../../lib/api/cnnAdmin'
import { ActiveBadge, CnnAdminHeader, ConfirmDialog, MotardStatusBadge, PersonCell, RelayNotice, fmtDateTime, fmtMoney, relayErrorMessage, useLocaleTag, useRelayMutation } from './shared'
import { FormModal, compact, type FormField } from './FormModal'
import { useDebounced } from './useDebounced'

type Editor = { mode: 'create' } | { mode: 'edit'; association: CnnAssociation } | { mode: 'password'; association: CnnAssociation } | null
type Pending = { kind: 'toggle' | 'delete'; association: CnnAssociation } | null

function AssociationDetail({ association, onClose }: { association: CnnAssociation | null; onClose: () => void }) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const id = association?.id
  const detail = useQuery({ queryKey: ['cnn-admin', 'association', id], queryFn: () => cnnAdmin.association(id!), enabled: Boolean(id) })
  const motards = useQuery({ queryKey: ['cnn-admin', 'association-motards', id], queryFn: () => cnnAdmin.associationMotards(id!), enabled: Boolean(id) })
  const d = detail.data
  return (
    <Modal open={Boolean(association)} onClose={onClose} kicker="Colis na Nga" title={association?.name ?? ''} subtitle={association?.phone} size="lg">
      {detail.isLoading ? (
        <Skeleton className="h-40 rounded-[16px]" />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-3 gap-2.5">
            {[
              { label: t('cnnAdmin.associations.motards', 'Motards'), value: d?.totalMotards ?? 0 },
              { label: t('cnnAdmin.motards.approvedTab', 'Approuvés'), value: d?.approvedMotards ?? 0 },
              { label: t('cnnAdmin.motards.toReview', 'À valider'), value: d?.pendingMotards ?? 0 },
            ].map((s) => (
              <div key={s.label} className="clay-field rounded-[14px] px-3.5 py-3">
                <p className="text-[12px] text-ink-3">{s.label}</p>
                <p className="mt-1 text-[22px] font-bold tabular-nums tracking-[-0.03em] text-ink">{s.value}</p>
              </div>
            ))}
          </div>
          <DetailList
            columns={2}
            items={[
              { label: t('cnnAdmin.fields.email', 'E-mail'), value: association?.email || '–' },
              { label: t('cnnAdmin.associations.commission', 'Commission'), value: association?.commissionPercent != null ? `${association.commissionPercent} %` : '–' },
              { label: t('cnnAdmin.associations.revenue', 'Revenus cumulés'), value: fmtMoney(d?.totalRevenue ?? association?.totalRevenue, locale) },
              { label: t('cnnAdmin.associations.since', 'Partenaire depuis'), value: fmtDateTime(association?.createdAt, locale) },
            ]}
          />
          <div>
            <p className="mb-2 text-[13px] font-semibold text-ink-2">{t('cnnAdmin.associations.motardsList', 'Motards rattachés')}</p>
            {motards.isLoading ? (
              <Skeleton className="h-24 rounded-[14px]" />
            ) : (motards.data ?? []).length === 0 ? (
              <p className="text-[13px] text-ink-3">{t('cnnAdmin.associations.noMotards', 'Aucun motard rattaché.')}</p>
            ) : (
              <ul className="divide-y divide-hairline rounded-[14px] ring-1 ring-hairline">
                {(motards.data ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                    <PersonCell first={m.firstName} last={m.lastName} phone={m.phone} photo={m.profilePhotoUrl} />
                    <MotardStatusBadge status={m.validationStatus} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}

export function CnnAssociationsPage() {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 350)
  const [editor, setEditor] = useState<Editor>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [viewing, setViewing] = useState<CnnAssociation | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const associations = useQuery({
    queryKey: ['cnn-admin', 'associations', q],
    queryFn: () => cnnAdmin.associations(q || undefined),
    enabled: relay.can('MANAGE_CNN_ASSOCIATIONS', 'VIEW'),
  })
  const rows = useMemo(() => [...(associations.data ?? [])].sort((a, b) => a.name.localeCompare(b.name)), [associations.data])

  const done = (message: string | null, err: string | null) => {
    if (message) {
      setNotice(message)
      setEditor(null)
      setPending(null)
    }
    setError(err)
  }
  const keys = [['cnn-admin', 'associations'], ['cnn-admin', 'dashboard']]
  const create = useRelayMutation((v: Record<string, string>) => cnnAdmin.createAssociation(v as never), keys, done, t('cnnAdmin.associations.created', 'Association créée.'))
  const update = useRelayMutation(({ id, v }: { id: string; v: Record<string, string> }) => cnnAdmin.updateAssociation(id, v), keys, done, t('cnnAdmin.common.saved', 'Modifications enregistrées.'))
  const password = useRelayMutation(({ id, pwd }: { id: string; pwd: string }) => cnnAdmin.resetAssociationPassword(id, pwd), keys, done, t('cnnAdmin.associations.passwordReset', 'Nouveau mot de passe enregistré.'))
  const toggle = useRelayMutation((a: CnnAssociation) => cnnAdmin.setAssociationActive(a.id, !a.active), keys, done, t('cnnAdmin.common.statusChanged', 'Statut mis à jour.'))
  const remove = useRelayMutation((id: string) => cnnAdmin.deleteAssociation(id), keys, done, t('cnnAdmin.associations.deleted', 'Association supprimée.'))

  const canCreate = relay.can('MANAGE_CNN_ASSOCIATIONS', 'CREATE')
  const canUpdate = relay.can('MANAGE_CNN_ASSOCIATIONS', 'UPDATE')
  const canDelete = relay.can('MANAGE_CNN_ASSOCIATIONS', 'DELETE')

  const baseFields: FormField[] = [
    { name: 'name', label: t('cnnAdmin.fields.associationName', 'Nom de l’association'), required: true },
    { name: 'phone', label: t('cnnAdmin.fields.phone', 'Téléphone'), type: 'tel', required: true, half: true },
    { name: 'email', label: t('cnnAdmin.fields.email', 'E-mail'), type: 'email', half: true },
  ]
  const passwordField: FormField = { name: 'password', label: t('cnnAdmin.fields.initialPassword', 'Mot de passe initial'), type: 'password', required: true }
  const close = () => {
    setEditor(null)
    setPending(null)
    setError(null)
  }

  return (
    <div className="space-y-6">
      <CnnAdminHeader
        title={t('cnnAdmin.tabs.associations', 'Associations')}
        subtitle={t('cnnAdmin.associations.subtitle', 'Associations de motards partenaires de Colis na Nga.')}
        actions={
          canCreate && (
            <Button onClick={() => setEditor({ mode: 'create' })}>
              <Plus className="h-4 w-4" />
              {t('cnnAdmin.associations.new', 'Nouvelle association')}
            </Button>
          )
        }
      />
      <RelayNotice />
      {associations.isError && <Feedback tone="danger">{relayErrorMessage(associations.error, (k, v) => t(k, v))}</Feedback>}

      <TableCard
        loading={associations.isLoading}
        toolbar={
          <FilterBar>
            <SearchField value={search} onChange={setSearch} placeholder={t('cnnAdmin.associations.search', 'Nom, téléphone…')} />
          </FilterBar>
        }
        empty={!associations.isLoading && rows.length === 0 ? <EmptyState icon={<Building2 />} title={t('cnnAdmin.associations.empty', 'Aucune association')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
      >
        <Table minWidth={900}>
          <THead>
            <tr>
              <Th>{t('cnnAdmin.motards.association', 'Association')}</Th>
              <Th>{t('cnnAdmin.fields.email', 'E-mail')}</Th>
              <Th align="right">{t('cnnAdmin.associations.commission', 'Commission')}</Th>
              <Th align="right">{t('cnnAdmin.associations.revenue', 'Revenus cumulés')}</Th>
              <Th>{t('cnnAdmin.associations.since', 'Partenaire depuis')}</Th>
              <Th>{t('cnnAdmin.common.account', 'Compte')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {rows.map((a) => (
              <Tr key={a.id} className="group/row" onClick={() => setViewing(a)}>
                <Td>
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={a.name} src={a.profilePhotoUrl ?? undefined} size="md" />
                    <CellStack title={a.name} meta={a.phone} />
                  </div>
                </Td>
                <Td className="text-ink-2">{a.email || '–'}</Td>
                <Td align="right" className="tabular-nums">
                  {a.commissionPercent != null ? `${a.commissionPercent} %` : '–'}
                </Td>
                <Td align="right" className="tabular-nums">
                  {fmtMoney(a.totalRevenue, locale)}
                </Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(a.createdAt, locale)}</Td>
                <Td>
                  <ActiveBadge active={a.active} />
                </Td>
                <Td align="right">
                  <RowActions>
                    <IconAction label={t('cnnAdmin.common.view', 'Voir')} onClick={() => setViewing(a)}>
                      <Eye />
                    </IconAction>
                    {canUpdate && (
                      <>
                        <IconAction label={t('cnnAdmin.common.edit', 'Modifier')} onClick={() => setEditor({ mode: 'edit', association: a })}>
                          <Pencil />
                        </IconAction>
                        <IconAction label={t('cnnAdmin.associations.resetPassword', 'Nouveau mot de passe')} onClick={() => setEditor({ mode: 'password', association: a })}>
                          <KeyRound />
                        </IconAction>
                        <IconAction label={a.active ? t('cnnAdmin.common.deactivate', 'Désactiver') : t('cnnAdmin.common.activate', 'Activer')} onClick={() => setPending({ kind: 'toggle', association: a })}>
                          {a.active ? <PowerOff /> : <Power />}
                        </IconAction>
                      </>
                    )}
                    {canDelete && (
                      <IconAction tone="danger" label={t('cnnAdmin.common.delete', 'Supprimer')} onClick={() => setPending({ kind: 'delete', association: a })}>
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

      <AssociationDetail association={viewing} onClose={() => setViewing(null)} />
      <FormModal
        open={editor?.mode === 'create'}
        title={t('cnnAdmin.associations.new', 'Nouvelle association')}
        fields={[...baseFields, passwordField]}
        submitLabel={t('cnnAdmin.common.create', 'Créer')}
        busy={create.isPending}
        error={error}
        onSubmit={(v) => create.mutate(compact(v))}
        onClose={close}
      />
      <FormModal
        open={editor?.mode === 'edit'}
        title={editor?.mode === 'edit' ? editor.association.name : ''}
        fields={baseFields}
        initial={editor?.mode === 'edit' ? { name: editor.association.name, phone: editor.association.phone, email: editor.association.email ?? '' } : undefined}
        submitLabel={t('cnnAdmin.common.save', 'Enregistrer')}
        busy={update.isPending}
        error={error}
        onSubmit={(v) => editor?.mode === 'edit' && update.mutate({ id: editor.association.id, v: compact(v) })}
        onClose={close}
      />
      <FormModal
        open={editor?.mode === 'password'}
        title={t('cnnAdmin.associations.resetPassword', 'Nouveau mot de passe')}
        subtitle={editor?.mode === 'password' ? editor.association.name : undefined}
        fields={[{ name: 'password', label: t('cnnAdmin.fields.newPassword', 'Nouveau mot de passe'), type: 'password', required: true, hint: t('cnnAdmin.fields.passwordShare', 'À transmettre à l’association de vive voix') }]}
        submitLabel={t('cnnAdmin.common.save', 'Enregistrer')}
        busy={password.isPending}
        error={error}
        onSubmit={(v) => editor?.mode === 'password' && password.mutate({ id: editor.association.id, pwd: v.password })}
        onClose={close}
      />
      <ConfirmDialog
        open={pending?.kind === 'toggle'}
        title={pending?.association.active ? t('cnnAdmin.associations.deactivateTitle', 'Suspendre cette association ?') : t('cnnAdmin.associations.activateTitle', 'Réactiver cette association ?')}
        message={
          pending?.association.active
            ? t('cnnAdmin.associations.deactivateMessage', 'L’association et tous ses motards ne pourront plus se connecter tant qu’elle est suspendue.')
            : t('cnnAdmin.associations.activateMessage', 'L’association et ses motards approuvés pourront de nouveau se connecter.')
        }
        confirmLabel={pending?.association.active ? t('cnnAdmin.associations.suspend', 'Suspendre') : t('cnnAdmin.common.activate', 'Activer')}
        danger={Boolean(pending?.association.active)}
        busy={toggle.isPending}
        error={error}
        onClose={close}
        onConfirm={() => pending && toggle.mutate(pending.association)}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={t('cnnAdmin.associations.deleteTitle', 'Supprimer cette association ?')}
        message={t('cnnAdmin.associations.deleteMessage', 'Ses motards seront détachés et devront rejoindre une autre association. Cette action est définitive.')}
        confirmLabel={t('cnnAdmin.common.delete', 'Supprimer')}
        danger
        busy={remove.isPending}
        error={error}
        onClose={close}
        onConfirm={() => pending && remove.mutate(pending.association.id)}
      />
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}
