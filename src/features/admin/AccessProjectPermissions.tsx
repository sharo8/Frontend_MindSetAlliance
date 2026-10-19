import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ListChecks, Lock, Plus, RotateCcw, SlidersHorizontal, Unlock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Input, Select } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'
import { Mono } from '../../components/ui/table'
import { spring } from '../../components/motion/springs'
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
import { CheckBox, Switch } from './access-ui'

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
    <div className={cn('grid transition-[grid-template-rows] duration-[320ms] ease-[var(--ease-ma)]', open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
      <div className="min-h-0 overflow-hidden">
        <div className="space-y-4 border-t border-hairline bg-ink/[0.02] px-4 py-4 dark:bg-white/[0.02]">
          {error && <Feedback tone="danger">{error}</Feedback>}
          {notice && <Feedback tone="success">{notice}</Feedback>}
          <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-3">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0" />
            <span>
              Interrupteurs verrouillés = permissions du rôle dans la matrice. « Personnaliser » ne concerne que {projectNom.trim()}.
            </span>
          </p>
          {!ready && !rolePerms.isError && (
            <div className="space-y-2" aria-label="Chargement des permissions du rôle">
              <Skeleton className="h-12 rounded-[14px]" />
              <Skeleton className="h-12 rounded-[14px]" />
              <Skeleton className="h-12 rounded-[14px]" />
            </div>
          )}
          {rolePerms.isError && <Feedback tone="danger">Impossible de charger les permissions du rôle depuis la matrice.</Feedback>}
          {ready && grouped.length === 0 && (
            <p className="rounded-[14px] bg-surface px-4 py-3 text-[13px] text-ink-3 ring-1 ring-hairline">
              Aucune permission par défaut pour ce rôle. Utilisez « Autre domaine » ci-dessous pour lui en attribuer.
            </p>
          )}
          <div className="space-y-4">
            {grouped.map(([module, perms]) => (
              <div key={`${roleId}-${module}`} style={{ animation: 'ma-perm-section 280ms ease-out' }}>
                <p className="mb-2 flex items-center gap-2 px-1 text-[12.5px] font-semibold text-ink-2">
                  {module}
                  <span className="font-medium tabular-nums text-ink-3">{perms.length}</span>
                </p>
                <ul className="divide-y divide-hairline overflow-hidden rounded-[14px] bg-surface ring-1 ring-hairline">
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
                    const canRestore = Boolean(override) || pendingExtras.includes(perm.code)
                    return (
                      <li key={perm.id} className={cn('px-3.5 py-3 transition-colors duration-200', custom && 'bg-ma-gold-500/[0.035]')}>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                          <Switch
                            size="sm"
                            label={humanLabel(perm)}
                            checked={on}
                            disabled={!custom}
                            onChange={(next) => setChecked((current) => ({ ...current, [perm.code]: next }))}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5 text-[13.5px] font-medium leading-tight text-ink">
                              <span className="truncate">{humanLabel(perm)}</span>
                              <span className="shrink-0" title={custom ? 'Permission personnalisée pour cette société' : 'Permission du rôle'}>
                                {custom ? <Unlock className="h-3 w-3 text-accent-ink" /> : <Lock className="h-3 w-3 text-ink-3" />}
                              </span>
                            </p>
                            <Mono className="text-[11px] text-ink-3">{perm.code}</Mono>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            {showGrant && <Badge tone="success">Accordée</Badge>}
                            {showDeny && <Badge tone="danger">Retirée</Badge>}
                            {decomposable && count < 4 && <Badge tone="gold">{count}/4 actions</Badge>}
                            {decomposable && (
                              <Button
                                variant="ghost"
                                size="sm"
                                aria-expanded={actionsOpen}
                                onClick={() => setExpandedActions((current) => ({ ...current, [perm.code]: !current[perm.code] }))}
                              >
                                <ListChecks className="h-3.5 w-3.5" />
                                Détailler
                              </Button>
                            )}
                            {!custom && native && (
                              <Button variant="ghost" size="sm" onClick={() => setUnlocked((current) => ({ ...current, [perm.code]: true }))}>
                                <SlidersHorizontal className="h-3.5 w-3.5" />
                                Personnaliser
                              </Button>
                            )}
                            {canRestore && (
                              <Button variant="outline" size="sm" disabled={save.isPending} onClick={() => restore(perm.code)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                Rétablir
                              </Button>
                            )}
                            {dirty && (
                              <Button size="sm" disabled={save.isPending || denyNeedsMotif} onClick={() => save.mutate({ code: perm.code })}>
                                Enregistrer
                              </Button>
                            )}
                          </div>
                        </div>

                        <AnimatePresence initial={false}>
                          {decomposable && actionsOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={spring.snappy}
                              className="overflow-hidden"
                            >
                              <div className="mt-3 rounded-[12px] bg-ink/[0.03] p-3 ring-1 ring-inset ring-hairline dark:bg-white/[0.03]">
                                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                                  {(
                                    [
                                      ['VIEW', 'Consulter'],
                                      ['CREATE', 'Ajouter'],
                                      ['UPDATE', 'Modifier'],
                                      ['DELETE', 'Supprimer'],
                                    ] as const
                                  ).map(([key, label]) => {
                                    const changedAction = actions[key] !== savedActions(perm.code)[key]
                                    return (
                                      <label
                                        key={key}
                                        className={cn(
                                          'flex cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-2 text-[13px] text-ink ring-1 ring-inset transition-colors',
                                          changedAction
                                            ? actions[key]
                                              ? 'bg-status-success/[0.07] ring-status-success/25'
                                              : 'bg-status-danger/[0.06] ring-status-danger/25'
                                            : 'bg-surface ring-hairline',
                                        )}
                                      >
                                        <CheckBox
                                          label={label}
                                          checked={actions[key]}
                                          onChange={(next) =>
                                            setActionDrafts((current) => ({
                                              ...current,
                                              [perm.code]: { ...actions, [key]: next },
                                            }))
                                          }
                                        />
                                        {label}
                                      </label>
                                    )
                                  })}
                                </div>
                                <div className="mt-3 flex justify-end">
                                  <Button size="sm" disabled={saveActions.isPending || !actionsDirty} onClick={() => saveActions.mutate(perm.code)}>
                                    Enregistrer les actions
                                  </Button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <AnimatePresence initial={false}>
                          {denyDraft && dirty && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={spring.snappy}
                              className="overflow-hidden"
                            >
                              <div className="pt-3">
                                <Input
                                  placeholder="Motif de la restriction (obligatoire)"
                                  aria-invalid={denyNeedsMotif}
                                  value={motifs[perm.code] ?? ''}
                                  onChange={(e) => setMotifs((current) => ({ ...current, [perm.code]: e.target.value }))}
                                />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))}
          </div>
          {ready && (
            <div className="border-t border-hairline pt-4">
              <p className="mb-2 px-1 text-[12.5px] font-semibold text-ink-2">Autre domaine</p>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Select className="min-w-0 flex-1" aria-label="Permission hors rôle" value={picker} onChange={(e) => setPicker(e.target.value)}>
                  <option value="">Choisir une permission hors rôle</option>
                  {addablePerms.map((perm) => (
                    <option key={perm.id} value={perm.code}>
                      {perm.module} · {humanLabel(perm)}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="outline"
                  disabled={!picker}
                  onClick={() => {
                    setPendingExtras((current) => (current.includes(picker) ? current : [...current, picker]))
                    setUnlocked((current) => ({ ...current, [picker]: true }))
                    setChecked((current) => ({ ...current, [picker]: true }))
                    setPicker('')
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter
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
    <Button
      variant="ghost"
      size="sm"
      disabled={disabled}
      aria-expanded={open}
      aria-label="Permissions détaillées"
      title={count > 0 ? `Permissions détaillées · ${count > 1 ? `${count} personnalisations` : '1 personnalisation'}` : 'Permissions détaillées'}
      onClick={onToggle}
      className={cn(open && 'bg-ink/[0.05] text-ink dark:bg-white/[0.07]')}
    >
      Permissions
      {count > 0 && (
        <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-ma-gold-500/18 px-1 text-[11px] font-semibold tabular-nums text-accent-ink">
          {count}
        </span>
      )}
      <ChevronDown className={cn('h-3.5 w-3.5 transition-transform duration-300 ease-[var(--ease-ma)]', open && 'rotate-180')} />
    </Button>
  )
}
