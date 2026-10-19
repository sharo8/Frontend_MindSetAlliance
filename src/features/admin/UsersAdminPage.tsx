import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Ban,
  BriefcaseBusiness,
  Building2,
  Check,
  Contact,
  Globe,
  History,
  KeyRound,
  Lock,
  Pencil,
  Plus,
  Power,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Unlock,
  UserPlus,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { AgentPhotoField } from '../../components/ui/AgentPhotoField'
import { PerimeterFilter, RolePerimeterCells, RoleScopeBadges } from '../../components/ui/role-scope-badges'
import { Avatar } from '../../components/ui/avatar'
import { Badge, roleTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Input, Select } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Segmented } from '../../components/ui/segmented'
import { CellStack, IconAction, Pagination, RowActions, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { DetailList, FilterBar, FilterSelect, SearchField } from '../../components/ui/toolbar'
import { Toast } from '../../components/ui/toast'
import { spring } from '../../components/motion/springs'
import { ApiError } from '../../lib/api/client'
import {
  addAgentPermissionOverride,
  createDirectoryAgent,
  deactivateDirectoryAgent,
  deleteDirectoryAgent,
  fetchDepartements,
  fetchPermissionsCatalog,
  fetchRoles,
  fetchAgentPhoto,
  getDirectoryAgent,
  listDirectoryAgents,
  reactivateDirectoryAgent,
  removeAgentPermissionOverride,
  updateDirectoryAgent,
  type DirectoryAgent,
  type PermissionOverrideRow,
} from '../../lib/api/iam-admin'
import { assignAgentRole, listAccessProjects, listAgentAccessRoles, revokeAgentRole } from '../../lib/api/access-admin'
import { useAuthStore } from '../../lib/auth/auth-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { permissionLabel, projectLabel, roleLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'
import { CheckBox, FieldError, FieldHint, FormSection, InfoNote } from './access-ui'

const emptyForm = {
  nom: '',
  prenom: '',
  emailPro: '',
  telephone: '',
  departementId: '',
  projectCode: '',
  roles: [] as string[],
  photo: null as string | null,
}

function uniqueProjectCode(roles: { projectCode?: string | null }[]) {
  const codes = [...new Set(roles.map((r) => r.projectCode || ''))]
  return codes.length === 1 ? codes[0] : ''
}

function emailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function defaultRolesOf(deps: { id: number; roles?: { nom: string }[] }[] | undefined, departementId: string) {
  return deps?.find((d) => String(d.id) === departementId)?.roles?.map((r) => r.nom) ?? []
}

function shortDate(value?: string | null) {
  if (!value) return null
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function longDate(value?: string | null) {
  if (!value) return null
  const d = new Date(value)
  return `${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} à ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

const dash = <span className="text-ink-3">–</span>

/** Une dérogation (GRANT ou DENY) : libellé, périmètre, motif, auteur. */
function OverrideItem({ row, onRemove, disabled }: { row: PermissionOverrideRow; onRemove: () => void; disabled?: boolean }) {
  const grant = row.type === 'GRANT'
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={spring.snappy}
      className="flex items-start gap-3 rounded-[14px] bg-surface px-3.5 py-3 ring-1 ring-hairline"
    >
      <span
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full',
          grant ? 'bg-status-success/12 text-status-success' : 'bg-status-danger/10 text-status-danger',
        )}
      >
        {grant ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Ban className="h-3.5 w-3.5" strokeWidth={2.4} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">{row.permissionLibelle || permissionLabel(row.permission ?? '')}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-ink-3">
          <span>{row.projectCode ? projectLabel(row.projectCode) : 'Tous ses projets'}</span>
          {row.createdAt && <span aria-hidden>·</span>}
          {row.createdAt && <span>{shortDate(row.createdAt)}</span>}
          {row.accordePar && <span aria-hidden>·</span>}
          {row.accordePar && <span>{row.accordePar}</span>}
        </p>
        {row.motif && <p className="mt-1.5 text-[12.5px] leading-snug text-ink-2">« {row.motif} »</p>}
      </div>
      <Button variant="ghost" size="sm" disabled={disabled} onClick={onRemove}>
        Retirer
      </Button>
    </motion.li>
  )
}

export function UsersAdminPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const accessToken = useAuthStore((s) => s.accessToken)
  const selfId = useAuthStore((s) => s.agentId)
  const ready = Boolean(accessToken)

  const [q, setQ] = useState('')
  const [departementId, setDepartementId] = useState('')
  const [statut, setStatut] = useState('ACTIF')
  const [scope, setScope] = useState('')
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(10)
  const [editor, setEditor] = useState<'create' | DirectoryAgent | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [detailId, setDetailId] = useState<number | null>(null)
  const [tab, setTab] = useState<'profil' | 'roles' | 'perms'>('profil')
  const [confirm, setConfirm] = useState<DirectoryAgent | null>(null)
  const [pendingDelete, setPendingDelete] = useState<DirectoryAgent | null>(null)
  const [motif, setMotif] = useState('')
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [overrideForm, setOverrideForm] = useState({ permissionId: '', projectId: '', type: 'GRANT' as 'GRANT' | 'DENY', motif: '' })
  const [overrideTried, setOverrideTried] = useState(false)
  const [pendingRemove, setPendingRemove] = useState<number | null>(null)
  const [roleId, setRoleId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [photoDirty, setPhotoDirty] = useState(false)
  const [autoRoles, setAutoRoles] = useState<string[]>([])
  const [rolesLocked, setRolesLocked] = useState(true)
  const [flashRoles, setFlashRoles] = useState<string[]>([])
  const [confirmRelock, setConfirmRelock] = useState(false)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({ key: 'createdAt', dir: 'desc' })
  const [highlightedId, setHighlightedId] = useState<number | null>(null)

  const agents = useQuery({
    queryKey: ['directory-agents', q, departementId, statut, scope, page, size, sort],
    queryFn: () => listDirectoryAgents({ q, departementId, statut, scope, page, size, sort: `${sort.key},${sort.dir}` }),
    enabled: ready,
  })
  const deps = useQuery({ queryKey: ['departements'], queryFn: fetchDepartements, enabled: ready })
  const roles = useQuery({ queryKey: ['rbac-roles'], queryFn: fetchRoles, enabled: ready })
  const permissions = useQuery({ queryKey: ['rbac-permissions'], queryFn: fetchPermissionsCatalog, enabled: ready })
  const projects = useQuery({ queryKey: ['access-projects'], queryFn: listAccessProjects, enabled: ready })
  const detail = useQuery({
    queryKey: ['directory-agent', detailId],
    queryFn: () => getDirectoryAgent(detailId!),
    enabled: ready && detailId != null,
  })
  const currentRoles = useQuery({
    queryKey: ['access-agent-roles', detailId],
    queryFn: () => listAgentAccessRoles(detailId!),
    enabled: ready && detailId != null && tab === 'roles',
  })

  const rows = agents.data?.content ?? []
  const selected = detail.data
  const isCreate = editor === 'create'
  const fieldErrors = {
    prenom: !form.prenom.trim() ? 'Le prénom est obligatoire.' : null,
    nom: !form.nom.trim() ? 'Le nom est obligatoire.' : null,
    emailPro: isCreate && !form.emailPro.trim()
      ? 'L’e-mail professionnel est obligatoire.'
      : isCreate && !emailValid(form.emailPro)
        ? 'Indiquez un e-mail valide.'
        : null,
    departementId: !form.departementId ? 'Le département est obligatoire.' : null,
  }
  const formValid = !fieldErrors.prenom && !fieldErrors.nom && !fieldErrors.emailPro && !fieldErrors.departementId && !photoError
  const saveDisabledReason = !form.prenom.trim()
    ? 'Le prénom est obligatoire.'
    : !form.nom.trim()
      ? 'Le nom est obligatoire.'
      : isCreate && !form.emailPro.trim()
        ? 'L’e-mail professionnel est obligatoire.'
        : isCreate && !emailValid(form.emailPro)
          ? 'Indiquez un e-mail valide.'
          : !form.departementId
            ? 'Le département est obligatoire.'
            : photoError
              ? photoError
              : null

  function openCreate() {
    setForm(emptyForm)
    setTouched({})
    setPhotoError(null)
    setPhotoDirty(false)
    setAutoRoles([])
    setRolesLocked(true)
    setFlashRoles([])
    setEditor('create')
    setError(null)
  }

  function applyDepartment(id: string) {
    const nextAuto = defaultRolesOf(deps.data, id)
    setForm((f) => {
      if (rolesLocked) {
        return { ...f, departementId: id, roles: nextAuto }
      }
      const extras = f.roles.filter((r) => !autoRoles.includes(r))
      return { ...f, departementId: id, roles: [...new Set([...nextAuto, ...extras])] }
    })
    setAutoRoles(nextAuto)
    setFlashRoles(nextAuto)
    window.setTimeout(() => setFlashRoles([]), 560)
  }

  const extraRoles = form.roles.filter((r) => !autoRoles.includes(r))

  function requestToggleRolesLock() {
    if (rolesLocked) {
      setRolesLocked(false)
      return
    }
    if (extraRoles.length > 0) {
      setConfirmRelock(true)
      return
    }
    setRolesLocked(true)
  }

  function confirmLockRoles() {
    setForm((f) => ({ ...f, roles: autoRoles }))
    setRolesLocked(true)
    setConfirmRelock(false)
  }

  function openEdit(agent: DirectoryAgent) {
    const auto = defaultRolesOf(deps.data, agent.departement ? String(agent.departement.id) : '')
    setForm({
      nom: agent.nom,
      prenom: agent.prenom,
      emailPro: agent.emailPro,
      telephone: agent.telephone ?? '',
      departementId: agent.departement ? String(agent.departement.id) : '',
      roles: [...new Set(agent.roles.map((r) => r.role))],
      projectCode: uniqueProjectCode(agent.roles),
      photo: null,
    })
    setAutoRoles(auto)
    setRolesLocked(true)
    setFlashRoles([])
    setPhotoError(null)
    setPhotoDirty(false)
    setTouched({})
    setEditor(agent)
    setError(null)
    if (agent.hasPhoto) {
      void fetchAgentPhoto(agent.id).then((row) => {
        setForm((f) => (f.photo ? f : { ...f, photo: row.photo }))
      })
    }
  }

  function openDetail(agent: DirectoryAgent, nextTab: 'profil' | 'roles' | 'perms' = 'profil') {
    setDetailId(agent.id)
    setTab(nextTab)
    setError(null)
  }

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        emailPro: form.emailPro.trim(),
        telephone: form.telephone,
        departementId: Number(form.departementId),
        roles: [...new Set(form.roles)].map((role) => ({
          role,
          projectCode: form.projectCode || null,
        })),
      }
      if (editor === 'create' || photoDirty) payload.photo = form.photo
      if (editor === 'create') return createDirectoryAgent(payload as Parameters<typeof createDirectoryAgent>[0])
      if (typeof editor === 'object' && editor) {
        const { emailPro: _email, ...rest } = payload
        return updateDirectoryAgent(editor.id, rest)
      }
      throw new Error('Formulaire invalide')
    },
    onSuccess: (result) => {
      setNotice(
        editor === 'create'
          ? result.emailBienvenueEnvoye
            ? `Agent créé. Un e-mail de bienvenue a été envoyé à ${result.emailPro}.`
            : `${result.message ?? 'Agent créé.'}${result.motDePasseTemporaire ? ` Mot de passe temporaire : ${result.motDePasseTemporaire}` : ''}`
          : result.message || 'Modifications enregistrées.',
      )
      setEditor(null)
      if (editor === 'create' && result.id) {
        setPage(0)
        setSort({ key: 'createdAt', dir: 'desc' })
        setHighlightedId(result.id)
        window.setTimeout(() => setHighlightedId(null), 1800)
      }
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['access-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['agent-photo'] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent'] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : 'L’enregistrement a échoué.')
    },
  })

  const deactivate = useMutation({
    mutationFn: () => deactivateDirectoryAgent(confirm!.id, motif.trim()),
    onSuccess: () => {
      setNotice('Agent désactivé. Ses sessions ont été révoquées.')
      setConfirm(null)
      setMotif('')
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'La désactivation a échoué.'),
  })

  const removeAgent = useMutation({
    mutationFn: () => deleteDirectoryAgent(pendingDelete!.id, motif.trim()),
    onSuccess: () => {
      setNotice('Agent retiré de l’annuaire. Le compte est suspendu, sans suppression physique.')
      setPendingDelete(null)
      setDetailId(null)
      setMotif('')
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent'] })
      void queryClient.invalidateQueries({ queryKey: ['access-agents'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'La suppression a échoué.'),
  })

  const reactivate = useMutation({
    mutationFn: (id: number) => reactivateDirectoryAgent(id),
    onSuccess: () => {
      setNotice('Agent réactivé.')
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'La réactivation a échoué.'),
  })

  const addOverride = useMutation({
    mutationFn: () =>
      addAgentPermissionOverride(detailId!, {
        permissionId: Number(overrideForm.permissionId),
        projectId: overrideForm.projectId ? Number(overrideForm.projectId) : null,
        type: overrideForm.type,
        motif: overrideForm.motif.trim(),
      }),
    onSuccess: (result) => {
      setNotice(result.message || 'Dérogation enregistrée.')
      setOverrideForm({ permissionId: '', projectId: '', type: 'GRANT', motif: '' })
      setOverrideTried(false)
      void queryClient.invalidateQueries({ queryKey: ['directory-agent', detailId] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'La dérogation a échoué.'),
  })

  const removeOverride = useMutation({
    mutationFn: (id: number) => removeAgentPermissionOverride(detailId!, id),
    onSuccess: (result) => {
      setNotice(result.message || 'Dérogation retirée.')
      setPendingRemove(null)
      void queryClient.invalidateQueries({ queryKey: ['directory-agent', detailId] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Le retrait a échoué.'),
  })

  const assign = useMutation({
    mutationFn: () => assignAgentRole(detailId!, Number(roleId), projectId ? Number(projectId) : null),
    onSuccess: (result) => {
      setNotice(result.message || 'Rôle attribué.')
      setRoleId('')
      setProjectId('')
      void queryClient.invalidateQueries({ queryKey: ['access-agent-roles', detailId] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent', detailId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'L’attribution a échoué.'),
  })

  const revoke = useMutation({
    mutationFn: (agentRoleId: number) => revokeAgentRole(detailId!, agentRoleId),
    onSuccess: (result) => {
      setNotice(result.message || 'Rôle révoqué.')
      void queryClient.invalidateQueries({ queryKey: ['access-agent-roles', detailId] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agents'] })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent', detailId] })
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'La révocation a échoué.'),
  })

  function toggleSort(key: string) {
    setPage(0)
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: key === 'createdAt' ? 'desc' : 'asc' },
    )
  }

  const grants = useMemo(() => (selected?.overrides ?? []).filter((o) => o.type === 'GRANT'), [selected])
  const denies = useMemo(() => (selected?.overrides ?? []).filter((o) => o.type === 'DENY'), [selected])
  const isSelf = (id: number) => selfId != null && selfId === id

  const total = agents.data?.totalElements ?? 0
  const pageCount = Math.max(1, agents.data?.totalPages ?? 1)
  const currentPage = (agents.data?.number ?? page) + 1
  const sortDir = (key: string) => (sort.key === key ? sort.dir : null)
  const roleRows = currentRoles.data ?? selected?.roles ?? []

  return (
    <RequirePermission anyOfPermissions={['MANAGE_USERS', 'MANAGE_ACCESS', 'MANAGE_INTERNAL_AGENTS', 'MANAGE_HR']}>
      <div className="space-y-6">
        <PageHeader
          kicker={t('pages.users.kicker')}
          title={t('pages.users.title')}
          subtitle={t('pages.users.subtitle')}
          actions={(
            <Button onClick={openCreate}>
              <UserPlus className="h-4 w-4" />
              Nouvel agent
            </Button>
          )}
        />
        {error && <Feedback tone="danger">{error}</Feedback>}

        <TableCard
          loading={agents.isLoading}
          toolbar={(
            <FilterBar>
              <SearchField
                placeholder="Rechercher un nom ou un e-mail"
                value={q}
                onChange={(value) => {
                  setPage(0)
                  setQ(value)
                }}
              />
              <Segmented
                className="w-full sm:w-auto [&>button]:flex-1 [&>button]:justify-center sm:[&>button]:flex-none"
                ariaLabel={t('common.status')}
                value={statut}
                onChange={(value) => {
                  setPage(0)
                  setStatut(value)
                }}
                options={[
                  { value: 'ACTIF', label: t('acces.users.actives', 'Actifs') },
                  { value: 'INACTIF', label: t('acces.users.suspended', 'Suspendus') },
                  { value: '', label: t('acces.users.all', 'Tous') },
                ]}
              />
              <FilterSelect
                className="w-[calc(50%-4px)] text-ellipsis sm:w-auto"
                active={Boolean(departementId)}
                aria-label={t('common.department')}
                value={departementId}
                onChange={(e) => {
                  setPage(0)
                  setDepartementId(e.target.value)
                }}
              >
                <option value="">Tous les départements</option>
                {(deps.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nom}
                  </option>
                ))}
              </FilterSelect>
              <PerimeterFilter
                className="w-[calc(50%-4px)] text-ellipsis sm:w-auto"
                value={scope}
                projects={projects.data ?? []}
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
                <Feedback tone="danger">{agents.error instanceof ApiError ? agents.error.message : 'Impossible de charger les agents.'}</Feedback>
              </div>
            ) : rows.length === 0 ? (
              <EmptyState
                icon={<UsersRound />}
                title="Aucun agent pour ces filtres"
                hint={t('acces.users.emptyHint', 'Modifiez la recherche ou les filtres, ou créez un nouvel agent.')}
              />
            ) : undefined
          }
          footer={
            total > 0 ? (
              <Pagination
                page={currentPage}
                pageCount={pageCount}
                total={total}
                pageSize={size}
                sizes={[10, 20]}
                unit="agents"
                onPage={(p) => setPage(p - 1)}
                onPageSize={(s) => {
                  setPage(0)
                  setSize(s)
                }}
              />
            ) : undefined
          }
        >
          <Table minWidth={1000} className="[&_td]:px-3 [&_th]:px-3 [&_td:first-child]:pl-5 [&_th:first-child]:pl-5 [&_td:last-child]:pr-4 [&_th:last-child]:pr-4">
            <THead>
              <tr>
                <Th sort={sortDir('nom')} onSort={() => toggleSort('nom')}>
                  {t('adminUi.agent')}
                </Th>
                <Th>{t('common.department')}</Th>
                <Th>Rôles</Th>
                <Th>{t('adminUi.perimeter')}</Th>
                <Th>{t('common.status')}</Th>
                <Th sort={sortDir('createdAt')} onSort={() => toggleSort('createdAt')}>
                  Créé le
                </Th>
                <Th align="right">
                  <span className="sr-only">{t('common.actions')}</span>
                </Th>
              </tr>
            </THead>
            <TBody>
              {rows.map((agent) => {
                const self = isSelf(agent.id)
                const selfHint = 'Impossible d’agir sur votre propre compte'
                return (
                  <Tr
                    key={agent.id}
                    onClick={() => openDetail(agent)}
                    selected={highlightedId === agent.id}
                    className={cn(highlightedId === agent.id && 'ma-row-new')}
                  >
                    <Td className="max-w-[232px]">
                      <div className="flex items-center gap-3">
                        <Avatar name={`${agent.prenom} ${agent.nom}`} agentId={agent.id} hasPhoto={agent.hasPhoto} size="md" />
                        <CellStack
                          title={(
                            <span className="inline-flex items-center gap-2">
                              <span className="truncate">
                                {agent.prenom} {agent.nom}
                              </span>
                              {agent.hasOverrides && (
                                <span title="Dérogations individuelles actives" className="inline-flex">
                                  <Badge tone="violet" className="h-[19px] px-1.5">
                                    <KeyRound className="h-3 w-3" aria-hidden />
                                    <span className="sr-only">Dérogations</span>
                                  </Badge>
                                </span>
                              )}
                            </span>
                          )}
                          meta={agent.emailPro}
                        />
                      </div>
                    </Td>
                    <Td className="max-w-[140px]">
                      <span className="block truncate text-ink-2" title={agent.departement?.nom ?? ''}>
                        {agent.departement?.nom ?? dash}
                      </span>
                    </Td>
                    <RolePerimeterCells roles={agent.roles} />
                    <Td>
                      <Badge dot tone={agent.statut === 'ACTIF' ? 'success' : 'danger'}>
                        {agent.statut === 'ACTIF' ? 'Actif' : 'Suspendu'}
                      </Badge>
                    </Td>
                    <Td className="whitespace-nowrap tabular-nums text-ink-2">{shortDate(agent.createdAt) ?? dash}</Td>
                    <Td align="right">
                      <RowActions>
                        <IconAction label="Modifier le profil" onClick={() => openEdit(agent)}>
                          <Pencil />
                        </IconAction>
                        <IconAction label="Permissions individuelles" onClick={() => openDetail(agent, 'perms')}>
                          <Shield />
                        </IconAction>
                        <IconAction
                          label={self ? selfHint : agent.statut === 'ACTIF' ? 'Désactiver' : 'Réactiver'}
                          disabled={self}
                          onClick={() => (agent.statut === 'ACTIF' ? setConfirm(agent) : reactivate.mutate(agent.id))}
                        >
                          {agent.statut === 'ACTIF' ? <Power /> : <RotateCcw />}
                        </IconAction>
                        <IconAction
                          tone="danger"
                          label={self ? selfHint : 'Supprimer'}
                          disabled={self}
                          onClick={() => {
                            setPendingDelete(agent)
                            setMotif('')
                          }}
                        >
                          <Trash2 />
                        </IconAction>
                      </RowActions>
                    </Td>
                  </Tr>
                )
              })}
            </TBody>
          </Table>
        </TableCard>

        {/* Création / modification */}
        <Modal
          open={Boolean(editor)}
          onClose={() => setEditor(null)}
          title={isCreate ? 'Nouvel agent' : 'Modifier l’agent'}
          kicker="Administration"
          subtitle={
            isCreate
              ? t('acces.users.createSubtitle', 'Le compte est créé et un e-mail de bienvenue est envoyé à l’agent.')
              : `${form.prenom} ${form.nom}`.trim() || undefined
          }
          size="lg"
          nested
          footer={(
            <>
              {saveDisabledReason && (
                <p className="mr-auto hidden items-center gap-1.5 text-[12.5px] text-ink-3 sm:flex">
                  <Lock className="h-3.5 w-3.5" />
                  {saveDisabledReason}
                </p>
              )}
              <Button variant="outline" onClick={() => setEditor(null)}>
                Annuler
              </Button>
              <span title={saveDisabledReason ?? undefined}>
                <Button disabled={save.isPending || !formValid} onClick={() => save.mutate()}>
                  {isCreate ? <UserPlus className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                  {save.isPending ? 'Enregistrement…' : isCreate ? t('acces.users.createAction', 'Créer l’agent') : 'Enregistrer'}
                </Button>
              </span>
            </>
          )}
        >
          <div>
            <FormSection icon={<UserRound />} tone="navy" title={t('acces.users.identity', 'Identité')} hint={t('acces.users.identityHint', 'Nom et photo affichés dans l’annuaire et sur les tickets.')}>
              <div className="space-y-4">
                <AgentPhotoField
                  prenom={form.prenom}
                  nom={form.nom}
                  value={form.photo}
                  error={photoError}
                  onError={setPhotoError}
                  onChange={(photo) => {
                    setPhotoDirty(true)
                    setForm({ ...form, photo })
                  }}
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <FieldLabel>Prénom *</FieldLabel>
                    <Input
                      value={form.prenom}
                      placeholder="Ex. Grace"
                      autoComplete="off"
                      aria-invalid={Boolean(touched.prenom && fieldErrors.prenom)}
                      onBlur={() => setTouched((v) => ({ ...v, prenom: true }))}
                      onChange={(e) => setForm({ ...form, prenom: e.target.value })}
                    />
                    {touched.prenom && fieldErrors.prenom && <FieldError>{fieldErrors.prenom}</FieldError>}
                  </label>
                  <label className="block">
                    <FieldLabel>Nom *</FieldLabel>
                    <Input
                      value={form.nom}
                      placeholder="Ex. Kabila"
                      autoComplete="off"
                      aria-invalid={Boolean(touched.nom && fieldErrors.nom)}
                      onBlur={() => setTouched((v) => ({ ...v, nom: true }))}
                      onChange={(e) => setForm({ ...form, nom: e.target.value })}
                    />
                    {touched.nom && fieldErrors.nom && <FieldError>{fieldErrors.nom}</FieldError>}
                  </label>
                </div>
              </div>
            </FormSection>

            <FormSection icon={<Contact />} tone="sky" title={t('acces.users.contact', 'Coordonnées')} hint={t('acces.users.contactHint', 'L’e-mail professionnel sert d’identifiant de connexion.')}>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <label className="block min-w-0">
                  <FieldLabel>{isCreate ? 'E-mail professionnel *' : 'E-mail professionnel'}</FieldLabel>
                  <div className="relative">
                    <Input
                      type="email"
                      value={form.emailPro}
                      placeholder="prenom.nom@mindsetalliance.cd"
                      disabled={!isCreate}
                      className={cn(!isCreate && 'pr-10')}
                      aria-invalid={Boolean(touched.emailPro && fieldErrors.emailPro)}
                      onBlur={() => setTouched((v) => ({ ...v, emailPro: true }))}
                      onChange={(e) => setForm({ ...form, emailPro: e.target.value })}
                    />
                    {!isCreate && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3" title="L’identifiant de connexion ne peut pas être modifié">
                        <Lock className="h-4 w-4" />
                      </span>
                    )}
                  </div>
                  {!isCreate && <FieldHint>L’identifiant de connexion ne peut pas être modifié.</FieldHint>}
                  {touched.emailPro && fieldErrors.emailPro && <FieldError>{fieldErrors.emailPro}</FieldError>}
                </label>
                <label className="block min-w-0">
                  <FieldLabel hint={t('acces.users.optional', 'Facultatif')}>Téléphone</FieldLabel>
                  <Input type="tel" value={form.telephone} placeholder="+243 81 234 5678" onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
                </label>
              </div>
            </FormSection>

            <FormSection icon={<BriefcaseBusiness />} tone="gold" title={t('acces.users.assignment', 'Affectation')} hint={t('acces.users.assignmentHint', 'Le département détermine les rôles attribués par défaut.')}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block min-w-0">
                  <FieldLabel>Département *</FieldLabel>
                  <Select
                    className={cn(!form.departementId && 'text-ink-3')}
                    value={form.departementId}
                    aria-invalid={Boolean(touched.departementId && fieldErrors.departementId)}
                    onBlur={() => setTouched((v) => ({ ...v, departementId: true }))}
                    onChange={(e) => applyDepartment(e.target.value)}
                  >
                    <option value="" disabled>
                      Sélectionner un département
                    </option>
                    {(deps.data ?? [])
                      .filter((d) => d.statut !== 'INACTIF' || String(d.id) === form.departementId)
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.nom}
                        </option>
                      ))}
                  </Select>
                  {touched.departementId && fieldErrors.departementId && <FieldError>{fieldErrors.departementId}</FieldError>}
                </label>
                <label className="block min-w-0">
                  <FieldLabel>Périmètre</FieldLabel>
                  <Select value={form.projectCode} onChange={(e) => setForm({ ...form, projectCode: e.target.value })} aria-label="Périmètre d’accès">
                    <option value="">Toute l’entreprise</option>
                    {(projects.data ?? []).map((p) => (
                      <option key={p.id} value={p.code}>
                        {p.nom}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
              <div className="mt-3">
                <InfoNote icon={form.projectCode ? <Building2 /> : <Globe />} tone={form.projectCode ? 'gold' : 'neutral'}>
                  {form.projectCode
                    ? 'Accès limité à cette société uniquement. Les rôles ci-dessous s’appliquent à ce projet.'
                    : 'Accès transverse : l’agent voit toutes les sociétés. Les rôles ci-dessous s’appliquent à toute l’entreprise.'}
                </InfoNote>
              </div>
            </FormSection>

            <FormSection
              icon={<ShieldCheck />}
              tone="violet"
              title="Rôles"
              hint={
                rolesLocked
                  ? 'Rôles déterminés par le département. Les rôles du département restent non décochables.'
                  : 'Mode manuel : ajoutez des rôles supplémentaires. Les rôles du département restent verrouillés.'
              }
              action={(
                <Button variant={rolesLocked ? 'soft' : 'ghost'} size="sm" disabled={!form.departementId} onClick={requestToggleRolesLock}>
                  {rolesLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{rolesLocked ? 'Modifier manuellement' : 'Verrouiller à nouveau'}</span>
                  <span className="sm:hidden">{rolesLocked ? t('acces.users.unlockShort', 'Modifier') : t('acces.users.lockShort', 'Verrouiller')}</span>
                </Button>
              )}
            >
              {!form.departementId && (
                <p className="mb-3 text-[12.5px] text-ink-3">{t('acces.users.pickDepartmentFirst', 'Choisissez d’abord un département pour voir ses rôles.')}</p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(roles.data ?? []).map((r) => {
                  const isAuto = autoRoles.includes(r.nom)
                  const on = form.roles.includes(r.nom)
                  const isExtra = on && !isAuto
                  const disabled = !form.departementId || rolesLocked || isAuto
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-[13px] px-3 py-2 ring-1 ring-inset transition-[background-color,box-shadow,opacity] duration-200',
                        on ? 'bg-ma-gold-500/[0.07] ring-ma-gold-500/30 dark:bg-ma-gold-400/[0.07]' : 'bg-surface ring-hairline',
                        flashRoles.includes(r.nom) && 'ma-role-auto-flash',
                        disabled ? 'cursor-not-allowed' : 'cursor-pointer hover:ring-ma-gold-500/40',
                        disabled && !on && 'opacity-55',
                      )}
                    >
                      <CheckBox
                        label={r.libelle || roleLabel(r.nom)}
                        disabled={disabled}
                        checked={on}
                        onChange={(next) => {
                          if (disabled) return
                          setForm({
                            ...form,
                            roles: next ? [...form.roles, r.nom] : form.roles.filter((x) => x !== r.nom),
                          })
                        }}
                      />
                      <Badge tone={roleTone(r.nom)}>{r.libelle || roleLabel(r.nom)}</Badge>
                      {isAuto && (
                        <span className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-accent-ink" title="Rôle du département">
                          <Lock className="h-3 w-3" />
                          {t('acces.users.fromDepartment', 'Département')}
                        </span>
                      )}
                      {isExtra && <span className="ml-auto text-[11.5px] font-medium text-ink-2">Manuel</span>}
                    </label>
                  )
                })}
              </div>
            </FormSection>
          </div>
        </Modal>

        <Modal
          open={confirmRelock}
          onClose={() => setConfirmRelock(false)}
          title="Verrouiller à nouveau ?"
          kicker="Rôles"
          nested
          footer={(
            <>
              <Button variant="outline" onClick={() => setConfirmRelock(false)}>
                Annuler
              </Button>
              <Button onClick={confirmLockRoles}>Retirer les rôles manuels</Button>
            </>
          )}
        >
          <p className="text-[14px] leading-relaxed text-ink-2">
            {extraRoles.length} rôle{extraRoles.length > 1 ? 's' : ''} ajouté{extraRoles.length > 1 ? 's' : ''} manuellement
            {extraRoles.length > 1 ? ' seront retirés' : ' sera retiré'}. Les rôles du département seront conservés.
          </p>
        </Modal>

        <Modal
          open={Boolean(confirm)}
          onClose={() => {
            setConfirm(null)
            setMotif('')
          }}
          title="Confirmer la désactivation"
          kicker="Annuaire"
          nested
          footer={(
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setConfirm(null)
                  setMotif('')
                }}
              >
                Annuler
              </Button>
              <Button disabled={deactivate.isPending || !motif.trim()} onClick={() => deactivate.mutate()}>
                <Power className="h-4 w-4" />
                Désactiver
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            {confirm && <PersonStrip agent={confirm} />}
            <p className="text-[14px] leading-relaxed text-ink-2">
              Le compte passera à Suspendu et les sessions seront révoquées. Aucune suppression physique.
            </p>
            <label className="block">
              <FieldLabel>Motif *</FieldLabel>
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Raison de la désactivation" />
            </label>
          </div>
        </Modal>

        <Modal
          open={Boolean(pendingDelete)}
          onClose={() => {
            setPendingDelete(null)
            setMotif('')
          }}
          title="Supprimer l’agent"
          kicker="Annuaire"
          nested={detailId != null}
          footer={(
            <>
              <Button
                variant="outline"
                onClick={() => {
                  setPendingDelete(null)
                  setMotif('')
                }}
              >
                Annuler
              </Button>
              <Button variant="danger" disabled={removeAgent.isPending || !motif.trim()} onClick={() => removeAgent.mutate()}>
                <Trash2 className="h-4 w-4" />
                {removeAgent.isPending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </>
          )}
        >
          <div className="space-y-4">
            {pendingDelete && <PersonStrip agent={pendingDelete} />}
            <p className="text-[14px] leading-relaxed text-ink-2">
              L’agent est retiré de l’annuaire : le compte passe à Suspendu et les sessions sont révoquées. Aucune suppression physique en base.
            </p>
            <label className="block">
              <FieldLabel>Motif *</FieldLabel>
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Raison de la suppression" />
            </label>
          </div>
        </Modal>

        {/* Fiche agent */}
        <Modal
          open={detailId != null}
          onClose={() => setDetailId(null)}
          title={selected ? `${selected.prenom} ${selected.nom}` : 'Fiche agent'}
          kicker="Fiche agent"
          subtitle={selected?.emailPro}
          size="xl"
          footer={(
            <Button variant="outline" onClick={() => setDetailId(null)}>
              Fermer
            </Button>
          )}
        >
          <div className="mb-5 pt-1">
            <Segmented
              className="w-full sm:w-auto [&>button]:flex-1 [&>button]:justify-center sm:[&>button]:flex-none"
              value={tab}
              onChange={setTab}
              options={[
                { value: 'profil', label: 'Profil', icon: <UserRound className="h-3.5 w-3.5" /> },
                { value: 'roles', label: <><span className="sm:hidden">Rôles</span><span className="hidden sm:inline">Rôles et projets</span></>, icon: <Building2 className="h-3.5 w-3.5" /> },
                { value: 'perms', label: 'Permissions', icon: <Shield className="h-3.5 w-3.5" /> },
              ]}
            />
          </div>

          {detail.isError && <Feedback tone="danger">{detail.error instanceof ApiError ? detail.error.message : 'Impossible de charger la fiche.'}</Feedback>}
          {detail.isLoading && (
            <div className="space-y-3">
              <div className="ma-shimmer h-20 rounded-[18px]" />
              <div className="ma-shimmer h-40 rounded-[18px]" />
            </div>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.18 }}
            >
              {tab === 'profil' && selected && (
                <div className="space-y-5">
                  <div className="clay flex flex-wrap items-center gap-4 rounded-[20px] p-4 ring-1 ring-hairline sm:p-5">
                    <Avatar name={`${selected.prenom} ${selected.nom}`} agentId={selected.id} hasPhoto={selected.hasPhoto} size="lg" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[18px] font-semibold tracking-[-0.02em] text-ink">
                        {selected.prenom} {selected.nom}
                      </p>
                      <p className="truncate text-[13.5px] text-ink-3">{selected.emailPro}</p>
                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        <Badge dot tone={selected.statut === 'ACTIF' ? 'success' : 'danger'}>
                          {selected.statut === 'ACTIF' ? 'Actif' : 'Suspendu'}
                        </Badge>
                        {selected.roles.map((r) => (
                          <RoleScopeBadges key={r.id} role={r.role} projectCode={r.projectCode} projectNom={r.projectNom} />
                        ))}
                        {selected.hasOverrides && <Badge tone="violet">Permissions individuelles actives</Badge>}
                      </div>
                    </div>
                  </div>

                  <DetailList
                    columns={2}
                    items={[
                      { label: 'Téléphone', value: selected.telephone || dash },
                      { label: 'Département', value: selected.departement?.nom || dash },
                      { label: 'Créé le', value: longDate(selected.createdAt) ?? dash },
                      { label: 'Statut', value: selected.statut === 'ACTIF' ? 'Actif' : 'Suspendu' },
                    ]}
                  />

                  {selected.derniereModification && (
                    <InfoNote icon={<History />}>
                      Dernière modification par {selected.derniereModification.auteur || 'un agent'} le {longDate(selected.derniereModification.createdAt)}.{' '}
                      <Link className="font-medium text-accent-ink underline-offset-2 hover:underline" to={`/admin/audit?logId=${selected.derniereModification.id}`}>
                        Voir dans le journal d’audit
                      </Link>
                    </InfoNote>
                  )}

                  {isSelf(selected.id) && <Feedback tone="warning">Vous ne pouvez pas modifier vos propres rôles, permissions ou statut.</Feedback>}

                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={isSelf(selected.id)} onClick={() => openEdit(selected)}>
                      <Pencil className="h-4 w-4" />
                      Modifier le profil
                    </Button>
                    {selected.statut === 'ACTIF' ? (
                      <Button variant="outline" disabled={isSelf(selected.id)} onClick={() => setConfirm(selected)}>
                        <Power className="h-4 w-4" />
                        Désactiver
                      </Button>
                    ) : (
                      <Button variant="outline" disabled={isSelf(selected.id)} onClick={() => reactivate.mutate(selected.id)}>
                        <RotateCcw className="h-4 w-4" />
                        Réactiver
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      className="text-status-danger hover:bg-status-danger/10 hover:text-status-danger sm:ml-auto"
                      disabled={isSelf(selected.id)}
                      onClick={() => {
                        setPendingDelete(selected)
                        setMotif('')
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              )}

              {tab === 'roles' && (
                <div className="space-y-5">
                  <p className="text-[13.5px] text-ink-3">
                    Attribuez ou révoquez un rôle par société.{' '}
                    <Link className="font-medium text-accent-ink underline-offset-2 hover:underline" to="/admin/acces">
                      Gérer en détail
                    </Link>
                  </p>
                  {currentRoles.isLoading ? (
                    <div className="space-y-2">
                      <div className="ma-shimmer h-14 rounded-[14px]" />
                      <div className="ma-shimmer h-14 rounded-[14px]" />
                    </div>
                  ) : roleRows.length === 0 ? (
                    <div className="rounded-[18px] ring-1 ring-hairline">
                      <EmptyState icon={<ShieldOff />} title="Aucun rôle attribué" hint={t('acces.users.noRoleHint', 'Attribuez un premier rôle avec le formulaire ci-dessous.')} />
                    </div>
                  ) : (
                    <ul className="divide-y divide-hairline overflow-hidden rounded-[18px] bg-surface ring-1 ring-hairline">
                      <AnimatePresence initial={false}>
                        {roleRows.map((r) => (
                          <motion.li
                            key={r.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="flex items-center justify-between gap-3 px-4 py-3"
                          >
                            <RoleScopeBadges role={r.role} projectCode={r.projectCode} projectNom={r.projectNom} />
                            <Button variant="ghost" size="sm" disabled={revoke.isPending || isSelf(detailId!)} onClick={() => revoke.mutate(r.id)}>
                              Révoquer
                            </Button>
                          </motion.li>
                        ))}
                      </AnimatePresence>
                    </ul>
                  )}
                  <div className="rounded-[18px] bg-ink/[0.025] p-4 ring-1 ring-inset ring-hairline dark:bg-white/[0.025]">
                    <p className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <Plus className="h-4 w-4 text-accent-ink" />
                      Attribuer un rôle
                    </p>
                    <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                      <Select aria-label="Rôle" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                        <option value="">Choisir un rôle</option>
                        {(roles.data ?? []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.libelle || roleLabel(r.nom)}
                          </option>
                        ))}
                      </Select>
                      <Select aria-label="Périmètre" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                        <option value="">Toute l’entreprise</option>
                        {(projects.data ?? []).map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nom}
                          </option>
                        ))}
                      </Select>
                      <Button disabled={!roleId || assign.isPending || isSelf(detailId!)} onClick={() => assign.mutate()}>
                        {assign.isPending ? 'Enregistrement…' : 'Attribuer'}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {tab === 'perms' && selected && (
                <div className="space-y-5">
                  <div className="grid gap-4 lg:grid-cols-2">
                    <section className="min-w-0 rounded-[18px] bg-status-success/[0.05] p-4 ring-1 ring-inset ring-status-success/15">
                      <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-success/15 text-status-success">
                          <Check className="h-3.5 w-3.5" strokeWidth={2.6} />
                        </span>
                        Accordées en plus du rôle
                        <span className="ml-auto text-[12px] font-medium tabular-nums text-ink-3">{grants.length}</span>
                      </h3>
                      {grants.length === 0 ? (
                        <p className="px-1 py-2 text-[13px] text-ink-3">{t('acces.users.noGrant', 'Aucune permission accordée en plus.')}</p>
                      ) : (
                        <ul className="space-y-2">
                          <AnimatePresence initial={false}>
                            {grants.map((o) => (
                              <OverrideItem key={o.id} row={o} disabled={isSelf(selected.id)} onRemove={() => setPendingRemove(o.id)} />
                            ))}
                          </AnimatePresence>
                        </ul>
                      )}
                    </section>
                    <section className="min-w-0 rounded-[18px] bg-status-danger/[0.04] p-4 ring-1 ring-inset ring-status-danger/15">
                      <h3 className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-status-danger/12 text-status-danger">
                          <ShieldOff className="h-3.5 w-3.5" strokeWidth={2.4} />
                        </span>
                        Restrictions spécifiques
                        <span className="ml-auto text-[12px] font-medium tabular-nums text-ink-3">{denies.length}</span>
                      </h3>
                      {denies.length === 0 ? (
                        <p className="px-1 py-2 text-[13px] text-ink-3">{t('acces.users.noDeny', 'Aucune restriction en place.')}</p>
                      ) : (
                        <ul className="space-y-2">
                          <AnimatePresence initial={false}>
                            {denies.map((o) => (
                              <OverrideItem key={o.id} row={o} disabled={isSelf(selected.id)} onRemove={() => setPendingRemove(o.id)} />
                            ))}
                          </AnimatePresence>
                        </ul>
                      )}
                    </section>
                  </div>

                  <section className="rounded-[18px] bg-ma-gold-500/[0.05] p-4 ring-1 ring-inset ring-ma-gold-500/20 sm:p-5">
                    <h3 className="mb-4 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      <Plus className="h-4 w-4 text-accent-ink" />
                      Ajouter une dérogation
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block min-w-0 sm:col-span-2">
                        <FieldLabel>Permission</FieldLabel>
                        <Select
                          value={overrideForm.permissionId}
                          aria-invalid={overrideTried && !overrideForm.permissionId}
                          onChange={(e) => setOverrideForm({ ...overrideForm, permissionId: e.target.value })}
                        >
                          <option value="">Choisir une permission</option>
                          {(permissions.data ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.module} · {p.libelle || permissionLabel(p.code)}
                            </option>
                          ))}
                        </Select>
                        {overrideTried && !overrideForm.permissionId && <FieldError>Choisissez une permission.</FieldError>}
                      </label>
                      <label className="block min-w-0">
                        <FieldLabel>Projet concerné</FieldLabel>
                        <Select value={overrideForm.projectId} onChange={(e) => setOverrideForm({ ...overrideForm, projectId: e.target.value })}>
                          <option value="">Tous ses projets</option>
                          {(projects.data ?? []).map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.nom}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <div className="min-w-0">
                        <FieldLabel>Type de dérogation</FieldLabel>
                        <Segmented
                          className="w-full [&>button]:flex-1 [&>button]:justify-center"
                          value={overrideForm.type}
                          onChange={(value) => setOverrideForm({ ...overrideForm, type: value })}
                          options={[
                            { value: 'GRANT', label: 'Accorder', icon: <Check className="h-3.5 w-3.5" /> },
                            { value: 'DENY', label: 'Restreindre', icon: <Ban className="h-3.5 w-3.5" /> },
                          ]}
                        />
                      </div>
                      <label className="block min-w-0 sm:col-span-2">
                        <FieldLabel>Motif *</FieldLabel>
                        <Input
                          placeholder="Raison obligatoire pour l’audit"
                          value={overrideForm.motif}
                          aria-invalid={overrideTried && !overrideForm.motif.trim()}
                          onChange={(e) => setOverrideForm({ ...overrideForm, motif: e.target.value })}
                        />
                        {overrideTried && !overrideForm.motif.trim() && <FieldError>Le motif est obligatoire.</FieldError>}
                      </label>
                    </div>
                    <div className="mt-4 flex justify-end">
                      <Button
                        disabled={addOverride.isPending || isSelf(selected.id) || !overrideForm.motif.trim() || !overrideForm.permissionId}
                        title={!overrideForm.motif.trim() ? 'Indiquez un motif pour enregistrer la dérogation.' : !overrideForm.permissionId ? 'Choisissez une permission.' : undefined}
                        onClick={() => {
                          setOverrideTried(true)
                          if (!overrideForm.permissionId || !overrideForm.motif.trim()) return
                          addOverride.mutate()
                        }}
                      >
                        Enregistrer la dérogation
                      </Button>
                    </div>
                  </section>

                  <section>
                    <h3 className="mb-2.5 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                      Permissions effectives
                      <span className="text-[12px] font-medium tabular-nums text-ink-3">{(selected.permissionsEffectives ?? []).length}</span>
                    </h3>
                    {(selected.permissionsEffectives ?? []).length === 0 ? (
                      <p className="text-[13px] text-ink-3">Aucune permission effective.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {(selected.permissionsEffectives ?? []).map((code) => (
                          <span key={code} title={code}>
                            <Badge tone="muted">{permissionLabel(code)}</Badge>
                          </span>
                        ))}
                      </div>
                    )}
                  </section>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </Modal>

        <Modal
          open={pendingRemove != null}
          onClose={() => setPendingRemove(null)}
          title="Retirer cette dérogation ?"
          kicker="Permissions"
          nested
          footer={(
            <>
              <Button variant="outline" onClick={() => setPendingRemove(null)}>
                Annuler
              </Button>
              <Button disabled={removeOverride.isPending || pendingRemove == null} onClick={() => pendingRemove != null && removeOverride.mutate(pendingRemove)}>
                Retirer
              </Button>
            </>
          )}
        >
          <p className="text-[14px] leading-relaxed text-ink-2">La permission effective de l’agent sera recalculée immédiatement. Cette action est journalisée.</p>
        </Modal>

        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}

function PersonStrip({ agent }: { agent: DirectoryAgent }) {
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-ink/[0.03] px-3.5 py-3 ring-1 ring-inset ring-hairline dark:bg-white/[0.03]">
      <Avatar name={`${agent.prenom} ${agent.nom}`} agentId={agent.id} hasPhoto={agent.hasPhoto} size="md" />
      <CellStack title={`${agent.prenom} ${agent.nom}`} meta={agent.emailPro} />
    </div>
  )
}
