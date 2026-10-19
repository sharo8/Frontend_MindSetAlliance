import { Loader2, Lock } from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { AuthField, AuthNotice, AuthShell, BackToLogin, PasswordRules } from './AuthShell'
import { Button } from '../../components/ui/button'
import { completePasswordSetup } from '../../lib/api/auth'
import { ApiError } from '../../lib/api/client'

const COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

export function SetupPasswordPage() {
  const { t } = useTranslation()
  const [params] = useSearchParams()
  const token = useMemo(() => params.get('token') ?? '', [params])
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!token) {
      setError(t('setupPassword.missingToken'))
      return
    }
    if (!COMPLEXITY.test(newPassword)) {
      setError(t('profile.complexityFail'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('profile.confirmMismatch'))
      return
    }
    setBusy(true)
    try {
      const result = await completePasswordSetup(token, newPassword)
      setDone(result.message || t('setupPassword.done'))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profile.saveError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthShell kicker={t('login.brand')} title={t('setupPassword.title')} subtitle={t('setupPassword.subtitle')} footer={t('login.footer')}>
          {done ? (
            <AuthNotice tone="success">{done}</AuthNotice>
          ) : (
            <form className="space-y-4" noValidate onSubmit={(e) => void onSubmit(e)}>
              <AuthField label={t('firstLogin.next')} icon={<Lock />} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              <AuthField label={t('firstLogin.confirm')} icon={<Lock />} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              <PasswordRules value={newPassword} confirm={confirmPassword} />
          {error && <AuthNotice tone="error">{error}</AuthNotice>}
              <Button className="w-full" size="lg" type="submit" disabled={busy}>
                {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                {t('setupPassword.submit')}
              </Button>
            </form>
          )}
          <BackToLogin />
    </AuthShell>
  )
}
