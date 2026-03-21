import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { runsApi } from '../api/runs'
import type { StepResult, IterationResult } from '../api/runs'
import { stepsApi } from '../api/steps'
import type { Step } from '../api/steps'
import { RunStepCard } from '../components/RunStepCard'

type StepStatus = 'pending' | 'running' | 'passed' | 'failed'

interface LoopProgress {
  totalIterations: number
  currentIteration: number
  iterationResults: IterationResult[]
}

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
  const [loopProgress, setLoopProgress] = useState<Record<string, LoopProgress>>({})

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
              ...r[event.step_id],
              step_id: event.step_id,
              status: 'passed',
              response_body: r[event.step_id]?.response_body ?? '',
              extracted_vars: event.extracted ?? {},
              iterations: r[event.step_id]?.iterations,
            },
          }))
          break
        case 'step_failed':
          setStepStatuses(s => ({ ...s, [event.step_id]: 'failed' }))
          setStepResults(r => ({
            ...r,
            [event.step_id]: {
              ...r[event.step_id],
              step_id: event.step_id,
              status: 'failed',
              response_body: event.response ?? '',
              extracted_vars: r[event.step_id]?.extracted_vars ?? {},
              error: event.error,
              iterations: r[event.step_id]?.iterations,
            },
          }))
          break
        case 'loop_start':
          setLoopProgress(lp => ({
            ...lp,
            [event.step_id]: {
              totalIterations: event.total_iterations,
              currentIteration: 0,
              iterationResults: [],
            },
          }))
          break
        case 'iteration_start':
          setLoopProgress(lp => ({
            ...lp,
            [event.step_id]: {
              ...lp[event.step_id],
              currentIteration: event.iteration,
            },
          }))
          break
        case 'iteration_complete':
          setLoopProgress(lp => {
            const prev = lp[event.step_id]
            if (!prev) return lp
            const iterResult: IterationResult = {
              index: event.iteration,
              status: event.status,
              response_body: '',
              extracted_vars: event.extracted ?? {},
            }
            const newResults = [...prev.iterationResults, iterResult]
            return {
              ...lp,
              [event.step_id]: {
                ...prev,
                currentIteration: event.iteration + 1,
                iterationResults: newResults,
              },
            }
          })
          setStepResults(r => ({
            ...r,
            [event.step_id]: {
              ...r[event.step_id],
              step_id: event.step_id,
              status: 'passed',
              response_body: '',
              extracted_vars: event.extracted ?? {},
              iterations: [
                ...(r[event.step_id]?.iterations ?? []),
                {
                  index: event.iteration,
                  status: event.status,
                  response_body: '',
                  extracted_vars: event.extracted ?? {},
                },
              ],
            },
          }))
          break
        case 'iteration_failed':
          setLoopProgress(lp => {
            const prev = lp[event.step_id]
            if (!prev) return lp
            const iterResult: IterationResult = {
              index: event.iteration,
              status: 'failed',
              response_body: '',
              extracted_vars: {},
              error: event.error,
            }
            return {
              ...lp,
              [event.step_id]: {
                ...prev,
                currentIteration: event.iteration + 1,
                iterationResults: [...prev.iterationResults, iterResult],
              },
            }
          })
          setStepResults(r => ({
            ...r,
            [event.step_id]: {
              ...r[event.step_id],
              step_id: event.step_id,
              status: 'failed',
              response_body: '',
              extracted_vars: {},
              error: event.error,
              iterations: [
                ...(r[event.step_id]?.iterations ?? []),
                {
                  index: event.iteration,
                  status: 'failed',
                  response_body: '',
                  extracted_vars: {},
                  error: event.error,
                },
              ],
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

  const statusConfig: Record<string, { bg: string; text: string; border: string }> = {
    running: { bg: 'var(--accent-light)', text: 'var(--accent)', border: 'var(--accent)' },
    passed:  { bg: 'var(--success-light)', text: 'var(--success)', border: 'var(--success)' },
    failed:  { bg: 'var(--danger-light)', text: 'var(--danger)', border: 'var(--danger)' },
  }

  const sc = statusConfig[runStatus]

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-2xl mx-auto px-8 py-10">
        <button
          onClick={() => navigate(`/projects/${projectId}/workflows/${workflowId}`)}
          className="flex items-center gap-2 text-sm font-medium mb-8 transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to Editor
        </button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Run</h1>
          <span
            className="px-4 py-1.5 rounded-full font-semibold text-sm"
            style={{
              backgroundColor: sc.bg,
              color: sc.text,
              border: `1px solid ${sc.border}`,
              animation: runStatus === 'running' ? 'pulse-dot 1.5s ease-in-out infinite' : undefined,
            }}
          >
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
                loopProgress={loopProgress[step.id]}
              />
              {idx < steps.length - 1 && (
                <div className="flex justify-center py-1">
                  <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                    <path d="M8 0v16M4 12l4 4 4-4" stroke="var(--border-hover)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
          {steps.length === 0 && (
            <p className="text-center text-sm" style={{ color: 'var(--text-tertiary)' }}>No steps in this workflow.</p>
          )}
        </div>
      </div>
    </div>
  )
}
