import { api } from './client'

export const yamlApi = {
  exportWorkflow: (workflowId: string) =>
    api.get(`/api/workflows/${workflowId}/export`, { responseType: 'blob' }).then(r => r.data),
  importWorkflow: (projectId: string, yamlContent: string) =>
    api.post(`/api/projects/${projectId}/import`, yamlContent, {
      headers: { 'Content-Type': 'application/x-yaml' },
    }).then(r => r.data),
}
