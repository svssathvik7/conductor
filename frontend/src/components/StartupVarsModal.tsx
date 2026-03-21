import { useState } from 'react'
import type { StartupVariable } from '../api/workflows'

interface Props {
  variables: StartupVariable[]
  onRun: (values: Record<string, string>) => void
  onClose: () => void
}

export function StartupVarsModal({ variables, onRun, onClose }: Props) {
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(variables.map(v => [v.name, v.default_value]))
  )

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div
        className="rounded-2xl p-8 w-full max-w-md animate-fade-in"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--success-light)' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--success)' }}>
              <polygon points="5 3 19 12 5 21 5 3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Run Workflow</h2>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
              {variables.length > 0 ? 'Set startup variables' : 'Ready to execute'}
            </p>
          </div>
        </div>

        {variables.length > 0 ? (
          <div className="space-y-4 mb-6">
            {variables.map(v => (
              <div key={v.name}>
                <label className="text-sm font-medium block mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {v.name}
                  {v.description && <span className="font-normal ml-2 text-xs" style={{ color: 'var(--text-tertiary)' }}>{'\u2014'} {v.description}</span>}
                </label>
                <input
                  className="w-full rounded-xl px-4 py-2.5 text-sm"
                  style={{
                    backgroundColor: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  value={values[v.name] ?? ''}
                  onChange={e => setValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>No startup variables defined. Click run to execute.</p>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => onRun(values)}
            className="flex-1 py-3 rounded-xl text-white font-semibold text-sm transition-all hover:shadow-lg"
            style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
          >
            {'\u25B6'} Run
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 rounded-xl text-sm font-medium"
            style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
