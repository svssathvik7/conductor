import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../api/runs'
import type { StepResult } from '../api/runs'
import { stepsApi } from '../api/steps'
import type { Step } from '../api/steps'
import { RunStepCard } from '../components/RunStepCard'

type StepStatus = 'pending' | 'running' | 'passed' | 'failed'

export default function RunPage() {
  const { projectId, workflowId, runId } = useParams<{
    projectId: string
    workflowId: string
    runId: string
  }>()
  const navigate = useNavigate()
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({})
  const [stepResults, setStepResults] = useState<Record<string, StepResult>>({})
  const [runStatus, setRunStatus] = useState<'running' | 'passed' | 'failed'>('running')

  const { data: steps = [] } = useQuery<Step[]>({
    queryKey: ['steps', workflowId],
    queryFn: () => stepsApi.list(workflowId!),
  })

  useEffect(() => {
    if (!runId) return
    const es = new EventSource(runsApi.streamUrl(runId))

    es.onmessage = (e: MessageEvent) => {
      const event = JSON.parse(e.data)
      switch (event.type) {
        case 'step_start':
          setStepStatuses(s => ({ ...s, [event.step_id]: 'running' }))
          break
        case 'step_complete':
          setStepStatuses(s => ({ ...s, [event.step_id]: 'passed' }))
          setStepResults(r => ({
            ...r,
            [event.step_id]: {
              step_id: event.step_id,
              status: 'passed',
              response_body: '',
              extracted_vars: event.extracted ?? {},
            },
          }))
          break
        case 'step_failed':
          setStepStatuses(s => ({ ...s, [event.step_id]: 'failed' }))
          setStepResults(r => ({
            ...r,
            [event.step_id]: {
              step_id: event.step_id,
              status: 'failed',
              response_body: event.response ?? '',
              extracted_vars: {},
              error: event.error,
            },
          }))
          break
        case 'run_complete':
          setRunStatus(event.status === 'passed' ? 'passed' : 'failed')
          es.close()
          break
      }
    }

    es.onerror = () => {
      setRunStatus('failed')
      es.close()
    }

    return () => es.close()
  }, [runId])

  const getStepStatus = (stepId: string): StepStatus =>
    stepStatuses[stepId] ?? 'pending'

  const statusBadge = {
    running: 'bg-blue-100 text-blue-700',
    passed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto p-8">
        <button
          onClick={() => navigate(`/projects/${projectId}/workflows/${workflowId}`)}
          className="text-gray-500 mb-6 hover:text-gray-900"
        >
          ← Back to Editor
        </button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Run</h1>
          <span className={`px-4 py-1.5 rounded-full font-medium text-sm ${statusBadge[runStatus]}`}>
            {runStatus.toUpperCase()}
          </span>
        </div>

        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={step.id}>
              <RunStepCard
                step={step}
                result={stepResults[step.id]}
                status={getStepStatus(step.id)}
              />
              {idx < steps.length - 1 && (
                <div className="flex justify-center text-gray-300 text-lg py-1">↓</div>
              )}
            </div>
          ))}
          {steps.length === 0 && (
            <p className="text-center text-gray-400">No steps in this workflow.</p>
          )}
        </div>
      </div>
    </div>
  )
}
