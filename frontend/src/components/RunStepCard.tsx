import { useState } from 'react'
import type { StepResult } from '../api/runs'
import type { Step } from '../api/steps'

interface Props {
  step: Step
  result?: StepResult
  status: 'pending' | 'running' | 'passed' | 'failed'
}

const STATUS_CONFIG: Record<string, { icon: string; border: string; bg: string }> = {
  pending: { icon: '\u25CB', border: 'var(--border)', bg: 'var(--bg-secondary)' },
  running: { icon: '\u25C9', border: 'var(--accent)', bg: 'var(--accent-light)' },
  passed:  { icon: '\u2713', border: 'var(--success)', bg: 'var(--success-light)' },
  failed:  { icon: '\u2715', border: 'var(--danger)', bg: 'var(--danger-light)' },
}

export function RunStepCard({ step, result, status }: Props) {
  const [expanded, setExpanded] = useState(false)
  const cfg = STATUS_CONFIG[status]

  return (
    <div
      className="rounded-xl p-4 transition-all duration-300"
      style={{
        backgroundColor: cfg.bg,
        border: `2px solid ${cfg.border}`,
      }}
    >
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => result && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{
              backgroundColor: cfg.border,
              color: status === 'pending' ? 'var(--text-tertiary)' : '#fff',
              animation: status === 'running' ? 'pulse-dot 1.5s ease-in-out infinite' : undefined,
            }}
          >
            {cfg.icon}
          </span>
          <div>
            <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{step.name}</p>
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {step.method} {step.url}
            </p>
          </div>
        </div>
        {result && (
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="transition-transform duration-200"
            style={{ color: 'var(--text-tertiary)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {expanded && result && (
        <div className="mt-4 space-y-3 text-xs animate-fade-in">
          {result.error && (
            <div className="rounded-lg p-3 font-mono" style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
              Error: {result.error}
            </div>
          )}
          {result.response_body && (
            <div>
              <p className="font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Response</p>
              <pre
                className="rounded-lg p-3 overflow-x-auto max-h-48"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', fontFamily: "'JetBrains Mono', monospace" }}
              >
                {(() => { try { return JSON.stringify(JSON.parse(result.response_body), null, 2) } catch { return result.response_body } })()}
              </pre>
            </div>
          )}
          {Object.keys(result.extracted_vars).length > 0 && (
            <div>
              <p className="font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Extracted Variables</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.extracted_vars).map(([k, v]) => (
                  <span
                    key={k}
                    className="px-2 py-1 rounded-lg font-mono"
                    style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)' }}
                  >
                    <span style={{ color: 'var(--accent)' }}>{k}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}> = </span>
                    <span style={{ color: 'var(--text-primary)' }}>{v}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
