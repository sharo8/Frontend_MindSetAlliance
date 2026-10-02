import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

function flatten(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      keys.push(...flatten(value as Record<string, unknown>, path))
    } else {
      keys.push(path)
    }
  }
  return keys
}

function load(lang: string) {
  const file = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'locales', `${lang}.json`)
  return JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
}

describe('locale key parity', () => {
  const fr = new Set(flatten(load('fr')))

  it.each(['en', 'ln', 'sw'] as const)('%s has every French key', (lang) => {
    const other = new Set(flatten(load(lang)))
    const missing = [...fr].filter((key) => !other.has(key)).sort()
    expect(missing).toEqual([])
  })

  it.each(['en', 'ln', 'sw'] as const)('%s has no extra keys vs French', (lang) => {
    const other = flatten(load(lang))
    const extra = other.filter((key) => !fr.has(key)).sort()
    expect(extra).toEqual([])
  })
})
