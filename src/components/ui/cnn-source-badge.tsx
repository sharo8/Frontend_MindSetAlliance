import { useTranslation } from 'react-i18next'

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
    const age = ageSecondes == null ? '—' : String(ageSecondes)
    return (
      <p className="inline-flex rounded-full border border-ma-line bg-white/80 px-3 py-1 text-xs text-ma-navy-900 dark:border-white/10 dark:bg-white/8 dark:text-ma-gray-300">
        {t('cnn.source.live', { age })}
        {readOnlyVerified === false ? ` — ${t('cnn.source.grants')}` : ''}
      </p>
    )
  }
  const detail = message && !/indisponible/i.test(message) ? message : t('cnn.source.downDetail')
  return (
    <p className="inline-flex rounded-full border border-status-danger/40 bg-status-danger/10 px-3 py-1 text-xs text-red-800 dark:text-red-200">
      {t('cnn.source.down', { message: detail })}
    </p>
  )
}
