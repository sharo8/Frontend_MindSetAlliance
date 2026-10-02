import { useQuery } from '@tanstack/react-query'
import { fetchProjects } from '../api/domain'
import { projectLabel } from '../rbac/rbac'
import { useProjectStore } from './project-store'

export function useActiveSociety() {
  const currentProject = useProjectStore((s) => s.currentProject)
  const projects = useQuery({ queryKey: ['projects'], queryFn: fetchProjects })
  const society = (projects.data ?? []).find((p) => p.code === currentProject)
  const isEnterprise = currentProject === 'ENTREPRISE'
  const name = isEnterprise ? 'Toute l’entreprise' : (society?.nom ?? projectLabel(currentProject))
  return {
    currentProject,
    society,
    name,
    ville: society?.villeReference,
    isEnterprise,
    code: isEnterprise ? null : currentProject,
  }
}
