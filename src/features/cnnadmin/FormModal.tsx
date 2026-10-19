import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Input, Select, Textarea } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'

export type FormField = {
  name: string
  label: string
  type?: 'text' | 'tel' | 'email' | 'password' | 'date' | 'select' | 'number' | 'checkbox' | 'textarea'
  /** Choix proposés quand type = 'select'. */
  options?: { value: string; label: string }[]
  required?: boolean
  hint?: string
  half?: boolean
  autoComplete?: string
  /** Date : accepter les dates futures (échéance, fin d'abonnement…). */
  future?: boolean
  /** Nombre : pas et minimum. */
  step?: string
  min?: string
}

/** Petit formulaire en fenêtre : champs simples, validation « obligatoire », erreur du relais. */
export function FormModal({
  open,
  title,
  subtitle,
  fields,
  initial,
  submitLabel,
  busy,
  error,
  onSubmit,
  onClose,
}: {
  open: boolean
  title: string
  subtitle?: string
  fields: FormField[]
  initial?: Record<string, string>
  submitLabel: string
  busy?: boolean
  error?: string | null
  onSubmit: (values: Record<string, string>) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [values, setValues] = useState<Record<string, string>>({})
  useEffect(() => {
    if (open) setValues(initial ?? {})
    // Réinitialisé seulement à l'ouverture : `initial` est souvent recréé à chaque rendu.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  const missing = fields.some((f) => f.required && !(values[f.name] ?? '').trim())
  const dirty = fields.some((f) => (values[f.name] ?? '') !== (initial?.[f.name] ?? ''))

  return (
    <Modal
      open={open}
      onClose={onClose}
      kicker="Colis na Nga"
      title={title}
      subtitle={subtitle}
      dirty={dirty && !busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t('cnnAdmin.common.cancel', 'Annuler')}
          </Button>
          <Button
            variant="gold"
            disabled={busy || missing}
            onClick={() => {
              const clean: Record<string, string> = {}
              for (const f of fields) clean[f.name] = (values[f.name] ?? '').trim()
              onSubmit(clean)
            }}
          >
            {busy ? t('cnnAdmin.common.working', 'Envoi…') : submitLabel}
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        {fields.map((f) => (
          <label key={f.name} className={f.half ? 'block' : 'block sm:col-span-2'}>
            <FieldLabel hint={f.type === 'checkbox' ? undefined : f.hint ?? (f.required ? t('cnnAdmin.common.required', 'Obligatoire') : undefined)}>{f.label}</FieldLabel>
            {f.type === 'select' ? (
              <Select value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}>
                <option value="">{t('cnnAdmin.common.choose', 'Choisir…')}</option>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            ) : f.type === 'checkbox' ? (
              <span className="flex h-10 items-center gap-2.5 text-[13.5px] text-ink-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--ma-gold-500,#cf9410)]"
                  checked={values[f.name] === 'true'}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.checked ? 'true' : '' }))}
                />
                {f.hint}
              </span>
            ) : f.type === 'textarea' ? (
              <Textarea rows={3} value={values[f.name] ?? ''} onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))} />
            ) : (
              <Input
                type={f.type ?? 'text'}
                value={values[f.name] ?? ''}
                max={f.type === 'date' && !f.future ? new Date().toISOString().slice(0, 10) : undefined}
                min={f.min}
                step={f.step}
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                autoComplete={f.autoComplete ?? (f.type === 'password' ? 'new-password' : 'off')}
                onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
              />
            )}
          </label>
        ))}
        {error && <Feedback tone="danger" className="sm:col-span-2">{error}</Feedback>}
      </form>
    </Modal>
  )
}

/** Retire les champs vides (l'API Colis na Nga ignore les valeurs nulles en modification). */
export function compact(values: Record<string, string>) {
  return Object.fromEntries(Object.entries(values).filter(([, v]) => v !== '')) as Record<string, string>
}
