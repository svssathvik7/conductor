import { api } from './client'

export interface StartupVariable {
  name: string
  default_value: string
  description: string
}

export interface Workflow {
  id: string
  project_id: string
  name: string
  description: string
  startup_variables: string
  created_at: string
}

export const workflowsApi = {
  list: (projectId: string) =>
    api.get<Workflow[]>(`/api/projects/${projectId}/workflows`).then(r => r.data),
  create: (projectId: string, name: string, description?: string) =>
    api.post<Workflow>(`/api/projects/${projectId}/workflows`, { name, description }).then(r => r.data),
  get: (id: string) =>
    api.get<Workflow>(`/api/workflows/${id}`).then(r => r.data),
  update: (id: string, data: Partial<Workflow>) =>
    api.put<Workflow>(`/api/workflows/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/workflows/${id}`),
}
