import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, ArrowRight, Loader2, Lock, Mail } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { login, requestPasswordReset, verify2fa } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useAuthStore } from '../../lib/auth/auth-store'
import { Button } from '../../components/ui/button'
import { easeIOS } from '../../components/motion/springs'
import { makeLoginSchema, type LoginValues } from './login-schema'
import { AuthField, AuthNotice, AuthShell, BackToLogin, RevealButton } from './AuthShell'
import { OtpInput } from './OtpInput'


export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const applyTokens = useAuthStore((s) => s.applyTokens)
  const accessToken = useAuthStore((s) => s.accessToken)
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword)
  const hydrate = useAuthStore((s) => s.hydrate)
  const [showPassword, setShowPassword] = useState(false)
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [otpHint, setOtpHint] = useState<string | null>(null)
  const [otp, setOtp] = useState('')
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpBusy, setOtpBusy] = useState(false)
  const [seconds, setSeconds] = useState(30)
  const [sessionNotice, setSessionNotice] = useState<string | null>(null)
  const schema = useMemo(() => makeLoginSchema(t), [t])

  const form = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    let stored: string | null = null
    try {
      stored = sessionStorage.getItem('ma.auth.notice')
      if (stored) sessionStorage.removeItem('ma.auth.notice')
    } catch {
      /* ignore */
    }
    const reason = new URLSearchParams(window.location.search).get('reason')
    if (reason === 'session' || stored === 'expired') {
      setSessionNotice(t('authErrors.sessionExpired'))
      if (reason === 'session') {
        window.history.replaceState(null, '', '/connexion')
      }
    }
  }, [t])

  useEffect(() => {
    if (accessToken && mustChangePassword) navigate('/premiere-connexion', { replace: true })
    else if (accessToken) navigate('/', { replace: true })
  }, [accessToken, mustChangePassword, navigate])

  useEffect(() => {
    if (!challengeId) return
    setSeconds(30)
    const id = window.setInterval(() => {
      setSeconds((s) => (s <= 0 ? 0 : s - 1))
    }, 1000)
    return () => window.clearInterval(id)
  }, [challengeId])

  async function onSubmit(values: LoginValues) {
    try {
      const result = await login(values.email, values.password)
      if (result.requires2fa) {
        setChallengeId(result.challengeId)
        setOtpHint(result.message ?? null)
        return
      }
      applyTokens(result.accessToken, result.refreshToken, result.expiresIn)
      navigate(result.mustChangePassword ? '/premiere-connexion' : '/', { replace: true })
    } catch (error) {
      const mapped =
        error instanceof ApiError
          ? error.status === 401
            ? t('authErrors.badCredentials')
            : error.message
          : t('login.failed')
      form.setError('root', { message: mapped })
    }
  }

  async function onVerify() {
    if (!challengeId || otp.length !== 6) return
    setOtpBusy(true)
    setOtpError(null)
    try {
      const result = await verify2fa(challengeId, otp)
      applyTokens(result.accessToken, result.refreshToken, result.expiresIn)
      navigate(result.mustChangePassword ? '/premiere-connexion' : '/', { replace: true })
    } catch (error) {
      setOtpError(error instanceof ApiError ? error.message : t('login.otpInvalid'))
    } finally {
      setOtpBusy(false)
    }
  }

  const submitting = form.formState.isSubmitting

  return (
    <AuthShell
      kicker={t('login.brand')}
      title={challengeId ? t('login.otpTitle') : t('login.heading')}
      subtitle={challengeId ? otpHint || t('login.otpHint') : t('login.headingSub')}
      footer={t('login.footer')}
    >
      <AnimatePresence mode="wait" initial={false}>
        {!challengeId ? (
          <motion.form
            key="credentials"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.32, ease: easeIOS }}
            className="space-y-4"
            noValidate
            onSubmit={form.handleSubmit(onSubmit)}
          >
            {sessionNotice && <AuthNotice tone="info">{sessionNotice}</AuthNotice>}
            <AuthField
              label={t('login.email')}
              icon={<Mail />}
              type="email"
              autoComplete="username"
              placeholder={t('login.emailPlaceholder')}
              error={form.formState.errors.email?.message}
              {...form.register('email')}
            />
            <AuthField
              label={t('login.password')}
              icon={<Lock />}
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              error={form.formState.errors.password?.message}
              trailing={
                <RevealButton
                  shown={showPassword}
                  onToggle={() => setShowPassword((v) => !v)}
                  labelShow={t('login.showPassword')}
                  labelHide={t('login.hidePassword')}
                />
              }
              {...form.register('password')}
            />
            <div className="flex justify-end">
              <Link
                to="/mot-de-passe-oublie"
                className="rounded-md text-[13px] font-medium text-accent-ink transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
              >
                {t('login.forgot')}
              </Link>
            </div>
            {form.formState.errors.root && <AuthNotice tone="error">{form.formState.errors.root.message}</AuthNotice>}
            <Button className="w-full" size="lg" type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
              {submitting ? t('login.submitting') : t('login.submit')}
              {!submitting && <ArrowRight className="h-4 w-4" aria-hidden strokeWidth={2.4} />}
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="otp"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 16 }}
            transition={{ duration: 0.32, ease: easeIOS }}
            className="space-y-5"
          >
            <div>
              <p className="mb-2.5 text-[13px] font-medium text-ink-2">{t('login.otpLabel')}</p>
              <OtpInput value={otp} onChange={setOtp} disabled={otpBusy} invalid={Boolean(otpError)} />
            </div>
            {otpError && <AuthNotice tone="error">{otpError}</AuthNotice>}
            <p className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <span className="relative inline-flex h-4 w-4 items-center justify-center">
                <svg viewBox="0 0 20 20" className="h-4 w-4 -rotate-90" aria-hidden>
                  <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={2.5} />
                  <circle
                    cx="10"
                    cy="10"
                    r="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeDasharray={50.27}
                    strokeDashoffset={50.27 * (1 - seconds / 30)}
                    className="text-accent-ink transition-[stroke-dashoffset] duration-1000 ease-linear"
                  />
                </svg>
              </span>
              {seconds > 0 ? t('login.otpWait', { time: `00:${String(seconds).padStart(2, '0')}` }) : t('login.otpExpired')}
            </p>
            <Button className="w-full" size="lg" disabled={otp.length !== 6 || otpBusy} onClick={() => void onVerify()}>
              {otpBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {otpBusy ? t('login.verifying') : t('login.verify')}
            </Button>
            <button
              type="button"
              onClick={() => {
                setChallengeId(null)
                setOtp('')
                setOtpError(null)
              }}
              className="press mx-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium text-ink-3 hover:text-ink focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" strokeWidth={2.4} />
              {t('login.changeAccount')}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AuthShell>
  )
}

export function ForgotPasswordPage() {
  const { t } = useTranslation()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState<string | null>(null)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSent(null)
    if (!email.trim() || !email.includes('@')) {
      setError(t('login.emailInvalid'))
      return
    }
    setBusy(true)
    try {
      const result = await requestPasswordReset(email.trim())
      setSent(result.message || t('login.forgotSent'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('login.failed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell kicker={t('login.brand')} title={t('login.forgotTitle')} subtitle={t('login.forgotBody')} footer={t('login.footer')}>
      {sent ? (
        <AuthNotice tone="success">{sent}</AuthNotice>
      ) : (
        <form className="space-y-4" noValidate onSubmit={(e) => void onSubmit(e)}>
          <AuthField
            label={t('login.email')}
            icon={<Mail />}
            type="email"
            autoComplete="username"
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
          <Button className="w-full" size="lg" type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? t('login.forgotSubmitting') : t('login.forgotSubmit')}
          </Button>
        </form>
      )}
      <BackToLogin />
    </AuthShell>
  )
}
