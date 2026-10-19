import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Briefcase, Check, CheckCircle2, Pencil, Plus, UserX, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, roleTone, statutLabel, statutTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { IconTile } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Input, Select } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { Skeleton } from '../../components/ui/skeleton'
import { StatCard } from '../../components/ui/stat-card'
import { CellStack, IconAction, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { Toast } from '../../components/ui/toast'
import { SearchField } from '../../components/ui/toolbar'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { ApiError } from '../../lib/api/client'
import {
  createDepartement,
  deactivateDepartement,
  fetchDepartements,
  fetchRoles,
  updateDepartement,
  type DepartementOption,
} from '../../lib/api/iam-admin'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { roleLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'
import { ConfirmNotice, Dash, Field } from './admin-kit'

const emptyForm = { nom: '', description: '', roles: [] as string[], statut: 'ACTIF' }

type StatusFilter = 'ALL' | 'ACTIF' | 'INACTIF'

function sameRoles(a: string[], b: string[]) {
  const left = [...a].map((x) => x.toUpperCase()).sort()
  const right = [...b].map((x) => x.toUpperCase()).sort()
  return left.length === right.length && left.every((v, i) => v === right[i])
}

export function DepartementsAdminPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<'create' | DepartementOption | null>(null)
  const [toDisable, setToDisable] = useState<DepartementOption | null>(null)
  const [roleWarning, setRoleWarning] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [tried, setTried] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>('ALL')

  const deps = useQuery({ queryKey: ['admin-departements'], queryFn: fetchDepartements })
  const roles = useQuery({ queryKey: ['rbac-roles'], queryFn: fetchRoles })

  const nomError = !form.nom.trim() ? t('adminUi.nameRequired') : null
  const duplicate = (deps.data ?? []).some((row) => {
    if (!form.nom.trim()) return false
    if (editor !== 'create' && editor && row.id === editor.id) return false
    return row.nom.toLowerCase() === form.nom.trim().toLowerCase()
  })
  const nameTaken = duplicate ? t('adminUi.nameTaken') : null

  function openCreate() {
    setForm(emptyForm)
    setTried(false)
    setRoleWarning(false)
    setEditor('create')
    setError(null)
  }

  function openEdit(row: DepartementOption) {
    setForm({
      nom: row.nom,
      description: row.description ?? '',
      roles: (row.roles ?? []).map((r) => r.nom),
      statut: row.statut ?? 'ACTIF',
    })
    setTried(false)
    setRoleWarning(false)
    setEditor(row)
    setError(null)
  }

  function closeEditor() {
    setEditor(null)
    setRoleWarning(false)
  }

  function persist() {
    if (editor === 'create') {
      return createDepartement({
        nom: form.nom.trim(),
        description: form.description.trim() || undefined,
        roles: form.roles,
      })
    }
    const current = editor as DepartementOption
    return updateDepartement(current.id, {
      nom: form.nom.trim(),
      description: form.description,
      roles: form.roles,
      statut: form.statut,
    })
  }

  const save = useMutation({
    mutationFn: persist,
    onSuccess: () => {
      setNotice(editor === 'create' ? t('adminUi.deptCreated') : t('adminUi.deptUpdated'))
      setEditor(null)
      setRoleWarning(false)
      void queryClient.invalidateQueries({ queryKey: ['admin-departements'] })
      void queryClient.invalidateQueries({ queryKey: ['departements'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('crud.saveFail')),
  })

  const disable = useMutation({
    mutationFn: () => deactivateDepartement(toDisable!.id),
    onSuccess: () => {
      setNotice(t('adminUi.deptDisabled'))
      setToDisable(null)
      void queryClient.invalidateQueries({ queryKey: ['admin-departements'] })
      void queryClient.invalidateQueries({ queryKey: ['departements'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : t('crud.actionFail')),
  })

  function trySave() {
    setTried(true)
    if (nomError || nameTaken) return
    if (editor !== 'create' && editor) {
      const previous = (editor.roles ?? []).map((r) => r.nom)
      if (!sameRoles(previous, form.roles) && !roleWarning) {
        setRoleWarning(true)
        return
      }
    }
    save.mutate()
  }

  const editing = editor !== 'create' && editor ? editor : null
  const agentsCount = editing?.agentsCount ?? 0
  const rows = useMemo(() => deps.data ?? [], [deps.data])
  const kpis = useMemo(() => {
    const total = rows.length
    const actifs = rows.filter((r) => r.statut !== 'INACTIF').length
    const agents = rows.reduce((sum, r) => sum + (r.agentsCount ?? 0), 0)
    const empty = rows.filter((r) => (r.agentsCount ?? 0) === 0).length
    return { total, actifs, agents, empty }
  }, [rows])

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const inactive = r.statut === 'INACTIF'
      if (status === 'ACTIF' && inactive) return false
      if (status === 'INACTIF' && !inactive) return false
      if (!q) return true
      return [r.nom, r.description ?? '', ...(r.roles ?? []).map((x) => roleLabel(x.nom))].some((v) => v.toLowerCase().includes(q))
    })
  }, [rows, search, status])
  const filtered = search.trim() !== '' || status !== 'ALL'

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-6">
        <PageHeader
          kicker={t('pages.departments.kicker')}
          title={t('pages.departments.title')}
          subtitle={t('pages.departments.subtitle')}
          actions={
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" strokeWidth={2.4} />
              {t('adminUi.newDepartment')}
            </Button>
          }
        />
        {error && !editor && !toDisable && <Feedback tone="danger">{error}</Feedback>}
        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StaggerItem className="min-w-0">
            <StatCard
              className="h-full"
              label={t('adminUi.totalDepartments')}
              value={kpis.total}
              hint={t('adminUi.allStatuses')}
              accent="gold"
              icon={<Briefcase />}
            />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard
              className="h-full"
              label={t('adminUi.activeDepartments')}
              value={kpis.actifs}
              hint={t('adminUi.offeredToAgents')}
              accent="ok"
              icon={<CheckCircle2 />}
            />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard
              className="h-full"
              label={t('adminUi.attachedAgents')}
              value={kpis.agents}
              hint={t('adminUi.allDepartmentsTogether')}
              accent="info"
              icon={<Users />}
            />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard
              className="h-full"
              label={t('adminUi.noAgentAttached')}
              value={kpis.empty}
              hint={kpis.empty > 0 ? t('adminUi.toStaffOrDisable') : t('adminUi.allHaveAgent')}
              accent={kpis.empty > 0 ? 'danger' : 'ok'}
              icon={<UserX />}
            />
          </StaggerItem>
        </Stagger>

        <TableCard
          loading={deps.isLoading}
          toolbar={
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <Segmented<StatusFilter>
                ariaLabel={t('adminUi.filterByStatus')}
                value={status}
                onChange={setStatus}
                size="sm"
                options={[
                  { value: 'ALL', label: <Count label={t('orgUi.allM', 'Tous')} n={kpis.total} /> },
                  { value: 'ACTIF', label: <Count label={t('orgUi.activeM', 'Actifs')} n={kpis.actifs} /> },
                  { value: 'INACTIF', label: <Count label={t('orgUi.inactiveM', 'Inactifs')} n={kpis.total - kpis.actifs} /> },
                ]}
              />
              <SearchField
                value={search}
                onChange={setSearch}
                placeholder={t('orgUi.searchDept', 'Rechercher un département…')}
                className="lg:max-w-[20rem]"
              />
            </div>
          }
          empty={
            deps.isError ? (
              <div className="py-3">
                <Feedback tone="danger">{deps.error instanceof ApiError ? deps.error.message : t('crud.loadFail')}</Feedback>
              </div>
            ) : visible.length === 0 ? (
              filtered ? (
                <EmptyState
                  icon={<Briefcase />}
                  title={t('orgUi.noDeptMatch', 'Aucun département ne correspond')}
                  hint={t('orgUi.noMatchHint', 'Modifiez la recherche ou le filtre de statut.')}
                />
              ) : (
                <EmptyState
                  icon={<Briefcase />}
                  title={t('adminUi.noDept')}
                  hint={t('orgUi.noDeptHint', 'Créez un département pour proposer des rôles par défaut aux nouveaux agents.')}
                  action={
                    <Button size="sm" onClick={openCreate}>
                      <Plus className="h-4 w-4" />
                      {t('adminUi.newDepartment')}
                    </Button>
                  }
                />
              )
            ) : undefined
          }
        >
          <Table minWidth={780}>
            <THead>
              <tr>
                <Th>{t('adminUi.deptName')}</Th>
                <Th>{t('adminUi.defaultRolesShort')}</Th>
                <Th align="right">{t('adminUi.attachedAgents')}</Th>
                <Th>{t('common.status')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('common.actions')}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {visible.map((row) => {
                const inactive = row.statut === 'INACTIF'
                const count = row.agentsCount ?? 0
                return (
                  <Tr key={row.id} onClick={() => openEdit(row)}>
                    <Td className="max-w-[22rem]">
                      <div className="flex min-w-0 items-center gap-3">
                        <IconTile tone={inactive ? 'neutral' : 'teal'} size="sm">
                          <Briefcase />
                        </IconTile>
                        <CellStack
                          title={<span className={inactive ? 'text-ink-2' : undefined}>{row.nom}</span>}
                          meta={row.description || row.code}
                        />
                      </div>
                    </Td>
                    <Td>
                      <span className="flex flex-wrap gap-1">
                        {(row.roles ?? []).map((r) => (
                          <Badge key={r.id} tone={roleTone(r.nom)}>
                            {roleLabel(r.nom)}
                          </Badge>
                        ))}
                        {(row.roles ?? []).length === 0 && <Dash />}
                      </span>
                    </Td>
                    <Td align="right">
                      {count === 0 ? (
                        <span
                          className="inline-flex items-center gap-1.5 font-medium tabular-nums text-status-warning"
                          title={t('adminUi.noAgentAttached')}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.2} />0
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 tabular-nums text-ink-2">
                          <Users className="h-3.5 w-3.5 text-ink-3" strokeWidth={2.2} />
                          {count}
                        </span>
                      )}
                    </Td>
                    <Td>
                      <Badge tone={statutTone(inactive ? 'INACTIF' : 'ACTIF')} dot>
                        {statutLabel(inactive ? 'INACTIF' : 'ACTIF')}
                      </Badge>
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
          onClose={closeEditor}
          size="lg"
          title={editor === 'create' ? t('adminUi.newDepartment') : t('adminUi.editDepartment')}
          kicker={t('adminUi.administration')}
          subtitle={
            editor === 'create'
              ? t('orgUi.newDeptHint', 'Les rôles par défaut sont attribués automatiquement aux nouveaux agents du département.')
              : t('orgUi.editDeptHint', '{{count}} agent(s) rattaché(s) à ce département.', { count: agentsCount })
          }
          footer={
            <>
              <Button variant="outline" onClick={closeEditor}>
                {t('common.cancel')}
              </Button>
              <Button disabled={save.isPending} onClick={trySave}>
                {save.isPending ? t('common.saving') : roleWarning ? t('orgUi.confirmSave', 'Confirmer et enregistrer') : t('common.save')}
              </Button>
            </>
          }
        >
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              trySave()
            }}
          >
            <div className={cn('grid gap-4', editor !== 'create' && 'sm:grid-cols-[minmax(0,1fr)_11rem]')}>
              <Field label={t('adminUi.nameStar')} error={tried ? nomError || nameTaken : null}>
                <Input
                  value={form.nom}
                  onChange={(e) => setForm({ ...form, nom: e.target.value })}
                  aria-invalid={tried && Boolean(nomError || nameTaken)}
                  placeholder={t('orgUi.deptNamePh', 'Ex. Support client')}
                  autoFocus
                />
              </Field>
              {editor !== 'create' && (
                <Field label={t('common.status')}>
                  <Select value={form.statut} onChange={(e) => setForm({ ...form, statut: e.target.value })}>
                    <option value="ACTIF">{t('common.active')}</option>
                    <option value="INACTIF">{t('common.inactive')}</option>
                  </Select>
                </Field>
              )}
            </div>
            <Field label={t('common.description')} hint={t('orgUi.optional', 'Facultatif')}>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder={t('orgUi.deptDescPh', 'Ex. Réclamations et suivi des courses')}
              />
            </Field>
            <fieldset>
              <legend className="mb-2 flex w-full items-baseline justify-between gap-2 text-[12.5px] font-medium text-ink-2">
                <span>{t('adminUi.defaultRolesShort')}</span>
                <span className="text-[11.5px] font-normal tabular-nums text-ink-3">
                  {t('orgUi.selectedCount', '{{count}} sélectionné(s)', { count: form.roles.length })}
                </span>
              </legend>
              {roles.isLoading ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {[0, 1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-11 rounded-[13px]" />
                  ))}
                </div>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {(roles.data ?? []).map((r) => {
                    const checked = form.roles.includes(r.nom)
                    return (
                      <label
                        key={r.id}
                        className={cn(
                          'press flex min-h-11 cursor-pointer items-center gap-3 rounded-[13px] px-3 py-2 text-[13.5px] ring-1 ring-inset transition-colors',
                          'has-[:focus-visible]:[box-shadow:var(--ring-focus)]',
                          checked
                            ? 'bg-ma-gold-500/10 font-medium text-ink ring-ma-gold-500/35 dark:bg-ma-gold-400/10'
                            : 'bg-surface text-ink-2 ring-hairline hover:bg-surface-2 hover:text-ink',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          onChange={(e) => {
                            setForm({
                              ...form,
                              roles: e.target.checked ? [...form.roles, r.nom] : form.roles.filter((x) => x !== r.nom),
                            })
                          }}
                        />
                        <span
                          aria-hidden
                          className={cn(
                            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] transition-[background-color,box-shadow] duration-200',
                            checked ? 'clay-gold text-ma-navy-950' : 'clay-field',
                          )}
                        >
                          {checked && <Check className="h-3 w-3" strokeWidth={3.2} />}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{r.libelle || roleLabel(r.nom)}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </fieldset>
            {roleWarning && editing && <Feedback tone="warning">{t('adminUi.roleChangeWarning', { count: agentsCount })}</Feedback>}
            {error && <Feedback tone="danger">{error}</Feedback>}
            <button type="submit" className="hidden" aria-hidden tabIndex={-1} />
          </form>
        </Modal>

        <Modal
          open={Boolean(toDisable)}
          onClose={() => setToDisable(null)}
          title={t('adminUi.deactivateDeptTitle')}
          kicker={t('adminUi.confirmation')}
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
              {t('adminUi.deactivateDeptBody', { name: toDisable?.nom ?? '', count: toDisable?.agentsCount ?? 0 })}
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
