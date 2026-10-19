import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Eye, Gauge, Megaphone, Truck, Users, Wallet, type LucideIcon } from 'lucide-react'
import { PageHeader } from '../../components/ui/page-header'
import { ScopeEmpty } from '../../components/ui/scope-empty'
import { StatCard } from '../../components/ui/stat-card'
import { Feedback } from '../../components/ui/feedback'
import { CellStack, Table, TableCard, TBody, Td, Th, THead, Tr } from '../../components/ui/table'
import { Stagger, StaggerItem } from '../../components/motion/page-fade'
import { fetchVitrine } from '../../lib/api/domain'
import { ApiError } from '../../lib/api/client'
import { useActiveSociety } from '../../lib/projects/use-active-society'
import { RequirePermission } from '../../lib/rbac/RequirePermission'
import { projectLabel } from '../../lib/rbac/rbac'
import { categorieLabel as rawCategorieLabel, kpiLabel } from '../../lib/vitrine/labels'
import { sentence } from '../../components/ui/badge'

const categorieLabel = (code: string) => {
  const label = rawCategorieLabel(code)
  return label === code ? sentence(code.replaceAll('_', ' ')) : label
}
import { StatSkeletons } from '../ops/charts'
import { cn } from '../../lib/utils'

const ACCENTS = ['gold', 'info', 'ok', 'warn'] as const

function iconFor(cle: string): LucideIcon {
  if (/abonn/.test(cle)) return Users
  if (/vue/.test(cle)) return Eye
  if (/course|coursier/.test(cle)) return Truck
  if (/revenu|usd|cdf/.test(cle)) return Wallet
  if (/campagne|media/.test(cle)) return Megaphone
  return Gauge
}

function toNumber(v: number | string | null) {
  if (typeof v === 'number') return v
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isNaN(n) ? null : n
}

export function MdrPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language === 'en' ? 'en-GB' : 'fr-FR'
  const { currentProject, name, isEnterprise, code } = useActiveSociety()
  const kpis = useQuery({ queryKey: ['vitrine', currentProject], queryFn: fetchVitrine })
  const rows = (kpis.data ?? []).filter((k) => isEnterprise || k.project?.code === code)
  const fmtDate = (iso?: string) => {
    if (!iso) return null
    const d = new Date(iso)
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  }
  return (
    <RequirePermission permission="VIEW_MARKETING_PERFORMANCE">
      <div className="space-y-6">
        <PageHeader kicker={t('pages.media.kicker')} title={t('pages.media.title')} subtitle={t('opsui.mdr.subtitle', 'Indicateurs média de {{name}}.', { name })} />
        {kpis.isError && <Feedback tone="danger">{kpis.error instanceof ApiError ? kpis.error.message : t('crud.loadFail')}</Feedback>}
        {kpis.isLoading ? (
          <StatSkeletons />
        ) : rows.length === 0 ? (
          <ScopeEmpty context={t('opsui.mdr.empty', 'Aucun indicateur publié pour « {{name}} ».', { name })} />
        ) : (
          <>
            <Stagger className={cn('grid grid-cols-2 gap-3 sm:gap-4 [&>*>*]:h-full', rows.length === 5 ? 'lg:grid-cols-3 2xl:grid-cols-5' : 'xl:grid-cols-4')}>
              {rows.map((k, i) => {
                const Icon = iconFor(k.cle)
                const value = toNumber(k.valeur)
                const hint = `${categorieLabel(k.categorie)} · ${projectLabel(k.project?.code ?? null)}`
                return (
                  <StaggerItem key={k.id}>
                    {value != null ? (
                      <StatCard label={kpiLabel(k.cle, k.categorie)} value={value} hint={hint} accent={ACCENTS[i % 4]} icon={<Icon />} />
                    ) : (
                      <div className="clay flex min-h-[132px] flex-col rounded-[var(--radius-ma)] p-5 ring-1 ring-hairline">
                        <p className="text-[12.5px] font-medium text-ink-3">{kpiLabel(k.cle, k.categorie)}</p>
                        <p className="mt-auto pt-3 text-[22px] font-semibold tracking-[-0.03em] text-ink">{k.valeur ?? <span className="text-ink-3">–</span>}</p>
                        <p className="mt-2 text-[12px] text-ink-3">{hint}</p>
                      </div>
                    )}
                  </StaggerItem>
                )
              })}
            </Stagger>
            <TableCard
              toolbar={
                <div>
                  <h2 className="text-[15px] font-semibold tracking-[-0.015em] text-ink">{t('opsui.mdr.detail', 'Détail des indicateurs')}</h2>
                  <p className="mt-0.5 text-[12.5px] text-ink-3">{t('opsui.mdr.detailHint', 'Valeurs publiées sur la vitrine, avec leur dernière mise à jour.')}</p>
                </div>
              }
            >
              <Table minWidth={620}>
                <THead>
                  <tr>
                    <Th>{t('opsui.mdr.indicator', 'Indicateur')}</Th>
                    <Th>{t('opsui.mdr.category', 'Catégorie')}</Th>
                    <Th align="right">{t('opsui.mdr.value', 'Valeur')}</Th>
                    <Th>{t('opsui.mdr.updated', 'Mis à jour')}</Th>
                  </tr>
                </THead>
                <TBody>
                  {rows.map((k) => (
                    <Tr key={k.id}>
                      <Td>
                        <CellStack title={kpiLabel(k.cle, k.categorie)} meta={projectLabel(k.project?.code ?? null)} />
                      </Td>
                      <Td className="text-ink-2">{categorieLabel(k.categorie)}</Td>
                      <Td align="right" className="font-semibold tabular-nums">
                        {toNumber(k.valeur) != null ? toNumber(k.valeur)!.toLocaleString('fr-FR') : (k.valeur ?? <span className="text-ink-3">–</span>)}
                      </Td>
                      <Td className="whitespace-nowrap tabular-nums text-ink-3">{fmtDate(k.derniereMaj) ?? '–'}</Td>
                    </Tr>
                  ))}
                </TBody>
              </Table>
            </TableCard>
          </>
        )}
      </div>
    </RequirePermission>
  )
}
