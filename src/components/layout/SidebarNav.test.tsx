import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '../../lib/i18n/i18n'
import type { NavSection } from '../../lib/rbac/rbac'
import { SidebarNav } from './SidebarNav'

const sections: NavSection[] = [
  { id: 'home', items: [{ id: 'accueil', label: 'Accueil', to: '/' }] },
  {
    id: 'operations',
    label: 'Opérations',
    items: [{ id: 'cnn', label: 'Supervision opérationnelle', to: '/supervision/operations' }],
  },
  {
    id: 'tickets-sec',
    label: 'Billetterie',
    items: [{ id: 'tickets', label: 'Tickets', to: '/tickets' }],
  },
  {
    id: 'hr',
    label: 'Ressources humaines',
    items: [
      { id: 'rh', label: 'Vue RH', to: '/rh' },
      { id: 'agents-hr', label: 'Agents internes', to: '/rh/agents' },
      { id: 'leaves', label: 'Personnel & congés', to: '/rh/conges' },
    ],
  },
  { id: 'footer', items: [{ id: 'compte', label: 'Mon compte', to: '/compte' }] },
]

function renderAt(path: string, compact = false) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SidebarNav sections={sections} compact={compact} storageKey={`nav-test-${path}`} />
    </MemoryRouter>,
  )
}

function activeLabel() {
  const current = screen.queryAllByRole('link', { current: 'page' })
  expect(current.length).toBeLessThanOrEqual(1)
  return current[0]?.textContent ?? null
}

describe('SidebarNav entrée active', () => {
  it.each([
    ['/', 'Accueil'],
    ['/rh', 'Ressources humaines'],
    ['/rh/conges', 'Personnel & congés'],
    ['/rh/conges?projectCode=CNN', 'Personnel & congés'],
    ['/tickets', 'Tickets'],
    ['/tickets/5', 'Tickets'],
    ['/supervision/operations', 'Supervision opérationnelle'],
    ['/compte', 'Mon compte'],
  ])('%s active uniquement « %s »', (path, label) => {
    renderAt(path)
    expect(activeLabel()).toBe(label)
  })

  it('n’active aucune entrée sur une URL inconnue', () => {
    renderAt('/introuvable')
    expect(activeLabel()).toBeNull()
  })

  it('marque la section repliée d’un point sans surligner d’entrée', async () => {
    const user = userEvent.setup()
    renderAt('/rh/conges')
    await user.click(screen.getByRole('button', { name: 'Ressources humaines' }))
    // La section se replie avec une animation : on attend la fin de la sortie.
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Personnel & congés' })).not.toBeInTheDocument())
    expect(screen.queryByRole('link', { current: 'page' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ressources humaines' }).querySelector('[aria-hidden="true"]')).toBeTruthy()
  })

  it('garde l’entrée active quand la barre est réduite aux icônes', () => {
    renderAt('/rh/conges', true)
    const current = screen.getByRole('link', { current: 'page' })
    expect(current).toHaveAttribute('title', 'Personnel & congés')
    expect(screen.queryAllByRole('link', { current: 'page' })).toHaveLength(1)
  })
})
