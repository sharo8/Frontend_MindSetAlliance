import { forwardRef, useEffect, useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertCircle, ArrowLeft, CheckCircle2, Info, Moon, ShieldCheck, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { fieldClass } from '../../components/ui/input'
import { easeIOS } from '../../components/motion/springs'
import { cn } from '../../lib/utils'
import { useThemeStore } from '../../lib/theme/theme-store'
import { FlagFR, FlagGB } from '../../components/ui/brand-marks'
import { SceneBackground, ShowcaseWidgets, usePointerField } from './ProductShowcase'

type Props = {
  kicker: string
  title: string
  subtitle?: string
  children: ReactNode
  footer?: string
  wide?: boolean
}

/**
 * Écrans d'accès : panneau de marque à gauche (bureau), formulaire en argile à droite.
 * Sur téléphone, le logo et le nom passent au-dessus de la carte.
 */
/**
 * Écrans d'accès : une seule scène graphite (couleurs du mode sombre du système).
 * Le formulaire est une feuille de verre liquide ; les widgets flottent à côté,
 * dans le même décor, avec une lumière qui suit la souris.
 */
export function AuthShell({ kicker, title, subtitle, children, footer, wide }: Props) {
  const { t } = useTranslation()
  const { x, y } = usePointerField()

  return (
    <div className="auth-scene relative min-h-svh overflow-hidden text-ink">
      <SceneBackground x={x} y={y} />

      <header className="relative z-20 flex items-center justify-between px-6 pt-6 sm:px-10">
        <div className="flex items-center gap-2.5">
          <img src="/logo-mindset-alliance.jpg" alt="" className="h-9 w-9 rounded-full object-cover ring-1 ring-black/5 dark:ring-white/10" />
          <span className="hidden leading-tight sm:block">
            <span className="block font-display text-[12px] font-semibold tracking-[0.2em] text-ink">{kicker}</span>
            <span className="block text-[11.5px] font-medium text-ink-3">MA Workspace</span>
          </span>
        </div>
        <div className="flex items-center gap-2.5 sm:gap-4">
          <Link
            to="/bienvenue"
            className="glass press inline-flex h-10 items-center gap-2 rounded-full px-3 text-[13px] font-semibold text-ink-2 transition-colors hover:text-ink sm:px-4"
            aria-label={t('site.backHome', 'Retour à l’accueil')}
            title={t('site.backHome', 'Retour à l’accueil')}
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{t('site.backHome', 'Retour à l’accueil')}</span>
          </Link>
          <span className="hidden items-center gap-1.5 text-[12px] text-ink-3 lg:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-status-success" strokeWidth={2.2} />
            <AuthSecureNote />
          </span>
          <LanguageSwitch />
          <ThemeSwitch />
        </div>
      </header>

      <main className="relative z-10 mx-auto grid min-h-[calc(100svh-5.5rem)] w-full max-w-[1320px] items-center gap-12 px-5 pb-16 pt-6 sm:px-10 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:gap-20 xl:gap-28">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97, filter: 'blur(10px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', transitionEnd: { filter: 'none', transform: 'none' } }}
          transition={{ type: 'spring', stiffness: 160, damping: 22, delay: 0.05 }}
          className={cn('mx-auto w-full', wide ? 'max-w-[28rem]' : 'max-w-[26rem]')}
        >
          <div className="glass-strong lg-lens rounded-[38px] px-7 pb-8 pt-9 [--spec-size:380px] sm:px-9">
            <h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.04em] text-ink">{title}</h1>
            {subtitle && <p className="mt-2 text-[14.5px] leading-relaxed text-ink-3">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            <p className="mt-8 border-t border-hairline pt-5 text-[12.5px] leading-relaxed text-ink-3">{t('loginShowcase.access')}</p>
          </div>
          {footer && <p className="mt-5 text-center text-[11.5px] text-ink-3">{footer}</p>}
        </motion.div>

        <ShowcaseWidgets x={x} y={y} />
      </main>
    </div>
  )
}

/** Bascule clair / sombre de l'écran de connexion : soleil et lune dans une pastille de verre qui glisse. */
export function ThemeSwitch() {
  const { t } = useTranslation()
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const hydrate = useThemeStore((s) => s.hydrate)
  useEffect(() => {
    hydrate()
  }, [hydrate])
  const options = [
    { value: 'light' as const, label: t('appearance.light'), Icon: Sun },
    { value: 'dark' as const, label: t('appearance.dark'), Icon: Moon },
  ]
  return (
    <div role="radiogroup" aria-label={t('appearance.theme')} className="glass relative flex h-10 items-center gap-0.5 rounded-full p-1">
      {options.map(({ value, label, Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className={cn('relative flex h-8 w-9 items-center justify-center rounded-full transition-colors', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
          >
            {active && (
              <motion.span
                layoutId="auth-theme-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgb(0_0_0/0.12)] dark:bg-white/[0.16] dark:shadow-none"
              />
            )}
            <Icon className="relative h-[17px] w-[17px]" strokeWidth={2} />
          </button>
        )
      })}
    </div>
  )
}

/** Choix de la langue (français / anglais) : la pastille glisse d'une langue à l'autre. Les noms des sociétés et du système ne sont pas traduits. */
export function LanguageSwitch() {
  const { t, i18n } = useTranslation()
  const current = i18n.language?.startsWith('en') ? 'en' : 'fr'
  const options = [
    { value: 'fr', short: 'FR', label: 'Français', Flag: FlagFR },
    { value: 'en', short: 'EN', label: 'English', Flag: FlagGB },
  ]
  return (
    <div role="radiogroup" aria-label={t('topbar.language')} className="glass relative flex h-10 items-center gap-0.5 rounded-full p-1">
      {options.map(({ value, short, label, Flag }) => {
        const active = current === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            lang={value}
            onClick={() => void i18n.changeLanguage(value)}
            className={cn('relative flex h-8 items-center justify-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold tracking-[0.02em] transition-colors', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
          >
            {active && (
              <motion.span
                layoutId="auth-lang-pill"
                transition={{ type: 'spring', stiffness: 400, damping: 26 }}
                className="absolute inset-0 rounded-full bg-white shadow-[0_2px_8px_rgb(0_0_0/0.12)] dark:bg-white/[0.16] dark:shadow-none"
              />
            )}
            <motion.span
              className="relative inline-flex"
              animate={{ scale: active ? 1 : 0.86, opacity: active ? 1 : 0.6 }}
              transition={{ type: 'spring', stiffness: 400, damping: 22 }}
            >
              <Flag />
            </motion.span>
            <span className="relative">{short}</span>
          </button>
        )
      })}
    </div>
  )
}

function AuthSecureNote() {
  const { t } = useTranslation()
  return <>{t('login.secure')}</>
}

/** Champ des écrans d'accès : libellé, icône à gauche, action optionnelle à droite. */
export const AuthField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & {
    label: ReactNode
    icon: ReactNode
    trailing?: ReactNode
    error?: ReactNode
  }
>(function AuthField({ label, icon, trailing, error, className, id, ...props }, ref) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errId = `${fieldId}-err`
  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-medium text-ink-2">
        {label}
      </label>
      <div className="group relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3 transition-colors duration-200 group-focus-within:text-accent-ink [&>svg]:h-[17px] [&>svg]:w-[17px]">
          {icon}
        </span>
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errId : undefined}
          className={cn(fieldClass, 'h-12 rounded-[14px] pl-11 text-[15px]', trailing && 'pr-12', className)}
          {...props}
        />
        {trailing && <span className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</span>}
      </div>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            id={errId}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: easeIOS }}
            className="overflow-hidden pt-1.5 text-[12.5px] text-status-danger"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
})

/** Message d'état des écrans d'accès (erreur, info, succès), entrée douce. */
export function AuthNotice({
  tone = 'info',
  children,
  className,
}: {
  tone?: 'error' | 'info' | 'success'
  children: ReactNode
  className?: string
}) {
  const Icon = tone === 'error' ? AlertCircle : tone === 'success' ? CheckCircle2 : Info
  return (
    <motion.div
      role={tone === 'error' ? 'alert' : 'status'}
      initial={{ opacity: 0, y: -6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: easeIOS }}
      className={cn(
        'flex items-start gap-2.5 rounded-[14px] px-3.5 py-3 text-[13.5px] leading-relaxed',
        tone === 'error' && 'bg-status-danger/10 text-status-danger ring-1 ring-status-danger/20',
        tone === 'info' && 'bg-ma-gold-400/12 text-accent-ink ring-1 ring-ma-gold-500/25',
        tone === 'success' && 'bg-status-success/10 text-status-success ring-1 ring-status-success/20',
        className,
      )}
    >
      <Icon className="mt-[1px] h-[17px] w-[17px] shrink-0" strokeWidth={2.2} />
      <span className="min-w-0">{children}</span>
    </motion.div>
  )
}

/** Bouton « œil » pour afficher / masquer le mot de passe. */
export function RevealButton({
  shown,
  onToggle,
  labelShow,
  labelHide,
}: {
  shown: boolean
  onToggle: () => void
  labelShow: string
  labelHide: string
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={shown ? labelHide : labelShow}
      aria-pressed={shown}
      className="press flex h-9 w-9 items-center justify-center rounded-[11px] text-ink-3 hover:bg-ink/[0.05] hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)] dark:hover:bg-white/[0.07]"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.svg
          key={shown ? 'hide' : 'show'}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.18 }}
          viewBox="0 0 24 24"
          className="h-[18px] w-[18px]"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
          <circle cx="12" cy="12" r="3" />
          {shown && <path d="m3 3 18 18" />}
        </motion.svg>
      </AnimatePresence>
    </button>
  )
}

/** Lien de retour vers la connexion, commun aux écrans secondaires. */
export function BackToLogin() {
  const { t } = useTranslation()
  return (
    <div className="mt-6 flex justify-center">
      <Link
        to="/connexion"
        className="press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
        {t('login.backToLogin')}
      </Link>
    </div>
  )
}

/** Règles du mot de passe cochées en direct pendant la saisie. */
export function PasswordRules({ value, confirm }: { value: string; confirm: string }) {
  const { t } = useTranslation()
  const rules = [
    { ok: value.length >= 8, label: t('login.ruleLength') },
    { ok: /[A-Za-z]/.test(value), label: t('login.ruleLetter') },
    { ok: /\d/.test(value), label: t('login.ruleDigit') },
    {
      ok: confirm.length > 0 && confirm === value,
      label: t('login.ruleMatch'),
    },
  ]
  const score = rules.filter((r) => r.ok).length
  return (
    <div className="rounded-[16px] bg-ink/[0.03] px-4 py-3.5 ring-1 ring-hairline dark:bg-white/[0.03]">
      <div className="mb-3 grid grid-cols-4 gap-1.5" aria-hidden>
        {rules.map((_, i) => (
          <span key={i} className="h-1 overflow-hidden rounded-full bg-ink/[0.08] dark:bg-white/[0.08]">
            <motion.span
              className={cn('block h-full rounded-full', score === 4 ? 'bg-status-success' : 'bg-ma-gold-500')}
              initial={false}
              animate={{ width: i < score ? '100%' : '0%' }}
              transition={{ duration: 0.35, ease: easeIOS }}
            />
          </span>
        ))}
      </div>
      <ul className="grid grid-cols-1 gap-1.5">
        {rules.map((rule) => (
          <li
            key={rule.label}
            className={cn('flex items-center gap-2 text-[12.5px] transition-colors duration-200', rule.ok ? 'text-ink' : 'text-ink-3')}
          >
            <span
              className={cn(
                'flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-[background-color,box-shadow] duration-200',
                rule.ok ? 'bg-status-success text-white' : 'shadow-[inset_0_0_0_1.5px_currentColor] opacity-60',
              )}
            >
              <AnimatePresence>
                {rule.ok && (
                  <motion.svg
                    viewBox="0 0 12 12"
                    className="h-2.5 w-2.5"
                    initial={{ scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.4, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <path
                      d="M2.5 6.2 5 8.5l4.5-5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={1.8}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </motion.svg>
                )}
              </AnimatePresence>
            </span>
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
