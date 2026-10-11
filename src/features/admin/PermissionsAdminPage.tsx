import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { Modal } from '../../components/ui/modal'
import { PageHeader } from '../../components/ui/page-header'
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

const HEADER_H = 76
const ROW_H = 44
const PERM_W = 300
const ROLE_MIN = 88

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

  const stickyBg = 'bg-white dark:bg-[#101a45]'
  const minTable = PERM_W + Math.max(roleList.length, 1) * ROLE_MIN

  return (
    <RequirePermission permission="MANAGE_PERMISSIONS">
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.permissions.kicker')}
          title={t('pages.permissions.title')}
          subtitle={t('pages.permissions.subtitle')}
        />
        {notice && <Feedback tone="success">{notice}</Feedback>}
        {error && <Feedback tone="danger">{error}</Feedback>}
        <Card className="hover:translate-y-0">
          <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-3 border-b border-ma-line/80 bg-white/95 px-4 py-2 backdrop-blur dark:border-white/10 dark:bg-[#101a45]/95">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 text-sm">
                {pendingCount === 0 && <Check className="h-3.5 w-3.5 text-status-success" strokeWidth={2.5} />}
                {pendingCount === 0 ? t('adminUi.noPending') : t('adminUi.pendingCount', { count: pendingCount })}
              </p>
              <p className="text-xs text-ma-muted">{t('adminUi.emailNotice')}</p>
            </div>
            <Button disabled={save.isPending || preview.isPending || pendingCount === 0} onClick={() => preview.mutate()}>
              {preview.isPending ? t('adminUi.analyzing') : t('adminUi.saveChanges')}
            </Button>
          </div>
          <div
            ref={scrollRef}
            className="overflow-auto"
            style={{ maxHeight, scrollbarGutter: 'stable' }}
            onScroll={(event) => setScrolledX(event.currentTarget.scrollLeft > 0)}
          >
            {loading ? (
              <MatrixSkeleton columns={Math.max(roleList.length, 10)} />
            ) : (
              <table
                className="border-separate border-spacing-0 text-left text-sm"
                style={{ tableLayout: 'fixed', width: '100%', minWidth: compact ? minTable : '100%' }}
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
                        'sticky left-0 top-0 z-30 border-b border-r border-ma-line/70 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted',
                        stickyBg,
                        scrolledX && 'shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]',
                      )}
                      style={{ height: HEADER_H, width: PERM_W }}
                    >
                      {t('adminUi.permissionCol')}
                    </th>
                    {roleList.map((role) => (
                      <th
                        key={role.id}
                        title={role.libelle}
                      className={cn(
                        'sticky top-0 z-20 overflow-hidden border-b border-ma-line/70 p-0 text-center align-middle',
                        stickyBg,
                        hover.col === role.id && 'bg-ma-gold-500/10',
                      )}
                      style={{ height: HEADER_H }}
                    >
                      <span className="mx-auto flex h-[76px] flex-col items-center justify-center px-1">
                        <span className="line-clamp-2 text-[12px] font-semibold leading-tight text-ma-navy-900 dark:text-white">
                          {role.libelle}
                        </span>
                        <span className="mt-1 text-[10px] font-normal text-ma-muted">
                          {t('adminUi.agentsCount', { count: role.agentsCount ?? 0 })}
                        </span>
                      </span>
                    </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grouped.map(([module, perms]) => {
                    const closed = collapsed[module] === true
                    return (
                      <Fragment key={module}>
                        <tr>
                          <th
                            colSpan={roleList.length + 1}
                            className="h-9 border-b border-ma-line/60 bg-slate-50 p-0 text-left dark:bg-white/5"
                          >
                            <button
                              type="button"
                              className="flex h-9 w-full items-center gap-2 px-3 text-left text-[11px] font-semibold uppercase tracking-[0.14em]"
                              aria-expanded={!closed}
                              onClick={() => setCollapsed((prev) => ({ ...prev, [module]: !closed }))}
                            >
                              <span className={cn('inline-block w-3 text-ma-muted', closed && '-rotate-90')}>▾</span>
                              {module}
                            </button>
                          </th>
                        </tr>
                        {!closed && perms.map((perm) => (
                          <tr key={perm.id} className={cn('bg-white dark:bg-[#101a45]', hover.row === perm.id && 'bg-ma-gold-500/10 dark:bg-[#243056]')}>
                            <th
                              scope="row"
                              title={`${humanLabel(perm)} · ${perm.code}`}
                              className={cn(
                                'sticky left-0 z-10 border-b border-r border-ma-line/60 px-3 text-left font-normal',
                                hover.row === perm.id ? 'bg-[#f8f1dc] dark:bg-[#243056]' : stickyBg,
                                scrolledX && 'shadow-[4px_0_8px_-6px_rgba(15,23,42,0.35)]',
                              )}
                              style={{ height: ROW_H, width: PERM_W }}
                            >
                              <span className="block truncate text-[13px] text-ma-navy-900 dark:text-white">{humanLabel(perm)}</span>
                            </th>
                            {roleList.map((role) => {
                              const checked = (matrix[role.id] ?? []).includes(perm.code)
                              const dirty = changed(role.id, perm.code)
                              return (
                                <td
                                  key={role.id}
                                  className={cn(
                                    'relative border-b border-ma-line/40 p-0',
                                    hover.col === role.id && 'bg-ma-gold-500/10',
                                  )}
                                  style={{ height: ROW_H }}
                                  onMouseEnter={() => setHover({ row: perm.id, col: role.id })}
                                >
                                  <label className="flex h-11 w-full cursor-pointer items-center justify-center focus-within:outline focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-ma-gold-400">
                                    <input
                                      type="checkbox"
                                      className="h-[18px] w-[18px] cursor-pointer accent-ma-gold-500"
                                      checked={checked}
                                      aria-label={`${humanLabel(perm)} — ${role.libelle}`}
                                      onChange={() => toggle(role.id, perm.code)}
                                    />
                                  </label>
                                  {dirty && <span className="pointer-events-none absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-ma-gold-500" aria-hidden="true" />}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
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
          footer={(
            <>
              <Button variant="outline" onClick={() => setImpact(null)}>{t('common.cancel')}</Button>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? t('common.saving') : t('common.confirm')}
              </Button>
            </>
          )}
        >
          <p className="mb-3 text-sm">{impact?.confirmation}</p>
          <div className="space-y-3 text-sm">
            {(impact?.roles ?? []).map((row) => (
              <div key={row.id}>
                <p className="font-medium">
                  {row.libelle}
                  {typeof row.agentsCount === 'number' && (
                    <span className="ml-2 text-xs font-normal text-ma-muted">{t('adminUi.agentsCount', { count: row.agentsCount })}</span>
                  )}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {row.added.map((p) => (
                    <li key={`+${p.code}`} className="text-status-success">+ {p.libelle}</li>
                  ))}
                  {row.removed.map((p) => (
                    <li key={`-${p.code}`} className="text-status-danger">− {p.libelle}</li>
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
    <div className="min-w-[1180px]" aria-hidden="true">
      <div className="flex border-b border-ma-line/70" style={{ height: HEADER_H }}>
        <div className="w-[300px] shrink-0 bg-slate-100 dark:bg-white/5" />
        {Array.from({ length: columns }, (_, i) => (
          <div key={i} className="min-w-[88px] flex-1 bg-slate-100 dark:bg-white/5" />
        ))}
      </div>
      {Array.from({ length: 8 }, (_, row) => (
        <div key={row} className="flex border-b border-ma-line/40" style={{ height: ROW_H }}>
          <div className="w-[300px] shrink-0 px-3 py-3">
            <div className="h-3 w-40 rounded bg-slate-200 dark:bg-white/10" />
          </div>
          {Array.from({ length: columns }, (_, col) => (
            <div key={col} className="flex min-w-[88px] flex-1 items-center justify-center">
              <div className="h-[18px] w-[18px] rounded bg-slate-200 dark:bg-white/10" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
