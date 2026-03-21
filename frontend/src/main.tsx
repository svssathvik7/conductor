import React, { useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import Dashboard from './pages/Dashboard'
import ProjectPage from './pages/ProjectPage'
import WorkflowEditor from './pages/WorkflowEditor'
import RunPage from './pages/RunPage'
import RunView from './pages/RunView'

const queryClient = new QueryClient()

function App() {
  useEffect(() => {
    const stored = localStorage.getItem('theme')
    if (stored === 'dark' || (!stored && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark')
    }
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/projects/:projectId" element={<ProjectPage />} />
          <Route path="/projects/:projectId/workflows/:workflowId" element={<WorkflowEditor />} />
          <Route path="/projects/:projectId/workflows/:workflowId/run-view/:runId" element={<RunPage />} />
          <Route path="/runs/:runId" element={<RunView />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
