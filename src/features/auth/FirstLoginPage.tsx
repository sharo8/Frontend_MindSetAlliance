import { Loader2, Lock } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { AuthField, AuthNotice, AuthShell, PasswordRules } from './AuthShell'
import { Button } from '../../components/ui/button'
import { changePassword } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'
import { useAuthStore } from '../../lib/auth/auth-store'

const COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

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
    <AuthShell kicker={t('login.brand')} title={t('firstLogin.title')} subtitle={t('firstLogin.subtitle')} footer={t('login.footer')}>
        <form className="space-y-4" noValidate onSubmit={(e) => void onSubmit(e)}>
          <AuthField label={t('firstLogin.current')} icon={<Lock />} type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
          <AuthField label={t('firstLogin.next')} icon={<Lock />} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <AuthField label={t('firstLogin.confirm')} icon={<Lock />} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          <PasswordRules value={newPassword} confirm={confirmPassword} />
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
          <Button className="w-full" size="lg" type="submit" disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
            {busy ? t('firstLogin.submitting') : t('firstLogin.submit')}
          </Button>
        </form>
    </AuthShell>
  )
}
