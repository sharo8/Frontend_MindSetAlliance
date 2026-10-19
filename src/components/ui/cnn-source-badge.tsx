import { useTranslation } from 'react-i18next'

/** Pastille d'état de la source Colis na Nga (temps réel ou indisponible). */
export function CnnSourceBadge({
  source,
  ageSecondes,
  message,
  readOnlyVerified,
}: {
  source?: string | null
  ageSecondes?: number | null
  message?: string | null
  readOnlyVerified?: boolean | null
}) {
  const { t } = useTranslation()
  if (source === 'CNN_DB') {
    const age = ageSecondes == null ? '–' : String(ageSecondes)
    return (
      <p className="inline-flex min-h-7 items-center gap-2 rounded-[14px] bg-status-success/10 px-3 py-1 text-[12px] font-medium text-[#0f7a37] ring-1 ring-inset ring-status-success/20 dark:text-[#4ade80]">
        <span className="relative flex h-2 w-2">
          <span className="ma-pulse absolute inline-flex h-full w-full rounded-full bg-status-success/60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-status-success" />
        </span>
        {t('cnn.source.live', { age })}
        {readOnlyVerified === false ? ` · ${t('cnn.source.grants')}` : ''}
      </p>
    )
  }
  const detail = message && !/indisponible/i.test(message) ? message : t('cnn.source.downDetail')
  return (
    <p className="inline-flex min-h-7 items-center gap-2 rounded-[14px] bg-status-danger/10 px-3 py-1 text-[12px] font-medium text-[#b91c1c] ring-1 ring-inset ring-status-danger/20 dark:text-[#f87171]">
      <span className="h-2 w-2 shrink-0 rounded-full bg-status-danger" />
      {t('cnn.source.down', { message: detail })}
    </p>
  )
}
