import { useTranslation } from 'react-i18next'
import { Ban, Building2, CheckCircle2, Hourglass, MapPin, Pencil, Plus, Users } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Badge, statutLabel, statutTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Input, Select } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { StatCard } from '../../components/ui/stat-card'
import { IconAction, Mono, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { Toast } from '../../components/ui/toast'
import { SearchField } from '../../components/ui/toolbar'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { ApiError } from '../../lib/api/client'
import { createSociete, deactivateSociete, listSocietes, updateSociete, type SocieteAdmin } from '../../lib/api/access-admin'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { CompanyMark, ConfirmNotice, Dash, Field, formatDay } from './admin-kit'

const emptyForm = { nom: '', code: '', villeReference: '', statut: 'ACTIF' }

type StatusFilter = 'ALL' | 'ACTIF' | 'EN_PREPARATION' | 'INACTIF'

export function SocietesAdminPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<'create' | SocieteAdmin | null>(null)
  const [toDisable, setToDisable] = useState<SocieteAdmin | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')

  const societes = useQuery({ queryKey: ['admin-societes'], queryFn: listSocietes })
  const rows = useMemo(() => societes.data ?? [], [societes.data])

  const kpis = useMemo(() => {
    const total = rows.length
    const actives = rows.filter((r) => r.statut === 'ACTIF').length
    const prep = rows.filter((r) => r.statut === 'EN_PREPARATION').length
    const inactives = rows.filter((r) => r.statut === 'INACTIF').length
    const agents = rows.reduce((sum, r) => sum + (r.agentsCount ?? 0), 0)
    return { total, actives, prep, inactives, agents }
  }, [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (status !== 'ALL' && r.statut !== status) return false
      if (!q) return true
      return [r.nom, r.code, r.villeReference ?? ''].some((v) => v.toLowerCase().includes(q))
    })
  }, [rows, search, status])

  function openCreate() {
    setForm(emptyForm)
    setEditor('create')
    setError(null)
  }

  function openEdit(row: SocieteAdmin) {
    setForm({
      nom: row.nom,
      code: row.code,
      villeReference: row.villeReference ?? '',
      statut: row.statut ?? 'ACTIF',
    })
    setEditor(row)
    setError(null)
  }

  const save = useMutation({
    mutationFn: () => {
      if (editor === 'create') {
        return createSociete({
          nom: form.nom.trim(),
          code: form.code.trim().toUpperCase(),
          villeReference: form.villeReference.trim() || undefined,
        })
      }
      const current = editor as SocieteAdmin
      return updateSociete(current.id, {
        nom: form.nom.trim(),
        villeReference: form.villeReference,
        statut: form.statut,
      })
    },
    onSuccess: () => {
      setNotice(editor === 'create' ? t('adminUi.companyCreated') : t('adminUi.companyUpdated'))
      setEditor(null)
      void queryClient.invalidateQueries({ queryKey: ['admin-societes'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('crud.saveFail')),
  })

  const disable = useMutation({
    mutationFn: () => deactivateSociete(toDisable!.id),
    onSuccess: () => {
      setNotice(t('adminUi.companyDisabled'))
      setToDisable(null)
      void queryClient.invalidateQueries({ queryKey: ['admin-societes'] })
      void queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('crud.actionFail')),
  })

  const filtered = search.trim() !== '' || status !== 'ALL'

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-6">
        <PageHeader
          kicker={t('pages.companies.kicker')}
          title={t('pages.companies.title')}
          subtitle={t('pages.companies.subtitle')}
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              {t('adminUi.newCompany')}
            </Button>
          }
        />
        {error && !editor && !toDisable && <Feedback tone="danger">{error}</Feedback>}
        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StaggerItem className="min-w-0">
            <StatCard className="h-full" label={t('adminUi.totalCompanies')} value={kpis.total} accent="gold" icon={<Building2 />} />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard className="h-full" label={t('adminUi.activeCompanies')} value={kpis.actives} accent="ok" icon={<CheckCircle2 />} />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard className="h-full" label={t('adminUi.inPreparation')} value={kpis.prep} accent="warn" icon={<Hourglass />} />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard
              className="h-full"
              label={t('adminUi.attachedAgents')}
              value={kpis.agents}
              hint={t('adminUi.allCompaniesTogether')}
              accent="info"
              icon={<Users />}
            />
          </StaggerItem>
        </Stagger>

        <TableCard
          loading={societes.isLoading}
          toolbar={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Segmented<StatusFilter>
                ariaLabel={t('adminUi.filterByStatus')}
                value={status}
                onChange={setStatus}
                size="sm"
                options={[
                  { value: 'ALL', label: <Count label={t('orgUi.all', 'Toutes')} n={kpis.total} /> },
                  { value: 'ACTIF', label: <Count label={t('orgUi.activeF', 'Actives')} n={kpis.actives} /> },
                  { value: 'EN_PREPARATION', label: <Count label={t('adminUi.inPreparation')} n={kpis.prep} /> },
                  { value: 'INACTIF', label: <Count label={t('orgUi.inactiveF', 'Inactives')} n={kpis.inactives} /> },
                ]}
              />
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={t('orgUi.searchCompany', 'Rechercher une société…')}
                className="lg:max-w-[20rem]"
              />
            </div>
          }
          empty={
            societes.isError ? (
              <div className="py-3">
                <Feedback tone="danger">{societes.error instanceof ApiError ? societes.error.message : t('crud.loadFail')}</Feedback>
              </div>
            ) : visible.length === 0 ? (
              filtered ? (
                <EmptyState
                  icon={<Building2 />}
                  title={t('orgUi.noCompanyMatch', 'Aucune société ne correspond')}
                  hint={t('orgUi.noMatchHint', 'Modifiez la recherche ou le filtre de statut.')}
                />
              ) : (
                <EmptyState
                  icon={<Building2 />}
                  title={t('adminUi.noCompanyRegistered')}
                  hint={t('orgUi.noCompanyHint', 'Créez la première société pour ouvrir un nouveau contexte de travail.')}
                  action={
                    <Button size="sm" onClick={openCreate}>
                      <Plus className="h-4 w-4" />
                      {t('adminUi.newCompany')}
                    </Button>
                  }
                />
              )
            ) : undefined
          }
        >
          <Table minWidth={760}>
            <THead>
              <tr>
                <Th>{t('adminUi.name')}</Th>
                <Th>{t('adminUi.code')}</Th>
                <Th>{t('adminUi.city')}</Th>
                <Th>{t('common.status')}</Th>
                <Th align="right">{t('adminUi.attachedAgents')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('common.actions')}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {visible.map((row) => {
                const inactive = row.statut === 'INACTIF'
                const created = formatDay(row.createdAt)
                return (
                  <Tr key={row.id} onClick={() => openEdit(row)}>
                    <Td>
                      <div className="flex min-w-0 items-center gap-3">
                        <CompanyMark code={row.code} muted={inactive} />
                        <div className="min-w-0">
                          <p className={inactive ? 'truncate font-medium text-ink-2' : 'truncate font-medium text-ink'}>{row.nom}</p>
                          <p className="mt-0.5 truncate text-[12px] text-ink-3">
                            {created ? t('orgUi.createdOn', 'Créée le {{date}}', { date: created }) : t('orgUi.company', 'Société')}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <Mono>{row.code}</Mono>
                    </Td>
                    <Td>
                      {row.villeReference ? (
                        <span className="inline-flex items-center gap-1.5 text-ink-2">
                          <MapPin className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.2} />
                          {row.villeReference}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </Td>
                    <Td>
                      <Badge tone={statutTone(row.statut)} dot>
                        {statutLabel(row.statut)}
                      </Badge>
                    </Td>
                    <Td align="right">
                      <span className="inline-flex items-center gap-1.5 tabular-nums text-ink-2">
                        <Users className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.2} />
                        {row.agentsCount ?? 0}
                      </span>
                    </Td>
                    <Td align="right" className="w-[1%] whitespace-nowrap">
                      <RowActions>
                        <IconAction label={t('common.edit')} onClick={() => openEdit(row)}>
                          <Pencil />
                        </IconAction>
                        <IconAction label={t('common.deactivate')} tone="danger" disabled={inactive} onClick={() => setToDisable(row)}>
                          <Ban />
                        </IconAction>
                      </RowActions>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        </TableCard>

        <Modal
          open={Boolean(editor)}
          onClose={() => setEditor(null)}
          kicker={t('adminUi.administration')}
          title={editor === 'create' ? t('adminUi.newCompany') : t('adminUi.editCompany')}
          subtitle={
            editor === 'create'
              ? t('orgUi.newCompanyHint', 'Une société définit un contexte de travail séparé : agents, tickets et données.')
              : t('orgUi.editCompanyHint', 'Le code d’une société existante ne peut pas être modifié.')
          }
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" form="ma-societe-form" disabled={save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </>
          }
        >
          <form
            id="ma-societe-form"
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
          >
            {editor !== 'create' && editor && (
              <div className="flex items-center gap-3 rounded-[16px] bg-sunken/70 p-3 ring-1 ring-inset ring-hairline">
                <CompanyMark code={editor.code} muted={editor.statut === 'INACTIF'} />
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold text-ink">{editor.nom}</p>
                  <p className="text-[12px] text-ink-3">
                    {t('orgUi.agentsCount', '{{count}} agent(s) rattaché(s)', { count: editor.agentsCount ?? 0 })}
                  </p>
                </div>
              </div>
            )}
            <Field label={t('adminUi.name')}>
              <Input
                value={form.nom}
                onChange={(e) => setForm({ ...form, nom: e.target.value })}
                placeholder={t('orgUi.companyNamePh', 'Ex. Colis na Nga')}
                required
                autoFocus
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
              <Field label={t('adminUi.projectCode')} hint={editor === 'create' ? t('orgUi.codeHint', '10 car. max') : undefined}>
                <Input
                  value={form.code}
                  disabled={editor !== 'create'}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="CNN"
                  className="font-mono tracking-wide"
                  required
                  maxLength={10}
                />
              </Field>
              <Field label={t('adminUi.city')} hint={t('orgUi.optional', 'Facultatif')}>
                <Input
                  value={form.villeReference}
                  onChange={(e) => setForm({ ...form, villeReference: e.target.value })}
                  placeholder={t('orgUi.cityPh', 'Ex. Kinshasa')}
                />
              </Field>
            </div>
            {editor !== 'create' && (
              <Field label={t('common.status')}>
                <Select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                  <option value="ACTIF">{t('common.active')}</option>
                  <option value="EN_PREPARATION">{t('adminUi.inPreparation')}</option>
                  <option value="INACTIF">{t('common.inactive')}</option>
                </Select>
              </Field>
            )}
            {error && <Feedback tone="danger">{error}</Feedback>}
          </form>
        </Modal>

        <Modal
          open={Boolean(toDisable)}
          onClose={() => setToDisable(null)}
          kicker={t('adminUi.confirmation')}
          title={t('adminUi.deactivateCompanyTitle')}
          footer={
            <>
              <Button variant="outline" onClick={() => setToDisable(null)}>
                {t('common.cancel')}
              </Button>
              <Button variant="danger" disabled={disable.isPending} onClick={() => disable.mutate()}>
                <Ban className="h-4 w-4" />
                {t('adminUi.confirmDeactivate')}
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <ConfirmNotice icon={<Ban />}>
              {t('adminUi.deactivateCompanyBody', { name: toDisable?.nom ?? '', code: toDisable?.code ?? '' })}
            </ConfirmNotice>
            {error && <Feedback tone="danger">{error}</Feedback>}
          </div>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}

function Count({ label, n }: { label: string; n: number }) {
  return (
    <>
      {label}
      <span className="tabular-nums text-ink-3">{n}</span>
    </>
  )
}
