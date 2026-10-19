import { cn } from '../../lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('ma-shimmer rounded-[10px]', className)} />
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3.5 p-5" role="status" aria-label="Chargement">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4" style={{ opacity: 1 - i * 0.1 }}>
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          {Array.from({ length: cols - 1 }).map((__, j) => (
            <Skeleton key={j} className={cn('h-3.5', j === 0 ? 'flex-[2]' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  )
}
