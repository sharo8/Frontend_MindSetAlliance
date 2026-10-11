import { describe, expect, it } from 'vitest'
import { greetingName, greetingPeriod } from './greeting'

describe('greetingPeriod', () => {
  it('couvre 08:00, 14:00 et 20:00', () => {
    expect(greetingPeriod(new Date(2026, 9, 11, 8, 0))).toBe('morning')
    expect(greetingPeriod(new Date(2026, 9, 11, 14, 0))).toBe('afternoon')
    expect(greetingPeriod(new Date(2026, 9, 11, 20, 0))).toBe('evening')
  })

  it('respecte les bornes 05:00, 12:00 et 18:00', () => {
    expect(greetingPeriod(new Date(2026, 9, 11, 4, 59))).toBe('evening')
    expect(greetingPeriod(new Date(2026, 9, 11, 5, 0))).toBe('morning')
    expect(greetingPeriod(new Date(2026, 9, 11, 11, 59))).toBe('morning')
    expect(greetingPeriod(new Date(2026, 9, 11, 12, 0))).toBe('afternoon')
    expect(greetingPeriod(new Date(2026, 9, 11, 17, 59))).toBe('afternoon')
    expect(greetingPeriod(new Date(2026, 9, 11, 18, 0))).toBe('evening')
  })
})

describe('greetingName', () => {
  it('prend le prénom, sinon la partie locale de l’e-mail', () => {
    expect(greetingName('Aline', 'aline.k@mindsetalliance.cd')).toBe('Aline')
    expect(greetingName('  ', 'patrick.nsimba@mindsetalliance.cd')).toBe('Patrick.nsimba')
    expect(greetingName(undefined, null)).toBe('')
  })
})
