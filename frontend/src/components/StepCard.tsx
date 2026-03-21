import type { Step } from '../api/steps'

const METHOD_STYLES: Record<string, { bg: string; text: string }> = {
  GET:    { bg: '#ecfdf5', text: '#059669' },
  POST:   { bg: '#eef2ff', text: '#4f46e5' },
  PUT:    { bg: '#fefce8', text: '#ca8a04' },
  PATCH:  { bg: '#fff7ed', text: '#ea580c' },
  DELETE: { bg: '#fef2f2', text: '#dc2626' },
}

interface Props {
  step: Step
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function StepCard({ step, isSelected, onClick, onDelete }: Props) {
  const ms = METHOD_STYLES[step.method] ?? { bg: 'var(--bg-tertiary)', text: 'var(--text-secondary)' }

  return (
    <div
      onClick={onClick}
      className="group rounded-xl p-4 cursor-pointer transition-all duration-200"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--border)'}`,
        boxShadow: isSelected ? '0 0 0 3px var(--accent-light)' : 'var(--shadow)',
      }}
      onMouseEnter={e => {
        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border-hover)'
      }}
      onMouseLeave={e => {
        if (!isSelected) e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span
            className="text-xs font-bold px-2.5 py-1 rounded-lg flex-shrink-0"
            style={{ backgroundColor: ms.bg, color: ms.text }}
          >
            {step.method}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{step.name}</p>
              {step.loop_type && step.loop_type !== 'none' && (
                <span
                  className="text-xs px-1.5 py-0.5 rounded-md font-medium flex-shrink-0"
                  style={{ backgroundColor: 'var(--accent-light)', color: 'var(--accent)' }}
                >
                  {step.loop_type === 'count'
                    ? `\u00D7${(() => { try { return JSON.parse(step.loop_config)?.count ?? '?' } catch { return '?' } })()}`
                    : 'for-each'}
                </span>
              )}
            </div>
            {step.url && (
              <p className="text-xs truncate mt-0.5 font-mono" style={{ color: 'var(--text-tertiary)' }}>
                {step.url}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-lg ml-2"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
