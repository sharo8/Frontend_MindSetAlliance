import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Building2, Globe, History, KeyRound, ShieldCheck, UserCheck, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Avatar } from '../../components/ui/avatar'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { IconTile } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Select } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { PerimeterFilter, RolePerimeterCells } from '../../components/ui/role-scope-badges'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { StatCard } from '../../components/ui/stat-card'
import { CellStack, IconAction, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { spring } from '../../components/motion/springs'
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
import { Switch } from './access-ui'

function historyLabel(action: string, role?: string, project?: string) {
  const roleTxt = role ? roleLabel(String(role)) : i18n.t('adminUi.roleWord')
  const scope = project === 'ENTREPRISE' || !project ? i18n.t('adminUi.wholeEnterprise') : projectLabel(project)
  if (action === 'ASSIGN_ROLE') return i18n.t('adminUi.historyAssign', { role: roleTxt, scope })
  if (action === 'REVOKE_ROLE') return i18n.t('adminUi.historyRevoke', { role: roleTxt, scope })
  if (action === 'CREATE') return i18n.t('adminUi.historyCreate')
  return action
}

function historyTone(action: string) {
  if (action === 'ASSIGN_ROLE') return 'bg-status-success'
  if (action === 'REVOKE_ROLE') return 'bg-status-danger'
  return 'bg-ma-gold-500'
}

function dateTime(value?: string) {
  if (!value) return '–'
  const d = new Date(value)
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

/** Titre de bloc dans la fenêtre d'accès. */
function BlockTitle({ children, hint }: { children: string; hint?: string }) {
  return (
    <div className="mb-3">
      <h3 className="text-[14.5px] font-semibold tracking-[-0.015em] text-ink">{children}</h3>
      {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{hint}</p>}
    </div>
  )
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


  const total = agents.data?.totalElements ?? 0
  const pageCount = Math.max(1, agents.data?.totalPages ?? 1)
  const currentPage = (agents.data?.number ?? page) + 1

  return (
    <RequirePermission permission="MANAGE_ACCESS">
      <div className="space-y-6">
        <PageHeader kicker={t('pages.access.kicker')} title={t('pages.access.title')} subtitle={t('pages.access.subtitle')} />
        {error && !selected && <Feedback tone="danger">{error}</Feedback>}

        <Stagger className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StaggerItem className="min-w-0">
            <StatCard label={t('adminUi.totalAgents')} value={stats.data?.total ?? 0} hint={t('adminUi.allAccounts')} accent="gold" icon={<UsersRound />} />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard label={t('adminUi.activeAgents')} value={stats.data?.actifs ?? 0} hint={t('adminUi.accountsInService')} accent="ok" icon={<UserCheck />} />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard label={t('adminUi.wholeCompany')} value={stats.data?.entreprise ?? 0} hint={t('adminUi.crossAccess')} accent="info" icon={<Globe />} />
          </StaggerItem>
          <StaggerItem className="min-w-0">
            <StatCard label={t('adminUi.oneProject')} value={stats.data?.projetSeul ?? 0} hint={t('adminUi.limitedAccess')} accent="warn" icon={<Building2 />} />
          </StaggerItem>
        </Stagger>

        <TableCard
          loading={agents.isLoading}
          toolbar={(
            <FilterBar>
              <SearchField
                placeholder={t('adminUi.searchAgent')}
                value={q}
                onChange={(value) => {
                  setPage(0)
                  setQ(value)
                }}
              />
              <FilterSelect
                className="w-[calc(50%-4px)] text-ellipsis sm:w-auto"
                aria-label={t('common.department')}
                active={Boolean(departementId)}
                value={departementId}
                onChange={(e) => {
                  setPage(0)
                  setDepartementId(e.target.value)
                }}
              >
                <option value="">{t('adminUi.allDepartments')}</option>
                {(deps.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                className="w-[calc(50%-4px)] text-ellipsis sm:w-auto"
                aria-label={t('adminUi.allRoles')}
                active={Boolean(roleFilter)}
                value={roleFilter}
                onChange={(e) => {
                  setPage(0)
                  setRoleFilter(e.target.value)
                }}
              >
                <option value="">{t('adminUi.allRoles')}</option>
                {(catalogRoles.data ?? []).map((r) => (
                  <option key={r.id} value={r.nom}>
                    {roleLabel(r.nom)}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect
                className="w-[calc(50%-4px)] text-ellipsis sm:w-auto"
                aria-label={t('common.status')}
                active={Boolean(statut)}
                value={statut}
                onChange={(e) => {
                  setPage(0)
                  setStatut(e.target.value)
                }}
              >
                <option value="">{t('common.allStatuses')}</option>
                <option value="ACTIF">{t('common.active')}</option>
                <option value="INACTIF">{t('common.inactive')}</option>
              </FilterSelect>
              <PerimeterFilter
                className="w-[calc(50%-4px)] text-ellipsis sm:w-auto"
                value={scope}
                projects={catalogProjects.data ?? []}
                onChange={(value) => {
                  setPage(0)
                  setScope(value)
                }}
              />
            </FilterBar>
          )}
          empty={
            agents.isError ? (
              <div className="py-3">
                <Feedback tone="danger">{agents.error instanceof ApiError ? agents.error.message : t('adminUi.loadAgentsFail')}</Feedback>
              </div>
            ) : rows.length === 0 ? (
              <EmptyState icon={<UsersRound />} title={t('adminUi.noAgentsFilter')} hint={t('acces.access.emptyHint', 'Élargissez la recherche ou retirez un filtre.')} />
            ) : undefined
          }
          footer={
            total > 0 ? (
              <Pagination page={currentPage} pageCount={pageCount} total={total} pageSize={agents.data?.size ?? 20} unit="agents" onPage={(p) => setPage(p - 1)} />
            ) : undefined
          }
        >
          <Table minWidth={980}>
            <THead>
              <tr>
                <Th>{t('adminUi.agent')}</Th>
                <Th>{t('common.department')}</Th>
                <Th>{t('adminUi.defaultRolesShort')}</Th>
                <Th>{t('adminUi.perimeter')}</Th>
                <Th>{t('common.status')}</Th>
                <Th align="right">
                  <span className="sr-only">{t('common.actions')}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((agent) => (
                <Tr
                  key={agent.id}
                  onClick={() => {
                    setSelected(agent)
                    setError(null)
                  }}
                >
                  <Td className="max-w-[280px]">
                    <div className="flex items-center gap-3">
                      <Avatar name={`${agent.prenom} ${agent.nom}`} agentId={agent.id} hasPhoto={agent.hasPhoto} size="md" />
                      <CellStack title={`${agent.prenom} ${agent.nom}`} meta={agent.emailPro} />
                    </div>
                  </Td>
                  <Td className="max-w-[180px]">
                    <span className="block truncate text-ink-2" title={agent.departement?.nom ?? ''}>
                      {agent.departement?.nom ?? <span className="text-ink-3">–</span>}
                    </span>
                  </Td>
                  <RolePerimeterCells roles={agent.roles} />
                  <Td>
                    <Badge dot tone={agent.statut === 'ACTIF' ? 'success' : 'danger'}>
                      {agent.statut === 'ACTIF' ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </Td>
                  <Td align="right">
                    <RowActions>
                      <IconAction
                        label={t('adminUi.manageAccess')}
                        onClick={() => {
                          setSelected(agent)
                          setError(null)
                        }}
                      >
                        <KeyRound />
                      </IconAction>
                    </RowActions>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        </TableCard>

        <Modal
          open={Boolean(selected)}
          onClose={() => {
            setSelected(null)
            setConfirmWide(false)
            setDenyBlockers({})
          }}
          title={selectedLabel || t('adminUi.manageAccess')}
          kicker={t('adminUi.accessAgent')}
          subtitle={selected ? `${selected.emailPro}${selected.departement?.nom ? ` · ${selected.departement.nom}` : ''}` : undefined}
          size="xl"
          footer={(
            <>
              <Button variant="outline" onClick={() => setSelected(null)}>
                {t('common.cancel')}
              </Button>
              <Button disabled={save.isPending || (companyWide && !companyRoleId)} onClick={requestSave}>
                <ShieldCheck className="h-4 w-4" />
                {save.isPending ? t('common.saving') : confirmWide ? t('common.confirm') : t('common.save')}
              </Button>
            </>
          )}
        >
          <div className="space-y-6">
            {error && <Feedback tone="danger">{error}</Feedback>}

            {/* Accès transverse */}
            <section
              className={cn(
                'rounded-[20px] p-4 ring-1 ring-inset transition-[background-color,box-shadow] duration-300 sm:p-5',
                companyWide ? 'bg-ma-navy-700/[0.05] ring-ma-navy-700/20 dark:bg-ma-gold-400/[0.06] dark:ring-ma-gold-400/25' : 'bg-surface ring-hairline',
              )}
            >
              <div className="flex items-start gap-3.5">
                <span className="mt-0.5 inline-flex" title="Accès toute l’entreprise : l’agent voit tous les projets.">
                  <IconTile tone="navy">
                    <Globe />
                  </IconTile>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[14.5px] font-semibold tracking-[-0.015em] text-ink">{t('adminUi.crossAccess')}</h3>
                      <p className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{t('adminUi.crossAccessHint')}</p>
                    </div>
                    <Switch checked={companyWide} onChange={setCompanyWide} label={t('adminUi.enable')} />
                  </div>
                  <AnimatePresence initial={false}>
                    {companyWide && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={spring.snappy}
                        className="overflow-hidden"
                      >
                        <div className="pt-3.5">
                          <Select
                            aria-label={t('adminUi.chooseCompanyRole')}
                            aria-invalid={!companyRoleId}
                            className="sm:max-w-sm"
                            value={companyRoleId}
                            onChange={(e) => setCompanyRoleId(e.target.value)}
                          >
                            <option value="">{t('adminUi.chooseCompanyRole')}</option>
                            {(catalogRoles.data ?? []).map((r) => (
                              <option key={r.id} value={r.id}>
                                {roleLabel(r.nom)}
                              </option>
                            ))}
                          </Select>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </section>

            {/* Accès par société */}
            <section>
              <BlockTitle hint={companyWide ? t('adminUi.projectAccessInactive') : undefined}>{t('adminUi.accessByProject')}</BlockTitle>
              <div className={cn('space-y-2.5 transition-opacity duration-300', companyWide && 'pointer-events-none opacity-50')}>
                {catalogProjects.isLoading && <Skeleton className="h-16 rounded-[18px]" />}
                {(catalogProjects.data ?? []).map((project) => {
                  const specificRole = projectRoles[String(project.id)] ?? ''
                  const customCount = (detail.data?.overrides ?? []).filter((row) => row.projectId === project.id).length
                  const open = expandedProjectId === project.id
                  return (
                    <div
                      key={project.id}
                      className={cn(
                        'overflow-hidden rounded-[18px] bg-surface ring-1 ring-inset transition-[box-shadow] duration-200',
                        specificRole && !companyWide ? 'ring-ma-gold-500/30' : 'ring-hairline',
                      )}
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:flex-nowrap">
                        <span className="inline-flex" title="Accès limité à cette société : l’agent ne voit que ce projet.">
                          <IconTile tone="gold" size="sm">
                            <Building2 />
                          </IconTile>
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">{project.nom}</span>
                        <div className="order-last w-full sm:order-none sm:w-[15rem] sm:shrink-0">
                          <Select
                            aria-label={`${t('adminUi.accessByProject')} · ${project.nom}`}
                            disabled={companyWide}
                            value={specificRole}
                            onChange={(e) => setProjectRoles((current) => ({ ...current, [String(project.id)]: e.target.value }))}
                          >
                            <option value="">{companyWide ? t('adminUi.coveredByWide') : t('adminUi.noAccess')}</option>
                            {(catalogRoles.data ?? []).map((r) => (
                              <option key={r.id} value={r.id}>
                                {roleLabel(r.nom)}
                              </option>
                            ))}
                          </Select>
                        </div>
                        <div className="flex shrink-0 justify-end sm:w-[8.5rem]">
                          {specificRole && (
                            <ProjectPermissionsToggle
                              open={open}
                              count={customCount}
                              disabled={companyWide}
                              onToggle={() => setExpandedProjectId((current) => (current === project.id ? null : project.id))}
                            />
                          )}
                        </div>
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

            {confirmWide && <Feedback tone="warning">{t('adminUi.confirmWide')}</Feedback>}

            {/* Historique */}
            <section>
              <BlockTitle>{t('adminUi.accessHistory')}</BlockTitle>
              {history.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : (history.data ?? []).length === 0 ? (
                <div className="rounded-[18px] ring-1 ring-hairline">
                  <EmptyState icon={<History />} title={t('adminUi.noAccessHistory')} />
                </div>
              ) : (
                <ol className="relative space-y-0.5 pl-1">
                  {(history.data ?? []).map((row, i, list) => (
                    <li key={row.id} className="relative flex gap-3.5 pb-3.5">
                      <div className="relative flex w-3 shrink-0 justify-center">
                        <span className={cn('relative z-[1] mt-[5px] h-2.5 w-2.5 rounded-full ring-4 ring-[var(--glass-bg-strong)]', historyTone(row.action))} />
                        {i < list.length - 1 && <span className="absolute bottom-[-6px] top-4 w-px bg-hairline" aria-hidden />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium text-ink">{historyLabel(row.action, row.role, row.project)}</p>
                        <p className="mt-0.5 text-[12px] tabular-nums text-ink-3">
                          {dateTime(row.createdAt)}
                          {row.auteur ? ` · ${row.auteur}` : ''}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </Modal>
        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}
