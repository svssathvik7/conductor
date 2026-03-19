interface Props {
  name: string
  description: string
  onClick: () => void
  onDelete: () => void
}

export function ProjectCard({ name, description, onClick, onDelete }: Props) {
  return (
    <div
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-md transition-shadow"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900">{name}</h3>
          {description && <p className="text-sm text-gray-500 mt-1">{description}</p>}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="text-gray-400 hover:text-red-500 text-sm ml-4 flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
