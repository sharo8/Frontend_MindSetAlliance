import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Bike, Check } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { CurrencyFlag } from '../../components/ui/flags'
import { FieldLabel, Input, Select } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { cnnOps, useCnnRelay, type CnnSubscription, type CnnSubscriptionInput, type SubscriptionStatus } from '../../lib/api/cnnAdmin'
import { cn } from '../../lib/utils'
import { useLocaleTag } from './shared'

type Currency = 'USD' | 'CDF'
type Form = { planName: string; currency: Currency; monthlyPrice: string; coursesLimit: string; allowCustomDuration: boolean; pricePerCourse: string; status: SubscriptionStatus }

const EMPTY: Form = { planName: '', currency: 'USD', monthlyPrice: '25', coursesLimit: '', allowCustomDuration: false, pricePerCourse: '', status: 'ACTIVE' }

/**
 * Création et modification d'un abonnement : mêmes champs, mêmes valeurs par défaut et mêmes règles
 * que la fenêtre « Créer un abonnement » de l'admin Colis na Nga (onglet Abonnements) :
 * nom du pack, devise USD ou FC avec conversion au taux du jour, prix, courses incluses,
 * durée personnalisée, prix par course facultatif, refus des doublons (même prix et mêmes courses).
 */
export function SubscriptionPlanModal({
  open,
  plan,
  plans,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean
  plan: CnnSubscription | null
  plans: CnnSubscription[]
  busy: boolean
  error: string | null
  onSubmit: (body: CnnSubscriptionInput) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const locale = useLocaleTag()
  const relay = useCnnRelay()
  const rates = useQuery({ queryKey: ['cnn-ops', 'exchange-rates'], queryFn: cnnOps.exchangeRates, enabled: open && relay.writable, staleTime: 300_000 })
  const rate = rates.data?.usdToCdf ? Number(rates.data.usdToCdf) : null
  const [form, setForm] = useState<Form>(EMPTY)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    if (!open) return
    setMissing(false)
    setForm(
      plan
        ? {
            planName: plan.planType ?? '',
            currency: (plan.currency === 'CDF' ? 'CDF' : 'USD') as Currency,
            monthlyPrice: plan.monthlyPrice != null ? String(plan.monthlyPrice) : '',
            coursesLimit: plan.coursesLimit != null ? String(plan.coursesLimit) : '',
            allowCustomDuration: Boolean(plan.allowCustomDuration),
            pricePerCourse: plan.pricePerCourse != null ? String(plan.pricePerCourse) : '',
            status: plan.status,
          }
        : EMPTY,
    )
    // Réinitialisé seulement à l'ouverture.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const price = Number(form.monthlyPrice) || 0
  const courses = form.coursesLimit ? Number(form.coursesLimit) : null
  const sym = form.currency === 'USD' ? '$' : 'FC'

  // Changer de devise convertit le prix au taux du jour (comme dans l'application).
  const switchCurrency = (cur: Currency) => {
    if (cur === form.currency) return
    let converted = price
    if (rate && cur === 'CDF') converted = Math.round(price * rate)
    if (rate && cur === 'USD') converted = Math.round((price / rate) * 100) / 100
    setForm((f) => ({ ...f, currency: cur, monthlyPrice: String(converted) }))
  }

  // Doublon : même prix (comparé en francs) et même nombre de courses qu'un abonnement existant.
  const toCdf = (p: number, cur: string) => (cur === 'CDF' ? p : rate ? p * rate : p)
  const duplicate =
    price > 0 &&
    plans.some((s) => {
      if (plan && s.id === plan.id) return false
      if (!s.monthlyPrice) return false
      const samePrice = Math.abs(toCdf(Number(s.monthlyPrice), s.currency ?? 'USD') - toCdf(price, form.currency)) < 1
      return samePrice && (s.coursesLimit ?? null) === courses
    })

  const submit = () => {
    if (!(price > 0)) {
      setMissing(true)
      return
    }
    const body: CnnSubscriptionInput = {
      planType: form.planName.trim() || undefined,
      monthlyPrice: price,
      status: plan ? form.status : 'ACTIVE',
      currency: form.currency,
      coursesLimit: form.coursesLimit ? Number(form.coursesLimit) : undefined,
      allowCustomDuration: form.allowCustomDuration,
      pricePerCourse: form.pricePerCourse ? Number(form.pricePerCourse) : undefined,
    }
    // L'API réécrit tout l'abonnement : on renvoie aussi ses dates pour ne pas les effacer.
    if (plan) {
      body.startDate = plan.startDate ?? undefined
      body.expirationDate = plan.expirationDate ?? undefined
    }
    onSubmit(body)
  }

  const label = 'text-[12px] font-semibold uppercase tracking-[0.05em] text-ink-2'
  const hint = 'mt-1.5 block text-[12px] leading-relaxed text-ink-3'

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Colis na Nga"
      title={plan ? plan.planType || t('cnnSubs.planShort', 'Formule') : t('cnnSubs.createTitle', 'Créer un abonnement')}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('cnnAdmin.common.cancel', 'Annuler')}
          </Button>
          <Button variant="gold" disabled={busy || duplicate} onClick={submit}>
            {busy ? t('cnnAdmin.common.working', 'Envoi…') : plan ? t('cnnAdmin.common.save', 'Enregistrer') : t('cnnSubs.createSubmit', 'Créer l’abonnement')}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Nom du pack */}
        <label className="block">
          <span className={label}>{t('cnnSubs.packName', 'Nom du pack')}</span>
          <Input className="mt-1.5" value={form.planName} placeholder={t('cnnSubs.packPlaceholder', 'ex : Pack Starter')} onChange={(e) => set('planName', e.target.value)} />
        </label>

        {/* Devise */}
        <div>
          <span className={label}>{t('cnnSubs.currency', 'Devise')}</span>
          <div className="clay-field mt-1.5 grid grid-cols-2 gap-1 rounded-[12px] p-1">
            {(['USD', 'CDF'] as Currency[]).map((cur) => (
              <button
                key={cur}
                type="button"
                onClick={() => switchCurrency(cur)}
                aria-pressed={form.currency === cur}
                className={cn(
                  'press inline-flex h-10 items-center justify-center gap-2 rounded-[9px] text-[13.5px] font-bold transition-colors',
                  form.currency === cur ? 'bg-ma-gold-500 text-[#1c1405]' : 'text-ink-2 hover:bg-ink/[0.04]',
                )}
              >
                <CurrencyFlag code={cur} />
                {cur === 'USD' ? '$ USD' : t('cnnSubs.cdfLabel', 'FC Congolais')}
              </button>
            ))}
          </div>
          {rate && <span className={hint}>{t('cnnSubs.rateLine', 'Taux : 1 USD = {{r}} FC', { r: rate.toLocaleString(locale, { maximumFractionDigits: 2 }) })}</span>}
        </div>

        {/* Prix */}
        <label className="block">
          <FieldLabel hint={t('cnnAdmin.common.required', 'Obligatoire')}>
            <span className={label}>{t('cnnSubs.subPrice', 'Prix de l’abonnement ({{c}})', { c: form.currency })}</span>
          </FieldLabel>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] font-bold text-ink-3">{sym}</span>
            <Input
              className={cn('pl-11 font-semibold', missing && !(price > 0) && 'ring-2 ring-status-danger/60')}
              inputMode="decimal"
              value={form.monthlyPrice}
              onChange={(e) => set('monthlyPrice', e.target.value.replace(/[^0-9.]/g, ''))}
            />
          </div>
          {rate && price > 0 && (
            <span className={hint}>
              ≈ {form.currency === 'USD' ? `${Math.round(price * rate).toLocaleString(locale)} ${t('cnnSubs.cdfLabel', 'FC Congolais')}` : `${(price / rate).toFixed(2)} USD`}
            </span>
          )}
        </label>

        {/* Courses incluses */}
        <label className="block">
          <span className={label}>{t('cnnSubs.coursesIncluded', 'Nombre de courses incluses')}</span>
          <div className="relative mt-1.5">
            <Bike className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
            <Input
              className="pl-10 pr-24"
              inputMode="numeric"
              placeholder={t('cnnSubs.coursesPlaceholder', 'Ex : 20')}
              value={form.coursesLimit}
              onChange={(e) => set('coursesLimit', e.target.value.replace(/[^0-9]/g, ''))}
            />
            {form.coursesLimit && (
              <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-bold text-accent-ink">
                {t('cnnSubs.coursesN', '{{n}} course(s)', { n: Number(form.coursesLimit) })}
              </span>
            )}
          </div>
          <span className={hint}>{t('cnnSubs.coursesHint', 'Chaque livraison confirmée consomme 1 course. À 0, le forfait est épuisé ; le client reste abonné.')}</span>
          {price > 0 && Number(form.coursesLimit) > 0 && (
            <span className="mt-1 block text-[12px] font-bold text-accent-ink">
              {t('cnnSubs.perCourseCalc', 'Soit {{p}} {{s}} / course', { p: (price / Number(form.coursesLimit)).toFixed(2), s: sym })}
            </span>
          )}
        </label>

        {/* Durée personnalisée */}
        <button
          type="button"
          onClick={() => set('allowCustomDuration', !form.allowCustomDuration)}
          aria-pressed={form.allowCustomDuration}
          className="clay-field flex w-full items-center gap-3 rounded-[12px] px-3.5 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[13.5px] font-semibold text-ink">{t('cnnSubs.customDurationTitle', 'Durée personnalisée')}</span>
            <span className="block text-[12px] text-ink-3">{t('cnnSubs.customDurationText', 'Le client peut choisir des dates libres au lieu du mensuel fixe (ex : Pack Pro Max Plus).')}</span>
          </span>
          <span
            className={cn(
              'inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-2',
              form.allowCustomDuration ? 'border-ma-gold-500 bg-ma-gold-500 text-[#1c1405]' : 'border-hairline',
            )}
          >
            {form.allowCustomDuration && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
          </span>
        </button>

        {/* Prix par course (facultatif) */}
        <div className="clay-field rounded-[12px] p-3.5">
          <span className={label}>{t('cnnSubs.pricePerCourseOpt', 'Prix par course ({{c}}) · facultatif', { c: form.currency })}</span>
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute inset-y-0 left-3.5 flex items-center text-[15px] font-bold text-ink-3">{sym}</span>
            <Input
              className="pl-11 pr-20 font-semibold"
              inputMode="decimal"
              placeholder={t('cnnSubs.ppcPlaceholder', 'ex : 8')}
              value={form.pricePerCourse}
              onChange={(e) => set('pricePerCourse', e.target.value.replace(/[^0-9.]/g, ''))}
            />
            <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-[12px] font-bold text-ink-3">/course</span>
          </div>
          <span className={hint}>
            {t('cnnSubs.ppcHint', 'Si renseigné, le client entre lui-même son nombre de courses (> 100) et le prix se calcule automatiquement. Laissez le prix et les courses ci-dessus à 0.')}
          </span>
        </div>

        {/* Statut : seulement en modification, comme dans le détail d'un abonnement de l'application */}
        {plan && (
          <label className="block">
            <span className={label}>{t('cnnAdmin.orders.status', 'Statut')}</span>
            <Select className="mt-1.5" value={form.status} onChange={(e) => set('status', e.target.value as SubscriptionStatus)}>
              {(['ACTIVE', 'SUSPENDED', 'CANCELLED'] as SubscriptionStatus[]).map((s) => (
                <option key={s} value={s}>
                  {t(`cnnSubs.status.${s}`, { defaultValue: s })}
                </option>
              ))}
            </Select>
          </label>
        )}

        {duplicate && (
          <Feedback tone="warning">
            <span className="inline-flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {t('cnnSubs.duplicate', 'Un abonnement avec ce prix et ce nombre de courses existe déjà.')}
            </span>
          </Feedback>
        )}
        {missing && !(price > 0) && <Feedback tone="danger">{t('cnnSubs.priceRequired', 'Indiquez le prix de l’abonnement.')}</Feedback>}
        {error && <Feedback tone="danger">{error}</Feedback>}
      </div>
    </Modal>
  )
}
