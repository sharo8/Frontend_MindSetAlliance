import { Camera, UserRound } from 'lucide-react'
import { useRef } from 'react'
import { cn } from '../../lib/utils'
import { avatarTone, initialsFrom } from './avatar'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPT = ['image/jpeg', 'image/png', 'image/webp']

export function AgentPhotoField({
  prenom,
  nom,
  value,
  error,
  onChange,
  onError,
  size = 'md',
  showCaption = true,
}: {
  prenom: string
  nom: string
  value: string | null
  error: string | null
  onChange: (dataUrl: string | null) => void
  onError: (message: string | null) => void
  size?: 'md' | 'lg'
  showCaption?: boolean
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

  const dim = size === 'lg' ? 'h-28 w-28' : 'h-24 w-24'
  return (
    <div className="flex flex-col items-center gap-2 pb-1">
      {showCaption && (
        <span className="self-start text-[11px] font-semibold uppercase tracking-[0.14em] text-ma-muted">Photo de profil</span>
      )}
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          'group relative overflow-hidden rounded-full ring-2 ring-ma-gold-500/35 transition hover:ring-ma-gold-500 hover:shadow-[0_0_0_4px_rgba(224,167,33,0.18)]',
          dim,
        )}
        title="Changer la photo"
      >
        {value ? (
          <img src={value} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className={cn('flex h-full w-full items-center justify-center text-xl font-semibold', avatarTone(name))}>
            {initials || <UserRound className="h-10 w-10 text-ma-gray-300" />}
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-ma-navy-950/55 opacity-0 transition group-hover:opacity-100 group-focus:opacity-100">
          <Camera className="h-7 w-7 text-ma-gold-400" />
        </span>
      </button>
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
      {error ? (
        <p className="text-center text-xs text-status-danger">{error}</p>
      ) : (
        <p className="text-center text-[11px] text-ma-muted">JPEG, PNG ou WebP · 5 Mo max</p>
      )}
    </div>
  )
}
