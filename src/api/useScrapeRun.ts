import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchScrapeStatus, startScrape, cancelScrape, OFFLINE_STATUS,
  type ScrapeRunState, type ScrapeStatus,
} from './scrapeControl'

const QUERY_KEY = ['scrape', 'status'] as const

/** Live enough to feel responsive without hammering the sidecar for 15 minutes. */
const POLL_ACTIVE_MS = 2_000
/** Idle polling only exists to notice a run started elsewhere (CLI, web app). */
const POLL_IDLE_MS = 30_000

export interface UseScrapeRunResult {
  status: ScrapeStatus
  starting: boolean
  error: string | null
  /**
   * The run that just ended, held until acknowledged.
   *
   * Null on a fresh launch even if the last recorded run finished long ago —
   * otherwise the dock would open with a stale "complete" panel every time.
   */
  justFinished: ScrapeRunState | null
  start: () => Promise<void>
  cancel: () => Promise<void>
  clearError: () => void
  acknowledgeFinish: () => void
}

/**
 * Drives an on-demand pipeline run from the dock.
 *
 * The run lives on the Mac, not in this window, so state is polled rather than
 * streamed: quitting the dock does not stop a run, and relaunching reattaches
 * to whatever is in flight.
 *
 * @param onComplete fired once per successful run — refetch the feed with it.
 */
export function useScrapeRun(onComplete?: (state: ScrapeRunState) => void): UseScrapeRunResult {
  const queryClient = useQueryClient()
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justFinished, setJustFinished] = useState<ScrapeRunState | null>(null)

  // Terminal state keeps being polled after a run ends; this makes the
  // completion callback fire exactly once per run.
  const completedRunId = useRef<string | null>(null)
  // Only report a finish for a run we actually watched running in this session.
  const sawRunning = useRef(false)
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const { data: status = OFFLINE_STATUS } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: fetchScrapeStatus,
    refetchInterval: (query) => (query.state.data?.running ? POLL_ACTIVE_MS : POLL_IDLE_MS),
    refetchOnWindowFocus: true,
    staleTime: 0,
  })

  useEffect(() => {
    if (status.running) {
      sawRunning.current = true
      return
    }
    const { runId, status: runStatus } = status.state
    const terminal = runStatus !== 'idle' && runStatus !== 'running'
    if (!sawRunning.current || !terminal || !runId) return
    if (completedRunId.current === runId) return
    completedRunId.current = runId
    sawRunning.current = false
    setJustFinished(status.state)
    if (runStatus === 'done') onCompleteRef.current?.(status.state)
  }, [status])

  const refresh = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }, [queryClient])

  const start = useCallback(async () => {
    setStarting(true)
    setError(null)
    const res = await startScrape()
    // 409 means one is already running — attaching to it is the right outcome.
    if (!res.ok && !res.alreadyRunning) setError(res.error ?? 'Could not start the scrape.')
    setStarting(false)
    refresh()
  }, [refresh])

  const cancel = useCallback(async () => {
    setError(null)
    const res = await cancelScrape()
    if (!res.ok && res.error) setError(res.error)
    refresh()
  }, [refresh])

  const clearError = useCallback(() => setError(null), [])
  const acknowledgeFinish = useCallback(() => setJustFinished(null), [])

  return { status, starting, error, justFinished, start, cancel, clearError, acknowledgeFinish }
}
