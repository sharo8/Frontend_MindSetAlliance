import { Loader2, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AuthShell } from './AuthShell'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { changePassword } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useAuthStore } from '../../lib/auth/auth-store'

const COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/
const navyField =
  'h-11 border-white/10 bg-ma-navy-700/55 pl-10 text-ma-white placeholder:text-ma-gray-300/70 transition-all duration-200 focus:border-ma-gold-400 focus:ring-2 focus:ring-ma-gold-400/70'

export function FirstLoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { accessToken, mustChangePassword, applyTokens, hydrated, hydrate } = useAuthStore()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    hydrate()
  }, [hydrate])

  useEffect(() => {
    if (!hydrated) return
    if (!accessToken) {
      navigate('/connexion', { replace: true })
      return
    }
    if (!mustChangePassword) {
      navigate('/', { replace: true })
    }
  }, [accessToken, hydrated, mustChangePassword, navigate])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!COMPLEXITY.test(newPassword)) {
      setError(t('profile.complexityFail'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('profile.confirmMismatch'))
      return
    }
    if (currentPassword === newPassword) {
      setError(t('profile.samePassword'))
      return
    }
    setBusy(true)
    try {
      const result = await changePassword(currentPassword, newPassword)
      if (result.accessToken && result.refreshToken && result.expiresIn) {
        applyTokens(result.accessToken, result.refreshToken, result.expiresIn)
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profile.saveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell kicker="MINDSET ALLIANCE" title={t('firstLogin.title')} subtitle={t('firstLogin.subtitle')} footer="© 2026 Mindset Alliance">
        <form className="space-y-4" onSubmit={(e) => void onSubmit(e)}>
          <label className="block text-sm text-ma-gray-300">
            {t('firstLogin.current')}
            <span className="relative mt-1.5 block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ma-gold-400/80" />
              <Input className={navyField} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </span>
          </label>
          <label className="block text-sm text-ma-gray-300">
            {t('firstLogin.next')}
            <span className="relative mt-1.5 block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ma-gold-400/80" />
              <Input className={navyField} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </span>
          </label>
          <label className="block text-sm text-ma-gray-300">
            {t('firstLogin.confirm')}
            <span className="relative mt-1.5 block">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ma-gold-400/80" />
              <Input className={navyField} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </span>
          </label>
          {error && <p className="rounded-lg bg-status-danger/15 px-3 py-2 text-sm text-status-danger">{error}</p>}
          <Button className="w-full" type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? t('firstLogin.submitting') : t('firstLogin.submit')}
          </Button>
        </form>
    </AuthShell>
  )
}
