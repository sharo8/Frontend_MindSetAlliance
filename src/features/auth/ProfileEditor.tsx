import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentPhotoField } from '../../components/ui/AgentPhotoField'
import { Button } from '../../components/ui/button'
import { Feedback } from '../../components/ui/feedback'
import { Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { Toast } from '../../components/ui/toast'
import { ApiError } from '../../lib/api/client'
import { changePassword, fetchMe, updateMe } from '../../lib/api/auth'
import { useAuthStore } from '../../lib/auth/auth-store'
import { cn } from '../../lib/utils'

const COMPLEXITY = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/

const FR = {
  prenom: 'Prénom',
  nom: 'Nom',
  email: 'E-mail professionnel',
  emailHint: 'Identifiant de connexion — non modifiable.',
  telephone: 'Téléphone',
        passwordSection: 'Sécurité',
  currentPassword: 'Mot de passe actuel',
  newPassword: 'Nouveau mot de passe',
  confirmPassword: 'Confirmation du nouveau mot de passe',
  complexity: 'Au moins 8 caractères, une lettre et un chiffre.',
  save: 'Enregistrer les modifications',
  saving: 'Enregistrement…',
  saved: 'Profil mis à jour avec succès',
  cancel: 'Annuler',
}

type Props = {
  onCancel?: () => void
  compact?: boolean
  hideFooter?: boolean
  french?: boolean
}

export function ProfileEditor({ onCancel, hideFooter, french }: Props) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const applyTokens = useAuthStore((s) => s.applyTokens)
  const profile = useQuery({ queryKey: ['agents-me'], queryFn: fetchMe })
  const agent = profile.data
  const L = french
    ? FR
    : {
        prenom: t('profile.prenom'),
        nom: t('profile.nom'),
        email: t('profile.email'),
        emailHint: t('profile.emailHint'),
        telephone: t('profile.telephone'),
        passwordSection: t('profile.passwordSection'),
        currentPassword: t('profile.currentPassword'),
        newPassword: t('profile.newPassword'),
        confirmPassword: t('profile.confirmPassword'),
        complexity: t('profile.complexity'),
        save: t('profile.save'),
        saving: t('profile.saving'),
        saved: t('profile.saved'),
        cancel: t('profile.cancel'),
      }

  const [nom, setNom] = useState('')
  const [prenom, setPrenom] = useState('')
  const [telephone, setTelephone] = useState('')
  const [photo, setPhoto] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)

  useEffect(() => {
    if (!agent) return
    setNom(agent.nom ?? '')
    setPrenom(agent.prenom ?? '')
    setTelephone(agent.telephone ?? '')
    setPhoto(agent.photo ?? null)
  }, [agent])

  const save = useMutation({
    mutationFn: async () => {
      const pwdTouched = Boolean(currentPassword || newPassword || confirmPassword)
      if (pwdTouched) {
        if (!currentPassword) throw new ApiError(t('profile.currentRequired'), 400)
        if (!newPassword) throw new ApiError(t('profile.newRequired'), 400)
        if (!COMPLEXITY.test(newPassword)) throw new ApiError(t('profile.complexityFail'), 400)
        if (newPassword !== confirmPassword) throw new ApiError(t('profile.confirmMismatch'), 400)
        if (currentPassword === newPassword) throw new ApiError(t('profile.samePassword'), 400)
      }
      const updated = await updateMe({ nom, prenom, telephone, photo })
      if (pwdTouched) {
        const result = await changePassword(currentPassword, newPassword)
        if (result.accessToken && result.refreshToken && result.expiresIn) {
          applyTokens(result.accessToken, result.refreshToken, result.expiresIn)
        }
        return { updated, passwordMessage: result.message }
      }
      return { updated, passwordMessage: null as string | null }
    },
    onSuccess: (result) => {
      setError(null)
      setSuccess(result.passwordMessage || L.saved)
      setSavedFlash(true)
      window.setTimeout(() => setSavedFlash(false), 1600)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      void queryClient.setQueryData(['agents-me'], result.updated)
    },
    onError: (err) => {
      setSuccess(null)
      setError(err instanceof ApiError ? err.message : t('profile.saveError'))
    },
  })

  const labelClass = 'mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted'

  return (
    <form
      id="ma-profile-form"
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      {profile.isError && <Feedback tone="danger">{t('profile.loadError')}</Feedback>}
      <AgentPhotoField
        prenom={prenom || agent?.prenom || ''}
        nom={nom || agent?.nom || ''}
        value={photo}
        error={photoError}
        onError={setPhotoError}
        onChange={setPhoto}
        size="lg"
        showCaption={false}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className={labelClass}>{L.prenom}</span>
          <Input value={prenom} onChange={(e) => setPrenom(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{L.nom}</span>
          <Input value={nom} onChange={(e) => setNom(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <span className={labelClass}>{L.email}</span>
        <div className="relative">
          <Input className="opacity-80 pr-10" value={agent?.email ?? ''} readOnly disabled />
          <Lock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ma-muted" />
        </div>
        <span className="mt-1.5 flex items-center gap-1.5 text-xs italic text-ma-muted">
          <Lock className="h-3 w-3 shrink-0" />
          {L.emailHint}
        </span>
      </label>
      <label className="block">
        <span className={labelClass}>{L.telephone}</span>
        <Input value={telephone} onChange={(e) => setTelephone(e.target.value)} />
      </label>
      <div className="space-y-3 border-t border-ma-line pt-4 dark:border-white/10">
        <h3 className={labelClass}>{L.passwordSection}</h3>
        <p className="text-xs text-ma-muted">{L.complexity}</p>
        <label className="block">
          <span className={labelClass}>{L.currentPassword}</span>
          <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{L.newPassword}</span>
          <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        <label className="block">
          <span className={labelClass}>{L.confirmPassword}</span>
          <Input type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
        </label>
      </div>
      {error && <Feedback tone="danger">{error}</Feedback>}
      <Toast message={success} onDismiss={() => setSuccess(null)} />
      {!hideFooter && (
        <div className="flex justify-end gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              {L.cancel}
            </Button>
          )}
          <Button type="submit" disabled={save.isPending || !agent} className={cn(savedFlash && 'bg-status-success text-white hover:bg-status-success')}>
            {savedFlash ? <Check className="h-4 w-4" /> : null}
            {save.isPending ? L.saving : savedFlash ? L.saved : L.save}
          </Button>
        </div>
      )}
    </form>
  )
}

export function ProfileModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('profile.title')}
      size="lg"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>{t('profile.cancel')}</Button>
          <Button type="submit" form="ma-profile-form">{t('profile.save')}</Button>
        </>
      )}
    >
      <ProfileEditor compact hideFooter onCancel={onClose} />
    </Modal>
  )
}
