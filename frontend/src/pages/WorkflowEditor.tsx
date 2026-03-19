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

  const handleRun = async (vars: Record<string, string>) => {
    const { run_id } = await runsApi.start(workflowId!, vars)
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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/projects/${projectId}`)}
            className="text-gray-500 hover:text-gray-900"
          >
            ←
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">{workflow?.name ?? 'Loading...'}</h1>
            <p className="text-xs text-gray-400">Workflow Editor</p>
          </div>
        </div>
        <button
          onClick={() => setShowRunModal(true)}
          className="bg-green-600 text-white px-5 py-2 rounded-lg hover:bg-green-700 font-medium"
        >
          ▶ Run
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Canvas */}
        <div className="flex-1 overflow-y-auto p-8">
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
                      <div className="flex justify-center text-gray-300 text-lg">↓</div>
                    </>
                  )}
                </div>
              )
            })}

            <div className="pt-2">
              <button
                onClick={() => createStep.mutate()}
                disabled={createStep.isPending}
                className="w-full border-2 border-dashed border-gray-300 rounded-xl py-4 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors disabled:opacity-50"
              >
                + Add Step
              </button>
            </div>

            {steps.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-4">
                Add your first step to start building this workflow.
              </p>
            )}
          </div>
        </div>

        {/* Config panel */}
        {selectedStep && (
          <div className="w-96 bg-white border-l flex flex-col overflow-hidden">
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
      </div>

      {showRunModal && workflow && (
        <StartupVarsModal
          variables={(() => {
            try { return JSON.parse(workflow.startup_variables ?? '[]') as StartupVariable[] }
            catch { return [] }
          })()}
          onRun={vars => { setShowRunModal(false); handleRun(vars) }}
          onClose={() => setShowRunModal(false)}
        />
      )}
    </div>
  )
}
