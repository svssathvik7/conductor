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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-8 w-full max-w-md shadow-xl">
        <h2 className="font-bold text-lg text-gray-900 mb-2">Run Workflow</h2>
        {variables.length > 0 ? (
          <>
            <p className="text-sm text-gray-500 mb-6">Set values for startup variables before running.</p>
            <div className="space-y-4">
              {variables.map(v => (
                <div key={v.name}>
                  <label className="text-sm font-medium text-gray-700 block mb-1">
                    {v.name}
                    {v.description && (
                      <span className="text-gray-400 font-normal ml-2 text-xs">— {v.description}</span>
                    )}
                  </label>
                  <input
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                    value={values[v.name] ?? ''}
                    onChange={e => setValues(prev => ({ ...prev, [v.name]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="text-sm text-gray-500 mb-6">No startup variables defined. Ready to run.</p>
        )}
        <div className="flex gap-3 mt-8">
          <button
            onClick={() => onRun(values)}
            className="flex-1 bg-green-600 text-white py-3 rounded-xl font-medium hover:bg-green-700"
          >
            ▶ Run Workflow
          </button>
          <button
            onClick={onClose}
            className="px-5 text-gray-500 hover:text-gray-900 rounded-xl"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
