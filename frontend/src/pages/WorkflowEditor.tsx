import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowsApi } from '../api/workflows'
import type { StartupVariable } from '../api/workflows'
import { stepsApi } from '../api/steps'
import type { Step } from '../api/steps'
import { conditionsApi } from '../api/conditions'
import type { Condition } from '../api/conditions'
import { runsApi } from '../api/runs'
import { StepCard } from '../components/StepCard'
import { ConditionGate } from '../components/ConditionGate'
import { StepConfigPanel } from '../components/StepConfigPanel'
import { StartupVarsModal } from '../components/StartupVarsModal'
import { RunHistory } from '../components/RunHistory'
import { ProfileManager } from '../components/ProfileManager'

export default function WorkflowEditor() {
  const { projectId, workflowId } = useParams<{ projectId: string; workflowId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedStep, setSelectedStep] = useState<Step | null>(null)
  const [showRunModal, setShowRunModal] = useState(false)

  const { data: workflow } = useQuery({
    queryKey: ['workflow', workflowId],
    queryFn: () => workflowsApi.get(workflowId!),
  })

  const { data: steps = [] } = useQuery({
    queryKey: ['steps', workflowId],
    queryFn: () => stepsApi.list(workflowId!),
  })

  const { data: conditions = [] } = useQuery<Condition[]>({
    queryKey: ['conditions', workflowId],
    queryFn: () => conditionsApi.list(workflowId!),
  })

  const createStep = useMutation({
    mutationFn: () => stepsApi.create(workflowId!, `Step ${steps.length + 1}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', workflowId] }),
  })

  const deleteStep = useMutation({
    mutationFn: stepsApi.delete,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['steps', workflowId] })
      setSelectedStep(null)
    },
  })

  const updateStep = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Step> }) =>
      stepsApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['steps', workflowId] }),
  })

  const addCondition = useMutation({
    mutationFn: ({ stepId, expr, action }: { stepId: string; expr: string; action: string }) =>
      conditionsApi.create(stepId, workflowId!, expr, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conditions', workflowId] }),
  })

  const updateCondition = useMutation({
    mutationFn: ({ id, expr, action }: { id: string; expr: string; action: string }) =>
      conditionsApi.update(id, expr, action),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conditions', workflowId] }),
  })

  const deleteCondition = useMutation({
    mutationFn: conditionsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conditions', workflowId] }),
  })

  const handleRun = async (vars: Record<string, string>, profileId?: string) => {
    const { run_id } = await runsApi.start(workflowId!, vars, profileId)
    navigate(`/projects/${projectId}/workflows/${workflowId}/run-view/${run_id}`)
  }

  const getAvailableVars = (stepIndex: number): string[] => {
    const startupVars = (() => {
      try {
        return JSON.parse(workflow?.startup_variables ?? '[]').map((v: { name: string }) => v.name)
      } catch { return [] }
    })()
    const stepVars: string[] = []
    for (let i = 0; i < stepIndex; i++) {
      try {
        const schema = JSON.parse(steps[i]?.response_schema ?? '[]')
        schema.forEach((f: { alias: string }) => stepVars.push(`step${i + 1}.${f.alias}`))
      } catch { /* ignore parse errors */ }
    }
    return [...startupVars, ...stepVars]
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Top bar */}
      <div
        className="px-6 py-4 flex justify-between items-center"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
          </button>
          <div>
            <h1 className="font-semibold" style={{ color: 'var(--text-primary)' }}>{workflow?.name ?? 'Loading...'}</h1>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Workflow Editor</p>
          </div>
        </div>
        <button
          onClick={() => setShowRunModal(true)}
          className="px-5 py-2.5 rounded-xl text-white font-medium text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
        >
          {'\u25B6'} Run
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-8" style={{ backgroundColor: 'var(--bg-primary)' }}>
          <div className="max-w-xl mx-auto space-y-1">
            {steps.map((step, idx) => {
              const condition = conditions.find(c => c.after_step_id === step.id)
              return (
                <div key={step.id}>
                  <StepCard
                    step={step}
                    isSelected={selectedStep?.id === step.id}
                    onClick={() => setSelectedStep(step)}
                    onDelete={() => deleteStep.mutate(step.id)}
                  />
                  {/* Condition gate + connector */}
                  {idx < steps.length - 1 && (
                    <>
                      <ConditionGate
                        condition={condition}
                        onSave={(expr, action) => {
                          if (condition) {
                            updateCondition.mutate({ id: condition.id, expr, action })
                          } else {
                            addCondition.mutate({ stepId: step.id, expr, action })
                          }
                        }}
                        onDelete={condition ? () => deleteCondition.mutate(condition.id) : undefined}
                      />
                      <div className="flex justify-center py-1">
                        <svg width="16" height="20" viewBox="0 0 16 20" fill="none">
                          <path d="M8 0v16M4 12l4 4 4-4" stroke="var(--border-hover)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </>
                  )}
                </div>
              )
            })}

            <div className="pt-2">
              <button
                onClick={() => createStep.mutate()}
                disabled={createStep.isPending}
                className="w-full border-2 border-dashed rounded-xl py-4 text-sm font-medium transition-all duration-200 disabled:opacity-50"
                style={{
                  borderColor: 'var(--border)',
                  color: 'var(--text-tertiary)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--accent)'
                  e.currentTarget.style.color = 'var(--accent)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text-tertiary)'
                }}
              >
                + Add Step
              </button>
            </div>

            {steps.length === 0 && (
              <p className="text-center text-sm mt-4" style={{ color: 'var(--text-tertiary)' }}>
                Add your first step to start building this workflow.
              </p>
            )}
          </div>
        </div>

        {/* Config panel */}
        {selectedStep && (
          <div className="w-96 flex flex-col overflow-hidden" style={{ borderLeft: '1px solid var(--border)' }}>
            <StepConfigPanel
              step={selectedStep}
              availableVars={getAvailableVars(steps.findIndex(s => s.id === selectedStep.id))}
              onSave={data => {
                updateStep.mutate({ id: selectedStep.id, data })
                setSelectedStep(prev => prev ? { ...prev, ...data } : null)
              }}
              onClose={() => setSelectedStep(null)}
            />
          </div>
        )}
        <RunHistory />
        <ProfileManager workflowId={workflowId!} />
      </div>

      {showRunModal && workflow && (
        <StartupVarsModal
          workflowId={workflowId!}
          variables={(() => {
            try { return JSON.parse(workflow.startup_variables ?? '[]') as StartupVariable[] }
            catch { return [] }
          })()}
          onRun={(vars, profileId) => { setShowRunModal(false); handleRun(vars, profileId) }}
          onClose={() => setShowRunModal(false)}
        />
      )}
    </div>
  )
}
