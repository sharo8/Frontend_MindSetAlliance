export type GreetingPeriod = 'morning' | 'afternoon' | 'evening'

/** Heure locale du navigateur. 05:00–11:59 matin, 12:00–17:59 après-midi, sinon soir. */
export function greetingPeriod(date: Date): GreetingPeriod {
  const hour = date.getHours()
  if (hour >= 5 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 18) return 'afternoon'
  return 'evening'
}

export function greetingName(prenom: string | undefined, email: string | null | undefined): string {
  const first = prenom?.trim()
  if (first) return first
  const local = (email ?? '').split('@')[0]?.trim() ?? ''
  if (!local) return ''
  return local.charAt(0).toUpperCase() + local.slice(1)
}
