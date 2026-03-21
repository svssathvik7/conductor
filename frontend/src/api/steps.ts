import { api } from './client'

export interface Header { key: string; value: string }
export interface ResponseSchemaField { path: string; alias: string; field_type: string }

export interface Step {
  id: string
  workflow_id: string
  order_index: number
  name: string
  method: string
  url: string
  headers: string
  body: string
  response_schema: string
  on_success: string
  on_failure: string
  loop_type: string
  loop_config: string
  parallel_group: string | null
}

export const stepsApi = {
  list: (workflowId: string) =>
    api.get<Step[]>(`/api/workflows/${workflowId}/steps`).then(r => r.data),
  create: (workflowId: string, name: string) =>
    api.post<Step>(`/api/workflows/${workflowId}/steps`, { name }).then(r => r.data),
  update: (id: string, data: Partial<Step>) =>
    api.put(`/api/steps/${id}`, data).then(r => r.data),
  delete: (id: string) => api.delete(`/api/steps/${id}`),
}
