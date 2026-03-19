import type { Step } from '../api/steps'

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-green-100 text-green-700',
  POST: 'bg-blue-100 text-blue-700',
  PUT: 'bg-yellow-100 text-yellow-700',
  PATCH: 'bg-orange-100 text-orange-700',
  DELETE: 'bg-red-100 text-red-700',
}

interface Props {
  step: Step
  isSelected: boolean
  onClick: () => void
  onDelete: () => void
}

export function StepCard({ step, isSelected, onClick, onDelete }: Props) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border-2 p-4 cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 min-w-0">
          <span className={`text-xs font-bold px-2 py-1 rounded flex-shrink-0 ${METHOD_COLORS[step.method] ?? 'bg-gray-100 text-gray-700'}`}>
            {step.method}
          </span>
          <div className="min-w-0">
            <p className="font-medium text-gray-900 text-sm">{step.name}</p>
            {step.url && <p className="text-xs text-gray-400 truncate">{step.url}</p>}
          </div>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-gray-300 hover:text-red-400 text-lg leading-none ml-3 flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
