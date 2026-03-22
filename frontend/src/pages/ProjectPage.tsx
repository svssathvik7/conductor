import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowsApi } from '../api/workflows'
import type { Workflow } from '../api/workflows'
import { yamlApi } from '../api/yaml'
import { ThemeToggle } from '../components/ThemeToggle'

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')

  const { data: workflows = [], isLoading } = useQuery({
    queryKey: ['workflows', projectId],
    queryFn: () => workflowsApi.list(projectId!),
  })

  const createMutation = useMutation({
    mutationFn: () => workflowsApi.create(projectId!, name),
    onSuccess: (wf: Workflow) => {
      qc.invalidateQueries({ queryKey: ['workflows', projectId] })
      navigate(`/projects/${projectId}/workflows/${wf.id}`)
    },
  })

  const handleImport = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.yaml,.yml'
    input.onchange = async () => {
      const file = input.files?.[0]
      if (!file) return
      const content = await file.text()
      const workflow = await yamlApi.importWorkflow(projectId!, content)
      qc.invalidateQueries({ queryKey: ['workflows', projectId] })
      navigate(`/projects/${projectId}/workflows/${workflow.id}`)
    }
    input.click()
  }

  const deleteMutation = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', projectId] }),
  })

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto px-8 py-10">
        {/* Top nav */}
        <div className="flex items-center justify-between mb-8">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-sm font-medium transition-colors"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Projects
          </button>
          <ThemeToggle />
        </div>

        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Workflows</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-tertiary)' }}>
              {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleImport}
              className="px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = 'var(--accent)'
                e.currentTarget.style.color = 'var(--accent)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-secondary)'
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'middle' }}>
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
              Import YAML
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
            >
              + New Workflow
            </button>
          </div>
        </div>

        {showForm && (
          <div
            className="animate-fade-in rounded-xl p-6 mb-6"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>New Workflow</h2>
            <input
              className="w-full rounded-xl px-4 py-3 mb-4 text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="Workflow name (e.g. Order Happy Flow)"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name && createMutation.mutate()}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-40"
                style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Workflow'}
              </button>
              <button
                onClick={() => { setShowForm(false); setName('') }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </div>
        ) : (
          <div className="space-y-3">
            {workflows.map(wf => (
              <div
                key={wf.id}
                className="group animate-fade-in rounded-xl p-5 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 flex justify-between items-center"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border)',
                  boxShadow: 'var(--shadow)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow-md)'
                  e.currentTarget.style.borderColor = 'var(--accent)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.boxShadow = 'var(--shadow)'
                  e.currentTarget.style.borderColor = 'var(--border)'
                }}
              >
                <div className="flex-1 min-w-0" onClick={() => navigate(`/projects/${projectId}/workflows/${wf.id}`)}>
                  <div className="flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)' }}>
                      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                    </svg>
                    <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{wf.name}</h3>
                  </div>
                  {wf.description && (
                    <p className="text-sm mt-1 ml-6" style={{ color: 'var(--text-secondary)' }}>{wf.description}</p>
                  )}
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteMutation.mutate(wf.id) }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ml-3"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </div>
            ))}
            {workflows.length === 0 && !showForm && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
                    <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-lg font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No workflows yet</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Create a workflow to start chaining API steps</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
