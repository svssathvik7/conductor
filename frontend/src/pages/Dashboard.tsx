import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '../api/projects'
import { ProjectCard } from '../components/ProjectCard'
import { ThemeToggle } from '../components/ThemeToggle'

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
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-6xl mx-auto px-8 py-10">
        {/* Header */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white text-lg" style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}>
                C
              </div>
              <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Conductor
              </h1>
            </div>
            <p className="text-sm ml-[52px]" style={{ color: 'var(--text-tertiary)' }}>
              Visual API workflow tester
            </p>
          </div>
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2.5 rounded-xl text-white font-medium text-sm transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
            >
              + New Project
            </button>
          </div>
        </div>

        {/* Create form */}
        {showForm && (
          <div
            className="animate-fade-in rounded-xl p-6 mb-8"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>New Project</h2>
            <input
              className="w-full rounded-xl px-4 py-3 mb-3 text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="Project name"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && name && createMutation.mutate()}
              autoFocus
            />
            <input
              className="w-full rounded-xl px-4 py-3 mb-4 text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="Description (optional)"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
            <div className="flex gap-3">
              <button
                onClick={() => createMutation.mutate()}
                disabled={!name || createMutation.isPending}
                className="px-5 py-2.5 rounded-xl text-white font-medium text-sm disabled:opacity-40 transition-all"
                style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
              >
                {createMutation.isPending ? 'Creating...' : 'Create Project'}
              </button>
              <button
                onClick={() => { setShowForm(false); setName(''); setDesc('') }}
                className="px-4 py-2.5 rounded-xl text-sm font-medium transition-colors"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Projects grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 rounded-full animate-spin" style={{ borderColor: 'var(--border)', borderTopColor: 'var(--accent)' }} />
          </div>
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
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'var(--accent-light)' }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" style={{ color: 'var(--accent)' }}>
                    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <p className="text-lg font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>No projects yet</p>
                <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Create a project to start building API workflows</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
