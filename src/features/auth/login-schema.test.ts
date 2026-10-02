import { describe, expect, it } from 'vitest'
import { makeLoginSchema } from './login-schema'

const schema = makeLoginSchema((key) => String(key))

describe('loginSchema', () => {
  it('refuse un e-mail invalide', () => {
    const result = schema.safeParse({ email: 'pas-un-email', password: 'x' })
    expect(result.success).toBe(false)
  })

  it('accepte un identifiant professionnel', () => {
    const result = schema.safeParse({
      email: 'support.cnn@mindsetalliance.cd',
      password: 'ChangeMe123!',
    })
    expect(result.success).toBe(true)
  })
})
