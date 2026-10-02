import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Globe, KeyRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { PerimeterFilter, RolePerimeterCells } from '../../components/ui/role-scope-badges'
import { StatCard } from '../../components/ui/stat-card'
import { Toast } from '../../components/ui/toast'
import { ApiError } from '../../lib/api/client'
import {
  fetchAccessHistory,
  fetchAccessStats,
  listAccessAgents,
  listAccessProjects,
  listAccessRoles,
  listAgentAccessRoles,
  syncAgentAccess,
  type AccessAgent,
} from '../../lib/api/access-admin'
import { fetchDepartements, getDirectoryAgent } from '../../lib/api/iam-admin'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { projectLabel, roleLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'
import i18n from '../../lib/i18n/i18n'
import { AccessProjectPermissions, ProjectPermissionsToggle } from './AccessProjectPermissions'

function FieldCaption({ children }: { children: string }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{children}</span>
}

function historyLabel(action: string, role?: string, project?: string) {
  const roleTxt = role ? roleLabel(String(role)) : i18n.t('adminUi.roleWord')
  const scope = project === 'ENTREPRISE' || !project ? i18n.t('adminUi.wholeEnterprise') : projectLabel(project)
  if (action === 'ASSIGN_ROLE') return i18n.t('adminUi.historyAssign', { role: roleTxt, scope })
  if (action === 'REVOKE_ROLE') return i18n.t('adminUi.historyRevoke', { role: roleTxt, scope })
  if (action === 'CREATE') return i18n.t('adminUi.historyCreate')
  return action
}

export function GestionAccesPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const [departementId, setDepartementId] = useState('')
  const [statut, setStatut] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [scope, setScope] = useState('')
  const [selected, setSelected] = useState<AccessAgent | null>(null)
  const [companyWide, setCompanyWide] = useState(false)
  const [companyRoleId, setCompanyRoleId] = useState('')
  const [projectRoles, setProjectRoles] = useState<Record<string, string>>({})
  const [confirmWide, setConfirmWide] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null)
  const [denyBlockers, setDenyBlockers] = useState<Record<number, string[]>>({})

  const agents = useQuery({
    queryKey: ['access-agents', q, page, departementId, statut, roleFilter, scope],
    queryFn: () =>
      listAccessAgents({
        q,
        page,
        departementId,
        statut,
        role: roleFilter,
        scope,
        sort: 'createdAt,desc',
      }),
  })
  const stats = useQuery({ queryKey: ['access-stats'], queryFn: fetchAccessStats })
  const deps = useQuery({ queryKey: ['departements'], queryFn: fetchDepartements })
  const catalogRoles = useQuery({ queryKey: ['access-roles'], queryFn: listAccessRoles })
  const catalogProjects = useQuery({ queryKey: ['access-projects'], queryFn: listAccessProjects })
  const currentRoles = useQuery({
    queryKey: ['access-agent-roles', selected?.id],
    queryFn: () => listAgentAccessRoles(selected!.id),
    enabled: Boolean(selected),
  })
  const history = useQuery({
    queryKey: ['access-history', selected?.id],
    queryFn: () => fetchAccessHistory(selected!.id),
    enabled: Boolean(selected),
  })
  const detail = useQuery({
    queryKey: ['directory-agent', selected?.id],
    queryFn: () => getDirectoryAgent(selected!.id),
    enabled: Boolean(selected),
  })

  const rows = agents.data?.content ?? []

  useEffect(() => {
    if (!selected) return
    const roles = currentRoles.data ?? selected.roles
    const wide = roles.find((r) => !r.projectId && !r.projectCode)
    setCompanyWide(Boolean(wide))
    setCompanyRoleId(wide ? String(wide.roleId) : '')
    const next: Record<string, string> = {}
    for (const project of catalogProjects.data ?? []) {
      const found = roles.find((r) => r.projectId === project.id || r.projectCode === project.code)
      next[String(project.id)] = found ? String(found.roleId) : ''
    }
    setProjectRoles(next)
    setConfirmWide(false)
    setExpandedProjectId(null)
    setDenyBlockers({})
  }, [selected, currentRoles.data, catalogProjects.data])

  const hadCompanyWide = (currentRoles.data ?? selected?.roles ?? []).some((r) => !r.projectId && !r.projectCode)

  const save = useMutation({
    mutationFn: () =>
      syncAgentAccess(selected!.id, {
        companyRoleId: companyWide && companyRoleId ? Number(companyRoleId) : null,
        projects: companyWide
          ? []
          : (catalogProjects.data ?? []).map((project) => ({
              projectId: project.id,
              roleId: projectRoles[String(project.id)] ? Number(projectRoles[String(project.id)]) : null,
            })),
      }),
    onSuccess: (result) => {
      setError(null)
      setNotice(result.message || t('adminUi.accessUpdated'))
      setConfirmWide(false)
      void queryClient.invalidateQueries({ queryKey: ['access-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['access-stats'] })
      void queryClient.invalidateQueries({ queryKey: ['access-agent-roles', selected?.id] })
      void queryClient.invalidateQueries({ queryKey: ['access-history', selected?.id] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent', selected?.id] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : t('crud.saveFail'))
    },
  })

  function requestSave() {
    const pendingDeny = Object.values(denyBlockers).flat().filter(Boolean)
    if (pendingDeny.length > 0) {
      setError(t('adminUi.denyReasonRequired', { list: pendingDeny.join(', ') }))
      return
    }
    const willWide = companyWide && Boolean(companyRoleId)
    if (willWide && !hadCompanyWide && !confirmWide) {
      setConfirmWide(true)
      return
    }
    save.mutate()
  }

  const selectedLabel = useMemo(() => {
    if (!selected) return ''
    return `${selected.prenom} ${selected.nom}`
  }, [selected])

  return (
    <RequirePermission permission="MANAGE_ACCESS">
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.access.kicker')}
          title={t('pages.access.title')}
          subtitle={t('pages.access.subtitle')}
        />
        {error && !selected && <Feedback tone="danger">{error}</Feedback>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label={t('adminUi.totalAgents')} value={stats.data?.total ?? 0} hint={t('adminUi.allAccounts')} accent="gold" />
          <StatCard label={t('adminUi.activeAgents')} value={stats.data?.actifs ?? 0} hint={t('adminUi.accountsInService')} accent="ok" />
          <StatCard label={t('adminUi.wholeCompany')} value={stats.data?.entreprise ?? 0} hint={t('adminUi.crossAccess')} accent="info" />
          <StatCard label={t('adminUi.oneProject')} value={stats.data?.projetSeul ?? 0} hint={t('adminUi.limitedAccess')} accent="warn" />
        </div>

        <div className="flex flex-wrap gap-2">
          <Input
            placeholder={t('adminUi.searchAgent')}
            value={q}
            onChange={(e) => {
              setPage(0)
              setQ(e.target.value)
            }}
            className="min-w-[220px] max-w-sm flex-1"
          />
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-800"
            value={departementId}
            onChange={(e) => {
              setPage(0)
              setDepartementId(e.target.value)
            }}
          >
            <option value="">{t('adminUi.allDepartments')}</option>
            {(deps.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.nom}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-800"
            value={roleFilter}
            onChange={(e) => {
              setPage(0)
              setRoleFilter(e.target.value)
            }}
          >
            <option value="">{t('adminUi.allRoles')}</option>
            {(catalogRoles.data ?? []).map((r) => (
              <option key={r.id} value={r.nom}>{roleLabel(r.nom)}</option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-800"
            value={statut}
            onChange={(e) => {
              setPage(0)
              setStatut(e.target.value)
            }}
          >
            <option value="">{t('common.allStatuses')}</option>
            <option value="ACTIF">{t('common.active')}</option>
            <option value="INACTIF">{t('common.inactive')}</option>
          </select>
          <PerimeterFilter
            value={scope}
            projects={catalogProjects.data ?? []}
            onChange={(value) => {
              setPage(0)
              setScope(value)
            }}
          />
        </div>

        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted dark:text-ma-gray-300">
                <tr>
                  <th className="px-4 py-3 font-medium">{t('adminUi.name')}</th>
                  <th className="max-w-[180px] px-4 py-3 font-medium">{t('adminUi.email')}</th>
                  <th className="max-w-[160px] px-4 py-3 font-medium">{t('common.department')}</th>
                  <th className="px-4 py-3 font-medium">{t('adminUi.defaultRolesShort')}</th>
                  <th className="px-4 py-3 font-medium">{t('adminUi.perimeter')}</th>
                  <th className="px-4 py-3 font-medium">{t('common.status')}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {rows.map((agent, i) => (
                  <tr
                    key={agent.id}
                    className={cn(
                      'ma-enter border-t border-ma-line/80 dark:border-white/8',
                      i % 2 === 1 ? 'bg-slate-50/70 dark:bg-white/[0.03]' : 'bg-white dark:bg-transparent',
                      'hover:bg-ma-gold-500/8',
                    )}
                    style={{ animationDelay: `${Math.min(i, 12) * 70}ms` }}
                  >
                    <td className="px-4 py-3 font-medium">
                      {agent.prenom} {agent.nom}
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3" title={agent.emailPro}>{agent.emailPro}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-ma-muted dark:text-ma-gray-300" title={agent.departement?.nom ?? ''}>{agent.departement?.nom ?? '—'}</td>
                    <RolePerimeterCells roles={agent.roles} />
                    <td className="px-4 py-3">
                      <Badge tone={agent.statut === 'ACTIF' ? 'success' : 'danger'}>
                        {agent.statut === 'ACTIF' ? 'ACTIF' : 'INACTIF'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-ma-muted hover:bg-slate-100 hover:text-ma-navy-900 dark:hover:bg-white/10 dark:hover:text-white"
                        title={t('adminUi.manageAccess')}
                        onClick={() => { setSelected(agent); setError(null) }}
                      >
                        <KeyRound className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agents.isError && (
              <div className="p-4">
                <Feedback tone="danger">
                  {agents.error instanceof ApiError ? agents.error.message : t('adminUi.loadAgentsFail')}
                </Feedback>
              </div>
            )}
            {!agents.isError && rows.length === 0 && <p className="p-4 text-sm text-ma-muted">{t('adminUi.noAgentsFilter')}</p>}
          </CardBody>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            {t('adminUi.previous')}
          </Button>
          <Button
            variant="outline"
            disabled={(agents.data?.number ?? 0) + 1 >= (agents.data?.totalPages ?? 1)}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('adminUi.next')}
          </Button>
        </div>

        <Modal
          open={Boolean(selected)}
          onClose={() => { setSelected(null); setConfirmWide(false); setDenyBlockers({}) }}
          title={selectedLabel || t('adminUi.manageAccess')}
          kicker={t('adminUi.accessAgent')}
          subtitle={selected ? `${selected.emailPro}${selected.departement?.nom ? ` · ${selected.departement.nom}` : ''}` : undefined}
          size="xl"
          footer={(
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>{t('common.close')}</Button>
              <Button disabled={save.isPending || (companyWide && !companyRoleId)} onClick={requestSave}>
                {save.isPending ? t('common.saving') : t('common.save')}
              </Button>
            </>
          )}
        >
          {error && <Feedback tone="danger">{error}</Feedback>}
          <div className="space-y-6">
            <section className={cn('rounded-2xl border p-4 transition duration-200', companyWide ? 'border-ma-navy-800/30 bg-ma-navy-950/[0.03] dark:border-ma-gold-500/20' : 'border-ma-line dark:border-white/10')}>
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <FieldCaption>{t('adminUi.crossAccess')}</FieldCaption>
                  <p className="text-sm text-ma-muted">{t('adminUi.crossAccessHint')}</p>
                </div>
                <label className="inline-flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="accent-ma-gold-500"
                    checked={companyWide}
                    onChange={(e) => setCompanyWide(e.target.checked)}
                  />
                  {t('adminUi.enable')}
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-ma-navy-800 dark:text-ma-gold-400" title="Accès toute l’entreprise : l’agent voit tous les projets." />
                <select
                  disabled={!companyWide}
                  className="w-full rounded-xl border border-ma-line bg-white px-3 py-2 text-sm transition duration-200 disabled:opacity-50 dark:border-white/10 dark:bg-ma-navy-900"
                  value={companyRoleId}
                  onChange={(e) => setCompanyRoleId(e.target.value)}
                >
                  <option value="">{t('adminUi.chooseCompanyRole')}</option>
                  {(catalogRoles.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{roleLabel(r.nom)}</option>
                  ))}
                </select>
              </div>
            </section>

            <section className={cn('transition duration-200', companyWide && 'pointer-events-none opacity-55')}>
              <FieldCaption>{t('adminUi.accessByProject')}</FieldCaption>
              {companyWide && (
                <p className="mb-3 text-sm text-ma-muted">
                  {t('adminUi.projectAccessInactive')}
                </p>
              )}
              <div className="space-y-2">
                {(catalogProjects.data ?? []).map((project) => {
                  const specificRole = projectRoles[String(project.id)] ?? ''
                  const customCount = (detail.data?.overrides ?? []).filter((row) => row.projectId === project.id).length
                  const open = expandedProjectId === project.id
                  return (
                    <div
                      key={project.id}
                      className="rounded-xl border border-ma-line transition duration-200 dark:border-white/10"
                    >
                      <div className="flex flex-wrap items-center gap-3 px-3 py-2.5">
                        <Building2 className="h-4 w-4 shrink-0 text-ma-gold-600" title="Accès limité à cette société : l’agent ne voit que ce projet." />
                        <span className="min-w-[10rem] flex-1 text-sm font-medium">{project.nom}</span>
                        <select
                          disabled={companyWide}
                          className="min-w-[12rem] flex-1 rounded-xl border border-ma-line bg-white px-3 py-2 text-sm transition duration-200 disabled:cursor-not-allowed disabled:bg-slate-50 dark:border-white/10 dark:bg-ma-navy-900 dark:disabled:bg-ma-navy-900/60"
                          value={specificRole}
                          onChange={(e) => setProjectRoles((current) => ({ ...current, [String(project.id)]: e.target.value }))}
                        >
                          <option value="">
                            {companyWide ? t('adminUi.coveredByWide') : t('adminUi.noAccess')}
                          </option>
                          {(catalogRoles.data ?? []).map((r) => (
                            <option key={r.id} value={r.id}>{roleLabel(r.nom)}</option>
                          ))}
                        </select>
                        {specificRole && (
                          <ProjectPermissionsToggle
                            open={open}
                            count={customCount}
                            disabled={companyWide}
                            onToggle={() => setExpandedProjectId((current) => (current === project.id ? null : project.id))}
                          />
                        )}
                      </div>
                      {specificRole && selected && (
                        <AccessProjectPermissions
                          agentId={selected.id}
                          projectId={project.id}
                          projectNom={project.nom}
                          roleId={Number(specificRole)}
                          open={open && !companyWide}
                          onDenyBlockersChange={(labels) => {
                            setDenyBlockers((current) => {
                              const previous = current[project.id] ?? []
                              if (previous.join('\0') === labels.join('\0')) return current
                              return { ...current, [project.id]: labels }
                            })
                          }}
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </section>

            {confirmWide && (
              <Feedback tone="warning">
                {t('adminUi.confirmWide')}
              </Feedback>
            )}

            <section>
              <FieldCaption>{t('adminUi.accessHistory')}</FieldCaption>
              <ul className="space-y-2">
                {(history.data ?? []).map((row) => (
                  <li key={row.id} className="rounded-xl border border-ma-line px-3 py-2 text-sm dark:border-white/10">
                    <p className="font-medium">{historyLabel(row.action, row.role, row.project)}</p>
                    <p className="text-xs text-ma-muted">
                      {row.createdAt ? new Date(row.createdAt).toLocaleString('fr-FR') : '—'}
                      {row.auteur ? ` · ${row.auteur}` : ''}
                    </p>
                  </li>
                ))}
                {(history.data ?? []).length === 0 && (
                  <p className="text-sm text-ma-muted">{t('adminUi.noAccessHistory')}</p>
                )}
              </ul>
            </section>
          </div>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}
