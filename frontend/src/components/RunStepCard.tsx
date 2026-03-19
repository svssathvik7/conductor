import { useState } from 'react'
import type { StepResult } from '../api/runs'
import type { Step } from '../api/steps'

interface Props {
  step: Step
  result?: StepResult
  status: 'pending' | 'running' | 'passed' | 'failed'
}

const STATUS_ICON: Record<string, string> = {
  pending: '⏳',
  running: '🔄',
  passed: '✅',
  failed: '❌',
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'border-gray-200 bg-white',
  running: 'border-blue-300 bg-blue-50',
  passed: 'border-green-300 bg-green-50',
  failed: 'border-red-300 bg-red-50',
}

export function RunStepCard({ step, result, status }: Props) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className={`rounded-xl border-2 p-4 transition-all ${STATUS_STYLE[status]}`}>
      <div
        className="flex justify-between items-center cursor-pointer"
        onClick={() => result && setExpanded(e => !e)}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{STATUS_ICON[status]}</span>
          <div>
            <p className="font-medium text-sm text-gray-900">{step.name}</p>
            <p className="text-xs text-gray-500">{step.method} {step.url}</p>
          </div>
        </div>
        {result && (
          <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
        )}
      </div>

      {expanded && result && (
        <div className="mt-4 space-y-3 text-xs">
          {result.error && (
            <div className="bg-red-50 border border-red-200 rounded p-2 text-red-700 font-mono">
              Error: {result.error}
            </div>
          )}
          {result.response_body && (
            <div>
              <p className="text-gray-500 mb-1 font-medium">Response</p>
              <pre className="bg-gray-50 border rounded p-2 overflow-x-auto text-gray-700 font-mono max-h-48">
                {(() => {
                  try { return JSON.stringify(JSON.parse(result.response_body), null, 2) }
                  catch { return result.response_body }
                })()}
              </pre>
            </div>
          )}
          {Object.keys(result.extracted_vars).length > 0 && (
            <div>
              <p className="text-gray-500 mb-1 font-medium">Extracted Variables</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.extracted_vars).map(([k, v]) => (
                  <span key={k} className="bg-white border rounded px-2 py-1 font-mono">
                    <span className="text-blue-600">{k}</span>
                    <span className="text-gray-400"> = </span>
                    <span className="text-gray-700">{v}</span>
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
