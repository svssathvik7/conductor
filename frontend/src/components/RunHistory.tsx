import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { runsApi } from '../api/runs'
import type { RunResult } from '../api/runs'

const STATUS_DOT: Record<string, string> = {
  PASSED: 'var(--success)',
  FAILED: 'var(--danger)',
  RUNNING: 'var(--accent)',
}

export function RunHistory() {
  const { workflowId, projectId } = useParams<{ workflowId: string; projectId: string }>()
  const navigate = useNavigate()

  const { data: runs = [] } = useQuery<RunResult[]>({
    queryKey: ['runs', workflowId],
    queryFn: () => runsApi.list(workflowId!),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 5000
      return (data as RunResult[]).some(r => r.status === 'RUNNING') ? 2000 : false
    },
  })

  return (
    <div className="w-60 flex flex-col overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}>
      <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-tertiary)' }}>Run History</h3>
      </div>
      <div className="flex-1 overflow-y-auto">
        {runs.map(run => (
          <div
            key={run.id}
            onClick={() => navigate(`/projects/${projectId}/workflows/${workflowId}/run-view/${run.id}`)}
            className="px-4 py-3 cursor-pointer transition-colors"
            style={{ borderBottom: '1px solid var(--border)' }}
            onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    backgroundColor: STATUS_DOT[run.status] ?? 'var(--text-tertiary)',
                    animation: run.status === 'RUNNING' ? 'pulse-dot 1.5s ease-in-out infinite' : undefined,
                  }}
                />
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {run.status}
                </span>
              </div>
              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                {new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {runs.length === 0 && (
          <p className="p-4 text-xs text-center" style={{ color: 'var(--text-tertiary)' }}>No runs yet</p>
        )}
      </div>
    </div>
  )
}
