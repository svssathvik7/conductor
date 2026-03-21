import { useState } from 'react'
import type { StepResult, IterationResult } from '../api/runs'
import type { Step } from '../api/steps'

interface LoopProgress {
  totalIterations: number
  currentIteration: number
  iterationResults: IterationResult[]
}

interface Props {
  step: Step
  result?: StepResult
  status: 'pending' | 'running' | 'passed' | 'failed'
  loopProgress?: LoopProgress
}

const STATUS_CONFIG: Record<string, { icon: string; border: string; bg: string }> = {
  pending: { icon: '\u25CB', border: 'var(--border)', bg: 'var(--bg-secondary)' },
  running: { icon: '\u25C9', border: 'var(--accent)', bg: 'var(--accent-light)' },
  passed:  { icon: '\u2713', border: 'var(--success)', bg: 'var(--success-light)' },
  failed:  { icon: '\u2715', border: 'var(--danger)', bg: 'var(--danger-light)' },
}

const ITER_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  passed: { bg: 'var(--success-light)', text: 'var(--success)' },
  failed: { bg: 'var(--danger-light)', text: 'var(--danger)' },
}

export function RunStepCard({ step, result, status, loopProgress }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [expandedIterations, setExpandedIterations] = useState<Set<number>>(new Set())
  const cfg = STATUS_CONFIG[status]
  const isLoop = step.loop_type && step.loop_type !== 'none'

  const toggleIteration = (idx: number) => {
    setExpandedIterations(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const iterations = result?.iterations

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
        onClick={() => (result || loopProgress) && setExpanded(e => !e)}
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
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{step.name}</p>
              {isLoop && loopProgress && status === 'running' && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--accent)' }}>
                  {loopProgress.currentIteration}/{loopProgress.totalIterations}
                </span>
              )}
              {isLoop && iterations && status !== 'running' && (
                <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                  {iterations.length} iteration{iterations.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>
              {step.method} {step.url}
            </p>
          </div>
        </div>
        {(result || loopProgress) && (
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="transition-transform duration-200"
            style={{ color: 'var(--text-tertiary)', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}
          >
            <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      {expanded && (
        <div className="mt-4 space-y-3 text-xs animate-fade-in">
          {/* Show iteration list for loop steps */}
          {isLoop && iterations && iterations.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Iterations</p>
              {iterations.map((iter) => {
                const iterColors = ITER_STATUS_COLORS[iter.status] ?? ITER_STATUS_COLORS.passed
                const isExpanded = expandedIterations.has(iter.index)
                return (
                  <div
                    key={iter.index}
                    className="rounded-lg overflow-hidden"
                    style={{ border: '1px solid var(--border)' }}
                  >
                    <div
                      className="flex items-center justify-between px-3 py-2 cursor-pointer"
                      style={{ backgroundColor: 'var(--bg-tertiary)' }}
                      onClick={() => toggleIteration(iter.index)}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: iterColors.bg, color: iterColors.text }}
                        >
                          {iter.status === 'passed' ? '\u2713' : '\u2715'}
                        </span>
                        <span style={{ color: 'var(--text-primary)' }}>
                          Iteration {iter.index}
                        </span>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: iterColors.bg, color: iterColors.text }}
                      >
                        {iter.status}
                      </span>
                    </div>
                    {isExpanded && (
                      <div className="px-3 py-2 space-y-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                        {iter.error && (
                          <div className="rounded-lg p-2 font-mono text-xs" style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
                            Error: {iter.error}
                          </div>
                        )}
                        {Object.keys(iter.extracted_vars).length > 0 && (
                          <div>
                            <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Extracted</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.entries(iter.extracted_vars).map(([k, v]) => (
                                <span
                                  key={k}
                                  className="px-2 py-0.5 rounded-lg font-mono text-xs"
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
                        {Object.keys(iter.extracted_vars).length === 0 && !iter.error && (
                          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>No extracted variables</p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Non-loop: show standard result details */}
          {!isLoop && result && (
            <>
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
            </>
          )}

          {/* Loop step: show error at the step level if present */}
          {isLoop && result?.error && (
            <div className="rounded-lg p-3 font-mono" style={{ backgroundColor: 'var(--danger-light)', border: '1px solid var(--danger)', color: 'var(--danger)' }}>
              Error: {result.error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
