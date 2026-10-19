import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Circle, KeyRound, Lock, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { AgentPhotoField } from '../../components/ui/AgentPhotoField'
import { Badge } from '../../components/ui/badge'
import { Button } from '../../components/ui/button'
import { Card } from '../../components/ui/card'
import { Feedback } from '../../components/ui/feedback'
import { FieldLabel, Input } from '../../components/ui/input'
import { Modal } from '../../components/ui/modal'
import { RoleScopeBadges } from '../../components/ui/role-scope-badges'
import { Skeleton } from '../../components/ui/skeleton'
import { SectionCard } from '../../components/ui/toolbar'
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
  emailHint: 'Identifiant de connexion, non modifiable.',
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
  /** `page` : en-tête avec grand avatar et sections en cartes (page Mon compte). */
  variant?: 'page' | 'modal'
  /** Contenu affiché à droite des sections sur grand écran (variante page). */
  aside?: ReactNode
}

/** Règle du mot de passe, cochée au fil de la saisie. */
function Rule({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <li className={cn('flex items-center gap-1.5 text-[12.5px] transition-colors duration-200', ok ? 'text-status-success' : 'text-ink-3')}>
      {ok ? <Check className="h-3.5 w-3.5" strokeWidth={2.6} /> : <Circle className="h-3 w-3" strokeWidth={2} />}
      {children}
    </li>
  )
}

export function ProfileEditor({ onCancel, hideFooter, french, variant = 'modal', aside }: Props) {
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
        emailHint: t('acces.profile.emailHint', 'Identifiant de connexion, non modifiable.'),
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
      void queryClient.invalidateQueries({ queryKey: ['agents-me'] })
      void queryClient.invalidateQueries({ queryKey: ['agent-photo'] })
    },
    onError: (err) => {
      setSuccess(null)
      setError(err instanceof ApiError ? err.message : t('profile.saveError'))
    },
  })

  const page = variant === 'page'
  const fullName = `${prenom || agent?.prenom || ''} ${nom || agent?.nom || ''}`.trim()
  const mismatch = Boolean(confirmPassword) && confirmPassword !== newPassword

  const photoField = (
    <AgentPhotoField
      prenom={prenom || agent?.prenom || ''}
      nom={nom || agent?.nom || ''}
      value={photo}
      error={photoError}
      onError={setPhotoError}
      onChange={setPhoto}
      size="lg"
      showCaption={!page}
      layout={page ? 'avatar' : 'row'}
    />
  )

  const identityFields = (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <FieldLabel>{L.prenom}</FieldLabel>
          <Input value={prenom} autoComplete="given-name" onChange={(e) => setPrenom(e.target.value)} />
        </label>
        <label className="block min-w-0">
          <FieldLabel>{L.nom}</FieldLabel>
          <Input value={nom} autoComplete="family-name" onChange={(e) => setNom(e.target.value)} />
        </label>
      </div>
      <label className="block">
        <FieldLabel>{L.email}</FieldLabel>
        <div className="relative">
          <Input className="pr-10" value={agent?.email ?? ''} readOnly disabled />
          <Lock className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-3" />
        </div>
        <span className="mt-1.5 block text-[12px] text-ink-3">{L.emailHint}</span>
      </label>
      <label className="block">
        <FieldLabel>{L.telephone}</FieldLabel>
        <Input type="tel" autoComplete="tel" placeholder="+243 81 234 5678" value={telephone} onChange={(e) => setTelephone(e.target.value)} />
      </label>
    </div>
  )

  const passwordFields = (
    <div className="space-y-4">
      <label className="block">
        <FieldLabel>{L.currentPassword}</FieldLabel>
        <Input type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block min-w-0">
          <FieldLabel>{L.newPassword}</FieldLabel>
          <Input type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        </label>
        <label className="block min-w-0">
          <FieldLabel>{L.confirmPassword}</FieldLabel>
          <Input
            type="password"
            autoComplete="new-password"
            aria-invalid={mismatch}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
          />
        </label>
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label={L.complexity}>
        <Rule ok={newPassword.length >= 8}>{t('acces.profile.ruleLength', '8 caractères minimum')}</Rule>
        <Rule ok={/[A-Za-z]/.test(newPassword)}>{t('acces.profile.ruleLetter', 'Une lettre')}</Rule>
        <Rule ok={/\d/.test(newPassword)}>{t('acces.profile.ruleDigit', 'Un chiffre')}</Rule>
        <Rule ok={Boolean(newPassword) && confirmPassword === newPassword}>{t('acces.profile.ruleMatch', 'Confirmation identique')}</Rule>
      </ul>
    </div>
  )

  const submit = (
    <Button type="submit" disabled={save.isPending || !agent} className={cn(savedFlash && '[background:linear-gradient(180deg,#34c172,#16a34a)] text-white')}>
      {savedFlash ? <Check className="h-4 w-4" /> : null}
      {save.isPending ? L.saving : savedFlash ? L.saved : L.save}
    </Button>
  )

  if (page) {
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

        <Card className="overflow-hidden">
          <div className="relative flex flex-col items-center gap-5 px-5 py-6 text-center sm:flex-row sm:items-center sm:px-7 sm:text-left">
            {photoField}
            <div className="min-w-0 flex-1">
              {profile.isLoading ? (
                <div className="space-y-2.5">
                  <Skeleton className="mx-auto h-7 w-56 sm:mx-0" />
                  <Skeleton className="mx-auto h-4 w-44 sm:mx-0" />
                </div>
              ) : (
                <>
                  <h2 className="text-[24px] font-bold leading-tight tracking-[-0.03em] text-ink sm:text-[26px]">{fullName || '–'}</h2>
                  <p className="mt-1 truncate text-[14px] text-ink-3">
                    {agent?.email}
                    {agent?.departement ? ` · ${agent.departement}` : ''}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 sm:justify-start">
                    <Badge dot tone={agent?.statut === 'ACTIF' ? 'success' : 'danger'}>
                      {agent?.statut === 'ACTIF' ? t('common.active') : t('common.inactive')}
                    </Badge>
                    {agent?.twoFactorEnabled && (
                      <Badge tone="info">
                        <ShieldCheck className="h-3 w-3" aria-hidden />
                        {t('acces.profile.twoFactor', 'Double authentification')}
                      </Badge>
                    )}
                    {(agent?.roles ?? []).map((r, i) => (
                      <RoleScopeBadges key={`${r.role}-${r.projectCode}-${i}`} role={r.role} projectCode={r.projectCode} />
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </Card>

        <div className={cn('grid gap-5', aside && 'xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]')}>
          <div className="min-w-0 space-y-5">
            <SectionCard
              title={t('acces.profile.identity', 'Informations personnelles')}
              subtitle={t('acces.profile.identityHint', 'Visibles par vos collègues dans l’annuaire.')}
              icon={<UserRound />}
              tone="navy"
            >
              {identityFields}
            </SectionCard>
            <SectionCard title={L.passwordSection} subtitle={L.complexity} icon={<KeyRound />} tone="gold">
              {passwordFields}
            </SectionCard>
            {error && <Feedback tone="danger">{error}</Feedback>}
            {!hideFooter && (
              <div className="flex flex-wrap items-center justify-end gap-2">
                {onCancel && (
                  <Button variant="outline" onClick={onCancel}>
                    {L.cancel}
                  </Button>
                )}
                {submit}
              </div>
            )}
          </div>
          {aside && <div className="min-w-0">{aside}</div>}
        </div>
        <Toast message={success} onDismiss={() => setSuccess(null)} />
      </form>
    )
  }

  return (
    <form
      id="ma-profile-form"
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        save.mutate()
      }}
    >
      {profile.isError && <Feedback tone="danger">{t('profile.loadError')}</Feedback>}
      {photoField}
      {identityFields}
      <div className="space-y-4 border-t border-hairline pt-5">
        <div>
          <h3 className="flex items-center gap-2 text-[14.5px] font-semibold tracking-[-0.015em] text-ink">
            <KeyRound className="h-4 w-4 text-accent-ink" />
            {L.passwordSection}
          </h3>
          <p className="mt-0.5 text-[12.5px] text-ink-3">{L.complexity}</p>
        </div>
        {passwordFields}
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
          {submit}
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
      kicker={t('pages.account.kicker')}
      size="lg"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>
            {t('profile.cancel')}
          </Button>
          <Button type="submit" form="ma-profile-form">
            {t('profile.save')}
          </Button>
        </>
      )}
    >
      <ProfileEditor compact hideFooter onCancel={onClose} />
    </Modal>
  )
}
