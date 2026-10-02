import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { login, requestPasswordReset, verify2fa } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useAuthStore } from '../../lib/auth/auth-store'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { makeLoginSchema, type LoginValues } from './login-schema'
import { AuthShell } from './AuthShell'
import { OtpInput } from './OtpInput'

const navyField =
  'h-11 border-white/10 bg-ma-navy-700/55 pl-10 text-ma-white placeholder:text-ma-gray-300/70 transition-all duration-200 focus:border-ma-gold-400 focus:ring-2 focus:ring-ma-gold-400/70 focus:shadow-[0_0_0_4px_rgba(246,208,106,0.16)]'

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
      title={challengeId ? 'Vérification' : t('login.title')}
      subtitle={challengeId ? otpHint || t('login.otpHint') : t('login.subtitle')}
      footer={t('login.footer')}
    >
            {!challengeId ? (
              <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
                {sessionNotice && (
                  <p className="rounded-lg bg-ma-gold-400/15 px-3 py-2 text-sm text-ma-gold-300">
                    {sessionNotice}
                  </p>
                )}
                <label className="block text-sm text-ma-gray-300">
                  {t('login.email')}
                  <span className="relative mt-1.5 block">
                    <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ma-gold-400/80" />
                    <Input
                      className={navyField}
                      type="email"
                      autoComplete="username"
                      {...form.register('email')}
                    />
                  </span>
                </label>
                {form.formState.errors.email && (
                  <p className="text-sm text-status-danger">{form.formState.errors.email.message}</p>
                )}
                <label className="block text-sm text-ma-gray-300">
                  {t('login.password')}
                  <div className="relative mt-1.5">
                    <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ma-gold-400/80" />
                    <Input
                      className={`${navyField} pr-11`}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      {...form.register('password')}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ma-gray-300 transition hover:text-ma-gold-400"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? t('login.hidePassword') : t('login.showPassword')}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </label>
                {form.formState.errors.password && (
                  <p className="text-sm text-status-danger">{form.formState.errors.password.message}</p>
                )}
                {form.formState.errors.root && (
                  <p className="rounded-lg bg-status-danger/15 px-3 py-2 text-sm text-status-danger">
                    {form.formState.errors.root.message}
                  </p>
                )}
                <Button className="mt-2 w-full" type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {submitting ? t('login.submitting') : t('login.submit')}
                </Button>
                <div className="text-center">
                  <Link to="/mot-de-passe-oublie" className="text-sm text-ma-gray-300 transition hover:text-ma-gold-400">
                    {t('login.forgot')}
                  </Link>
                </div>
              </form>
            ) : (
              <div className="space-y-5">
                <div className="rounded-2xl border border-ma-gold-400/30 bg-ma-navy-950/50 px-4 py-5">
                  <p className="mb-3 text-center text-[10px] font-semibold tracking-[0.28em] text-ma-gold-400">CODE</p>
                  <OtpInput value={otp} onChange={setOtp} disabled={otpBusy} />
                </div>
                {otpError && (
                  <p className="rounded-lg bg-status-danger/15 px-3 py-2 text-center text-sm text-status-danger">{otpError}</p>
                )}
                <p className="text-center text-xs text-ma-gray-300">
                  {seconds > 0
                    ? t('login.otpWait', { time: `00:${String(seconds).padStart(2, '0')}` })
                    : t('login.otpExpired')}
                </p>
                <Button className="w-full" disabled={otp.length !== 6 || otpBusy} onClick={() => void onVerify()}>
                  {otpBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {otpBusy ? t('login.verifying') : t('login.verify')}
                </Button>
              </div>
            )}
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
            <p className="rounded-xl border border-ma-gold-400/25 bg-ma-gold-400/10 px-3 py-3 text-center text-sm text-ma-gold-300">{sent}</p>
          ) : (
            <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
              <label className="block text-sm text-ma-gray-300">
                {t('login.email')}
                <span className="relative mt-1.5 block">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ma-gold-400/80" />
                  <Input
                    className={navyField}
                    type="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </span>
              </label>
              {error && (
                <p className="rounded-lg bg-status-danger/15 px-3 py-2 text-sm text-status-danger">{error}</p>
              )}
              <Button className="w-full" type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {busy ? t('login.forgotSubmitting') : t('login.forgotSubmit')}
              </Button>
            </form>
          )}
          <div className="mt-6 text-center">
            <Link to="/connexion" className="text-sm text-ma-gold-400 transition hover:text-ma-gold-300">
              {t('login.backToLogin')}
            </Link>
          </div>
    </AuthShell>
  )
}
