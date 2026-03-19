import { api } from './client'

export interface Condition {
  id: string
  workflow_id: string
  after_step_id: string
  expression: string
  action: string
}

export const conditionsApi = {
  list: (workflowId: string) =>
    api.get<Condition[]>(`/api/workflows/${workflowId}/conditions`).then(r => r.data),
  create: (stepId: string, workflowId: string, expression: string, action?: string) =>
    api.post<Condition>(`/api/steps/${stepId}/condition`, { workflow_id: workflowId, expression, action }).then(r => r.data),
  update: (id: string, expression: string, action: string) =>
    api.put(`/api/conditions/${id}`, { expression, action }).then(r => r.data),
  delete: (id: string) => api.delete(`/api/conditions/${id}`),
}
