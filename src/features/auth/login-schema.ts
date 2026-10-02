import { z } from 'zod'

export function makeLoginSchema(t: (key: string) => string) {
  return z.object({
    email: z.string().email(t('login.emailInvalid')),
    password: z.string().min(1, t('login.passwordRequired')),
  })
}

export type LoginValues = { email: string; password: string }