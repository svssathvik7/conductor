import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { workflowsApi } from '../api/workflows'
import type { Workflow } from '../api/workflows'

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

  const deleteMutation = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflows', projectId] }),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-8">
        <button
          onClick={() => navigate('/')}
          className="text-gray-500 mb-6 hover:text-gray-900 flex items-center gap-1"
        >
          ← Projects
        </button>

        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Workflows</h1>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + New Workflow
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">New Workflow</h2>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => { setShowForm(false); setName('') }}
                className="text-gray-500 px-4 py-2 hover:text-gray-900"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="text-center text-gray-400 mt-16">Loading...</div>
        ) : (
          <div className="space-y-3">
            {workflows.map(wf => (
              <div
                key={wf.id}
                className="bg-white rounded-xl border border-gray-200 p-5 cursor-pointer hover:shadow-md transition-shadow flex justify-between items-center"
              >
                <div onClick={() => navigate(`/projects/${projectId}/workflows/${wf.id}`)}>
                  <h3 className="font-semibold text-gray-900">{wf.name}</h3>
                  {wf.description && <p className="text-sm text-gray-500 mt-0.5">{wf.description}</p>}
                </div>
                <button
                  onClick={() => deleteMutation.mutate(wf.id)}
                  className="text-gray-400 hover:text-red-500 ml-4 flex-shrink-0"
                >
                  ✕
                </button>
              </div>
            ))}
            {workflows.length === 0 && !showForm && (
              <div className="text-center mt-16">
                <p className="text-gray-400 text-lg">No workflows yet.</p>
                <p className="text-gray-400 text-sm mt-1">Create a workflow to start chaining API steps.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
