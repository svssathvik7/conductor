import { api } from './client'

export interface Project {
  id: string
  name: string
  description: string
  created_at: string
}

export const projectsApi = {
  list: () => api.get<Project[]>('/api/projects').then(r => r.data),
  create: (name: string, description?: string) =>
    api.post<Project>('/api/projects', { name, description }).then(r => r.data),
  delete: (id: string) => api.delete(`/api/projects/${id}`),
}
