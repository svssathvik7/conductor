import { useState, useEffect } from 'react'
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

  useEffect(() => {
    setExpr(condition?.expression ?? '')
    setAction(condition?.action ?? 'FAIL')
  }, [condition?.id])

  if (!condition && !editing) {
    return (
      <div className="flex items-center justify-center py-1">
        <button
          onClick={() => setEditing(true)}
          className="text-xs px-3 py-1 rounded-full transition-all duration-200"
          style={{
            color: 'var(--text-tertiary)',
            border: '1px dashed var(--border)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.color = 'var(--warning)'
            e.currentTarget.style.borderColor = 'var(--warning)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.color = 'var(--text-tertiary)'
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        >
          + condition
        </button>
      </div>
    )
  }

  if (editing) {
    return (
      <div className="flex items-center justify-center py-2 animate-fade-in">
        <div
          className="rounded-xl p-3 flex items-center gap-2 text-sm flex-wrap"
          style={{
            backgroundColor: 'var(--warning-light)',
            border: '1px solid var(--warning)',
          }}
        >
          <span className="font-semibold text-xs" style={{ color: 'var(--warning)' }}>IF</span>
          <input
            className="rounded-lg px-2 py-1 text-xs w-48 font-mono"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            placeholder='step1.amount == "0"'
            value={expr}
            onChange={e => setExpr(e.target.value)}
            autoFocus
          />
          <span className="text-xs font-medium" style={{ color: 'var(--warning)' }}>THEN</span>
          <select
            className="rounded-lg px-2 py-1 text-xs"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
            }}
            value={action}
            onChange={e => setAction(e.target.value)}
          >
            <option value="FAIL">FAIL</option>
            <option value="STOP">STOP</option>
          </select>
          <button
            onClick={() => { if (expr) { onSave(expr, action); setEditing(false) } }}
            className="px-2.5 py-1 rounded-lg text-white text-xs font-medium"
            style={{ backgroundColor: 'var(--warning)' }}
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            className="text-xs px-2"
            style={{ color: 'var(--text-tertiary)' }}
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center py-1.5">
      <div
        className="rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs"
        style={{
          backgroundColor: 'var(--warning-light)',
          border: '1px solid var(--warning)',
          color: 'var(--warning)',
        }}
      >
        <span className="font-semibold">IF</span>
        <code
          className="px-1.5 py-0.5 rounded font-mono text-xs"
          style={{ backgroundColor: 'var(--bg-secondary)' }}
        >
          {condition!.expression}
        </code>
        <span className="font-semibold">{'\u2192'} {condition!.action}</span>
        <button
          onClick={() => { setExpr(condition!.expression); setAction(condition!.action); setEditing(true) }}
          className="underline ml-1 opacity-60 hover:opacity-100"
        >
          edit
        </button>
        <button
          onClick={onDelete}
          className="opacity-60 hover:opacity-100"
          style={{ color: 'var(--danger)' }}
        >
          {'\u2715'}
        </button>
      </div>
    </div>
  )
}
