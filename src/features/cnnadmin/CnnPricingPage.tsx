import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Calculator, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card, CardBody, CardHeader, CardTitle } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Input, Select } from '../../components/ui/input'
import { Skeleton } from '../../components/ui/skeleton'
import { Toast } from '../../components/ui/toast'
import { CurrencyFlag, type CurrencyCode } from '../../components/ui/flags'
import { cnnOps, useCnnRelay, type CnnPricing, type CnnPricingUpdate } from '../../lib/api/cnnAdmin'
import { CnnAdminHeader, ConfirmDialog, RelayNotice, fmtDateTime, relayErrorMessage, useLocaleTag, useRelayMutation } from './shared'

type Key = 'pricePerKm' | 'minimumPrice' | 'sensitiveMultiplier' | 'secretMultiplier' | 'returnTripMultiplier' | 'fragileMultiplier' | 'weightMultiplierPerKg'
type Draft = Record<Key, string> & { extra: { key: string; value: string }[] }

const KEYS: Key[] = ['pricePerKm', 'minimumPrice', 'sensitiveMultiplier', 'secretMultiplier', 'returnTripMultiplier', 'fragileMultiplier', 'weightMultiplierPerKg']
/** Plancher absolu appliqué par Colis na Nga, quel que soit le taux de change. */
const MIN_CDF = 4000

function toDraft(p: CnnPricing): Draft {
  const d = Object.fromEntries(KEYS.map((k) => [k, p[k] != null ? String(p[k]) : ''])) as Record<Key, string>
  return { ...d, extra: Object.entries(p.extraMultipliers ?? {}).map(([key, value]) => ({ key, value: String(value) })) }
}

const n = (v: string) => (v.trim() === '' ? null : Number(v.replace(',', '.')))

/** Même calcul que PricingCalculatorService (backend Colis na Nga), pour prévisualiser un prix. */
function simulate(d: Draft, rate: number | null, input: { km: number; type: string; returnTrip: boolean; fragile: boolean; weight: number }) {
  const ppk = n(d.pricePerKm) ?? 0
  const min = n(d.minimumPrice) ?? 0
  let mult = 1
  if (input.type === 'SENSITIVE') mult *= n(d.sensitiveMultiplier) ?? 1
  if (input.type === 'SECRET') mult *= n(d.secretMultiplier) ?? 1
  if (input.returnTrip) mult *= n(d.returnTripMultiplier) ?? 1
  if (input.fragile) {
    const fm = n(d.fragileMultiplier)
    mult *= fm != null && fm > 0 ? fm : 1.5
  }
  const calculated = ppk * input.km * mult
  const minimumForType = Math.round(min * mult * 100) / 100
  const usd = Math.round(Math.max(calculated, minimumForType) * 100) / 100
  const base = rate ? Math.max(MIN_CDF, Math.round(usd * rate)) : null
  const wpk = n(d.weightMultiplierPerKg) ?? 0
  const weight = input.weight > 0 && wpk > 0 ? Math.round(input.weight * wpk) : 0
  return { mult, calculated, minimumForType, usd, base, weight, total: base == null ? null : base + weight, floorApplied: base === MIN_CDF }
}

/** Tarification des courses Colis na Nga : prix au kilomètre, minimum, coefficients. */
export function CnnPricingPage() {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const enabled = relay.writable && relay.can('MANAGE_CNN_SETTINGS', 'VIEW')
  const pricing = useQuery({ queryKey: ['cnn-ops', 'pricing'], queryFn: cnnOps.pricing, enabled })
  const rates = useQuery({ queryKey: ['cnn-ops', 'exchange-rates'], queryFn: cnnOps.exchangeRates, enabled, staleTime: 300_000 })
  const [edits, setDraft] = useState<Draft | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sim, setSim] = useState({ km: '5', type: 'STANDARD', returnTrip: false, fragile: false, weight: '' })
  const canEdit = relay.can('MANAGE_CNN_SETTINGS', 'UPDATE')

  const original = useMemo(() => (pricing.data ? toDraft(pricing.data) : null), [pricing.data])
  // Brouillon : les valeurs saisies, sinon celles enregistrées dans Colis na Nga.
  const draft = edits ?? original
  const edit = (fn: (d: Draft) => Draft) => setDraft((cur) => {
    const base = cur ?? original
    return base ? fn(base) : cur
  })
  const dirty = Boolean(draft && original && JSON.stringify(draft) !== JSON.stringify(original))
  const invalid = Boolean(
    draft && (KEYS.some((k) => draft[k].trim() !== '' && (!Number.isFinite(n(draft[k])) || (n(draft[k]) ?? 0) < 0)) || draft.extra.some((e) => !e.key.trim() || !Number.isFinite(n(e.value)))),
  )
  const rate = pricing.data?.usdToCdfRate ?? rates.data?.usdToCdf ?? null

  const save = useRelayMutation(
    (body: CnnPricingUpdate) => cnnOps.updatePricing(body),
    [['cnn-ops', 'pricing']],
    (m, e) => {
      if (m) {
        setNotice(m)
        setConfirm(false)
        setDraft(null)
      }
      setError(e)
    },
    t('cnnPricing.saved', 'Tarification mise à jour. Les prochaines commandes utilisent ces valeurs.'),
  )
  const body = (): CnnPricingUpdate => {
    if (!draft) return {}
    const out: CnnPricingUpdate = {}
    for (const k of KEYS) {
      const v = n(draft[k])
      if (v != null) out[k] = v
    }
    out.extraMultipliers = Object.fromEntries(draft.extra.map((e) => [e.key.trim(), Number(n(e.value))]))
    return out
  }

  const simInput = { km: Math.max(0, Number(n(sim.km) ?? 0)), type: sim.type, returnTrip: sim.returnTrip, fragile: sim.fragile, weight: Math.max(0, Number(n(sim.weight) ?? 0)) }
  const now = original ? simulate(original, rate, simInput) : null
  const next = draft ? simulate(draft, rate, simInput) : null
  const fc = (v: number | null | undefined) => (v == null ? '–' : `${Math.round(v).toLocaleString(locale)} FC`)
  const withFlag = (code: CurrencyCode, text: string) => (
    <span className="inline-flex items-center gap-1.5">
      <CurrencyFlag code={code} />
      {text}
    </span>
  )
  const usd = (v: number | null | undefined) => (v == null ? '–' : `${v.toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`)

  const field = (k: Key, label: string, unit: string, hint?: string, flag?: CurrencyCode) => (
    <label key={k} className="block">
      <FieldLabel hint={hint}>{label}</FieldLabel>
      <div className="relative">
        <Input
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          disabled={!canEdit}
          value={draft?.[k] ?? ''}
          onChange={(e) => edit((d) => ({ ...d, [k]: e.target.value }))}
          className="pr-24"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center gap-1.5 text-[12px] text-ink-3">
          {flag && <CurrencyFlag code={flag} />}
          {unit}
        </span>
      </div>
      {original && draft && original[k] !== draft[k] && <span className="mt-1 block text-[11.5px] text-ink-3">{t('cnnPricing.before', 'Avant : {{v}}', { v: original[k] || '–' })}</span>}
    </label>
  )

  return (
    <div className="space-y-6">
      <CnnAdminHeader
        title={t('cnnPricing.title', 'Tarification')}
        subtitle={t('cnnPricing.subtitle', 'Prix des courses calculés par l’application Colis na Nga : base en dollars, convertie en francs congolais au taux du jour.')}
        actions={
          canEdit && (
            <>
              <Button variant="ghost" size="sm" disabled={!dirty || save.isPending} onClick={() => setDraft(null)}>
                <RotateCcw className="h-4 w-4" />
                {t('cnnPricing.reset', 'Annuler les changements')}
              </Button>
              <Button size="sm" disabled={!dirty || invalid || save.isPending} onClick={() => setConfirm(true)}>
                <Save className="h-4 w-4" />
                {t('cnnPricing.save', 'Enregistrer')}
              </Button>
            </>
          )
        }
      />
      <RelayNotice />
      {(pricing.isError || rates.isError) && <Feedback tone="danger">{relayErrorMessage(pricing.error ?? rates.error, (k, v) => t(k, v))}</Feedback>}
      {invalid && <Feedback tone="warning">{t('cnnPricing.invalid', 'Vérifiez les valeurs : nombres positifs uniquement, chaque coefficient supplémentaire doit avoir un nom.')}</Feedback>}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle
                title={t('cnnPricing.base', 'Prix de base')}
                subtitle={t('cnnPricing.baseSub', 'Prix = distance × prix au km × coefficients, jamais en dessous du minimum (lui aussi multiplié par les coefficients).')}
                action={pricing.data?.updatedAt ? <Badge tone="muted">{t('cnnPricing.updated', 'Modifié le {{d}}', { d: fmtDateTime(pricing.data.updatedAt, locale) })}</Badge> : undefined}
              />
            </CardHeader>
            <CardBody>
              {!draft ? (
                <Skeleton className="h-24 w-full rounded-[14px]" />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {field('pricePerKm', t('cnnPricing.pricePerKm', 'Prix au kilomètre'), 'USD / km', undefined, 'USD')}
                  {field('minimumPrice', t('cnnPricing.minimumPrice', 'Prix minimum d’une course'), 'USD', t('cnnPricing.floorHint', 'Plancher : 4 000 FC'), 'USD')}
                  {field('weightMultiplierPerKg', t('cnnPricing.weight', 'Supplément par kilo'), 'FC / kg', t('cnnPricing.weightHint', 'Ajouté après conversion'), 'CDF')}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle title={t('cnnPricing.multipliers', 'Coefficients')} subtitle={t('cnnPricing.multipliersSub', 'Multiplient le prix selon le colis ou le trajet. 1 = pas de changement, 1,5 = 50 % de plus.')} />
            </CardHeader>
            <CardBody>
              {!draft ? (
                <Skeleton className="h-24 w-full rounded-[14px]" />
              ) : (
                <div className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {field('sensitiveMultiplier', t('cnnPricing.sensitive', 'Colis sensible'), '×')}
                    {field('secretMultiplier', t('cnnPricing.secret', 'Colis secret'), '×')}
                    {field('returnTripMultiplier', t('cnnPricing.returnTrip', 'Aller-retour'), '×')}
                    {field('fragileMultiplier', t('cnnPricing.fragile', 'Colis fragile'), '×', t('cnnPricing.fragileHint', '1,5 si vide ou 0'))}
                  </div>
                  <div>
                    <div className="mb-2 flex items-center gap-2">
                      <p className="text-[13px] font-semibold text-ink">{t('cnnPricing.extra', 'Coefficients supplémentaires')}</p>
                      {canEdit && (
                        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => edit((d) => ({ ...d, extra: [...d.extra, { key: '', value: '1' }] }))}>
                          <Plus className="h-4 w-4" />
                          {t('cnnPricing.addExtra', 'Ajouter')}
                        </Button>
                      )}
                    </div>
                    {draft.extra.length === 0 ? (
                      <p className="text-[12.5px] text-ink-3">{t('cnnPricing.noExtra', 'Aucun coefficient supplémentaire enregistré.')}</p>
                    ) : (
                      <ul className="space-y-2">
                        {draft.extra.map((e, i) => (
                          <li key={i} className="flex items-center gap-2">
                            <Input
                              value={e.key}
                              disabled={!canEdit}
                              placeholder={t('cnnPricing.extraName', 'Nom (ex. NIGHT)')}
                              onChange={(ev) => edit((d) => ({ ...d, extra: d.extra.map((x, j) => (j === i ? { ...x, key: ev.target.value } : x)) }))}
                            />
                            <Input
                              type="number"
                              step="0.01"
                              className="w-28"
                              disabled={!canEdit}
                              value={e.value}
                              onChange={(ev) => edit((d) => ({ ...d, extra: d.extra.map((x, j) => (j === i ? { ...x, value: ev.target.value } : x)) }))}
                            />
                            {canEdit && (
                              <Button variant="ghost" size="icon" aria-label={t('cnnAdmin.common.delete', 'Supprimer')} onClick={() => edit((d) => ({ ...d, extra: d.extra.filter((_, j) => j !== i) }))}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                    <p className="mt-2 text-[11.5px] text-ink-3">{t('cnnPricing.extraNote', 'Enregistrés dans la configuration de l’application ; le calcul actuel du prix ne les applique pas encore.')}</p>
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle title={t('cnnPricing.rate', 'Taux de change')} subtitle={t('cnnPricing.rateSub', 'Mis à jour automatiquement par Colis na Nga')} />
            </CardHeader>
            <CardBody>
              {rates.isLoading && enabled ? (
                <Skeleton className="h-12 w-full rounded-[12px]" />
              ) : (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
                  <span className="inline-flex items-center gap-2.5 text-[20px] font-semibold tabular-nums text-ink">
                    <CurrencyFlag code="USD" className="h-[20px] w-[30px]" />
                    1 USD
                  </span>
                  <span className="text-[18px] text-ink-3">=</span>
                  <span className="inline-flex items-center gap-2.5 text-[20px] font-semibold tabular-nums text-ink">
                    <CurrencyFlag code="CDF" className="h-[20px] w-[30px]" />
                    {rate != null ? `${Number(rate).toLocaleString(locale, { maximumFractionDigits: 2 })} FC` : '–'}
                  </span>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle
                title={
                  <span className="inline-flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    {t('cnnPricing.simulator', 'Simulateur de prix')}
                  </span>
                }
                subtitle={t('cnnPricing.simulatorSub', 'Même calcul que l’application, avec les valeurs ci-contre.')}
              />
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <FieldLabel>{t('cnnPricing.distance', 'Distance')}</FieldLabel>
                  <div className="relative">
                    <Input type="number" min="0" step="0.1" value={sim.km} onChange={(e) => setSim((s) => ({ ...s, km: e.target.value }))} className="pr-10" />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-ink-3">km</span>
                  </div>
                </label>
                <label className="block">
                  <FieldLabel>{t('cnnPricing.weightLabel', 'Poids')}</FieldLabel>
                  <div className="relative">
                    <Input type="number" min="0" step="0.1" value={sim.weight} placeholder="0" onChange={(e) => setSim((s) => ({ ...s, weight: e.target.value }))} className="pr-10" />
                    <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-ink-3">kg</span>
                  </div>
                </label>
                <label className="col-span-2 block">
                  <FieldLabel>{t('cnnPricing.parcelType', 'Type de colis')}</FieldLabel>
                  <Select value={sim.type} onChange={(e) => setSim((s) => ({ ...s, type: e.target.value }))}>
                    {['STANDARD', 'DOCUMENT', 'SENSITIVE', 'SECRET'].map((p) => (
                      <option key={p} value={p}>
                        {t(`cnnStats.parcel.${p}`, { defaultValue: p })}
                      </option>
                    ))}
                  </Select>
                </label>
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  <input type="checkbox" checked={sim.returnTrip} onChange={(e) => setSim((s) => ({ ...s, returnTrip: e.target.checked }))} />
                  {t('cnnPricing.returnTrip', 'Aller-retour')}
                </label>
                <label className="flex items-center gap-2 text-[13px] text-ink-2">
                  <input type="checkbox" checked={sim.fragile} onChange={(e) => setSim((s) => ({ ...s, fragile: e.target.checked }))} />
                  {t('cnnPricing.fragile', 'Colis fragile')}
                </label>
              </div>
              {next && (
                <div className="clay-field space-y-1.5 rounded-[14px] p-3.5 text-[12.5px]">
                  <Row label={t('cnnPricing.coef', 'Coefficient total')} value={`× ${next.mult.toLocaleString(locale, { maximumFractionDigits: 3 })}`} />
                  <Row label={t('cnnPricing.calc', 'Distance × prix au km × coefficient')} value={usd(next.calculated)} />
                  <Row label={t('cnnPricing.minForType', 'Minimum pour ce colis')} value={usd(next.minimumForType)} />
                  <Row label={t('cnnPricing.retained', 'Prix retenu')} value={withFlag('USD', usd(next.usd))} strong />
                  <Row label={t('cnnPricing.converted', 'Converti en francs')} value={rate ? withFlag('CDF', fc(next.base)) : t('cnnPricing.noRate', 'taux indisponible')} note={next.floorApplied ? t('cnnPricing.floorApplied', 'plancher de 4 000 FC appliqué') : undefined} />
                  {next.weight > 0 && <Row label={t('cnnPricing.weightAdd', 'Supplément poids')} value={`+ ${fc(next.weight)}`} />}
                  <div className="!mt-2.5 flex items-baseline justify-between border-t border-hairline pt-2.5">
                    <span className="text-[13px] font-semibold text-ink">{t('cnnPricing.clientPays', 'Prix payé par le client')}</span>
                    <span className="inline-flex items-center gap-2 text-[20px] font-semibold tabular-nums tracking-[-0.02em] text-ink">
                      <CurrencyFlag code="CDF" className="h-[16px] w-[24px]" />
                      {fc(next.total)}
                    </span>
                  </div>
                  {dirty && now && now.total !== next.total && (
                    <p className="text-right text-[12px] text-ink-3">{t('cnnPricing.currently', 'Aujourd’hui : {{p}}', { p: fc(now.total) })}</p>
                  )}
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <ConfirmDialog
        open={confirm}
        title={t('cnnPricing.confirmTitle', 'Appliquer la nouvelle tarification ?')}
        message={t('cnnPricing.confirmMessage', 'Les prix de toutes les nouvelles commandes Colis na Nga seront calculés avec ces valeurs, immédiatement. Les commandes déjà créées ne changent pas.')}
        confirmLabel={t('cnnPricing.apply', 'Appliquer')}
        busy={save.isPending}
        error={error}
        onClose={() => {
          setConfirm(false)
          setError(null)
        }}
        onConfirm={() => save.mutate(body())}
      />
      <Toast message={notice} onDismiss={() => setNotice(null)} />
    </div>
  )
}

function Row({ label, value, note, strong }: { label: string; value: ReactNode; note?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-3">
        {label}
        {note && <span className="ml-1 text-[11px]">({note})</span>}
      </span>
      <span className={strong ? 'font-semibold tabular-nums text-ink' : 'tabular-nums text-ink-2'}>{value}</span>
    </div>
  )
}
