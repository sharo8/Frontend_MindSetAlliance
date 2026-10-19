import { useTranslation } from 'react-i18next'
import { Check, ChevronRight, ChevronsDownUp, ChevronsUpDown, Minus, Plus, SearchX, ShieldCheck, UsersRound } from 'lucide-react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
import { EmptyState } from '../../components/ui/scope-empty'
import { Skeleton } from '../../components/ui/skeleton'
import { Mono } from '../../components/ui/table'
import { SearchField } from '../../components/ui/toolbar'
import { spring } from '../../components/motion/springs'
import { ApiError } from '../../lib/api/client'
import {
  fetchPermissionsCatalog,
  fetchRolePermissions,
  fetchRoles,
  previewRolePermissionsMatrix,
  rolePermissionsQueryKey,
  saveRolePermissionsMatrix,
  type MatrixImpact,
  type PermissionRow,
} from '../../lib/api/iam-admin'
import { useAuthStore } from '../../lib/auth/auth-store'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { permissionLabel } from '../../lib/rbac/permissions'
import { cn } from '../../lib/utils'
import { CheckBox } from './access-ui'

function sameSet(a: string[] = [], b: string[] = []) {
  if (a.length !== b.length) return false
  const right = new Set(b)
  return a.every((code) => right.has(code))
}

function humanLabel(perm: PermissionRow) {
  if (perm.libelle && perm.libelle.trim() && perm.libelle.trim() !== perm.code) {
    return perm.libelle.trim()
  }
  return permissionLabel(perm.code)
}

function fold(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

const HEADER_H = 84
const ROW_H = 50
const PERM_W_DESK = 240
const PERM_W_MOB = 168
const ROLE_MIN = 104

export function PermissionsAdminPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [matrix, setMatrix] = useState<Record<number, string[]>>({})
  const [baseline, setBaseline] = useState<Record<number, string[]>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [impact, setImpact] = useState<MatrixImpact | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [hover, setHover] = useState<{ row?: number; col?: number }>({})
  const [scrolledX, setScrolledX] = useState(false)
  const [compact, setCompact] = useState(false)
  const [maxHeight, setMaxHeight] = useState('calc(100svh - 12rem)')
  const scrollRef = useRef<HTMLDivElement>(null)

  const ready = Boolean(useAuthStore((s) => s.accessToken))
  const roles = useQuery({ queryKey: ['rbac-roles'], queryFn: fetchRoles, enabled: ready })
  const permissions = useQuery({ queryKey: ['rbac-permissions'], queryFn: fetchPermissionsCatalog, enabled: ready })
  const rolePermQueries = useQueries({
    queries: (roles.data ?? []).map((role) => ({
      queryKey: rolePermissionsQueryKey(role.id),
      queryFn: () => fetchRolePermissions(role.id),
      enabled: ready && Boolean(roles.data),
      staleTime: 0,
    })),
  })

  const permSignature = rolePermQueries
    .map((row) => `${row.data?.id ?? ''}:${(row.data?.permissions ?? []).join(',')}`)
    .join('|')

  useEffect(() => {
    if (!roles.data?.length || !permSignature) return
    if (rolePermQueries.some((row) => !row.data)) return
    const next: Record<number, string[]> = {}
    for (const row of rolePermQueries) {
      if (!row.data) continue
      next[row.data.id] = row.data.permissions ?? []
    }
    setBaseline(next)
    setMatrix((current) => {
      const hasLocalEdits = (roles.data ?? []).some((role) => !sameSet(current[role.id] ?? [], next[role.id] ?? []))
      return hasLocalEdits && Object.keys(current).length > 0 ? current : next
    })
  }, [roles.data, permSignature])

  const grouped = useMemo(() => {
    const map = new Map<string, PermissionRow[]>()
    for (const perm of permissions.data ?? []) {
      const key = perm.module?.trim() || t('adminUi.general')
      const list = map.get(key) ?? []
      list.push(perm)
      map.set(key, list)
    }
    return [...map.entries()].filter(([, list]) => list.length > 0)
  }, [permissions.data, t])

  const payload = useMemo(
    () => (roles.data ?? []).map((role) => ({ id: role.id, permissions: matrix[role.id] ?? [] })),
    [roles.data, matrix],
  )

  const localDiffs = useMemo(() => {
    return (roles.data ?? [])
      .map((role) => {
        const current = new Set(matrix[role.id] ?? [])
        const original = new Set(baseline[role.id] ?? [])
        const added = [...current].filter((c) => !original.has(c))
        const removed = [...original].filter((c) => !current.has(c))
        const lib = (code: string) => {
          const perm = permissions.data?.find((p) => p.code === code)
          return perm ? humanLabel(perm) : permissionLabel(code)
        }
        return {
          id: role.id,
          libelle: role.libelle,
          added: added.map((code) => ({ code, libelle: lib(code) })),
          removed: removed.map((code) => ({ code, libelle: lib(code) })),
        }
      })
      .filter((row) => row.added.length || row.removed.length)
  }, [roles.data, matrix, baseline, permissions.data])

  const pendingCount = localDiffs.reduce((sum, row) => sum + row.added.length + row.removed.length, 0)

  function toggle(roleId: number, code: string) {
    setMatrix((prev) => {
      const current = prev[roleId] ?? []
      return {
        ...prev,
        [roleId]: current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
      }
    })
  }

  function changed(roleId: number, code: string) {
    const now = (matrix[roleId] ?? []).includes(code)
    const before = (baseline[roleId] ?? []).includes(code)
    return now !== before
  }

  const preview = useMutation({
    mutationFn: () => previewRolePermissionsMatrix(payload),
    onSuccess: (result) => {
      setImpact(result)
      setError(null)
    },
    onError: (err) => {
      setError(err instanceof ApiError ? err.message : t('crud.actionFail'))
    },
  })

  const save = useMutation({
    mutationFn: () => saveRolePermissionsMatrix(payload),
    onSuccess: (result) => {
      setNotice(result.message || t('adminUi.matrixSaved'))
      setError(null)
      setImpact(null)
      setBaseline(matrix)
      for (const role of payload) {
        queryClient.setQueryData(rolePermissionsQueryKey(role.id), (current: { id?: number; permissions?: string[] } | undefined) => ({
          ...(current ?? {}),
          id: role.id,
          permissions: role.permissions,
        }))
      }
      void queryClient.invalidateQueries({ queryKey: ['rbac-role-permissions'] })
      void queryClient.invalidateQueries({ queryKey: ['rbac-roles'] })
    },
    onError: (err) => {
      setNotice(null)
      setError(err instanceof ApiError ? err.message : t('crud.saveFail'))
    },
  })

  const roleList = roles.data ?? []
  const loading = roles.isLoading || permissions.isLoading || (roleList.length > 0 && rolePermQueries.some((row) => row.isLoading) && Object.keys(matrix).length === 0)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const fit = () => {
      const top = el.getBoundingClientRect().top
      setMaxHeight(`calc(100svh - ${Math.ceil(top)}px - 16px)`)
      setCompact(window.innerWidth < 1280)
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [loading, roleList.length])

  const [query, setQuery] = useState('')
  const searching = query.trim().length > 0
  const visibleGroups = useMemo(() => {
    if (!searching) return grouped
    const needle = fold(query.trim())
    return grouped
      .map(([module, perms]) => {
        if (fold(module).includes(needle)) return [module, perms] as const
        return [module, perms.filter((perm) => fold(`${humanLabel(perm)} ${perm.code}`).includes(needle))] as const
      })
      .filter(([, perms]) => perms.length > 0)
  }, [grouped, query, searching])
  const allCollapsed = grouped.length > 0 && grouped.every(([module]) => collapsed[module] === true)

  const PERM_W = typeof window !== 'undefined' && window.innerWidth < 640 ? PERM_W_MOB : PERM_W_DESK
  const minTable = PERM_W + Math.max(roleList.length, 1) * ROLE_MIN
  const stickyBg = 'bg-surface'
  const hoverTint = 'bg-[color-mix(in_srgb,var(--ma-surface),#dcaa28_8%)]'

  return (
    <RequirePermission permission="MANAGE_PERMISSIONS">
      <div className="space-y-6">
        <PageHeader kicker={t('pages.permissions.kicker')} title={t('pages.permissions.title')} subtitle={t('pages.permissions.subtitle')} />
        {notice && <Feedback tone="success">{notice}</Feedback>}
        {error && <Feedback tone="danger">{error}</Feedback>}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-hairline px-4 py-3.5 sm:px-5">
            <SearchField
              className="basis-full sm:basis-auto"
              placeholder={t('acces.matrix.search', 'Rechercher une permission')}
              value={query}
              onChange={setQuery}
            />
            <Button
              variant="ghost"
              size="sm"
              disabled={grouped.length === 0 || searching}
              onClick={() => setCollapsed(Object.fromEntries(grouped.map(([module]) => [module, !allCollapsed])))}
            >
              {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
              {allCollapsed ? t('acces.matrix.expandAll', 'Tout déplier') : t('acces.matrix.collapseAll', 'Tout replier')}
            </Button>
            <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:ml-auto sm:w-auto sm:justify-end">
              <div className="min-w-0">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.p
                    key={pendingCount === 0 ? 'none' : 'some'}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.16 }}
                    className="flex items-center gap-1.5 text-[13px] font-medium text-ink"
                  >
                    {pendingCount === 0 ? (
                      <Check className="h-3.5 w-3.5 text-status-success" strokeWidth={2.6} />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-status-warning" aria-hidden />
                    )}
                    <span className="tabular-nums">{pendingCount === 0 ? t('adminUi.noPending') : t('adminUi.pendingCount', { count: pendingCount })}</span>
                  </motion.p>
                </AnimatePresence>
                <p className="mt-0.5 hidden text-[12px] text-ink-3 md:block">{t('adminUi.emailNotice')}</p>
              </div>
              <Button disabled={save.isPending || preview.isPending || pendingCount === 0} onClick={() => preview.mutate()}>
                <ShieldCheck className="h-4 w-4" />
                {preview.isPending ? t('adminUi.analyzing') : t('adminUi.saveChanges')}
              </Button>
            </div>
          </div>
          <div
            ref={scrollRef}
            className="ma-scroll overflow-auto"
            style={{ maxHeight, scrollbarGutter: 'stable' }}
            onScroll={(event) => setScrolledX(event.currentTarget.scrollLeft > 0)}
          >
            {loading ? (
              <MatrixSkeleton columns={Math.max(roleList.length, 8)} />
            ) : (
              <table
                className="border-separate border-spacing-0 text-left text-[13.5px] text-ink"
                data-compact={compact || undefined}
                style={{ tableLayout: 'fixed', width: '100%', minWidth: minTable }}
                onMouseLeave={() => setHover({})}
              >
                <colgroup>
                  <col style={{ width: PERM_W }} />
                  {roleList.map((role) => (
                    <col key={role.id} style={{ width: `calc((100% - ${PERM_W}px) / ${Math.max(roleList.length, 1)})` }} />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th
                      className={cn(
                        'sticky left-0 top-0 z-30 border-b border-r border-hairline px-4 text-left align-bottom sm:px-5',
                        stickyBg,
                        scrolledX && 'shadow-[6px_0_12px_-8px_rgb(17_27_63/0.35)]',
                      )}
                      style={{ height: HEADER_H, width: PERM_W }}
                    >
                      <span className="block pb-3 text-[12px] font-medium text-ink-3">
                        {t('adminUi.permissionCol')}
                        <span className="ml-1.5 tabular-nums text-ink-3/80">{(permissions.data ?? []).length}</span>
                      </span>
                    </th>
                    {roleList.map((role) => (
                      <th
                        key={role.id}
                        title={role.libelle}
                        className={cn(
                          'sticky top-0 z-20 overflow-hidden border-b border-hairline p-0 text-center align-middle transition-colors duration-150',
                          hover.col === role.id ? hoverTint : stickyBg,
                        )}
                        style={{ height: HEADER_H }}
                      >
                        <span className="mx-auto flex h-[84px] flex-col items-center justify-center gap-1 px-2">
                          <span lang="fr" className="line-clamp-2 text-[12px] font-semibold leading-[1.15] tracking-[-0.01em] text-ink">{role.libelle}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] font-normal tabular-nums text-ink-3">
                            <UsersRound className="h-3 w-3" aria-hidden />
                            {role.agentsCount ?? 0}
                            <span className="sr-only">{t('adminUi.agentsCount', { count: role.agentsCount ?? 0 })}</span>
                          </span>
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibleGroups.length === 0 && (
                    <tr>
                      <td colSpan={roleList.length + 1} className="p-0">
                        <div className="sticky left-0 w-full max-w-[100vw] sm:max-w-none">
                          <EmptyState
                            icon={<SearchX />}
                            title={t('acces.matrix.noResult', 'Aucune permission ne correspond')}
                            hint={t('acces.matrix.noResultHint', 'Essayez un autre mot, par exemple « facture » ou « tickets ».')}
                          />
                        </div>
                      </td>
                    </tr>
                  )}
                  {visibleGroups.map(([module, perms]) => {
                    const closed = !searching && collapsed[module] === true
                    const enabledInGroup = roleList.reduce((sum, role) => sum + perms.filter((p) => (matrix[role.id] ?? []).includes(p.code)).length, 0)
                    return (
                      <Fragment key={module}>
                        <tr>
                          <th colSpan={roleList.length + 1} className="border-b border-hairline bg-surface-2 p-0 text-left">
                            <button
                              type="button"
                              className="group sticky left-0 flex h-10 items-center gap-2 px-5 text-left text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:inset_var(--ring-focus)]"
                              aria-expanded={!closed}
                              onClick={() => setCollapsed((prev) => ({ ...prev, [module]: !closed }))}
                            >
                              <ChevronRight
                                className={cn('h-4 w-4 text-ink-3 transition-transform duration-300 ease-[var(--ease-ma)]', !closed && 'rotate-90')}
                                strokeWidth={2.2}
                              />
                              {module}
                              <span className="ml-1 rounded-full bg-ink/[0.06] px-1.5 py-px text-[11px] font-medium tabular-nums text-ink-3 dark:bg-white/[0.07]">
                                {perms.length}
                              </span>
                              {closed && (
                                <span className="ml-1 text-[11.5px] font-normal text-ink-3">
                                  {t('acces.matrix.enabledCount', '{{count}} cases cochées', { count: enabledInGroup })}
                                </span>
                              )}
                            </button>
                          </th>
                        </tr>
                        {!closed &&
                          perms.map((perm) => {
                            const rowHover = hover.row === perm.id
                            return (
                              <tr key={perm.id} className="group/row">
                                <th
                                  scope="row"
                                  title={`${humanLabel(perm)} · ${perm.code}`}
                                  className={cn(
                                    'sticky left-0 z-10 border-b border-r border-hairline px-4 text-left font-normal transition-colors duration-150 sm:px-5',
                                    rowHover ? hoverTint : stickyBg,
                                    scrolledX && 'shadow-[6px_0_12px_-8px_rgb(17_27_63/0.35)]',
                                  )}
                                  style={{ height: ROW_H, width: PERM_W }}
                                >
                                  <span className="block truncate text-[13.5px] font-medium leading-tight text-ink">{humanLabel(perm)}</span>
                                  <Mono className="mt-0.5 block truncate text-[10.5px] text-ink-3">{perm.code}</Mono>
                                </th>
                                {roleList.map((role) => {
                                  const checked = (matrix[role.id] ?? []).includes(perm.code)
                                  const dirty = changed(role.id, perm.code)
                                  return (
                                    <td
                                      key={role.id}
                                      className={cn(
                                        'relative border-b border-hairline p-0 transition-colors duration-150',
                                        (hover.col === role.id || rowHover) && 'bg-ma-gold-500/[0.06]',
                                        hover.col === role.id && rowHover && 'bg-ma-gold-500/[0.11]',
                                        dirty && 'bg-status-warning/[0.07]',
                                      )}
                                      style={{ height: ROW_H }}
                                      onMouseEnter={() => setHover({ row: perm.id, col: role.id })}
                                    >
                                      <label className="flex h-full w-full cursor-pointer items-center justify-center">
                                        <CheckBox checked={checked} label={`${humanLabel(perm)}, ${role.libelle}`} onChange={() => toggle(role.id, perm.code)} />
                                      </label>
                                      <AnimatePresence>
                                        {dirty && (
                                          <motion.span
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            exit={{ scale: 0 }}
                                            transition={spring.snappy}
                                            className="pointer-events-none absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-status-warning"
                                            aria-hidden="true"
                                          />
                                        )}
                                      </AnimatePresence>
                                    </td>
                                  )
                                })}
                              </tr>
                            )
                          })}
                      </Fragment>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        </Card>
        <Modal
          open={Boolean(impact)}
          onClose={() => setImpact(null)}
          kicker={t('adminUi.confirmation')}
          title={t('adminUi.confirmMatrix')}
          subtitle={impact?.confirmation}
          footer={(
            <>
              <Button variant="outline" onClick={() => setImpact(null)}>
                {t('common.cancel')}
              </Button>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                <ShieldCheck className="h-4 w-4" />
                {save.isPending ? t('common.saving') : t('common.confirm')}
              </Button>
            </>
          )}
        >
          <div className="space-y-3">
            {(impact?.roles ?? []).map((row) => (
              <div key={row.id} className="rounded-[18px] bg-surface p-4 ring-1 ring-hairline">
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <p className="text-[14px] font-semibold text-ink">{row.libelle}</p>
                  {typeof row.agentsCount === 'number' && (
                    <Badge tone="muted">
                      <UsersRound className="h-3 w-3" aria-hidden />
                      {t('adminUi.agentsCount', { count: row.agentsCount })}
                    </Badge>
                  )}
                </div>
                <ul className="space-y-1.5">
                  {row.added.map((p) => (
                    <li key={`+${p.code}`} className="flex items-center gap-2.5 text-[13.5px] text-ink">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-success/12 text-status-success">
                        <Plus className="h-3 w-3" strokeWidth={2.8} />
                      </span>
                      {p.libelle}
                    </li>
                  ))}
                  {row.removed.map((p) => (
                    <li key={`-${p.code}`} className="flex items-center gap-2.5 text-[13.5px] text-ink">
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-status-danger/10 text-status-danger">
                        <Minus className="h-3 w-3" strokeWidth={2.8} />
                      </span>
                      {p.libelle}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Modal>
      </div>
    </RequirePermission>
  )
}

function MatrixSkeleton({ columns }: { columns: number }) {
  return (
    <div className="min-w-[1080px]" role="status" aria-label="Chargement">
      <div className="flex items-end gap-2 border-b border-hairline px-5 pb-3" style={{ height: HEADER_H }}>
        <Skeleton className="h-3.5 w-24 shrink-0" />
        <div className="ml-[176px] flex flex-1 justify-around">
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} className="h-3.5 w-14" />
          ))}
        </div>
      </div>
      {Array.from({ length: 9 }, (_, row) => (
        <div key={row} className="flex items-center border-b border-hairline" style={{ height: ROW_H, opacity: 1 - row * 0.08 }}>
          <div className="w-[240px] shrink-0 px-5">
            <Skeleton className="h-3.5 w-40" />
          </div>
          <div className="flex flex-1 justify-around">
            {Array.from({ length: columns }, (_, col) => (
              <Skeleton key={col} className="h-5 w-5 rounded-[7px]" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
