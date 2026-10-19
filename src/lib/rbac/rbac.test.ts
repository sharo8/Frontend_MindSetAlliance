import { describe, expect, it } from 'vitest'
import { buildMenuFromPermissions, buildNavSections, hasFullAccess, hasPermission, visibleProjectCodes } from './rbac'

describe('RBAC navigation', () => {
  const supportCnn = [{ projectCode: 'CNN', role: 'SUPPORT' }]

  it('ne propose jamais Mindset du Royaume au support CNN', () => {
    const menuCnn = buildMenuFromPermissions(supportCnn, 'CNN')
    const labels = menuCnn.map((item) => item.id)
    expect(labels).toContain('compte')
    expect(labels).not.toContain('tickets')
    expect(labels).not.toContain('mdr')
    expect(labels).not.toContain('access')
    expect(visibleProjectCodes(supportCnn)).toEqual(['CNN'])
  })

  it('masque Colis na Nga si le projet sélectionné est MDR', () => {
    const menu = buildMenuFromPermissions([{ projectCode: 'MDR', role: 'MARKETING' }], 'MDR')
    expect(menu.map((i) => i.id)).not.toContain('cnn')
    expect(menu.map((i) => i.id)).toContain('mdr')
  })

  it('accorde MANAGE_TICKETS au support', () => {
    expect(hasPermission(supportCnn, 'MANAGE_TICKETS', 'CNN')).toBe(true)
    expect(hasPermission(supportCnn, 'VIEW_FINANCE', 'CNN')).toBe(false)
  })

  it('montre Gestion des accès uniquement avec MANAGE_ACCESS', () => {
    const rh = [{ projectCode: null, role: 'RH' }]
    expect(buildMenuFromPermissions(rh, 'ENTREPRISE').map((i) => i.id)).toContain('access')
    expect(buildMenuFromPermissions(supportCnn, 'CNN').map((i) => i.id)).not.toContain('access')
  })

  it('montre Commercial après attribution du rôle COMMERCIAL', () => {
    const both = [
      { projectCode: 'CNN', role: 'SUPPORT' },
      { projectCode: 'CNN', role: 'COMMERCIAL' },
    ]
    expect(buildMenuFromPermissions(both, 'ENTREPRISE').map((i) => i.id)).toContain('enterprises')
    expect(buildMenuFromPermissions(supportCnn, 'ENTREPRISE').map((i) => i.id)).not.toContain('enterprises')
    // Dans l'espace Colis na Nga, seuls les menus Colis na Nga apparaissent.
    expect(buildMenuFromPermissions(both, 'CNN').map((i) => i.id)).not.toContain('enterprises')
  })

  it('affiche les menus Colis na Nga selon les droits calculés par le Core', () => {
    const granted = new Set(['VIEW_CNN_DASHBOARD', 'MANAGE_CNN_ORDERS'])
    const ids = buildNavSections(supportCnn, 'CNN', [], granted).flatMap((s) => s.items.map((i) => i.id))
    expect(ids).toEqual(['cnn-home', 'cnn-map', 'cnn-stats', 'cnn-orders', 'cnn-incidents', 'compte'])
  })

  it('autorise Toute l’entreprise seulement si le rôle n’est pas lié à un projet', () => {
    const direction = [{ projectCode: null, role: 'DIRECTION' }]
    expect(visibleProjectCodes(direction)).toEqual(['*'])
    const ids = buildNavSections(direction, 'ENTREPRISE').map((s) => s.id)
    expect(ids).toContain('direction')
    expect(ids).toContain('admin')
    expect(ids).not.toContain('cnn-admin')
    expect(ids).not.toContain('mdr')
  })

  it('isole GRANT et DENY par projet sans fuite vers un autre projet', () => {
    const finance = [
      { projectCode: 'CNN', role: 'FINANCE' },
      { projectCode: 'MDR', role: 'FINANCE' },
    ]
    const denyPayrollCnn = [{ permission: 'VIEW_PAYROLL', projectCode: 'CNN', type: 'DENY' as const }]
    expect(hasPermission(finance, 'VIEW_PAYROLL', 'CNN', denyPayrollCnn)).toBe(false)
    expect(hasPermission(finance, 'VIEW_PAYROLL', 'MDR', denyPayrollCnn)).toBe(true)
    const grantMonitorMdr = [{ permission: 'VIEW_MONITORING', projectCode: 'MDR', type: 'GRANT' as const }]
    expect(hasPermission(finance, 'VIEW_MONITORING', 'MDR', grantMonitorMdr)).toBe(true)
    expect(hasPermission(finance, 'VIEW_MONITORING', 'CNN', grantMonitorMdr)).toBe(false)
  })

  it('donne un accès total à ADMIN_SYSTEME', () => {
    const admin = [{ projectCode: null, role: 'ADMIN_SYSTEME' }]
    expect(hasFullAccess(admin)).toBe(true)
    expect(hasPermission(admin, 'VIEW_PAYROLL', 'MDR')).toBe(true)
    const ids = buildNavSections(admin, 'ENTREPRISE').map((s) => s.id)
    expect(ids).toEqual(expect.arrayContaining(['finance', 'hr', 'legal', 'marketing', 'tech', 'direction', 'admin']))
    // Chaque projet n'affiche que ses propres menus.
    expect(buildNavSections(admin, 'CNN').map((s) => s.id)).toEqual(['home', 'cnn-admin', 'footer'])
    expect(buildNavSections(admin, 'MDR').map((s) => s.id)).toEqual(['home', 'mdr', 'footer'])
    expect(buildMenuFromPermissions(supportCnn, 'CNN').map((i) => i.id)).not.toContain('payroll')
  })

  it('réserve le module Sociétés à Direction et Admin', () => {
    const direction = [{ projectCode: null, role: 'DIRECTION' }]
    expect(buildMenuFromPermissions(direction, 'ENTREPRISE').map((i) => i.id)).toContain('societes')
    expect(buildMenuFromPermissions(direction, 'ENTREPRISE').map((i) => i.id)).toContain('assistant')
    expect(buildMenuFromPermissions(supportCnn, 'CNN').map((i) => i.id)).not.toContain('societes')
    expect(buildMenuFromPermissions(supportCnn, 'CNN').map((i) => i.id)).not.toContain('assistant')
  })
})
