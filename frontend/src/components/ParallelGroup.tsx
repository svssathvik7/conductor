interface Props {
  children: React.ReactNode
  groupName: string
}

export function ParallelGroup({ children, groupName }: Props) {
  return (
    <div style={{
      border: '2px dashed var(--accent)',
      borderRadius: 'var(--radius)',
      padding: '12px',
      backgroundColor: 'var(--accent-light)',
    }}>
      <div style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: 600, marginBottom: '8px', textTransform: 'uppercase' }}>
        Parallel: {groupName}
      </div>
      <div style={{ display: 'flex', gap: '12px' }}>
        {children}
      </div>
    </div>
  )
}
