import { api } from './client'

export interface IterationResult {
  index: number
  status: 'passed' | 'failed'
  response_body: string
  extracted_vars: Record<string, string>
  error?: string
}

export interface StepResult {
  step_id: string
  status: 'passed' | 'failed'
  response_body: string
  extracted_vars: Record<string, string>
  error?: string
  iterations?: IterationResult[]
}

export interface RunResult {
  id: string
  status: 'RUNNING' | 'PASSED' | 'FAILED'
  started_at: string
  finished_at?: string
  step_results: StepResult[]
  startup_variable_values: Record<string, string>
}

export const runsApi = {
  start: (workflowId: string, startupVars: Record<string, string>, profileId?: string) =>
    api.post<{ run_id: string }>(`/api/workflows/${workflowId}/run`, {
      startup_variable_values: startupVars,
      profile_id: profileId,
    }).then(r => r.data),
  get: (runId: string) =>
    api.get<RunResult>(`/api/runs/${runId}`).then(r => r.data),
  list: (workflowId: string) =>
    api.get<RunResult[]>(`/api/workflows/${workflowId}/runs`).then(r => r.data),
  streamUrl: (runId: string) =>
    `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api/runs/${runId}/stream`,
}
