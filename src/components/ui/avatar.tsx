import { useQuery } from '@tanstack/react-query'
import { UserRound } from 'lucide-react'
import { fetchAgentPhoto } from '../../lib/api/iam-admin'
import { cn } from '../../lib/utils'

export function initialsFrom(name?: string | null) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean)
  const a = parts[0]?.[0] ?? ''
  const b = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? ''
  return `${a}${b}`.toUpperCase() || ''
}

export function avatarTone(name?: string | null) {
  const palette = [
    'bg-gradient-to-b from-[#2a3b8f] to-[#111b3f] text-ma-gold-300',
    'bg-gradient-to-b from-[#f8d977] to-[#d9a521] text-ma-navy-900',
    'bg-gradient-to-b from-[#3fd0b2] to-[#108a75] text-white',
    'bg-gradient-to-b from-[#a98bfa] to-[#6d3fe0] text-white',
    'bg-gradient-to-b from-[#6cc0f2] to-[#2380c4] text-white',
    'bg-gradient-to-b from-[#f6936f] to-[#d84b28] text-white',
  ]
  let hash = 0
  for (const ch of name ?? '') hash = (hash + ch.charCodeAt(0) * 17) % palette.length
  return palette[hash] ?? palette[0]
}

const sizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-[12px]',
  lg: 'h-20 w-20 text-[26px]',
}

export function Avatar({
  name,
  src,
  agentId,
  hasPhoto,
  size = 'sm',
  className,
}: {
  name?: string | null
  src?: string | null
  agentId?: number | null
  hasPhoto?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const photo = useQuery({
    queryKey: ['agent-photo', agentId],
    queryFn: () => fetchAgentPhoto(agentId!),
    enabled: Boolean(agentId && hasPhoto && !src),
    staleTime: 5 * 60_000,
  })
  const image = src || (hasPhoto ? photo.data?.photo : null) || null
  const initials = initialsFrom(name)
  return (
    <span
      title={name ?? undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold tracking-[0.02em] shadow-[inset_0_1px_0_rgb(255_255_255/0.35),0_2px_6px_-2px_rgb(17_27_63/0.35)] ring-2 ring-surface',
        image ? 'bg-ma-navy-800' : avatarTone(name),
        sizes[size],
        className,
      )}
    >
      {image ? (
        <img src={image} alt="" className="h-full w-full object-cover" />
      ) : initials ? (
        initials
      ) : (
        <UserRound className={cn('text-ma-gray-300', size === 'lg' ? 'h-9 w-9' : 'h-3.5 w-3.5')} />
      )}
    </span>
  )
}
