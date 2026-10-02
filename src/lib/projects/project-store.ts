import { create } from 'zustand'
import { isCompanyWide, visibleProjectCodes, type RoleAssignment } from '../rbac/rbac'

const PROJECT_KEY = 'ma.currentProject'

function readStored(): string {
  try {
    return localStorage.getItem(PROJECT_KEY) ?? sessionStorage.getItem(PROJECT_KEY) ?? 'ENTREPRISE'
  } catch {
    return 'ENTREPRISE'
  }
}

function writeStored(code: string) {
  try {
    localStorage.setItem(PROJECT_KEY, code)
    sessionStorage.setItem(PROJECT_KEY, code)
  } catch {
    /* ignore */
  }
}

type ProjectState = {
  currentProject: string
  setProject: (code: string) => void
  syncWithRoles: (roles: RoleAssignment[]) => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  currentProject: readStored(),
  setProject(code) {
    writeStored(code)
    set({ currentProject: code })
  },
  syncWithRoles(roles) {
    const visible = visibleProjectCodes(roles)
    const company = isCompanyWide(roles)
    const stored = get().currentProject
    if (company) {
      if (stored === 'ENTREPRISE' || visible.includes('*') || roles.some((r) => r.projectCode === stored || r.projectCode == null)) {
        if (stored !== 'ENTREPRISE' && stored !== '*' && !roles.some((r) => r.projectCode == null || r.projectCode === stored)) {
          writeStored('ENTREPRISE')
          set({ currentProject: 'ENTREPRISE' })
        }
        return
      }
      return
    }
    const codes = visible.filter((c) => c !== '*')
    if (codes.includes(stored)) return
    const next = codes[0] ?? 'ENTREPRISE'
    writeStored(next)
    set({ currentProject: next })
  },
}))
