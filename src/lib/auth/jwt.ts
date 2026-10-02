import { jwtDecode } from 'jwt-decode'
import type { AccessTokenClaims, PermissionOverride, RoleAssignment } from '../rbac/rbac'

export function decodeAccessToken(token: string): AccessTokenClaims {
  return jwtDecode<AccessTokenClaims>(token)
}

export function rolesFromToken(token: string | null): RoleAssignment[] {
  if (!token) return []
  try {
    const claims = decodeAccessToken(token)
    return Array.isArray(claims.roles) ? claims.roles : []
  } catch {
    return []
  }
}

export function overridesFromToken(token: string | null): PermissionOverride[] {
  if (!token) return []
  try {
    const claims = decodeAccessToken(token)
    return Array.isArray(claims.permissionOverrides) ? claims.permissionOverrides : []
  } catch {
    return []
  }
}
