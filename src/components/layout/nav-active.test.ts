import { describe, expect, it } from 'vitest'
import { resolveActiveNavId } from './nav-active'

const menu = [
  { id: 'accueil', to: '/' },
  { id: 'cnn', to: '/supervision/operations' },
  { id: 'fleet', to: '/operations/flotte' },
  { id: 'tickets', to: '/tickets' },
  { id: 'bugs', to: '/tickets-techniques' },
  { id: 'finance-home', to: '/finance' },
  { id: 'subscriptions', to: '/finance/abonnements' },
  { id: 'rh', to: '/rh' },
  { id: 'agents-hr', to: '/rh/agents' },
  { id: 'leaves', to: '/rh/conges' },
  { id: 'payroll', to: '/rh/paie' },
  { id: 'compte', to: '/compte' },
]

function active(pathname: string) {
  return resolveActiveNavId(pathname, menu)
}

describe('resolveActiveNavId', () => {
  it('n’active que l’accueil sur la racine', () => {
    expect(active('/')).toBe('accueil')
    expect(active('/?projectCode=CNN')).toBe('accueil')
  })

  it('active la page parente uniquement sur son chemin exact', () => {
    expect(active('/rh')).toBe('rh')
    expect(active('/rh/')).toBe('rh')
    expect(active('/finance')).toBe('finance-home')
  })

  it('préfère le plus long préfixe sur une sous-page', () => {
    expect(active('/rh/conges')).toBe('leaves')
    expect(active('/rh/conges/')).toBe('leaves')
    expect(active('/rh/conges?projectCode=CNN&page=2')).toBe('leaves')
    expect(active('/finance/abonnements')).toBe('subscriptions')
  })

  it('rattache les pages de détail à leur entrée', () => {
    expect(active('/tickets')).toBe('tickets')
    expect(active('/tickets/5')).toBe('tickets')
    expect(active('/tickets/5?filtre=ouverts')).toBe('tickets')
    expect(active('/rh/agents/12')).toBe('agents-hr')
  })

  it('ne franchit pas une frontière de segment', () => {
    expect(active('/rhume')).toBeNull()
    expect(active('/tickets-techniques')).toBe('bugs')
    expect(active('/tickets-techniques/3')).toBe('bugs')
  })

  it('active la supervision et le compte, et rien sur une URL inconnue', () => {
    expect(active('/supervision/operations')).toBe('cnn')
    expect(active('/compte')).toBe('compte')
    expect(active('/introuvable')).toBeNull()
    expect(active('/admin')).toBeNull()
  })
})
