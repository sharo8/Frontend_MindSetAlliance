export function ScopeEmpty({ context }: { context?: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-ma-line bg-white/70 px-6 py-12 text-center dark:border-white/10 dark:bg-ma-navy-900/40">
      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-ma-muted">Contexte</p>
      <p className="mt-2 font-display text-lg text-ma-navy-900 dark:text-ma-gold-400">Aucune donnée pour ce contexte</p>
      <p className="mx-auto mt-2 max-w-md text-sm text-ma-muted">
        {context ?? 'Le sélecteur en haut à gauche ne correspond à aucune donnée sur cette page. Choisissez un autre projet ou « Toute l’entreprise ».'}
      </p>
    </div>
  )
}
