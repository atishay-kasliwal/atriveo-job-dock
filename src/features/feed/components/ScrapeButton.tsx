import { useEffect, useRef, useState } from 'react'
import { Check, CircleAlert, Loader2, RadioTower, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrapeRun } from '@/api/useScrapeRun'
import { useFeedStore } from '@/stores/feedStore'
import {
  SCRAPE_PHASE_LABELS, formatScrapeDuration, scrapeElapsedMs, scrapeJobDelta,
  type ScrapePhase, type ScrapeRunState,
} from '@/api/scrapeControl'

const AUTO_SCRAPE_MINUTE_OF_HOUR = 45
const AUTO_SCRAPE_RETRY_MS = 5 * 60 * 1000
const IDLE_AUTO_SCRAPE_CHECK_MS = 30 * 1000
const AUTO_SCRAPE_SLOT_WINDOW_MS = 90 * 1000

function latestAutoScrapeSlotMs(nowMs: number) {
  const slot = new Date(nowMs)
  slot.setSeconds(0, 0)
  slot.setMinutes(AUTO_SCRAPE_MINUTE_OF_HOUR)
  if (slot.getTime() > nowMs) slot.setHours(slot.getHours() - 1)
  return slot.getTime()
}

function isWithinAutoScrapeSlotWindow(nowMs: number, slotMs: number) {
  return nowMs >= slotMs && nowMs < (slotMs + AUTO_SCRAPE_SLOT_WINDOW_MS)
}

function phaseFor(state: ScrapeRunState, name: string): ScrapePhase | undefined {
  return state.phases?.find((p) => p.name === name)
}

function PhaseIcon({ phase, active }: { phase?: ScrapePhase; active: boolean }) {
  const status = phase?.status
  if (status === 'ok') return <Check className="h-3 w-3 text-primary" />
  if (status === 'failed') return <X className="h-3 w-3 text-rose-400" />
  if (status === 'cancelled') return <Square className="h-3 w-3 text-foreground/30" />
  if (status === 'running' || active) return <Loader2 className="h-3 w-3 animate-spin text-primary" />
  return <span className="h-1 w-1 rounded-full bg-foreground/20" />
}

/**
 * Triggers a pipeline run on this Mac and reports progress.
 *
 * Replaces the hourly LaunchAgent. The run happens in the sidecar, so this is
 * a view over polled state — closing the dock does not stop it.
 */
export function ScrapeButton() {
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const panelRef = useRef<HTMLDivElement>(null)
  const lastAutoAttemptAt = useRef(0)
  const autoScrapeHourly = useFeedStore((state) => state.autoScrapeHourly)

  const { status, starting, error, start, cancel, clearError } = useScrapeRun()
  const { state, running, offline, knownPhases } = status

  // Keep the elapsed timer moving during active runs, and keep a light idle
  // heartbeat when automation is enabled so we actually notice when the next
  // run window rolls around.
  useEffect(() => {
    if (!running && !autoScrapeHourly) return
    const intervalMs = running ? 1000 : IDLE_AUTO_SCRAPE_CHECK_MS
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [running, autoScrapeHourly])

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => {
    if (!autoScrapeHourly || offline || running || starting) return

    const lastRunAtRaw = state.finishedAt ?? state.updatedAt ?? state.startedAt ?? null
    const lastRunAtMs = lastRunAtRaw ? Date.parse(lastRunAtRaw) : Number.NaN
    const nowMs = now
    const latestSlotMs = latestAutoScrapeSlotMs(nowMs)
    const isDue = isWithinAutoScrapeSlotWindow(nowMs, latestSlotMs)
      && (Number.isNaN(lastRunAtMs) || lastRunAtMs < latestSlotMs)
    if (!isDue) return
    if ((nowMs - lastAutoAttemptAt.current) < AUTO_SCRAPE_RETRY_MS) return

    lastAutoAttemptAt.current = nowMs
    void start()
  }, [autoScrapeHourly, now, offline, running, starting, state.finishedAt, state.updatedAt, state.startedAt, start])

  const elapsed = scrapeElapsedMs(state, now)
  const delta = scrapeJobDelta(state)

  const label = (() => {
    if (offline) return 'offline'
    if (running) return formatScrapeDuration(elapsed)
    if (state.status === 'done') return delta != null && delta > 0 ? `+${delta}` : 'scrape'
    if (state.status === 'failed' || state.status === 'interrupted') return 'failed'
    return 'scrape'
  })()
  const autoLabel = autoScrapeHourly ? ':45 on' : ':45 off'
  const visibleLabel = (() => {
    if (offline) return label
    if (running || state.status === 'failed' || state.status === 'interrupted') return label
    return autoLabel
  })()

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-label="Run the job pipeline now"
        title={offline ? 'Tailor service is not running on this Mac' : 'Run the pipeline now'}
        onClick={() => (running || offline ? setOpen((v) => !v) : void start())}
        onContextMenu={(e) => { e.preventDefault(); setOpen((v) => !v) }}
        disabled={starting}
        className={cn(
          'ml-2 flex items-center gap-1 rounded px-1 py-0.5 text-[9px] tabular-nums transition-all active:scale-90',
          offline && 'text-foreground/20',
          running && 'text-primary',
          !offline && !running && 'text-foreground/25 hover:text-foreground/60',
          state.status === 'failed' && !running && 'text-rose-400/70',
        )}
      >
        {running
          ? <Loader2 className="h-3 w-3 animate-spin" />
          : state.status === 'failed' || state.status === 'interrupted'
            ? <CircleAlert className="h-3 w-3" />
            : <RadioTower className="h-3 w-3" />}
        <span>{visibleLabel}</span>
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-60 rounded-lg border border-white/10 bg-neutral-900/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground/70">
              Pipeline run
            </span>
            <span className="text-[9px] tabular-nums text-foreground/35">
              {running ? formatScrapeDuration(elapsed) : state.status}
            </span>
          </div>

          {offline && (
            <p className="mb-2 rounded bg-white/5 px-2 py-1.5 text-[9px] leading-relaxed text-foreground/50">
              Tailor service is not running. Start it on this Mac:
              <code className="mt-0.5 block text-foreground/70">npm run tailor</code>
            </p>
          )}

          {error && (
            <p className="mb-2 flex items-start gap-1 rounded bg-rose-500/10 px-2 py-1.5 text-[9px] leading-relaxed text-rose-300">
              <span className="flex-1">{error}</span>
              <button onClick={clearError} aria-label="Dismiss" className="shrink-0 opacity-60 hover:opacity-100">
                <X className="h-2.5 w-2.5" />
              </button>
            </p>
          )}

          <p className="mb-2 text-[8.5px] text-foreground/25">
            Auto at :45: {autoScrapeHourly ? 'on' : 'off'}
          </p>

          <ol className="mb-2 flex flex-col gap-1">
            {knownPhases.map((name) => {
              const phase = phaseFor(state, name)
              const active = running && state.phase === name
              return (
                <li key={name} className="flex items-center gap-2 text-[10px]">
                  <span className="flex h-3 w-3 items-center justify-center">
                    <PhaseIcon phase={phase} active={active} />
                  </span>
                  <span className={cn(
                    'flex-1',
                    active ? 'text-primary' : phase?.status === 'ok' ? 'text-foreground/60' : 'text-foreground/30',
                  )}>
                    {SCRAPE_PHASE_LABELS[name] ?? name}
                  </span>
                  {phase?.finishedAt && (
                    <span className="tabular-nums text-[9px] text-foreground/25">
                      {formatScrapeDuration(Date.parse(phase.finishedAt) - Date.parse(phase.startedAt))}
                    </span>
                  )}
                </li>
              )
            })}
          </ol>

          {state.host && (
            <p className="mb-2 text-[9px] text-foreground/25">on {state.host}</p>
          )}

          {running ? (
            <button
              onClick={() => void cancel()}
              className="w-full rounded border border-rose-500/40 px-2 py-1 text-[10px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/10"
            >
              Stop run
            </button>
          ) : (
            <button
              onClick={() => void start()}
              disabled={offline || starting}
              className="w-full rounded border border-primary/40 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
            >
              {starting ? 'Starting…' : 'Run now'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
