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
      className="group animate-fade-in cursor-pointer rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        boxShadow: 'var(--shadow)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow-md)'
        e.currentTarget.style.borderColor = 'var(--accent)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = 'var(--shadow)'
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
    >
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm" style={{ color: 'var(--accent)' }}>&#9679;</span>
            <h3 className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</h3>
          </div>
          {description && (
            <p className="text-sm mt-1 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
              {description}
            </p>
          )}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 ml-3 p-1.5 rounded-lg"
          style={{ color: 'var(--text-tertiary)' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--danger)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
