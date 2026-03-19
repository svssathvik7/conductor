import { useState, useEffect } from 'react'
import type { Step } from '../api/steps'

interface Props {
  step: Step
  availableVars: string[]
  onSave: (updated: Partial<Step>) => void
  onClose: () => void
}

export function StepConfigPanel({ step, availableVars, onSave, onClose }: Props) {
  const [name, setName] = useState(step.name)
  const [method, setMethod] = useState(step.method)
  const [url, setUrl] = useState(step.url)
  const [body, setBody] = useState(step.body)
  const [schema, setSchema] = useState(step.response_schema)

  useEffect(() => {
    setName(step.name)
    setMethod(step.method)
    setUrl(step.url)
    setBody(step.body)
    setSchema(step.response_schema)
  }, [step.id])

  return (
    <div className="h-full flex flex-col">
      <div className="flex justify-between items-center p-4 border-b">
        <h3 className="font-semibold text-gray-900">Step Config</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Step Name</label>
          <input
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>

        <div className="flex gap-2">
          <div className="w-28">
            <label className="text-xs text-gray-500 block mb-1">Method</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={method}
              onChange={e => setMethod(e.target.value)}
            >
              {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map(m => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-xs text-gray-500 block mb-1">URL</label>
            <input
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://api.example.com/{{base_path}}/orders"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Body (JSON)</label>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={5}
            placeholder={'{\n  "amount": "{{step1.amount}}"\n}'}
            value={body}
            onChange={e => setBody(e.target.value)}
          />
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Response Schema</label>
          <p className="text-xs text-gray-400 mb-1">Extract variables from response as JSON</p>
          <textarea
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={4}
            placeholder={'[{"path": "result.token", "alias": "token", "field_type": "String"}]'}
            value={schema}
            onChange={e => setSchema(e.target.value)}
          />
        </div>

        {availableVars.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 block mb-2">Available Variables</label>
            <div className="flex flex-wrap gap-1">
              {availableVars.map(v => (
                <span
                  key={v}
                  className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded font-mono cursor-pointer hover:bg-blue-100"
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

      <div className="p-4 border-t">
        <button
          onClick={() => onSave({ name, method, url, body, response_schema: schema })}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 font-medium"
        >
          Save Step
        </button>
      </div>
    </div>
  )
}
