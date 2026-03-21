import { useState, useEffect } from 'react'
import type { Step } from '../api/steps'

interface Props {
  step: Step
  availableVars: string[]
  onSave: (updated: Partial<Step>) => void
  onClose: () => void
}

function parseLoopConfig(configStr: string): { count?: number; source_var?: string } {
  try {
    return JSON.parse(configStr)
  } catch {
    return {}
  }
}

export function StepConfigPanel({ step, availableVars, onSave, onClose }: Props) {
  const [name, setName] = useState(step.name)
  const [method, setMethod] = useState(step.method)
  const [url, setUrl] = useState(step.url)
  const [body, setBody] = useState(step.body)
  const [schema, setSchema] = useState(step.response_schema)
  const [loopType, setLoopType] = useState(step.loop_type || 'none')
  const [loopCount, setLoopCount] = useState(() => {
    const cfg = parseLoopConfig(step.loop_config || '{}')
    return cfg.count ?? 1
  })
  const [loopSourceVar, setLoopSourceVar] = useState(() => {
    const cfg = parseLoopConfig(step.loop_config || '{}')
    return cfg.source_var ?? ''
  })

  useEffect(() => {
    setName(step.name); setMethod(step.method); setUrl(step.url)
    setBody(step.body); setSchema(step.response_schema)
    const lt = step.loop_type || 'none'
    setLoopType(lt)
    const cfg = parseLoopConfig(step.loop_config || '{}')
    setLoopCount(cfg.count ?? 1)
    setLoopSourceVar(cfg.source_var ?? '')
  }, [step.id])

  const buildLoopConfig = (): string => {
    if (loopType === 'count') return JSON.stringify({ count: loopCount })
    if (loopType === 'for_each') return JSON.stringify({ source_var: loopSourceVar })
    return '{}'
  }

  const inputStyle = {
    backgroundColor: 'var(--bg-tertiary)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  }

  return (
    <div className="h-full flex flex-col animate-slide-in" style={{ backgroundColor: 'var(--bg-secondary)' }}>
      <div className="flex justify-between items-center px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Configure Step</h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg transition-colors"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Step Name</label>
          <input className="w-full rounded-xl px-3 py-2.5 text-sm" style={inputStyle} value={name} onChange={e => setName(e.target.value)} />
        </div>

        <div className="flex gap-2">
          <div className="w-28">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Method</label>
            <select className="w-full rounded-xl px-2 py-2.5 text-sm" style={inputStyle} value={method} onChange={e => setMethod(e.target.value)}>
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => <option key={m}>{m}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>URL</label>
            <input
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
              placeholder="https://api.example.com/..."
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Body (JSON)</label>
          <textarea
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
            rows={5}
            placeholder={'{\n  "amount": "{{step1.amount}}"\n}'}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-1.5" style={{ color: 'var(--text-secondary)' }}>Response Schema</label>
          <textarea
            className="w-full rounded-xl px-3 py-2.5 text-sm resize-none"
            style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
            rows={4}
            placeholder={'[{"path": "result.token", "alias": "token", "field_type": "String"}]'}
            value={schema}
            onChange={e => setSchema(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Loop</label>
          <div className="space-y-2">
            <select
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={inputStyle}
              value={loopType}
              onChange={e => setLoopType(e.target.value)}
            >
              <option value="none">None</option>
              <option value="count">Count (repeat N times)</option>
              <option value="for_each">For Each (iterate over array)</option>
            </select>

            {loopType === 'count' && (
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>Iteration count</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={inputStyle}
                  value={loopCount}
                  onChange={e => setLoopCount(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
            )}

            {loopType === 'for_each' && (
              <div>
                <label className="text-xs block mb-1" style={{ color: 'var(--text-tertiary)' }}>
                  Source variable (e.g. step1.items)
                </label>
                <input
                  className="w-full rounded-xl px-3 py-2.5 text-sm"
                  style={{ ...inputStyle, fontFamily: "'JetBrains Mono', monospace" }}
                  placeholder="step1.items"
                  value={loopSourceVar}
                  onChange={e => setLoopSourceVar(e.target.value)}
                />
              </div>
            )}
          </div>
        </div>

        {availableVars.length > 0 && (
          <div>
            <label className="text-xs font-medium block mb-2" style={{ color: 'var(--text-secondary)' }}>Available Variables</label>
            <div className="flex flex-wrap gap-1.5">
              {availableVars.map(v => (
                <span
                  key={v}
                  className="text-xs px-2 py-1 rounded-lg cursor-pointer transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--accent-light)',
                    color: 'var(--accent)',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                  onClick={() => navigator.clipboard?.writeText(`{{${v}}}`)}
                  title="Click to copy"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-5 py-4" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={() => onSave({
            name, method, url, body, response_schema: schema,
            loop_type: loopType,
            loop_config: buildLoopConfig(),
          })}
          className="w-full py-2.5 rounded-xl text-white font-medium text-sm transition-all"
          style={{ background: 'linear-gradient(135deg, var(--accent), #a855f7)' }}
        >
          Save Step
        </button>
      </div>
    </div>
  )
}
