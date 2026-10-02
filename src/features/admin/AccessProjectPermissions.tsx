import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Lock, Plus, Unlock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Input } from '../../components/ui/input'
import { ApiError } from '../../lib/api/client'
import {
  addAgentPermissionOverride,
  fetchPermissionsCatalog,
  fetchRolePermissions,
  getDirectoryAgent,
  removeAgentPermissionOverride,
  rolePermissionsQueryKey,
  saveAgentPermissionActions,
  type PermissionActionMap,
  type PermissionOverrideRow,
  type PermissionRow,
} from '../../lib/api/iam-admin'
import { permissionLabel } from '../../lib/rbac/permissions'
import { cn } from '../../lib/utils'

function humanLabel(perm: PermissionRow) {
  if (perm.libelle && perm.libelle.trim() && perm.libelle.trim() !== perm.code) {
    return perm.libelle.trim()
  }
  return permissionLabel(perm.code)
}

function overrideFor(overrides: PermissionOverrideRow[], projectId: number, code: string) {
  return overrides.find(
    (row) => row.permission === code && Number(row.projectId) === Number(projectId),
  )
}

export function AccessProjectPermissions({
  agentId,
  projectId,
  projectNom,
  roleId,
  open,
  onDenyBlockersChange,
}: {
  agentId: number
  projectId: number
  projectNom: string
  roleId: number
  open: boolean
  onDenyBlockersChange?: (labels: string[]) => void
}) {
  const queryClient = useQueryClient()
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({})
  const [checked, setChecked] = useState<Record<string, boolean>>({})
  const [motifs, setMotifs] = useState<Record<string, string>>({})
  const [pendingExtras, setPendingExtras] = useState<string[]>([])
  const [expandedActions, setExpandedActions] = useState<Record<string, boolean>>({})
  const [actionDrafts, setActionDrafts] = useState<Record<string, PermissionActionMap>>({})
  const [picker, setPicker] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const catalog = useQuery({
    queryKey: ['rbac-permissions'],
    queryFn: fetchPermissionsCatalog,
    enabled: open,
  })
  const rolePerms = useQuery({
    queryKey: rolePermissionsQueryKey(roleId),
    queryFn: () => fetchRolePermissions(roleId),
    enabled: open && roleId > 0,
    staleTime: 0,
    refetchOnMount: 'always',
  })
  const agent = useQuery({
    queryKey: ['directory-agent', agentId],
    queryFn: () => getDirectoryAgent(agentId),
    enabled: open,
  })

  useEffect(() => {
    setUnlocked({})
    setChecked({})
    setMotifs({})
    setPendingExtras([])
    setExpandedActions({})
    setActionDrafts({})
    setPicker('')
    setError(null)
    setNotice(null)
  }, [roleId, projectId, agentId])

  const roleCodes = rolePerms.data?.permissions ?? []
  const roleSet = useMemo(() => new Set(roleCodes), [roleCodes])
  const overrides = agent.data?.overrides ?? []

  function savedChecked(code: string) {
    const override = overrideFor(overrides, projectId, code)
    if (override?.type === 'GRANT') return true
    if (override?.type === 'DENY') return false
    return roleSet.has(code)
  }

  function isChecked(code: string) {
    if (code in checked) return checked[code]
    return savedChecked(code)
  }

  function isUnlocked(code: string) {
    if (code in unlocked) return unlocked[code]
    return Boolean(overrideFor(overrides, projectId, code))
  }

  function roleDefault(code: string) {
    return roleSet.has(code)
  }

  const visiblePerms = useMemo(() => {
    const extras = new Set(pendingExtras)
    for (const row of overrides) {
      if (Number(row.projectId) !== Number(projectId)) continue
      if (row.type === 'GRANT' && row.permission && !roleSet.has(row.permission)) {
        extras.add(row.permission)
      }
    }
    return (catalog.data ?? []).filter(
      (perm) => roleSet.has(perm.code) || extras.has(perm.code),
    )
  }, [catalog.data, roleSet, overrides, projectId, pendingExtras])

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionRow[]>()
    for (const perm of visiblePerms) {
      const key = perm.module?.trim() || 'Général'
      const list = map.get(key) ?? []
      list.push(perm)
      map.set(key, list)
    }
    return [...map.entries()].filter(([, list]) => list.length > 0)
  }, [visiblePerms])

  const addablePerms = useMemo(() => {
    const visible = new Set(visiblePerms.map((p) => p.code))
    return (catalog.data ?? []).filter((perm) => !visible.has(perm.code))
  }, [catalog.data, visiblePerms])

  const denyBlockers = useMemo(() => {
    const labels: string[] = []
    for (const perm of visiblePerms) {
      const on = perm.code in checked ? checked[perm.code] : savedChecked(perm.code)
      const custom = perm.code in unlocked ? unlocked[perm.code] : Boolean(overrideFor(overrides, projectId, perm.code))
      const dirty = on !== savedChecked(perm.code)
      if (custom && dirty && !on && roleSet.has(perm.code) && !motifs[perm.code]?.trim()) {
        labels.push(`${humanLabel(perm)} (${projectNom})`)
      }
    }
    return labels
  }, [visiblePerms, checked, unlocked, motifs, overrides, projectId, projectNom, roleSet])

  useEffect(() => {
    onDenyBlockersChange?.(denyBlockers)
  }, [denyBlockers])

  const save = useMutation({
    mutationFn: async ({ code, nextChecked }: { code: string; nextChecked?: boolean }) => {
      const perm = (catalog.data ?? []).find((row) => row.code === code)
      if (!perm) throw new Error('Permission introuvable')
      const value = nextChecked ?? isChecked(code)
      const existing = overrideFor(overrides, projectId, code)
      const matchesRole = value === roleDefault(code)
      if (matchesRole) {
        if (existing) await removeAgentPermissionOverride(agentId, existing.id)
        return { message: 'Permission rétablie selon le rôle.' }
      }
      if (!value && !motifs[code]?.trim() && !(existing?.type === 'DENY' && existing.motif)) {
        throw new ApiError('Le motif est obligatoire pour une restriction DENY.', 400)
      }
      return addAgentPermissionOverride(agentId, {
        permissionId: perm.id,
        projectId,
        type: value ? 'GRANT' : 'DENY',
        motif: value
          ? (motifs[code]?.trim() || `Personnalisation Accès agent · ${projectNom}`)
          : (motifs[code]?.trim() || existing?.motif || ''),
      })
    },
    onSuccess: (result, variables) => {
      setError(null)
      setNotice(result.message || 'Permission personnalisée enregistrée.')
      setPendingExtras((current) => current.filter((code) => code !== variables.code))
      setUnlocked((current) => {
        const next = { ...current }
        delete next[variables.code]
        return next
      })
      setChecked((current) => {
        const next = { ...current }
        delete next[variables.code]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent', agentId] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : 'L’enregistrement de la permission a échoué.')
    },
  })

  function restore(code: string) {
    const existing = overrideFor(overrides, projectId, code)
    const hasMotif = Boolean(motifs[code]?.trim() || existing?.motif)
    if (hasMotif && !window.confirm('Rétablir cette permission selon le rôle ? Le motif saisi ne sera plus associé à cette dérogation.')) {
      return
    }
    const fallback = roleDefault(code)
    setChecked((current) => ({ ...current, [code]: fallback }))
    setPendingExtras((current) => current.filter((item) => item !== code))
    save.mutate({ code, nextChecked: fallback })
  }

  const ALL_ACTIONS: PermissionActionMap = { VIEW: true, CREATE: true, UPDATE: true, DELETE: true }

  function savedActions(code: string): PermissionActionMap {
    const row = (agent.data?.permissionActions ?? []).find(
      (item) => item.permission === code && Number(item.projectId) === Number(projectId),
    )
    return row?.actions ?? ALL_ACTIONS
  }

  function currentActions(code: string) {
    return actionDrafts[code] ?? savedActions(code)
  }

  function actionCount(map: PermissionActionMap) {
    return (['VIEW', 'CREATE', 'UPDATE', 'DELETE'] as const).filter((key) => map[key]).length
  }

  const saveActions = useMutation({
    mutationFn: async (code: string) => {
      const perm = (catalog.data ?? []).find((row) => row.code === code)
      if (!perm) throw new Error('Permission introuvable')
      return saveAgentPermissionActions(agentId, {
        permissionId: perm.id,
        projectId,
        actions: currentActions(code),
      })
    },
    onSuccess: (result, code) => {
      setNotice(result.message || 'Actions CRUD enregistrées.')
      setActionDrafts((current) => {
        const next = { ...current }
        delete next[code]
        return next
      })
      void queryClient.invalidateQueries({ queryKey: ['directory-agent', agentId] })
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : 'L’enregistrement des actions a échoué.')
    },
  })

  const ready = Boolean(rolePerms.data) && Boolean(catalog.data)

  return (
    <div
      className={cn(
        'grid transition-[grid-template-rows] duration-[280ms] ease-out',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="border-t border-ma-line/80 bg-ma-navy-950/[0.02] px-3 py-3 dark:border-white/10 dark:bg-ma-navy-950/40">
          {error && <Feedback tone="danger">{error}</Feedback>}
          {notice && <Feedback tone="success">{notice}</Feedback>}
          <p className="mb-3 text-xs text-ma-muted">
            Cases verrouillées = permissions du rôle sur la matrice. « Personnaliser » ne concerne que {projectNom.trim()}.
          </p>
          {!ready && !rolePerms.isError && <p className="text-xs text-ma-muted">Chargement des permissions du rôle…</p>}
          {rolePerms.isError && (
            <Feedback tone="danger">Impossible de charger les permissions du rôle depuis la matrice.</Feedback>
          )}
          {ready && grouped.length === 0 && (
            <p className="text-sm text-ma-muted">
              Aucune permission par défaut pour ce rôle. Utilisez « + Ajouter une permission d’un autre domaine » pour lui en attribuer.
            </p>
          )}
          <div className="max-h-[22rem] space-y-3 overflow-y-auto pr-1">
            {grouped.map(([module, perms]) => (
              <div
                key={`${roleId}-${module}`}
                className="translate-y-0 opacity-100 transition-[opacity,transform] duration-[280ms] ease-out"
                style={{ animation: 'ma-perm-section 280ms ease-out' }}
              >
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ma-navy-800 dark:text-ma-gold-300">
                  {module}
                </p>
                <ul className="space-y-1.5">
                  {perms.map((perm) => {
                    const on = isChecked(perm.code)
                    const custom = isUnlocked(perm.code)
                    const override = overrideFor(overrides, projectId, perm.code)
                    const dirty = on !== savedChecked(perm.code)
                    const native = roleDefault(perm.code)
                    const showGrant = override?.type === 'GRANT' && !native
                    const showDeny = override?.type === 'DENY'
                    const denyDraft = custom && native && !on
                    const denyNeedsMotif = denyDraft && dirty && !motifs[perm.code]?.trim()
                    const decomposable = Boolean(perm.decomposable) && on
                    const actions = currentActions(perm.code)
                    const count = actionCount(actions)
                    const actionsDirty = JSON.stringify(actions) !== JSON.stringify(savedActions(perm.code))
                    const actionsOpen = Boolean(expandedActions[perm.code])
                    return (
                      <li
                        key={perm.id}
                        className="rounded-lg border border-ma-line/80 bg-white px-2.5 py-2 dark:border-white/10 dark:bg-ma-navy-900"
                      >
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 shrink-0">
                            {custom ? <Unlock className="h-3.5 w-3.5 text-ma-gold-600" /> : <Lock className="h-3.5 w-3.5 text-ma-muted" />}
                          </span>
                          <label className="flex min-w-0 flex-1 items-start gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0 accent-ma-gold-500 disabled:cursor-not-allowed"
                              checked={on}
                              disabled={!custom}
                              onChange={(e) => setChecked((current) => ({ ...current, [perm.code]: e.target.checked }))}
                            />
                            <span className="min-w-0">
                              <span className="block font-medium leading-tight">{humanLabel(perm)}</span>
                              <span className="font-mono text-[10px] text-slate-400">{perm.code}</span>
                            </span>
                          </label>
                          <div className="flex w-[13.5rem] shrink-0 flex-wrap items-center justify-end gap-1.5">
                            {showGrant && <Badge tone="success">GRANT</Badge>}
                            {showDeny && <Badge tone="danger">DENY</Badge>}
                            {decomposable && count < 4 && (
                              <Badge tone="gold" className="normal-case tracking-normal">{count}/4 actions</Badge>
                            )}
                            {decomposable && (
                              <button
                                type="button"
                                className="text-xs font-medium text-ma-navy-800 underline-offset-2 hover:underline dark:text-ma-gold-400"
                                onClick={() => setExpandedActions((current) => ({ ...current, [perm.code]: !current[perm.code] }))}
                              >
                                Détailler les actions
                              </button>
                            )}
                            {!custom && native && (
                              <button
                                type="button"
                                className="text-xs font-medium text-ma-navy-800 underline-offset-2 hover:underline dark:text-ma-gold-400"
                                onClick={() => setUnlocked((current) => ({ ...current, [perm.code]: true }))}
                              >
                                Personnaliser
                              </button>
                            )}
                            <Button
                              className="px-3 py-1.5 text-xs"
                              disabled={save.isPending || !dirty || denyNeedsMotif}
                              onClick={() => save.mutate({ code: perm.code })}
                            >
                              Enregistrer
                            </Button>
                            <Button
                              className="px-3 py-1.5 text-xs"
                              variant="outline"
                              disabled={save.isPending || (!override && !pendingExtras.includes(perm.code))}
                              onClick={() => restore(perm.code)}
                            >
                              Rétablir
                            </Button>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                            decomposable && actionsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                          )}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="mt-2 rounded-lg border border-ma-line/80 bg-slate-50 px-2.5 py-2 dark:border-white/10 dark:bg-ma-navy-950/60">
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {([
                                  ['VIEW', 'Consulter'],
                                  ['CREATE', 'Ajouter'],
                                  ['UPDATE', 'Modifier'],
                                  ['DELETE', 'Supprimer'],
                                ] as const).map(([key, label]) => (
                                  <label key={key} className="flex items-center gap-1.5 text-xs">
                                    <input
                                      type="checkbox"
                                      className="accent-ma-gold-500"
                                      checked={actions[key]}
                                      onChange={(e) => setActionDrafts((current) => ({
                                        ...current,
                                        [perm.code]: { ...actions, [key]: e.target.checked },
                                      }))}
                                    />
                                    {label}
                                    {actions[key] !== savedActions(perm.code)[key] && (
                                      <Badge tone={actions[key] ? 'success' : 'danger'} className="normal-case">
                                        {actions[key] ? 'GRANT' : 'DENY'}
                                      </Badge>
                                    )}
                                  </label>
                                ))}
                              </div>
                              <div className="mt-2 flex justify-end">
                                <Button
                                  className="px-3 py-1.5 text-xs"
                                  disabled={saveActions.isPending || !actionsDirty}
                                  onClick={() => saveActions.mutate(perm.code)}
                                >
                                  Enregistrer les actions
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div
                          className={cn(
                            'grid transition-[grid-template-rows,opacity] duration-[280ms] ease-out',
                            denyDraft && dirty ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
                          )}
                        >
                          <div className="min-h-0 overflow-hidden">
                            <div className="pt-2">
                              <Input
                                placeholder="Motif (obligatoire)"
                                value={motifs[perm.code] ?? ''}
                                onChange={(e) => setMotifs((current) => ({ ...current, [perm.code]: e.target.value }))}
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          {ready && (
            <div className="mt-3 space-y-2 border-t border-ma-line/70 pt-3 dark:border-white/10">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">Autre domaine</p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="min-w-[14rem] flex-1 rounded-xl border border-ma-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-ma-navy-900"
                  value={picker}
                  onChange={(e) => setPicker(e.target.value)}
                >
                  <option value="">Choisir une permission hors rôle</option>
                  {addablePerms.map((perm) => (
                    <option key={perm.id} value={perm.code}>
                      {perm.module} · {humanLabel(perm)}
                    </option>
                  ))}
                </select>
                <Button
                  variant="outline"
                  className="px-3 py-2 text-xs"
                  disabled={!picker}
                  onClick={() => {
                    setPendingExtras((current) => (current.includes(picker) ? current : [...current, picker]))
                    setUnlocked((current) => ({ ...current, [picker]: true }))
                    setChecked((current) => ({ ...current, [picker]: true }))
                    setPicker('')
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter une permission d’un autre domaine
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function ProjectPermissionsToggle({
  open,
  count,
  disabled,
  onToggle,
}: {
  open: boolean
  count: number
  disabled?: boolean
  onToggle: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {count > 0 && (
        <Badge tone="gold" className="normal-case tracking-normal">
          Permissions personnalisées : {count}
        </Badge>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        className="inline-flex items-center gap-1 text-xs font-medium text-ma-navy-800 underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-50 dark:text-ma-gold-400"
      >
        Voir/modifier les permissions détaillées
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-[280ms]', open && 'rotate-180')} />
      </button>
    </div>
  )
}
