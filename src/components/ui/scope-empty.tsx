import { Layers } from 'lucide-react'
import { IconTile } from './card'

export function ScopeEmpty({ context }: { context?: string }) {
  return (
    <div className="clay flex flex-col items-center rounded-[var(--radius-ma)] px-6 py-14 text-center ring-1 ring-hairline">
      <IconTile tone="neutral" size="lg">
        <Layers />
      </IconTile>
      <p className="mt-4 text-[17px] font-semibold tracking-[-0.02em] text-ink">Aucune donnée pour ce contexte</p>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-relaxed text-ink-3">
        {context ?? 'Le sélecteur en haut à gauche ne correspond à aucune donnée sur cette page. Choisissez un autre projet ou « Toute l’entreprise ».'}
      </p>
    </div>
  )
}

/** État vide générique, réutilisable dans les cartes et les listes. */
export function EmptyState({ icon, title, hint, action }: { icon: React.ReactNode; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 px-4 py-10 text-center">
      <IconTile tone="neutral">{icon}</IconTile>
      <p className="mt-2.5 text-[14px] font-semibold text-ink">{title}</p>
      {hint && <p className="max-w-[18rem] text-[12.5px] leading-relaxed text-ink-3">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
