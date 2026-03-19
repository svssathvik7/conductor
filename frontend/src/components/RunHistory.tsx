import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { runsApi } from '../api/runs'
import type { RunResult } from '../api/runs'

export function RunHistory() {
  const { workflowId, projectId } = useParams<{ workflowId: string; projectId: string }>()
  const navigate = useNavigate()

  const { data: runs = [] } = useQuery<RunResult[]>({
    queryKey: ['runs', workflowId],
    queryFn: () => runsApi.list(workflowId!),
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 5000
      const hasRunning = (data as RunResult[]).some(r => r.status === 'RUNNING')
      return hasRunning ? 2000 : false
    },
  })

  const statusStyle: Record<string, string> = {
    PASSED: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    RUNNING: 'bg-blue-100 text-blue-700',
  }

  return (
    <div className="w-64 bg-white border-l flex flex-col overflow-hidden flex-shrink-0">
      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm text-gray-700">Run History</h3>
      </div>
      <div className="flex-1 overflow-y-auto divide-y">
        {runs.map(run => (
          <div
            key={run.id}
            onClick={() => navigate(`/projects/${projectId}/workflows/${workflowId}/run-view/${run.id}`)}
            className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <div className="flex justify-between items-center">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${statusStyle[run.status] ?? 'bg-gray-100 text-gray-700'}`}>
                {run.status}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(run.started_at).toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}
        {runs.length === 0 && (
          <p className="p-4 text-xs text-gray-400 text-center">No runs yet</p>
        )}
      </div>
    </div>
  )
}
