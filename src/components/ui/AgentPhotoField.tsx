import { Camera, ImageUp, UserRound } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '../../lib/utils'
import { avatarTone, initialsFrom } from './avatar'
import { Button } from './button'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

/**
 * Photo d'agent. `layout="row"` : pastille + texte + bouton (formulaires).
 * `layout="avatar"` : grande pastille seule avec badge appareil photo (en-tête de profil).
 */
export function AgentPhotoField({
  prenom,
  nom,
  value,
  error,
  onChange,
  onError,
  size = 'md',
  showCaption = true,
  layout = 'row',
}: {
  prenom: string
  nom: string
  value: string | null
  error: string | null
  onChange: (dataUrl: string | null) => void
  onError: (message: string | null) => void
  size?: 'md' | 'lg'
  showCaption?: boolean
  layout?: 'row' | 'avatar'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const name = `${prenom} ${nom}`.trim()
  const initials = initialsFrom(name)

  function pick(file: File | undefined) {
    if (!file) return
    if (!ACCEPT.includes(file.type)) {
      onError('Format invalide. Utilisez un fichier JPEG, PNG ou WebP.')
      return
    }
    if (file.size > MAX_BYTES) {
      onError('La photo dépasse 5 Mo. Choisissez une image plus légère.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      onError(null)
      onChange(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.readAsDataURL(file)
  }

  const open = () => inputRef.current?.click()
  const dim = layout === 'avatar' ? (size === 'lg' ? 'h-28 w-28 text-[34px]' : 'h-24 w-24 text-[30px]') : size === 'lg' ? 'h-20 w-20 text-[26px]' : 'h-[72px] w-[72px] text-[24px]'

  const avatar = (
    <button
      type="button"
      onClick={open}
      aria-label="Changer la photo"
      title="Changer la photo"
      className={cn(
        'group press relative shrink-0 rounded-full p-[3px] focus-visible:outline-none focus-visible:[box-shadow:var(--ring-focus)]',
        'bg-gradient-to-b from-ma-gold-300 to-ma-gold-600 shadow-[0_8px_24px_-10px_rgb(220_170_40/0.7)]',
      )}
    >
      <span className={cn('relative block overflow-hidden rounded-full ring-[3px] ring-surface', dim)}>
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={cn('flex h-full w-full items-center justify-center font-semibold tracking-[0.02em]', avatarTone(name))}>
            {initials || <UserRound className="h-1/2 w-1/2 opacity-80" />}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-ma-navy-950/50 opacity-0 backdrop-blur-[1px] transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
          <Camera className="h-6 w-6 text-white" strokeWidth={2} />
        </span>
      </span>
      <span
        aria-hidden
        className="glass-strong absolute bottom-0.5 right-0.5 flex h-8 w-8 items-center justify-center rounded-full text-ink-2 transition-transform duration-200 group-hover:scale-105"
      >
        <Camera className="h-4 w-4" strokeWidth={2.1} />
      </span>
    </button>
  )

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={(e) => {
        pick(e.target.files?.[0])
        e.target.value = ''
      }}
    />
  )

  const hint = error ? (
    <p className="text-[12px] font-medium text-status-danger">{error}</p>
  ) : (
    <p className="text-[12px] text-ink-3">JPEG, PNG ou WebP, 5 Mo maximum</p>
  )

  if (layout === 'avatar') {
    return (
      <div className="flex flex-col items-center gap-2">
        {avatar}
        {input}
        {(error || showCaption) && <div className="text-center">{hint}</div>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      {avatar}
      {input}
      <div className="min-w-0 space-y-1.5">
        {showCaption && <p className="text-[13.5px] font-semibold text-ink">Photo de profil</p>}
        {hint}
        <Button type="button" variant="outline" size="sm" onClick={open}>
          <ImageUp className="h-[15px] w-[15px]" />
          {value ? 'Changer la photo' : 'Choisir une photo'}
        </Button>
      </div>
    </div>
  )
}
