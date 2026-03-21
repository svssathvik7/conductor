import { api } from './client'

export interface EnvironmentProfile {
  id: string
  workflow_id: string
  name: string
  variables: string // JSON string
  created_at: string
}

export const profilesApi = {
  list: (workflowId: string) =>
    api.get<EnvironmentProfile[]>(`/api/workflows/${workflowId}/profiles`).then(r => r.data),
  create: (workflowId: string, name: string, variables: Record<string, string>) =>
    api.post<EnvironmentProfile>(`/api/workflows/${workflowId}/profiles`, { name, variables }).then(r => r.data),
  update: (id: string, data: { name?: string; variables?: Record<string, string> }) =>
    api.put<EnvironmentProfile>(`/api/profiles/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/profiles/${id}`),
}
