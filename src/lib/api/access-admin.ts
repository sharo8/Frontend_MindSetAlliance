import { api } from './client'
import type { PageResponse } from './iam-admin'

export type AccessRoleBadge = {
  id: number
  roleId: number
  role: string
  projectId: number | null
  projectCode: string | null
  projectNom: string | null
}

export type AccessAgent = {
  id: number
  nom: string
  prenom: string
  emailPro: string
  statut: string
  createdAt?: string
  hasPhoto?: boolean
  departement?: { id: number; nom: string; code: string } | null
  roles: AccessRoleBadge[]
}

export type AccessStats = {
  total: number
  actifs: number
  entreprise: number
  projetSeul: number
}

export type AccessHistoryRow = {
  id: number
  action: string
  createdAt?: string
  auteur?: string
  role?: string
  project?: string
  cible?: string
}

export function listAccessAgents(params: {
  q?: string
  page?: number
  departementId?: string
  statut?: string
  role?: string
  scope?: string
  sort?: string
}) {
  const query = new URLSearchParams()
  if (params.q) query.set('q', params.q)
  if (params.departementId) query.set('departement', params.departementId)
  if (params.statut) query.set('statut', params.statut)
  if (params.role) query.set('role', params.role)
  if (params.scope) query.set('scope', params.scope)
  query.set('page', String(params.page ?? 0))
  query.set('size', '20')
  query.set('sort', params.sort ?? 'createdAt,desc')
  return api.get<PageResponse<AccessAgent>>(`/api/admin/agents?${query}`)
}

export function fetchAccessStats() {
  return api.get<AccessStats>('/api/admin/access-stats')
}

export function fetchAccessHistory(agentId: number) {
  return api.get<AccessHistoryRow[]>(`/api/admin/agents/${agentId}/access-history`)
}

export function syncAgentAccess(agentId: number, body: { companyRoleId: number | null; projects: { projectId: number; roleId: number | null }[] }) {
  return api.put<{ message?: string; roles?: AccessRoleBadge[] }>(`/api/admin/agents/${agentId}/access`, body)
}

export function listAgentAccessRoles(agentId: number) {
  return api.get<AccessRoleBadge[]>(`/api/admin/agents/${agentId}/roles`)
}

export function assignAgentRole(agentId: number, roleId: number, projectId?: number | null) {
  return api.post<AccessRoleBadge & { message?: string }>(`/api/admin/agents/${agentId}/roles`, {
    roleId,
    projectId: projectId ?? null,
  })
}

export function revokeAgentRole(agentId: number, agentRoleId: number) {
  return api.del<{ message?: string }>(`/api/admin/agents/${agentId}/roles/${agentRoleId}`)
}

export function listAccessRoles() {
  return api.get<{ id: number; nom: string }[]>('/api/admin/roles')
}

export function listAccessProjects() {
  return api.get<{ id: number; code: string; nom: string }[]>('/api/admin/projects')
}

export type SocieteAdmin = {
  id: number
  code: string
  nom: string
  statut: string
  villeReference?: string | null
  createdAt?: string
  agentsCount?: number
}

export function listSocietes() {
  return api.get<SocieteAdmin[]>('/api/admin/societes')
}

export function createSociete(body: { nom: string; code: string; villeReference?: string }) {
  return api.post<SocieteAdmin>('/api/admin/societes', body)
}

export function updateSociete(id: number, body: { nom?: string; villeReference?: string; statut?: string }) {
  return api.put<SocieteAdmin>(`/api/admin/societes/${id}`, body)
}

export function deactivateSociete(id: number) {
  return api.post<SocieteAdmin>(`/api/admin/societes/${id}/desactiver`, {})
}
