import { api } from '../api/client'

export type DirectoryRole = { id: number; role: string; projectCode: string | null; projectNom?: string | null }

export type PermissionOverrideRow = {
  id: number
  type: 'GRANT' | 'DENY'
  motif: string
  createdAt?: string
  permissionId?: number
  permission?: string
  permissionLibelle?: string
  projectId?: number | null
  projectCode?: string | null
  accordePar?: string
}

export type PermissionActionMap = { VIEW: boolean; CREATE: boolean; UPDATE: boolean; DELETE: boolean }

export type PermissionActionRow = {
  permission: string
  projectId: number | null
  projectCode?: string | null
  actions: PermissionActionMap
}

export type DirectoryAgent = {
  id: number
  nom: string
  prenom: string
  emailPro: string
  telephone?: string | null
  statut: string
  createdAt?: string
  departement?: { id: number; nom: string; code: string } | null
  roles: DirectoryRole[]
  hasOverrides?: boolean
  overrides?: PermissionOverrideRow[]
  permissionsEffectives?: string[]
  permissionsEffectivesParProjet?: Record<string, string[]>
  permissionActions?: PermissionActionRow[]
  derniereModification?: { id: number; action: string; createdAt: string; auteur?: string }
  motDePasseTemporaire?: string
  emailBienvenueEnvoye?: boolean
  message?: string
  hasPhoto?: boolean
  photo?: string | null
}

export type PageResponse<T> = {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
}

export function listDirectoryAgents(params: {
  q?: string
  departementId?: string
  statut?: string
  role?: string
  scope?: string
  page?: number
  size?: number
  sort?: string
}) {
  const query = new URLSearchParams()
  if (params.q) query.set('search', params.q)
  if (params.departementId) query.set('departement', params.departementId)
  if (params.statut) query.set('statut', params.statut)
  if (params.role) query.set('role', params.role)
  if (params.scope) query.set('scope', params.scope)
  query.set('page', String(params.page ?? 0))
  query.set('size', String(params.size ?? 10))
  query.set('sort', params.sort ?? 'createdAt,desc')
  return api.get<PageResponse<DirectoryAgent>>(`/api/admin/agents?${query.toString()}`)
}

export function getDirectoryAgent(id: number) {
  return api.get<DirectoryAgent>(`/api/admin/agents/${id}`)
}

export function createDirectoryAgent(body: {
  nom: string
  prenom: string
  emailPro: string
  telephone?: string
  departementId: number
  roles: { role: string; projectCode?: string | null }[]
  photo?: string | null
}) {
  return api.post<DirectoryAgent>('/api/admin/agents', body)
}

export function updateDirectoryAgent(id: number, body: Record<string, unknown>) {
  return api.patch<DirectoryAgent>(`/api/admin/agents/${id}`, body)
}

export function deactivateDirectoryAgent(id: number, motif: string) {
  return api.post<DirectoryAgent>(`/api/admin/agents/${id}/desactiver`, { motif })
}

export function deleteDirectoryAgent(id: number, motif: string) {
  return api.post<DirectoryAgent>(`/api/admin/agents/${id}/supprimer`, { motif })
}

export function reactivateDirectoryAgent(id: number) {
  return api.post<DirectoryAgent>(`/api/admin/agents/${id}/reactiver`, {})
}

export function changeDirectoryAgentStatus(id: number, statut: 'ACTIF' | 'INACTIF', motif?: string) {
  if (statut === 'INACTIF') return deactivateDirectoryAgent(id, motif ?? 'Désactivation depuis l’administration')
  return reactivateDirectoryAgent(id)
}

export function addAgentPermissionOverride(
  agentId: number,
  body: { permissionId: number; projectId?: number | null; type: 'GRANT' | 'DENY'; motif?: string },
) {
  return api.post<PermissionOverrideRow & { message?: string }>(`/api/admin/agents/${agentId}/permissions/override`, body)
}

export function fetchAgentEffectivePermissions(agentId: number, projectCode?: string | null) {
  const query = new URLSearchParams()
  if (projectCode) query.set('projectCode', projectCode)
  const suffix = query.toString() ? `?${query}` : ''
  return api.get<string[]>(`/api/admin/agents/${agentId}/permissions-effectives${suffix}`)
}

export function removeAgentPermissionOverride(agentId: number, overrideId: number) {
  return api.del<{ message?: string }>(`/api/admin/agents/${agentId}/permissions/override/${overrideId}`)
}

export type DepartementOption = {
  id: number
  code: string
  nom: string
  description?: string | null
  statut?: string
  agentsCount?: number
  roles?: { id: number; nom: string }[]
}

export function fetchDepartements() {
  return api.get<DepartementOption[]>('/api/admin/departements')
}

export function fetchAgentPhoto(id: number) {
  return api.get<{ id: number; hasPhoto: boolean; photo: string | null }>(`/api/agents/${id}/photo`)
}

export function createDepartement(body: { nom: string; description?: string; roles: string[] }) {
  return api.post<DepartementOption>('/api/admin/departements', body)
}

export function updateDepartement(id: number, body: { nom: string; description?: string; roles: string[]; statut?: string }) {
  return api.put<DepartementOption>(`/api/admin/departements/${id}`, body)
}

export function deactivateDepartement(id: number) {
  return api.post<DepartementOption>(`/api/admin/departements/${id}/desactiver`, {})
}

export type RoleRow = { id: number; nom: string; libelle: string; permissions?: string[]; agentsCount?: number }

export type MatrixPermChange = { code: string; libelle: string }
export type MatrixRoleDiff = {
  id: number
  nom: string
  libelle: string
  agentsCount?: number
  added: MatrixPermChange[]
  removed: MatrixPermChange[]
}
export type MatrixImpact = {
  saved?: boolean
  agentsAffected: number
  emailsQueued?: number
  roles: MatrixRoleDiff[]
  confirmation: string
  message?: string
}
export type PermissionRow = { id: number; code: string; module: string; libelle: string; decomposable?: boolean }

export function rolePermissionsQueryKey(id: number) {
  return ['rbac-role-permissions', id] as const
}

export function fetchRoles() {
  return api.get<RoleRow[]>('/api/roles')
}

export function fetchPermissionsCatalog() {
  return api.get<PermissionRow[]>('/api/permissions')
}

export function fetchRolePermissions(id: number) {
  return api.get<RoleRow>(`/api/roles/${id}/permissions`)
}

export function saveAgentPermissionActions(
  agentId: number,
  body: { permissionId: number; projectId?: number | null; actions: PermissionActionMap },
) {
  return api.put<PermissionActionRow & { message?: string }>(`/api/admin/agents/${agentId}/permission-actions`, body)
}

export function saveRolePermissions(id: number, permissions: string[]) {
  return api.put<RoleRow & { message?: string }>(`/api/roles/${id}/permissions`, { permissions })
}

export function previewRolePermissionsMatrix(roles: { id: number; permissions: string[] }[]) {
  return api.post<MatrixImpact>('/api/roles/permissions-matrix/preview', { roles })
}

export function saveRolePermissionsMatrix(roles: { id: number; permissions: string[] }[]) {
  return api.put<MatrixImpact>('/api/roles/permissions-matrix', { roles })
}
