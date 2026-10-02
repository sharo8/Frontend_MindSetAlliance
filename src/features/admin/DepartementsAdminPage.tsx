import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Ban, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, roleTone, statutTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { StatCard } from '../../components/ui/stat-card'
import { Toast } from '../../components/ui/toast'
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

const emptyForm = { nom: '', description: '', roles: [] as string[], statut: 'ACTIF' }

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
  const rows = deps.data ?? []
  const kpis = useMemo(() => {
    const total = rows.length
    const actifs = rows.filter((r) => r.statut !== 'INACTIF').length
    const agents = rows.reduce((sum, r) => sum + (r.agentsCount ?? 0), 0)
    const empty = rows.filter((r) => (r.agentsCount ?? 0) === 0).length
    return { total, actifs, agents, empty }
  }, [rows])

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.departments.kicker')}
          title={t('pages.departments.title')}
          subtitle={t('pages.departments.subtitle')}
          actions={
            <Button onClick={openCreate}>
              <Plus size={15} />
              {t('adminUi.newDepartment')}
            </Button>
          }
        />
        {error && <Feedback tone="danger">{error}</Feedback>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('adminUi.totalDepartments')} value={kpis.total} hint={t('adminUi.allStatuses')} accent="gold" />
          <StatCard label={t('adminUi.activeDepartments')} value={kpis.actifs} hint={t('adminUi.offeredToAgents')} accent="ok" />
          <StatCard label={t('adminUi.attachedAgents')} value={kpis.agents} hint={t('adminUi.allDepartmentsTogether')} accent="info" />
          <StatCard
            label={t('adminUi.noAgentAttached')}
            value={kpis.empty}
            hint={kpis.empty > 0 ? t('adminUi.toStaffOrDisable') : t('adminUi.allHaveAgent')}
            accent={kpis.empty > 0 ? 'danger' : 'ok'}
          />
        </div>
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">
                <tr>
                  <th className="px-4 py-3">{t('adminUi.deptName')}</th>
                  <th className="px-4 py-3">{t('adminUi.defaultRoles')}</th>
                  <th className="px-4 py-3">{t('adminUi.attachedAgents')}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={
                      i % 2 === 1
                        ? 'border-t border-ma-line/80 bg-slate-50/70 transition hover:bg-ma-gold-500/8 hover:shadow-[inset_0_0_0_1px_rgb(232_180_42/0.12)] dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-ma-gold-500/10'
                        : 'border-t border-ma-line/80 bg-white transition hover:bg-ma-gold-500/8 hover:shadow-[inset_0_0_0_1px_rgb(232_180_42/0.12)] dark:border-white/8 dark:bg-transparent dark:hover:bg-ma-gold-500/10'
                    }
                  >
                    <td className="px-4 py-3 font-medium">
                      {row.nom}
                      {row.description && <p className="mt-0.5 text-xs font-normal text-ma-muted">{row.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1">
                        {(row.roles ?? []).map((r) => (
                          <Badge key={r.id} tone={roleTone(r.nom)}>{roleLabel(r.nom)}</Badge>
                        ))}
                        {(row.roles ?? []).length === 0 && <span className="text-ma-muted">—</span>}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {(row.agentsCount ?? 0) === 0 ? (
                        <span className="inline-flex items-center gap-1.5 text-ma-muted">
                          <AlertTriangle className="h-3.5 w-3.5 text-status-warning" />
                          0
                        </span>
                      ) : (
                        row.agentsCount
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statutTone(row.statut ?? 'ACTIF')}>
                        {row.statut === 'INACTIF' ? 'INACTIF' : 'ACTIF'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="rounded-lg p-2 text-ma-muted hover:bg-slate-100 hover:text-ma-navy-900 dark:hover:bg-white/10 dark:hover:text-white"
                          title={t('common.edit')}
                          onClick={() => openEdit(row)}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {row.statut !== 'INACTIF' && (
                          <button
                            type="button"
                            className="rounded-lg p-2 text-ma-muted hover:bg-slate-100 hover:text-status-danger dark:hover:bg-white/10"
                            title={t('common.deactivate')}
                            onClick={() => setToDisable(row)}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 && !deps.isError && <p className="px-4 py-6 text-sm text-ma-muted">{t('adminUi.noDept')}</p>}
            {deps.isError && (
              <div className="p-4">
                <Feedback tone="danger">{deps.error instanceof ApiError ? deps.error.message : t('crud.loadFail')}</Feedback>
              </div>
            )}
          </CardBody>
        </Card>

        <Modal
          open={Boolean(editor)}
          onClose={() => { setEditor(null); setRoleWarning(false) }}
          title={editor === 'create' ? t('adminUi.newDepartment') : t('adminUi.editDepartment')}
          kicker={t('adminUi.administration')}
          footer={(
            <>
              <Button variant="outline" onClick={() => { setEditor(null); setRoleWarning(false) }}>{t('common.close')}</Button>
              <Button disabled={save.isPending} onClick={trySave}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{t('adminUi.nameStar')}</span>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
              {tried && (nomError || nameTaken) && <p className="mt-1 text-xs text-status-danger">{nomError || nameTaken}</p>}
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{t('common.description')}</span>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </label>
            {editor !== 'create' && (
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{t('common.status')}</span>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-ma-navy-900"
                  value={form.statut}
                  onChange={(e) => setForm({ ...form, statut: e.target.value })}
                >
                  <option value="ACTIF">{t('common.active')}</option>
                  <option value="INACTIF">{t('common.inactive')}</option>
                </select>
              </label>
            )}
            <div>
              <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{t('adminUi.defaultRolesShort')}</span>
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {(roles.data ?? []).map((r) => (
                  <label key={r.id} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-white/5">
                    <input
                      type="checkbox"
                      className="accent-ma-gold-500"
                      checked={form.roles.includes(r.nom)}
                      onChange={(e) => {
                        setForm({
                          ...form,
                          roles: e.target.checked ? [...form.roles, r.nom] : form.roles.filter((x) => x !== r.nom),
                        })
                      }}
                    />
                    {r.libelle || roleLabel(r.nom)}
                  </label>
                ))}
              </div>
            </div>
            {roleWarning && editing && (
              <Feedback tone="warning">
                {t('adminUi.roleChangeWarning', { count: agentsCount })}
              </Feedback>
            )}
          </div>
        </Modal>

        <Modal
          open={Boolean(toDisable)}
          onClose={() => setToDisable(null)}
          title={t('adminUi.deactivateDeptTitle')}
          kicker={t('adminUi.confirmation')}
          footer={(
            <>
              <Button variant="outline" onClick={() => setToDisable(null)}>{t('common.cancel')}</Button>
              <Button disabled={disable.isPending} onClick={() => disable.mutate()}>{t('adminUi.confirmDeactivate')}</Button>
            </>
          )}
        >
          <p className="text-sm">
            {t('adminUi.deactivateDeptBody', { name: toDisable?.nom ?? '', count: toDisable?.agentsCount ?? 0 })}
          </p>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}
