import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { profilesApi } from '../api/profiles'
import type { EnvironmentProfile } from '../api/profiles'

interface Props {
  workflowId: string
}

export function ProfileManager({ workflowId }: Props) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formName, setFormName] = useState('')
  const [formVars, setFormVars] = useState<{ key: string; value: string }[]>([])

  const { data: profiles = [] } = useQuery<EnvironmentProfile[]>({
    queryKey: ['profiles', workflowId],
    queryFn: () => profilesApi.list(workflowId),
  })

  const createProfile = useMutation({
    mutationFn: () => {
      const vars: Record<string, string> = {}
      formVars.forEach(({ key, value }) => { if (key.trim()) vars[key.trim()] = value })
      return profilesApi.create(workflowId, formName, vars)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles', workflowId] })
      resetForm()
    },
  })

  const updateProfile = useMutation({
    mutationFn: (id: string) => {
      const vars: Record<string, string> = {}
      formVars.forEach(({ key, value }) => { if (key.trim()) vars[key.trim()] = value })
      return profilesApi.update(id, { name: formName, variables: vars })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profiles', workflowId] })
      resetForm()
    },
  })

  const deleteProfile = useMutation({
    mutationFn: profilesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profiles', workflowId] }),
  })

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setFormName('')
    setFormVars([])
  }

  const startEdit = (profile: EnvironmentProfile) => {
    setEditingId(profile.id)
    setFormName(profile.name)
    try {
      const vars: Record<string, string> = JSON.parse(profile.variables)
      setFormVars(Object.entries(vars).map(([key, value]) => ({ key, value })))
    } catch {
      setFormVars([])
    }
    setShowForm(true)
  }

  const startNew = () => {
    setEditingId(null)
    setFormName('')
    setFormVars([{ key: '', value: '' }])
    setShowForm(true)
  }

  const handleSave = () => {
    if (!formName.trim()) return
    if (editingId) {
      updateProfile.mutate(editingId)
    } else {
      createProfile.mutate()
    }
  }

  return (
    <div className="w-60 flex flex-col overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Profiles</h3>
        <button
          onClick={startNew}
          className="text-xs font-medium px-2 py-1 rounded-lg transition-colors"
          style={{ color: 'var(--accent)' }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          + New
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile list */}
        {profiles.map(profile => (
          <div
            key={profile.id}
            className="px-4 py-3"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {profile.name}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => startEdit(profile)}
                  className="text-xs px-1.5 py-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteProfile.mutate(profile.id)}
                  className="text-xs px-1.5 py-0.5 rounded transition-colors"
                  style={{ color: 'var(--text-tertiary)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                >
                  Del
                </button>
              </div>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
              {(() => {
                try {
                  return Object.keys(JSON.parse(profile.variables)).length + ' vars'
                } catch { return '0 vars' }
              })()}
            </p>
          </div>
        ))}

        {profiles.length === 0 && !showForm && (
          <p className="p-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>No profiles yet</p>
        )}

        {/* Inline create/edit form */}
        {showForm && (
          <div className="p-4 space-y-3" style={{ borderBottom: '1px solid var(--border)' }}>
            <input
              className="w-full rounded-lg px-3 py-2 text-sm"
              style={{
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
              placeholder="Profile name"
              value={formName}
              onChange={e => setFormName(e.target.value)}
            />
            <div className="space-y-2">
              <label className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>Variables</label>
              {formVars.map((pair, idx) => (
                <div key={idx} className="flex gap-1">
                  <input
                    className="flex-1 rounded-lg px-2 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    placeholder="key"
                    value={pair.key}
                    onChange={e => {
                      const updated = [...formVars]
                      updated[idx] = { ...updated[idx], key: e.target.value }
                      setFormVars(updated)
                    }}
                  />
                  <input
                    className="flex-1 rounded-lg px-2 py-1.5 text-xs"
                    style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border)',
                      color: 'var(--text-primary)',
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                    placeholder="value"
                    value={pair.value}
                    onChange={e => {
                      const updated = [...formVars]
                      updated[idx] = { ...updated[idx], value: e.target.value }
                      setFormVars(updated)
                    }}
                  />
                  <button
                    onClick={() => setFormVars(formVars.filter((_, i) => i !== idx))}
                    className="text-xs px-1 rounded"
                    style={{ color: 'var(--text-tertiary)' }}
                  >
                    x
                  </button>
                </div>
              ))}
              <button
                onClick={() => setFormVars([...formVars, { key: '', value: '' }])}
                className="text-xs"
                style={{ color: 'var(--accent)' }}
              >
                + Add variable
              </button>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={!formName.trim()}
                className="flex-1 py-1.5 rounded-lg text-white text-xs font-medium disabled:opacity-50"
                style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
              >
                {editingId ? 'Update' : 'Create'}
              </button>
              <button
                onClick={resetForm}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
