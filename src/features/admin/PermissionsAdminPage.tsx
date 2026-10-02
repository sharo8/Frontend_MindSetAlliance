import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader } from '../../components/ui/card'
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

const ROLE_COL = 'box-border w-[116px] min-w-[116px] max-w-[116px] px-2 text-center'
const TABLE = 'table-fixed border-separate border-spacing-0 text-left text-sm'
const ROLE_PX = 116
const HEADER_H = 'h-[72px] box-border'
const SECTION_H = 'h-[36px] box-border'
const ROW_H = 'h-[56px] box-border'

function tablePixelWidth(roleCount: number) {
  return Math.max(roleCount, 0) * ROLE_PX
}

function ColGroup({ roleCount }: { roleCount: number }) {
  return (
    <colgroup>
      {Array.from({ length: roleCount }, (_, i) => (
        <col key={i} style={{ width: ROLE_PX }} />
      ))}
    </colgroup>
  )
}

export function PermissionsAdminPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [matrix, setMatrix] = useState<Record<number, string[]>>({})
  const [baseline, setBaseline] = useState<Record<number, string[]>>({})
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [impact, setImpact] = useState<MatrixImpact | null>(null)
  const headScroll = useRef<HTMLDivElement>(null)
  const bodyScroll = useRef<HTMLDivElement>(null)

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

  const dirty = useMemo(() => {
    return (roles.data ?? []).some((role) => !sameSet(matrix[role.id] ?? [], baseline[role.id] ?? []))
  }, [roles.data, matrix, baseline])

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

  function toggle(roleId: number, code: string) {
    setMatrix((prev) => {
      const current = prev[roleId] ?? []
      return {
        ...prev,
        [roleId]: current.includes(code) ? current.filter((c) => c !== code) : [...current, code],
      }
    })
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
  const matrixWidth = tablePixelWidth(roleList.length)

  useEffect(() => {
    const head = headScroll.current
    const body = bodyScroll.current
    if (!head || !body) return
    const onBody = () => {
      if (head.scrollLeft !== body.scrollLeft) head.scrollLeft = body.scrollLeft
    }
    const onHead = () => {
      if (body.scrollLeft !== head.scrollLeft) body.scrollLeft = head.scrollLeft
    }
    body.addEventListener('scroll', onBody, { passive: true })
    head.addEventListener('scroll', onHead, { passive: true })
    return () => {
      body.removeEventListener('scroll', onBody)
      head.removeEventListener('scroll', onHead)
    }
  }, [roleList.length])

  return (
    <RequirePermission permission="MANAGE_PERMISSIONS">
      <div className="space-y-4">
        <PageHeader
          kicker={t('pages.permissions.kicker')}
          title={t('pages.permissions.title')}
          subtitle={t('pages.permissions.subtitle')}
          actions={
            <Button
              disabled={save.isPending || preview.isPending || !dirty}
              onClick={() => preview.mutate()}
            >
              {preview.isPending ? t('adminUi.analyzing') : t('adminUi.saveChanges')}
            </Button>
          }
        />
        {notice && <Feedback tone="success">{notice}</Feedback>}
        {error && <Feedback tone="danger">{error}</Feedback>}
        {!dirty && (
          <p className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-white/40">
            <Check className="h-3.5 w-3.5 text-status-success/80" strokeWidth={2.5} />
            {t('adminUi.noPending')}
          </p>
        )}
        {dirty && localDiffs.length > 0 && (
          <Card>
            <CardHeader>
              <h2 className="font-semibold">{t('adminUi.pendingChanges')}</h2>
            </CardHeader>
            <CardBody className="space-y-3 text-sm">
              {localDiffs.map((row) => (
                <div key={row.id}>
                  <p className="mb-1 font-medium">{row.libelle}</p>
                  <ul className="space-y-0.5">
                    {row.added.map((p) => (
                      <li key={`+${p.code}`} className="text-status-success">+ {p.libelle}</li>
                    ))}
                    {row.removed.map((p) => (
                      <li key={`-${p.code}`} className="text-status-danger">− {p.libelle}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardBody>
          </Card>
        )}
        <Card>
          <CardHeader>
            <h2 className="font-semibold">{t('adminUi.matrixTitle')}</h2>
          </CardHeader>
          <div className="flex min-w-0">
            <div className="relative z-20 w-[280px] shrink-0 overflow-hidden border-r-2 border-ma-navy-800/20 bg-white shadow-[8px_0_12px_-6px_rgba(15,23,42,0.28)] dark:border-ma-gold-500/25 dark:bg-ma-navy-950">
              <div className={`sticky top-0 z-40 flex ${HEADER_H} items-center border-b border-ma-line/80 bg-white px-4 dark:border-white/10 dark:bg-ma-navy-950`}>
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">{t('adminUi.permissionCol')}</span>
              </div>
              {grouped.map(([module, perms], sectionIndex) => {
                const gold = sectionIndex % 2 === 0
                const headBg = gold
                  ? 'bg-[#fbf6e8] text-ma-navy-900 dark:bg-ma-gold-500/15 dark:text-ma-gold-300'
                  : 'bg-ma-navy-800/[0.06] text-ma-navy-900 dark:bg-ma-navy-900 dark:text-ma-gold-200'
                const accent = gold
                  ? 'border-l-[5px] border-ma-gold-500'
                  : 'border-l-[5px] border-ma-navy-800 dark:border-ma-gold-500/70'
                return (
                  <Fragment key={`label-${module}`}>
                    <div className={`flex ${SECTION_H} items-center ${headBg} ${accent} px-4 text-[11px] font-semibold uppercase tracking-[0.16em]`}>
                      {module}
                    </div>
                    {perms.map((perm, rowIndex) => {
                      const zebra = rowIndex % 2 === 1
                      const rowBg = zebra
                        ? 'bg-slate-50 dark:bg-ma-navy-900'
                        : 'bg-white dark:bg-ma-navy-950'
                      return (
                        <div key={perm.id} className={`flex ${ROW_H} flex-col justify-center ${rowBg} px-4 pr-5`}>
                          <span className="block overflow-hidden text-[13px] font-medium leading-snug text-ma-navy-900 dark:text-white">
                            {humanLabel(perm)}
                          </span>
                          <span className="mt-1.5 block overflow-hidden font-mono text-[10px] leading-none text-slate-400 dark:text-white/35">
                            {perm.code}
                          </span>
                        </div>
                      )
                    })}
                  </Fragment>
                )
              })}
            </div>
            <div className="min-w-0 flex-1">
              <div className="sticky top-0 z-30 bg-white dark:bg-ma-navy-950">
                <div ref={headScroll} className="ma-matrix-hscroll ma-matrix-hscroll-hide">
                  <table className={TABLE} style={{ width: matrixWidth }}>
                    <ColGroup roleCount={roleList.length} />
                    <thead>
                      <tr>
                        {roleList.map((role) => (
                          <th key={role.id} data-ma-role-col={role.id} className={`${ROLE_COL} ${HEADER_H} border-b border-ma-line/80 bg-white p-0 dark:border-white/10 dark:bg-ma-navy-950`}>
                            <span className="mx-auto block max-w-[100px] overflow-hidden text-ellipsis text-[12px] font-semibold leading-tight text-ma-navy-900 dark:text-white">
                              {role.libelle}
                            </span>
                            <Badge tone="navy" className="mt-1.5 normal-case tracking-normal">
                              {t('adminUi.agentsCount', { count: role.agentsCount ?? 0 })}
                            </Badge>
                          </th>
                        ))}
                      </tr>
                    </thead>
                  </table>
                </div>
              </div>
              <div ref={bodyScroll} className="ma-matrix-hscroll">
                <table className={TABLE} style={{ width: matrixWidth }}>
                  <ColGroup roleCount={roleList.length} />
                  <tbody>
                    {grouped.map(([module, perms], sectionIndex) => {
                      const gold = sectionIndex % 2 === 0
                      const headBg = gold
                        ? 'bg-[#fbf6e8] dark:bg-ma-gold-500/15'
                        : 'bg-ma-navy-800/[0.06] dark:bg-ma-navy-900'
                      return (
                        <Fragment key={`cells-${module}`}>
                          <tr>
                            <td colSpan={Math.max(roleList.length, 1)} className={`${headBg} ${SECTION_H} p-0`} />
                          </tr>
                          {perms.map((perm, rowIndex) => {
                            const zebra = rowIndex % 2 === 1
                            const rowBg = zebra
                              ? 'bg-slate-50 dark:bg-ma-navy-900'
                              : 'bg-white dark:bg-ma-navy-950'
                            return (
                              <tr key={perm.id} className={ROW_H}>
                                {roleList.map((role) => {
                                  const checked = (matrix[role.id] ?? []).includes(perm.code)
                                  return (
                                    <td key={role.id} data-ma-role-col={role.id} className={`${ROLE_COL} ${ROW_H} ${rowBg} p-0 align-middle`}>
                                      <input
                                        type="checkbox"
                                        className="mx-auto block h-4 w-4 cursor-pointer accent-ma-gold-500 transition duration-150 ease-out"
                                        checked={checked}
                                        onChange={() => toggle(role.id, perm.code)}
                                      />
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
              </div>
            </div>
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
