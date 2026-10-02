import { useTranslation } from 'react-i18next'
import { Ban, Pencil, Plus, Users } from 'lucide-react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { Badge, statutLabel, statutTone } from '../../components/ui/badge'
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
  createSociete,
  deactivateSociete,
  listSocietes,
  updateSociete,
  type SocieteAdmin,
} from '../../lib/api/access-admin'
import { RequirePermission } from '../../lib/rbac/RequirePermission'

const emptyForm = { nom: '', code: '', villeReference: '', statut: 'ACTIF' }

export function SocietesAdminPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<'create' | SocieteAdmin | null>(null)
  const [toDisable, setToDisable] = useState<SocieteAdmin | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const societes = useQuery({ queryKey: ['admin-societes'], queryFn: listSocietes })
  const rows = societes.data ?? []

  const kpis = useMemo(() => {
    const total = rows.length
    const actives = rows.filter((r) => r.statut === 'ACTIF').length
    const prep = rows.filter((r) => r.statut === 'EN_PREPARATION').length
    const agents = rows.reduce((sum, r) => sum + (r.agentsCount ?? 0), 0)
    return { total, actives, prep, agents }
  }, [rows])

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

  return (
    <RequirePermission anyOf={['ADMIN_SYSTEME', 'DIRECTION']}>
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.companies.kicker')}
          title={t('pages.companies.title')}
          subtitle={t('pages.companies.subtitle')}
          actions={(
            <Button onClick={openCreate}>
              <Plus className="h-4 w-4" />
              {t('adminUi.newCompany')}
            </Button>
          )}
        />
        {error && <Feedback tone="danger">{error}</Feedback>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('adminUi.totalCompanies')} value={kpis.total} accent="gold" />
          <StatCard label={t('adminUi.activeCompanies')} value={kpis.actives} accent="ok" />
          <StatCard label={t('adminUi.inPreparation')} value={kpis.prep} accent="warn" />
          <StatCard label={t('adminUi.attachedAgents')} value={kpis.agents} hint={t('adminUi.allCompaniesTogether')} accent="info" />
        </div>
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">
                <tr>
                  <th className="px-4 py-3">{t('adminUi.name')}</th>
                  <th className="px-4 py-3">{t('adminUi.code')}</th>
                  <th className="px-4 py-3">{t('adminUi.city')}</th>
                  <th className="px-4 py-3">{t('common.status')}</th>
                  <th className="px-4 py-3">{t('adminUi.attachedAgents')}</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{ animation: `ma-enter 320ms ease ${i * 45}ms both` }}
                    className={
                      i % 2 === 1
                        ? 'border-t border-ma-line/80 bg-slate-50/70 transition hover:bg-ma-gold-500/8 hover:shadow-[inset_0_0_0_1px_rgb(232_180_42/0.12)] dark:border-white/8 dark:bg-white/[0.03] dark:hover:bg-ma-gold-500/10'
                        : 'border-t border-ma-line/80 bg-white transition hover:bg-ma-gold-500/8 hover:shadow-[inset_0_0_0_1px_rgb(232_180_42/0.12)] dark:border-white/8 dark:bg-transparent dark:hover:bg-ma-gold-500/10'
                    }
                  >
                    <td className="px-4 py-3 font-medium">{row.nom}</td>
                    <td className="px-4 py-3 font-mono text-xs">{row.code}</td>
                    <td className="px-4 py-3">
                      {row.villeReference ? (
                        row.villeReference
                      ) : (
                        <span className="italic text-slate-400 dark:text-white/35">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={statutTone(row.statut)}>{statutLabel(row.statut)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-ma-muted" />
                        {row.agentsCount ?? 0}
                      </span>
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
            {rows.length === 0 && !societes.isError && (
              <p className="px-4 py-6 text-sm text-ma-muted">{t('adminUi.noCompanyRegistered')}</p>
            )}
            {societes.isError && (
              <div className="p-4">
                <Feedback tone="danger">
                  {societes.error instanceof ApiError ? societes.error.message : t('crud.loadFail')}
                </Feedback>
              </div>
            )}
          </CardBody>
        </Card>
        <Modal
          open={Boolean(editor)}
          onClose={() => setEditor(null)}
          kicker={t('adminUi.administration')}
          title={editor === 'create' ? t('adminUi.newCompany') : t('adminUi.editCompany')}
          footer={(
            <>
              <Button type="button" variant="outline" onClick={() => setEditor(null)}>{t('common.close')}</Button>
              <Button type="submit" form="ma-societe-form" disabled={save.isPending}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </>
          )}
        >
          <form
            id="ma-societe-form"
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              save.mutate()
            }}
          >
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ma-muted">{t('adminUi.name')}</span>
              <Input value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} required />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ma-muted">{t('adminUi.projectCode')}</span>
              <Input
                value={form.code}
                disabled={editor !== 'create'}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                required
                maxLength={10}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ma-muted">
                {t('adminUi.cityOptional')}
              </span>
              <Input
                value={form.villeReference}
                onChange={(e) => setForm({ ...form, villeReference: e.target.value })}
              />
            </label>
            {editor !== 'create' && (
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-ma-muted">{t('common.status')}</span>
                <select
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-ma-navy-700 dark:bg-ma-navy-900"
                  value={form.statut}
                  onChange={(e) => setForm({ ...form, statut: e.target.value })}
                >
                  <option value="ACTIF">{t('common.active')}</option>
                  <option value="EN_PREPARATION">{t('adminUi.inPreparation')}</option>
                  <option value="INACTIF">{t('common.inactive')}</option>
                </select>
              </label>
            )}
          </form>
        </Modal>
        <Modal
          open={Boolean(toDisable)}
          onClose={() => setToDisable(null)}
          kicker={t('adminUi.confirmation')}
          title={t('adminUi.deactivateCompanyTitle')}
          footer={(
            <>
              <Button variant="outline" onClick={() => setToDisable(null)}>{t('common.cancel')}</Button>
              <Button disabled={disable.isPending} onClick={() => disable.mutate()}>{t('adminUi.confirmDeactivate')}</Button>
            </>
          )}
        >
          <p className="text-sm text-ma-muted">
            {t('adminUi.deactivateCompanyBody', { name: toDisable?.nom ?? '', code: toDisable?.code ?? '' })}
          </p>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}
