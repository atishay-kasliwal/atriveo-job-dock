import React from 'react'
import ReactDOM from 'react-dom/client'
import { invoke } from '@tauri-apps/api/core'
import { App } from './app/App'
import { loadConnection } from './config/connection'
import './styles.css'

// The connection (and demo mode) must be settled before the first render:
// every request reads TAILOR_BASE, and in demo mode those requests are
// answered by the in-process backend installed here.
void (async () => {
  const connection = await loadConnection()
  if (connection.demo) {
    const { installDemoBackend } = await import('./demo/demoServer')
    await installDemoBackend()
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )

  if (connection.demo && await invoke<boolean>('tour_enabled').catch(() => false)) {
    const { runTour } = await import('./demo/tour')
    void runTour()
  }
})()
