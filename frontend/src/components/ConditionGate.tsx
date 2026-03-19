import { useState } from 'react'
import type { Condition } from '../api/conditions'

interface Props {
  condition?: Condition
  onSave: (expression: string, action: string) => void
  onDelete?: () => void
}

export function ConditionGate({ condition, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false)
  const [expr, setExpr] = useState(condition?.expression ?? '')
  const [action, setAction] = useState(condition?.action ?? 'FAIL')

  if (!condition && !editing) {
    return (
      <div className="flex items-center justify-center py-1">
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-blue-500 border border-dashed border-gray-300 rounded-full px-3 py-0.5 transition-colors"
        >
          + condition
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center py-2">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2 text-sm flex-wrap">
          <span className="text-amber-700 font-medium">if</span>
          <input
            className="border border-amber-300 rounded px-2 py-1 text-xs w-48 focus:outline-none focus:ring-1 focus:ring-amber-400"
            placeholder="step1.amount == 0"
            value={expr}
            onChange={e => setExpr(e.target.value)}
            autoFocus
          />
          <span className="text-amber-700">→</span>
          <select
            className="border border-amber-300 rounded px-2 py-1 text-xs focus:outline-none"
            value={action}
            onChange={e => setAction(e.target.value)}
          >
            <option value="FAIL">FAIL</option>
            <option value="STOP">STOP</option>
          </select>
          <button
            onClick={() => { if (expr) { onSave(expr, action); setEditing(false) } }}
            className="bg-amber-500 text-white px-2 py-1 rounded text-xs hover:bg-amber-600"
          >
            Save
          </button>
          <button onClick={() => setEditing(false)} className="text-gray-400 text-xs hover:text-gray-600">
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-2">
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2 text-xs text-amber-700">
        <span>if <code className="bg-amber-100 px-1 rounded">{condition!.expression}</code> → {condition!.action}</span>
        <button onClick={() => { setExpr(condition!.expression); setAction(condition!.action); setEditing(true) }} className="text-amber-500 hover:text-amber-700 underline">edit</button>
        <button onClick={onDelete} className="text-red-400 hover:text-red-600">✕</button>
      </div>
    </div>
  )
}
