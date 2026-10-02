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
    'bg-ma-navy-800 text-ma-gold-400',
    'bg-[#15224a] text-ma-gold-300',
    'bg-[#1c2f63] text-ma-gold-400',
    'bg-[#24386e] text-[#f6d06a]',
  ]
  let hash = 0
  for (const ch of name ?? '') hash = (hash + ch.charCodeAt(0) * 17) % palette.length
  return palette[hash] ?? palette[0]
}

const sizes = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-20 w-20 text-xl',
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
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold ring-1 ring-ma-gold-500/25',
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
