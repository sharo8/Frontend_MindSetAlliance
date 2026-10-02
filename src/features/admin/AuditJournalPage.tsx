import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, CardBody } from '../../components/ui/card'
import { PageHeader } from '../../components/ui/page-header'
import { fetchAudit } from '../../lib/api/ops'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { Button } from '../../components/ui/button'
import { Badge, auditActionTone } from '../../components/ui/badge'
import { cn } from '../../lib/utils'

export function AuditJournalPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(0)
  const [params] = useSearchParams()
  const logId = params.get('logId') ?? undefined
  const objetId = params.get('objetId') ?? undefined
  const logs = useQuery({
    queryKey: ['audit', page, logId, objetId],
    queryFn: () => fetchAudit(page, { logId, objetId }),
  })
  return (
    <RequirePermission permission="VIEW_AUDIT">
      <div className="space-y-4">
        <PageHeader kicker={t('pages.audit.kicker')} title={t('pages.audit.title')} subtitle={t('pages.audit.subtitle')} />
        <Card>
          <CardBody className="overflow-x-auto p-0">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">
                <tr>
                  <th className="px-4 py-3">Horodatage</th>
                  <th className="px-4 py-3">Auteur</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Objet</th>
                  <th className="px-4 py-3">Id</th>
                  <th className="px-4 py-3">Détail</th>
                </tr>
              </thead>
              <tbody>
                {(logs.data?.content ?? []).map((row) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-t border-ma-line/80',
                      row.highlighted && 'bg-ma-gold-500/10',
                    )}
                  >
                    <td className="px-4 py-2 font-mono text-xs">{row.createdAt}</td>
                    <td className="px-4 py-2">{row.agent?.nom || row.agent?.emailPro || '—'}</td>
                    <td className="px-4 py-2">
                      <span className="block font-medium">{row.actionLibelle || row.action}</span>
                      <Badge tone={auditActionTone(row.action)} className="mt-0.5 font-mono text-[10px] normal-case tracking-normal">
                        {row.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-2">{row.objetType}</td>
                    <td className="px-4 py-2">{row.objetId ?? '—'}</td>
                    <td className="px-4 py-2 text-xs text-ma-muted">
                      {typeof row.valeurApres?.entite === 'string' ? row.valeurApres.entite : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
        <div className="flex gap-2">
          <Button variant="outline" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Précédent
          </Button>
          <Button variant="outline" disabled={(logs.data?.number ?? 0) + 1 >= (logs.data?.totalPages ?? 1)} onClick={() => setPage((p) => p + 1)}>
            Suivant
          </Button>
        </div>
      </div>
    </RequirePermission>
  )
}
