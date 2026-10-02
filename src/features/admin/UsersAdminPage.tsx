import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Ban, Building2, Check, Eye, Globe, Lock, Pencil, Plus, Power, Shield, ShieldOff, Trash2, Unlock } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AgentPhotoField } from '../../components/ui/AgentPhotoField'
import { PerimeterFilter, RolePerimeterCells, RoleScopeBadges } from '../../components/ui/role-scope-badges'
import { Avatar } from '../../components/ui/avatar'
import { Badge, roleTone } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { Toast } from '../../components/ui/toast'
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
} from '../../lib/api/iam-admin'
import { assignAgentRole, listAccessProjects, listAgentAccessRoles, revokeAgentRole } from '../../lib/api/access-admin'
import { useAuthStore } from '../../lib/auth/auth-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { projectLabel, roleLabel } from '../../lib/rbac/rbac'
import { cn } from '../../lib/utils'

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

function FieldCaption({ children }: { children: string }) {
  return <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{children}</span>
}

function emailValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}

function defaultRolesOf(deps: { id: number; roles?: { nom: string }[] }[] | undefined, departementId: string) {
  return deps?.find((d) => String(d.id) === departementId)?.roles?.map((r) => r.nom) ?? []
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
      roles: agent.roles.map((r) => r.role),
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
        roles: form.roles.map((role) => ({
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

  return (
    <RequirePermission anyOfPermissions={['MANAGE_USERS', 'MANAGE_ACCESS', 'MANAGE_INTERNAL_AGENTS', 'MANAGE_HR']}>
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.users.kicker')}
          title={t('pages.users.title')}
          subtitle={t('pages.users.subtitle')}
        />
        {error && <Feedback tone="danger">{error}</Feedback>}

        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Rechercher nom ou e-mail"
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
            <option value="">Tous les départements</option>
            {(deps.data ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.nom}</option>
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
            <option value="">Tous les statuts</option>
            <option value="ACTIF">Actif</option>
            <option value="INACTIF">Suspendu</option>
          </select>
          <PerimeterFilter
            value={scope}
            projects={projects.data ?? []}
            onChange={(value) => {
              setPage(0)
              setScope(value)
            }}
          />
          <div className="ml-auto">
            <Button onClick={openCreate}>
              <Plus size={15} />
              Nouvel agent
            </Button>
          </div>
        </div>

        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[1320px] text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted dark:text-ma-gray-300">
                <tr>
                  <th className="px-4 py-3 font-medium">
                    <button type="button" className="uppercase tracking-[0.14em]" onClick={() => toggleSort('nom')}>
                      Nom {sort.key === 'nom' ? (sort.dir === 'desc' ? '↓' : '↑') : ''}
                    </button>
                  </th>
                  <th className="max-w-[180px] px-4 py-3 font-medium">E-mail</th>
                  <th className="max-w-[160px] px-4 py-3 font-medium">Département</th>
                  <th className="px-4 py-3 font-medium">Rôles</th>
                  <th className="px-4 py-3 font-medium">Périmètre</th>
                  <th className="px-4 py-3 font-medium">Statut</th>
                  <th className="px-4 py-3 font-medium">
                    <button type="button" className="uppercase tracking-[0.14em]" onClick={() => toggleSort('createdAt')}>
                      Créé le {sort.key === 'createdAt' ? (sort.dir === 'desc' ? '↓' : '↑') : ''}
                    </button>
                  </th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
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
                      highlightedId === agent.id && 'ma-row-new',
                    )}
                    style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}
                  >
                    <td className="px-4 py-3">
                      <button type="button" className="flex items-center gap-3 text-left" onClick={() => openDetail(agent)}>
                        <Avatar
                          name={`${agent.prenom} ${agent.nom}`}
                          agentId={agent.id}
                          hasPhoto={agent.hasPhoto}
                          size="md"
                        />
                        <span className="font-medium">
                          {agent.prenom} {agent.nom}
                          {agent.hasOverrides && (
                            <span className="ml-2 align-middle"><Badge tone="violet">Dérogations</Badge></span>
                          )}
                        </span>
                      </button>
                    </td>
                    <td className="max-w-[180px] truncate px-4 py-3" title={agent.emailPro}>{agent.emailPro}</td>
                    <td className="max-w-[160px] truncate px-4 py-3 text-ma-muted dark:text-ma-gray-300" title={agent.departement?.nom ?? ''}>{agent.departement?.nom ?? '—'}</td>
                    <RolePerimeterCells roles={agent.roles} />
                    <td className="px-4 py-3">
                      <Badge tone={agent.statut === 'ACTIF' ? 'success' : 'danger'}>
                        {agent.statut === 'ACTIF' ? 'Actif' : 'Suspendu'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{agent.createdAt ? new Date(agent.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button type="button" className="rounded-lg p-2 text-ma-muted hover:bg-slate-100 hover:text-ma-navy-900 dark:hover:bg-white/10 dark:hover:text-white" title="Voir / modifier" onClick={() => openDetail(agent)}>
                          <Eye className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-lg p-2 text-ma-muted hover:bg-slate-100 hover:text-ma-navy-900 dark:hover:bg-white/10 dark:hover:text-white" title="Modifier le profil" onClick={() => openEdit(agent)}>
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button type="button" className="rounded-lg p-2 text-ma-muted hover:bg-slate-100 hover:text-ma-navy-900 dark:hover:bg-white/10 dark:hover:text-white" title="Permissions individuelles" onClick={() => openDetail(agent, 'perms')}>
                          <Shield className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-ma-muted hover:bg-slate-100 hover:text-ma-navy-900 disabled:opacity-40 dark:hover:bg-white/10 dark:hover:text-white"
                          title={isSelf(agent.id) ? 'Impossible d’agir sur votre propre compte' : agent.statut === 'ACTIF' ? 'Désactiver' : 'Réactiver'}
                          disabled={isSelf(agent.id)}
                          onClick={() => (agent.statut === 'ACTIF' ? setConfirm(agent) : reactivate.mutate(agent.id))}
                        >
                          <Power className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-status-danger/80 hover:bg-red-50 hover:text-status-danger disabled:opacity-40 dark:hover:bg-red-500/10"
                          title={isSelf(agent.id) ? 'Impossible d’agir sur votre propre compte' : 'Supprimer'}
                          disabled={isSelf(agent.id)}
                          onClick={() => { setPendingDelete(agent); setMotif('') }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {agents.isError && (
              <div className="p-4">
                <Feedback tone="danger">{agents.error instanceof ApiError ? agents.error.message : 'Impossible de charger les agents.'}</Feedback>
              </div>
            )}
            {!agents.isError && rows.length === 0 && <p className="p-4 text-sm text-ma-muted">Aucun agent pour ces filtres.</p>}
          </CardBody>
        </Card>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <select
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-800"
            value={size}
            onChange={(e) => {
              setPage(0)
              setSize(Number(e.target.value))
            }}
          >
            <option value={10}>10 par page</option>
            <option value={20}>20 par page</option>
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-ma-muted">
              Page {(agents.data?.number ?? 0) + 1} / {Math.max(1, agents.data?.totalPages ?? 1)} · {agents.data?.totalElements ?? 0} agents
            </span>
            <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>Précédent</Button>
            <Button variant="outline" disabled={(agents.data?.number ?? 0) + 1 >= (agents.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>Suivant</Button>
          </div>
        </div>

        <Modal
          open={Boolean(editor)}
          onClose={() => setEditor(null)}
          title={isCreate ? 'Nouvel agent' : 'Modifier l’agent'}
          kicker="Administration"
          size="lg"
          nested
          footer={(
            <>
              <Button variant="outline" onClick={() => setEditor(null)}>Fermer</Button>
              <span title={saveDisabledReason ?? undefined}>
                <Button disabled={save.isPending || !formValid} onClick={() => save.mutate()}>
                  {save.isPending ? 'Enregistrement…' : 'Enregistrer'}
                </Button>
              </span>
            </>
          )}
        >
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
                <FieldCaption>Prénom *</FieldCaption>
                <Input value={form.prenom} onBlur={() => setTouched((t) => ({ ...t, prenom: true }))} onChange={(e) => setForm({ ...form, prenom: e.target.value })} />
                {touched.prenom && fieldErrors.prenom && <p className="mt-1 text-xs text-status-danger">{fieldErrors.prenom}</p>}
              </label>
              <label className="block">
                <FieldCaption>Nom *</FieldCaption>
                <Input value={form.nom} onBlur={() => setTouched((t) => ({ ...t, nom: true }))} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
                {touched.nom && fieldErrors.nom && <p className="mt-1 text-xs text-status-danger">{fieldErrors.nom}</p>}
              </label>
            </div>
            <label className="block">
              <FieldCaption>{isCreate ? 'E-mail professionnel *' : 'E-mail professionnel'}</FieldCaption>
              <div className="relative">
                <Input
                  value={form.emailPro}
                  disabled={!isCreate}
                  onBlur={() => setTouched((t) => ({ ...t, emailPro: true }))}
                  onChange={(e) => setForm({ ...form, emailPro: e.target.value })}
                />
                {!isCreate && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-ma-muted" title="L’identifiant de connexion ne peut pas être modifié">
                    <Lock className="h-4 w-4" />
                  </span>
                )}
              </div>
              {!isCreate && <p className="mt-1 text-xs text-ma-muted">L’identifiant de connexion ne peut pas être modifié.</p>}
              {touched.emailPro && fieldErrors.emailPro && <p className="mt-1 text-xs text-status-danger">{fieldErrors.emailPro}</p>}
            </label>
            <label className="block">
              <FieldCaption>Téléphone</FieldCaption>
              <Input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} />
            </label>
            <label className="block">
              <FieldCaption>Département *</FieldCaption>
              <select
                className={cn(
                  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-ma-navy-900',
                  !form.departementId && 'text-slate-400',
                )}
                value={form.departementId}
                onBlur={() => setTouched((t) => ({ ...t, departementId: true }))}
                onChange={(e) => applyDepartment(e.target.value)}
              >
                <option value="" disabled>
                  Sélectionner un département
                </option>
                {(deps.data ?? [])
                  .filter((d) => d.statut !== 'INACTIF' || String(d.id) === form.departementId)
                  .map((d) => (
                    <option key={d.id} value={d.id} className="text-ma-navy-950 dark:text-white">
                      {d.nom}
                    </option>
                  ))}
              </select>
              {touched.departementId && fieldErrors.departementId && (
                <p className="mt-1 text-xs text-status-danger">{fieldErrors.departementId}</p>
              )}
            </label>
            <label className="block">
              <FieldCaption>Périmètre</FieldCaption>
              <select
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-white/10 dark:bg-ma-navy-900"
                value={form.projectCode}
                onChange={(e) => setForm({ ...form, projectCode: e.target.value })}
                aria-label="Périmètre d’accès"
              >
                <option value="">Toute l’entreprise</option>
                {(projects.data ?? []).map((p) => (
                  <option key={p.id} value={p.code}>
                    {p.nom}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 flex items-start gap-1.5 text-xs text-ma-muted">
                {form.projectCode ? (
                  <Building2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ma-gold-600" />
                ) : (
                  <Globe className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ma-navy-800 dark:text-ma-gold-400" />
                )}
                <span>
                  {form.projectCode
                    ? 'Accès limité à cette société uniquement. Les rôles ci-dessous s’appliquent à ce projet.'
                    : 'Accès transverse : l’agent voit toutes les sociétés. Les rôles ci-dessous s’appliquent à toute l’entreprise.'}
                </span>
              </p>
            </label>
            <div>
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <FieldCaption>Rôles</FieldCaption>
                <button
                  type="button"
                  disabled={!form.departementId}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-ma-gold-600 hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline"
                  onClick={requestToggleRolesLock}
                >
                  {rolesLocked ? <Unlock className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                  {rolesLocked ? 'Modifier manuellement' : 'Verrouiller à nouveau'}
                </button>
              </div>
              {rolesLocked ? (
                <p className="mb-2 text-xs text-ma-muted">
                  Rôles déterminés automatiquement par le département sélectionné. Cliquez sur « Modifier manuellement »
                  pour ajouter un rôle en plus. Les rôles du département restent non décochables.
                </p>
              ) : (
                <p className="mb-2 text-xs text-ma-muted">
                  Mode manuel : vous pouvez ajouter des rôles supplémentaires. Les rôles issus du département restent
                  verrouillés.
                </p>
              )}
              <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
                {(roles.data ?? []).map((r) => {
                  const isAuto = autoRoles.includes(r.nom)
                  const isExtra = form.roles.includes(r.nom) && !isAuto
                  const disabled = !form.departementId || rolesLocked || isAuto
                  return (
                    <label
                      key={r.id}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm',
                        flashRoles.includes(r.nom) && 'ma-role-auto-flash',
                        isExtra && 'ring-1 ring-ma-navy-700/20 dark:ring-white/15',
                        disabled && 'cursor-not-allowed opacity-60',
                        disabled && 'pointer-events-none',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="accent-ma-gold-500 disabled:cursor-not-allowed"
                        disabled={disabled}
                        checked={form.roles.includes(r.nom)}
                        onChange={(e) => {
                          if (disabled) return
                          setForm({
                            ...form,
                            roles: e.target.checked ? [...form.roles, r.nom] : form.roles.filter((x) => x !== r.nom),
                          })
                        }}
                      />
                      <Badge tone={roleTone(r.nom)}>{r.libelle || roleLabel(r.nom)}</Badge>
                      {isAuto && <Lock className="ml-auto h-3 w-3 shrink-0 text-ma-gold-600" />}
                      {isExtra && (
                        <span className="ml-auto text-[10px] uppercase tracking-wider text-ma-navy-700 dark:text-ma-gold-400">
                          Manuel
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </div>
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
              <Button variant="outline" onClick={() => setConfirmRelock(false)}>Annuler</Button>
              <Button onClick={confirmLockRoles}>Retirer les rôles manuels</Button>
            </>
          )}
        >
          <p className="text-sm">
            {extraRoles.length} rôle{extraRoles.length > 1 ? 's' : ''} ajouté{extraRoles.length > 1 ? 's' : ''} manuellement
            {extraRoles.length > 1 ? ' seront retirés' : ' sera retiré'}. Les rôles du département seront conservés.
          </p>
        </Modal>

        <Modal
          open={Boolean(confirm)}
          onClose={() => { setConfirm(null); setMotif('') }}
          title="Confirmer la désactivation"
          anchor="top"
          nested
          footer={(
            <>
              <Button variant="outline" onClick={() => { setConfirm(null); setMotif('') }}>Annuler</Button>
              <Button disabled={deactivate.isPending || !motif.trim()} onClick={() => deactivate.mutate()}>Désactiver</Button>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="text-sm">Désactiver {confirm?.prenom} {confirm?.nom} ? Le compte passera à Suspendu et les sessions seront révoquées. Aucune suppression physique.</p>
            <label className="block">
              <FieldCaption>Motif *</FieldCaption>
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Raison de la désactivation" />
            </label>
          </div>
        </Modal>

        <Modal
          open={Boolean(pendingDelete)}
          onClose={() => { setPendingDelete(null); setMotif('') }}
          title="Supprimer l’agent"
          kicker="Annuaire"
          anchor="top"
          nested={detailId != null}
          footer={(
            <>
              <Button variant="outline" onClick={() => { setPendingDelete(null); setMotif('') }}>Annuler</Button>
              <Button disabled={removeAgent.isPending || !motif.trim()} onClick={() => removeAgent.mutate()}>
                {removeAgent.isPending ? 'Suppression…' : 'Supprimer'}
              </Button>
            </>
          )}
        >
          <div className="space-y-3">
            <p className="text-sm">
              Retirer {pendingDelete?.prenom} {pendingDelete?.nom} de l’annuaire ? Le compte passe à Suspendu,
              les sessions sont révoquées. Aucune suppression physique en base.
            </p>
            <label className="block">
              <FieldCaption>Motif *</FieldCaption>
              <Input value={motif} onChange={(e) => setMotif(e.target.value)} placeholder="Raison de la suppression" />
            </label>
          </div>
        </Modal>

        <Modal
          open={detailId != null}
          onClose={() => setDetailId(null)}
          title={selected ? `${selected.prenom} ${selected.nom}` : 'Fiche agent'}
          kicker="Fiche agent"
          subtitle={selected?.emailPro}
          size="xl"
          footer={<Button variant="outline" onClick={() => setDetailId(null)}>Fermer</Button>}
        >
          <div className="sticky top-0 z-10 -mx-5 mb-4 bg-white px-5 pb-3 pt-0 dark:bg-ma-navy-800 sm:-mx-6 sm:px-6">
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-white/5">
            {([
              ['profil', 'Profil'],
              ['roles', 'Rôles & projets'],
              ['perms', 'Permissions individuelles'],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  'relative flex-1 rounded-lg px-2 py-2 text-[11px] font-semibold uppercase tracking-[0.12em] transition-colors duration-200',
                  tab === id
                    ? 'bg-ma-navy-900 text-ma-gold-400 shadow-sm dark:bg-ma-gold-500/15 dark:text-ma-gold-400'
                    : 'text-ma-muted hover:text-ma-navy-900 dark:hover:text-white',
                )}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
            </div>
          </div>

          {detail.isError && <Feedback tone="danger">{detail.error instanceof ApiError ? detail.error.message : 'Impossible de charger la fiche.'}</Feedback>}

          {tab === 'profil' && selected && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <Avatar name={`${selected.prenom} ${selected.nom}`} agentId={selected.id} hasPhoto={selected.hasPhoto} size="lg" />
                <div>
                  <p className="font-medium">{selected.prenom} {selected.nom}</p>
                  <p className="text-ma-muted">{selected.emailPro}</p>
                </div>
              </div>
              <p><span className="text-ma-muted">Statut · </span><Badge tone={selected.statut === 'ACTIF' ? 'success' : 'danger'}>{selected.statut === 'ACTIF' ? 'Actif' : 'Suspendu'}</Badge></p>
              <p><span className="text-ma-muted">Téléphone · </span>{selected.telephone || '—'}</p>
              <p><span className="text-ma-muted">Département · </span>{selected.departement?.nom || '—'}</p>
              <p><span className="text-ma-muted">Créé le · </span>{selected.createdAt ? new Date(selected.createdAt).toLocaleString('fr-FR') : '—'}</p>
              {selected.derniereModification && (
                <p className="text-xs text-ma-muted">
                  Dernière modification par {selected.derniereModification.auteur || 'un agent'} le{' '}
                  {new Date(selected.derniereModification.createdAt).toLocaleString('fr-FR')}
                  {' · '}
                  <Link className="text-ma-gold-600 underline" to={`/admin/audit?logId=${selected.derniereModification.id}`}>
                    Voir dans le journal d’audit
                  </Link>
                </p>
              )}
              {selected.hasOverrides && <Badge tone="violet">Permissions individuelles actives</Badge>}
              <div className="flex flex-wrap gap-2 pt-2">
                <Button variant="outline" disabled={isSelf(selected.id)} onClick={() => openEdit(selected)}>Modifier le profil</Button>
                {selected.statut === 'ACTIF' ? (
                  <Button variant="outline" disabled={isSelf(selected.id)} onClick={() => setConfirm(selected)}>Désactiver</Button>
                ) : (
                  <Button variant="outline" disabled={isSelf(selected.id)} onClick={() => reactivate.mutate(selected.id)}>Réactiver</Button>
                )}
                <Button
                  variant="outline"
                  disabled={isSelf(selected.id)}
                  onClick={() => { setPendingDelete(selected); setMotif('') }}
                >
                  Supprimer
                </Button>
              </div>
              {isSelf(selected.id) && <p className="text-xs text-status-warning">Vous ne pouvez pas modifier vos propres rôles, permissions ou statut.</p>}
            </div>
          )}

          {tab === 'roles' && (
            <div className="space-y-4">
              <p className="text-sm text-ma-muted">
                Attribuez ou révoquez un rôle par société.{' '}
                <Link className="text-ma-gold-600 underline" to="/admin/acces">Gérer en détail →</Link>
              </p>
              <ul className="space-y-2">
                {(currentRoles.data ?? selected?.roles ?? []).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 rounded-xl border border-ma-line px-3 py-2 dark:border-white/10">
                    <RoleScopeBadges role={r.role} projectCode={r.projectCode} projectNom={r.projectNom} />
                    <Button variant="outline" disabled={revoke.isPending || isSelf(detailId!)} onClick={() => revoke.mutate(r.id)}>Révoquer</Button>
                  </li>
                ))}
                {(currentRoles.data ?? selected?.roles ?? []).length === 0 && <p className="text-sm text-ma-muted">Aucun rôle attribué.</p>}
              </ul>
              <div className="space-y-3 rounded-xl border border-ma-line p-3 dark:border-white/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">Attribuer un rôle</p>
                <select className="w-full rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
                  <option value="">Choisir un rôle</option>
                  {(roles.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>{r.libelle || roleLabel(r.nom)}</option>
                  ))}
                </select>
                <select className="w-full rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                  <option value="">Toute l’entreprise</option>
                  {(projects.data ?? []).map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                <Button disabled={!roleId || assign.isPending || isSelf(detailId!)} onClick={() => assign.mutate()}>
                  {assign.isPending ? 'Enregistrement…' : 'Confirmer'}
                </Button>
              </div>
            </div>
          )}

          {tab === 'perms' && selected && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-emerald-700/20 bg-emerald-50/50 p-4 dark:border-emerald-400/20 dark:bg-emerald-950/20">
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800 dark:text-emerald-300">
                  <Check className="h-4 w-4" /> Permissions accordées en plus de son rôle
                </h3>
                {grants.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-ma-muted">
                    <Ban className="h-4 w-4 shrink-0 opacity-50" />
                    Aucune dérogation GRANT
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {grants.map((o) => (
                      <li key={o.id} className="rounded-xl border border-emerald-700/15 bg-white/80 px-3 py-2.5 text-sm dark:bg-ma-navy-900/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge tone="success">Accordé</Badge>
                              <span className="font-medium">{o.permissionLibelle || o.permission}</span>
                            </div>
                            <p className="text-xs text-ma-muted">
                              {o.projectCode ? projectLabel(o.projectCode) : 'Tous ses projets'}
                              {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString('fr-FR')}` : ''}
                              {o.accordePar ? ` · ${o.accordePar}` : ''}
                            </p>
                            <p className="text-xs">{o.motif}</p>
                          </div>
                          <Button variant="outline" className="px-2 py-1 text-xs" disabled={isSelf(selected.id)} onClick={() => setPendingRemove(o.id)}>Retirer</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border border-status-danger/30 bg-red-50/60 p-4 dark:border-status-danger/40 dark:bg-red-950/20">
                <h3 className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-status-danger">
                  <ShieldOff className="h-4 w-4" /> Restrictions spécifiques
                </h3>
                {denies.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-ma-muted">
                    <Ban className="h-4 w-4 shrink-0 opacity-50" />
                    Aucune restriction DENY
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {denies.map((o) => (
                      <li key={o.id} className="rounded-xl border border-status-danger/25 bg-white/80 px-3 py-2.5 text-sm dark:bg-ma-navy-900/40">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Badge tone="danger">Refusé</Badge>
                              <span className="font-medium">{o.permissionLibelle || o.permission}</span>
                            </div>
                            <p className="text-xs text-ma-muted">
                              {o.projectCode ? projectLabel(o.projectCode) : 'Tous ses projets'}
                              {o.createdAt ? ` · ${new Date(o.createdAt).toLocaleDateString('fr-FR')}` : ''}
                              {o.accordePar ? ` · ${o.accordePar}` : ''}
                            </p>
                            <p className="text-xs">{o.motif}</p>
                          </div>
                          <Button variant="outline" className="px-2 py-1 text-xs" disabled={isSelf(selected.id)} onClick={() => setPendingRemove(o.id)}>Retirer</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="space-y-3 rounded-2xl border border-ma-gold-600/25 bg-ma-gold-500/5 p-4 dark:border-ma-gold-500/20">
                <h3 className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-navy-900 dark:text-ma-gold-400">
                  <Plus className="h-4 w-4" /> Ajouter une dérogation
                </h3>
                <label className="block">
                  <FieldCaption>Permission</FieldCaption>
                  <select className="w-full rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900" value={overrideForm.permissionId} onChange={(e) => setOverrideForm({ ...overrideForm, permissionId: e.target.value })}>
                    <option value="">Choisir une permission</option>
                    {(permissions.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.module} · {p.libelle || p.code}</option>
                    ))}
                  </select>
                  {overrideTried && !overrideForm.permissionId && <p className="mt-1 text-xs text-status-danger">Choisissez une permission.</p>}
                </label>
                <label className="block">
                  <FieldCaption>Projet concerné</FieldCaption>
                  <select className="w-full rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900" value={overrideForm.projectId} onChange={(e) => setOverrideForm({ ...overrideForm, projectId: e.target.value })}>
                    <option value="">Tous ses projets</option>
                    {(projects.data ?? []).map((p) => (
                      <option key={p.id} value={p.id}>{p.nom}</option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <FieldCaption>Type de dérogation</FieldCaption>
                  <select className="w-full rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900" value={overrideForm.type} onChange={(e) => setOverrideForm({ ...overrideForm, type: e.target.value as 'GRANT' | 'DENY' })}>
                    <option value="GRANT">Accorder</option>
                    <option value="DENY">Restreindre</option>
                  </select>
                </label>
                <label className="block">
                  <FieldCaption>Motif *</FieldCaption>
                  <Input placeholder="Raison obligatoire pour l’audit" value={overrideForm.motif} onChange={(e) => setOverrideForm({ ...overrideForm, motif: e.target.value })} />
                  {overrideTried && !overrideForm.motif.trim() && <p className="mt-1 text-xs text-status-danger">Le motif est obligatoire.</p>}
                </label>
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
              </section>

              <section>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">Permissions effectives</h3>
                <div className="flex flex-wrap gap-1">
                  {(selected.permissionsEffectives ?? []).map((code) => (
                    <Badge key={code} tone="muted">{code}</Badge>
                  ))}
                  {(selected.permissionsEffectives ?? []).length === 0 && <p className="text-sm text-ma-muted">Aucune permission effective.</p>}
                </div>
              </section>
            </div>
          )}
        </Modal>

        <Modal
          open={pendingRemove != null}
          onClose={() => setPendingRemove(null)}
          title="Retirer cette dérogation ?"
          anchor="center"
          nested
          footer={(
            <>
              <Button variant="outline" onClick={() => setPendingRemove(null)}>Annuler</Button>
              <Button disabled={removeOverride.isPending || pendingRemove == null} onClick={() => pendingRemove != null && removeOverride.mutate(pendingRemove)}>Retirer</Button>
            </>
          )}
        >
          <p className="text-sm text-ma-muted">La permission effective de l’agent sera recalculée immédiatement. Cette action est journalisée.</p>
        </Modal>

        <Toast message={notice} onDismiss={() => setNotice(null)} />
      </div>
    </RequirePermission>
  )
}
