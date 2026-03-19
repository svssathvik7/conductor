import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../api/projects'
import { ProjectCard } from '../components/ProjectCard'

export default function Dashboard() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const createMutation = useMutation({
    mutationFn: () => projectsApi.create(name, desc),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] })
      setShowForm(false)
      setName('')
      setDesc('')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Conductor</h1>
            <p className="text-gray-500 mt-1">Visual API workflow tester</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 font-medium"
          >
            + New Project
          </button>
        </div>

        {showForm && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-4">New Project</h2>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Project name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name && createMutation.mutate()}
              autoFocus
            />
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 mb-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Description (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {createMutation.isPending ? 'Creating...' : 'Create'}
              </button>
              <button
                onClick={() => { setShowForm(false); setName(''); setDesc('') }}
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
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(p => (
                <ProjectCard
                  key={p.id}
                  name={p.name}
                  description={p.description}
                  onClick={() => navigate(`/projects/${p.id}`)}
                  onDelete={() => deleteMutation.mutate(p.id)}
                />
              ))}
            </div>
            {projects.length === 0 && !showForm && (
              <div className="text-center mt-16">
                <p className="text-gray-400 text-lg">No projects yet.</p>
                <p className="text-gray-400 text-sm mt-1">Create a project to start building API workflows.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
