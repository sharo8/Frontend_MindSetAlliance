import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Pencil, Plus, Power, PowerOff, Trash2, Motorbike } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { EmptyState } from '../../components/ui/scope-empty'
import { IconAction, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { cnnAdmin, useCnnRelay, type CnnAgent } from '../../lib/api/cnnAdmin'
import { ActiveBadge, CnnAdminHeader, ConfirmDialog, DutyBadge, PersonCell, RelayNotice, fmtDateTime, fullName, relayErrorMessage, useLocaleTag, useRelayMutation } from './shared'
import { FormModal, compact, type FormField } from './FormModal'
import { useDebounced } from './useDebounced'

type Editor = { mode: 'create' } | { mode: 'edit'; agent: CnnAgent } | null
type Pending = { kind: 'toggle' | 'delete'; agent: CnnAgent } | null

export function CnnAgentsPage() {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const [duty, setDuty] = useState('')
  const [search, setSearch] = useState('')
  const q = useDebounced(search, 350)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [editor, setEditor] = useState<Editor>(null)
  const [pending, setPending] = useState<Pending>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const agents = useQuery({
    queryKey: ['cnn-admin', 'agents', duty, q],
    queryFn: () => cnnAdmin.agents(duty || undefined, q || undefined),
    enabled: relay.can('MANAGE_CNN_AGENTS', 'VIEW'),
  })
  const rows = useMemo(() => [...(agents.data ?? [])].sort((a, b) => fullName(a.firstName, a.lastName, a.phone).localeCompare(fullName(b.firstName, b.lastName, b.phone))), [agents.data])
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const current = Math.min(page, pageCount)
  const shown = rows.slice((current - 1) * pageSize, current * pageSize)

  const done = (message: string | null, err: string | null) => {
    if (message) {
      setNotice(message)
      setEditor(null)
      setPending(null)
    }
    setError(err)
  }
  const keys = [['cnn-admin', 'agents'], ['cnn-admin', 'dashboard']]
  const create = useRelayMutation((v: Record<string, string>) => cnnAdmin.createAgent(v as never), keys, done, t('cnnAdmin.agents.created', 'Livreur créé.'))
  const update = useRelayMutation(({ id, v }: { id: string; v: Record<string, string> }) => cnnAdmin.updateAgent(id, v), keys, done, t('cnnAdmin.common.saved', 'Modifications enregistrées.'))
  const toggle = useRelayMutation((a: CnnAgent) => cnnAdmin.setAgentActive(a.id, !a.active), keys, done, t('cnnAdmin.common.statusChanged', 'Statut mis à jour.'))
  const remove = useRelayMutation((id: string) => cnnAdmin.deleteAgent(id), keys, done, t('cnnAdmin.agents.deleted', 'Livreur supprimé.'))

  const canCreate = relay.can('MANAGE_CNN_AGENTS', 'CREATE')
  const canUpdate = relay.can('MANAGE_CNN_AGENTS', 'UPDATE')
  const canDelete = relay.can('MANAGE_CNN_AGENTS', 'DELETE')

  const createFields: FormField[] = [
    { name: 'firstName', label: t('cnnAdmin.fields.firstName', 'Prénom'), required: true, half: true },
    { name: 'lastName', label: t('cnnAdmin.fields.lastName', 'Nom'), required: true, half: true },
    { name: 'phone', label: t('cnnAdmin.fields.phone', 'Téléphone'), type: 'tel', required: true, half: true },
    { name: 'email', label: t('cnnAdmin.fields.email', 'E-mail'), type: 'email', half: true },
    {
      name: 'gender',
      label: t('cnnAdmin.fields.gender', 'Sexe'),
      type: 'select',
      required: true,
      half: true,
      options: [
        { value: 'MALE', label: t('cnnAdmin.fields.male', 'Homme') },
        { value: 'FEMALE', label: t('cnnAdmin.fields.female', 'Femme') },
      ],
    },
    { name: 'birthDate', label: t('cnnAdmin.fields.birthDate', 'Date de naissance'), type: 'date', required: true, half: true },
    { name: 'password', label: t('cnnAdmin.fields.initialPassword', 'Mot de passe initial'), type: 'password', required: true, hint: t('cnnAdmin.fields.passwordHint', 'À transmettre au livreur, il le changera') },
  ]
  const editFields: FormField[] = [
    { name: 'phone', label: t('cnnAdmin.fields.phone', 'Téléphone'), type: 'tel', required: true, half: true },
    { name: 'email', label: t('cnnAdmin.fields.email', 'E-mail'), type: 'email', half: true },
  ]

  return (
    <div className="space-y-6">
      <CnnAdminHeader
        title={t('cnnAdmin.tabs.agents', 'Livreurs')}
        subtitle={t('cnnAdmin.agents.subtitle', 'Les livreurs salariés de Colis na Nga.')}
        actions={
          canCreate && (
            <Button onClick={() => setEditor({ mode: 'create' })}>
              <Plus className="h-4 w-4" />
              {t('cnnAdmin.agents.new', 'Nouveau livreur')}
            </Button>
          )
        }
      />
      <RelayNotice />
      {agents.isError && <Feedback tone="danger">{relayErrorMessage(agents.error, (k, v) => t(k, v))}</Feedback>}

      <TableCard
        loading={agents.isLoading}
        toolbar={
          <FilterBar>
            <SearchField value={search} onChange={(v) => {
                setSearch(v)
                setPage(1)
              }} placeholder={t('cnnAdmin.common.searchPerson', 'Nom, téléphone…')} />
            <FilterSelect value={duty} onChange={(e) => {
                setDuty(e.target.value)
                setPage(1)
              }} active={Boolean(duty)} aria-label={t('cnnAdmin.common.duty', 'Service')}>
              <option value="">{t('cnnAdmin.common.allDuty', 'En service ou non')}</option>
              <option value="ON_DUTY">{t('cnnAdmin.common.onDuty', 'En service')}</option>
              <option value="OFF_DUTY">{t('cnnAdmin.common.offDuty', 'Hors service')}</option>
            </FilterSelect>
          </FilterBar>
        }
        empty={!agents.isLoading && rows.length === 0 ? <EmptyState icon={<Motorbike />} title={t('cnnAdmin.agents.empty', 'Aucun livreur')} hint={t('cnnAdmin.common.emptyHint', 'Modifiez la recherche ou le filtre.')} /> : undefined}
        footer={rows.length > 0 ? <Pagination page={current} pageCount={pageCount} total={rows.length} pageSize={pageSize} onPage={setPage} onPageSize={(n) => {
                  setPageSize(n)
                  setPage(1)
                }} unit={t('cnnAdmin.agents.unit', 'livreurs')} /> : undefined}
      >
        <Table minWidth={820}>
          <THead>
            <tr>
              <Th>{t('cnnAdmin.agents.agent', 'Livreur')}</Th>
              <Th>{t('cnnAdmin.fields.email', 'E-mail')}</Th>
              <Th>{t('cnnAdmin.common.duty', 'Service')}</Th>
              <Th>{t('cnnAdmin.common.account', 'Compte')}</Th>
              <Th>{t('cnnAdmin.common.lastPosition', 'Dernière position')}</Th>
              <Th align="right">
                <span className="sr-only">{t('cnnAdmin.common.actions', 'Actions')}</span>
              </Th>
            </tr>
          </THead>
          <TBody>
            {shown.map((a) => (
              <Tr key={a.id} className="group/row">
                <Td>
                  <PersonCell first={a.firstName} last={a.lastName} phone={a.phone} photo={a.profilePhotoUrl} />
                </Td>
                <Td className="text-ink-2">{a.email || '–'}</Td>
                <Td>
                  <DutyBadge status={a.status} />
                </Td>
                <Td>
                  <ActiveBadge active={a.active} />
                </Td>
                <Td className="whitespace-nowrap text-ink-3">{fmtDateTime(a.lastPositionAt, locale)}</Td>
                <Td align="right">
                  <RowActions>
                    {canUpdate && (
                      <>
                        <IconAction label={t('cnnAdmin.common.edit', 'Modifier')} onClick={() => setEditor({ mode: 'edit', agent: a })}>
                          <Pencil />
                        </IconAction>
                        <IconAction
                          label={a.active ? t('cnnAdmin.common.deactivate', 'Désactiver') : t('cnnAdmin.common.activate', 'Activer')}
                          onClick={() => setPending({ kind: 'toggle', agent: a })}
                        >
                          {a.active ? <PowerOff /> : <Power />}
                        </IconAction>
                      </>
                    )}
                    {canDelete && (
                      <IconAction tone="danger" label={t('cnnAdmin.common.delete', 'Supprimer')} onClick={() => setPending({ kind: 'delete', agent: a })}>
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
        open={editor?.mode === 'create'}
        title={t('cnnAdmin.agents.new', 'Nouveau livreur')}
        fields={createFields}
        submitLabel={t('cnnAdmin.common.create', 'Créer')}
        busy={create.isPending}
        error={error}
        onSubmit={(v) => create.mutate(compact(v))}
        onClose={() => {
          setEditor(null)
          setError(null)
        }}
      />
      <FormModal
        open={editor?.mode === 'edit'}
        title={editor?.mode === 'edit' ? fullName(editor.agent.firstName, editor.agent.lastName, editor.agent.phone) : ''}
        subtitle={t('cnnAdmin.agents.editHint', 'Coordonnées du livreur')}
        fields={editFields}
        initial={editor?.mode === 'edit' ? { phone: editor.agent.phone ?? '', email: editor.agent.email ?? '' } : undefined}
        submitLabel={t('cnnAdmin.common.save', 'Enregistrer')}
        busy={update.isPending}
        error={error}
        onSubmit={(v) => editor?.mode === 'edit' && update.mutate({ id: editor.agent.id, v: compact(v) })}
        onClose={() => {
          setEditor(null)
          setError(null)
        }}
      />
      <ConfirmDialog
        open={pending?.kind === 'toggle'}
        title={pending?.agent.active ? t('cnnAdmin.agents.deactivateTitle', 'Désactiver ce livreur ?') : t('cnnAdmin.agents.activateTitle', 'Réactiver ce livreur ?')}
        message={
          pending?.agent.active
            ? t('cnnAdmin.agents.deactivateMessage', 'Il ne pourra plus se connecter ni recevoir de courses.')
            : t('cnnAdmin.agents.activateMessage', 'Il pourra de nouveau se connecter et recevoir des courses.')
        }
        confirmLabel={pending?.agent.active ? t('cnnAdmin.common.deactivate', 'Désactiver') : t('cnnAdmin.common.activate', 'Activer')}
        danger={Boolean(pending?.agent.active)}
        busy={toggle.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && toggle.mutate(pending.agent)}
      />
      <ConfirmDialog
        open={pending?.kind === 'delete'}
        title={t('cnnAdmin.agents.deleteTitle', 'Supprimer ce livreur ?')}
        message={t('cnnAdmin.agents.deleteMessage', 'Son compte sera supprimé de Colis na Nga. Les courses en cours doivent être terminées ou réassignées.')}
        confirmLabel={t('cnnAdmin.common.delete', 'Supprimer')}
        danger
        busy={remove.isPending}
        error={error}
        onClose={() => {
          setPending(null)
          setError(null)
        }}
        onConfirm={() => pending && remove.mutate(pending.agent.id)}
      />
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}
