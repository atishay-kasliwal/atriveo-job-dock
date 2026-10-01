/**
 * On-demand scrape control.
 *
 * Scraping used to run hourly from a LaunchAgent on the Mac. It now runs only
 * when asked, and the dock — which already sits on the same machine as the
 * tailor sidecar — can drive it directly over localhost. No Cloudflare relay
 * involved here, unlike the web app.
 *
 * Server side: atriveo-app/scripts/scrape-control.mjs
 */
import { TAILOR_BASE, TAILOR_TOKEN } from '@/config/tailor'

export type ScrapeRunStatus =
  | 'idle'
  | 'running'
  | 'done'
  | 'failed'
  | 'cancelled'
  /** State file said running but the process is gone — Mac slept, or it was killed. */
  | 'interrupted'

export type ScrapePhaseStatus = 'running' | 'ok' | 'failed' | 'cancelled'

export type ScrapePhaseName = 'scrape' | 'jd_export' | 'feed_deploy' | 'resume_queue'

export interface ScrapePhase {
  name: string
  status: ScrapePhaseStatus
  startedAt: string
  finishedAt?: string
  exitCode?: number
}

export interface ScrapeRunState {
  runId: string | null
  status: ScrapeRunStatus
  phase: string | null
  phases: ScrapePhase[]
  pid?: number
  host?: string
  startedAt?: string
  updatedAt?: string
  finishedAt?: string | null
  exitCode?: number | null
  jobsBefore?: number | null
  jobsAfter?: number | null
  error?: string
}

/** Median timings from past successful runs; `totalSec` is null until some exist. */
export interface ScrapeEstimate {
  totalSec: number | null
  samples: number
  byPhase: Partial<Record<ScrapePhaseName, number>>
}

export interface ScrapeStatus {
  running: boolean
  knownPhases: ScrapePhaseName[]
  state: ScrapeRunState
  estimate: ScrapeEstimate
  /** Sidecar unreachable — it is not running, rather than the run having failed. */
  offline: boolean
}

export const SCRAPE_PHASE_LABELS: Record<string, string> = {
  scrape: 'Scrape',
  jd_export: 'Descriptions',
  feed_deploy: 'Deploy feed',
  resume_queue: 'Queue resumes',
}

const DEFAULT_PHASES: ScrapePhaseName[] = ['scrape', 'jd_export', 'feed_deploy', 'resume_queue']

const IDLE_STATE: ScrapeRunState = { runId: null, status: 'idle', phase: null, phases: [] }

const NO_ESTIMATE: ScrapeEstimate = { totalSec: null, samples: 0, byPhase: {} }

export const OFFLINE_STATUS: ScrapeStatus = {
  running: false,
  knownPhases: DEFAULT_PHASES,
  state: IDLE_STATE,
  estimate: NO_ESTIMATE,
  offline: true,
}

function tailorHeaders(json = false): Record<string, string> {
  return json
    ? { 'Content-Type': 'application/json', 'X-Tailor-Token': TAILOR_TOKEN }
    : { 'X-Tailor-Token': TAILOR_TOKEN }
}

export async function fetchScrapeStatus(): Promise<ScrapeStatus> {
  try {
    const res = await fetch(`${TAILOR_BASE}/scrape/status?t=${Date.now()}`, {
      headers: tailorHeaders(),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return OFFLINE_STATUS
    const body = await res.json() as {
      running?: boolean
      knownPhases?: ScrapePhaseName[]
      state?: ScrapeRunState
      estimate?: ScrapeEstimate
    }
    return {
      running: Boolean(body.running),
      knownPhases: body.knownPhases?.length ? body.knownPhases : DEFAULT_PHASES,
      state: body.state ?? IDLE_STATE,
      estimate: body.estimate ?? NO_ESTIMATE,
      offline: false,
    }
  } catch {
    // Sidecar down. Not an error worth surfacing as a failure — the button
    // just reports that the local service is not up.
    return OFFLINE_STATUS
  }
}

export interface StartScrapeResult {
  ok: boolean
  runId?: string
  /** True when a run was already in flight — the caller should attach, not error. */
  alreadyRunning?: boolean
  error?: string
}

export async function startScrape(): Promise<StartScrapeResult> {
  try {
    const res = await fetch(`${TAILOR_BASE}/scrape/start`, {
      method: 'POST',
      headers: tailorHeaders(true),
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(15_000),
    })
    const body = await res.json().catch(() => null) as { runId?: string; error?: string } | null
    if (res.status === 409) return { ok: false, alreadyRunning: true, runId: body?.runId }
    if (!res.ok) return { ok: false, error: body?.error ?? `HTTP ${res.status}` }
    return { ok: true, runId: body?.runId }
  } catch {
    return { ok: false, error: 'Tailor service not running on this Mac (localhost:8787).' }
  }
}

export async function cancelScrape(): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`${TAILOR_BASE}/scrape/cancel`, {
      method: 'POST',
      headers: tailorHeaders(),
      signal: AbortSignal.timeout(8000),
    })
    const body = await res.json().catch(() => null) as { error?: string } | null
    if (!res.ok) return { ok: false, error: body?.error ?? `HTTP ${res.status}` }
    return { ok: true }
  } catch {
    return { ok: false, error: 'Tailor service not running on this Mac (localhost:8787).' }
  }
}

/** Jobs added by the run, when both counts were captured. */
export function scrapeJobDelta(state: ScrapeRunState): number | null {
  if (state.jobsBefore == null || state.jobsAfter == null) return null
  return state.jobsAfter - state.jobsBefore
}

export function scrapeElapsedMs(state: ScrapeRunState, now: number): number {
  if (!state.startedAt) return 0
  const start = Date.parse(state.startedAt)
  if (Number.isNaN(start)) return 0
  const end = state.finishedAt ? Date.parse(state.finishedAt) : now
  return (Number.isNaN(end) ? now : end) - start
}

export function formatScrapeDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return ''
  const total = Math.floor(ms / 1000)
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return mins <= 0 ? `${secs}s` : `${mins}m ${String(secs).padStart(2, '0')}s`
}

/**
 * "about 6m left", or null with no history to estimate from.
 *
 * A run past the median reports "any moment now" rather than counting negative:
 * we know it is late, not how late.
 */
export function scrapeRemainingLabel(estimateSec: number | null, elapsedMs: number): string | null {
  if (estimateSec == null || estimateSec <= 0) return null
  const remainingMs = estimateSec * 1000 - elapsedMs
  if (remainingMs <= 30_000) return 'any moment now'
  return `about ${formatScrapeDuration(remainingMs)} left`
}
