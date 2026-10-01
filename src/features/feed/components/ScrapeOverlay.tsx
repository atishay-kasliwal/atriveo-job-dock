import { useEffect, useState } from 'react'
import { Check, Loader2, Square, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useScrapeRun } from '@/api/useScrapeRun'
import {
  SCRAPE_PHASE_LABELS, formatScrapeDuration, scrapeElapsedMs, scrapeJobDelta,
  scrapeRemainingLabel, type ScrapePhase, type ScrapeRunState,
} from '@/api/scrapeControl'

interface ScrapeOverlayProps {
  /** Fired after a successful run so the feed can refetch. */
  onComplete?: (state: ScrapeRunState) => void
}

/** Long enough to read "N new jobs", short enough not to feel like a wait. */
const SUCCESS_DISMISS_MS = 1_500

function phaseFor(phases: ScrapePhase[], name: string): ScrapePhase | undefined {
  return phases?.find((p) => p.name === name)
}

function PhaseIcon({ phase, active }: { phase?: ScrapePhase; active: boolean }) {
  if (phase?.status === 'ok') return <Check className="h-3 w-3 text-primary" />
  if (phase?.status === 'failed') return <X className="h-3 w-3 text-rose-400" />
  if (phase?.status === 'cancelled') return <Square className="h-2.5 w-2.5 text-foreground/30" />
  if (phase?.status === 'running' || active) return <Loader2 className="h-3 w-3 animate-spin text-primary" />
  return <span className="h-1 w-1 rounded-full bg-foreground/20" />
}

/**
 * Covers the dock while a run is in flight.
 *
 * A run rewrites and redeploys the feed this window is showing, so queueing
 * resumes or applying against rows that are about to change is a good way to
 * act on stale data. Not dismissable while running — Stop is the way out.
 *
 * The run lives on the Mac, so quitting the dock does not stop it and
 * relaunching lands back here. A successful run closes itself.
 */
export function ScrapeOverlay({ onComplete }: ScrapeOverlayProps) {
  const { status, cancel, justFinished, acknowledgeFinish } = useScrapeRun(onComplete)
  const { state, running, knownPhases, estimate } = status
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [running])

  const finished = running ? null : justFinished?.status ?? null

  // A successful run needs nothing from the user: the feed is already
  // refetching, so show the result briefly and get out of the way. Failed,
  // cancelled and interrupted runs stay up until acknowledged.
  useEffect(() => {
    if (finished !== 'done') return
    const t = setTimeout(acknowledgeFinish, SUCCESS_DISMISS_MS)
    return () => clearTimeout(t)
  }, [finished, acknowledgeFinish])

  if (!running && !finished) return null

  const shown = running ? state : justFinished ?? state
  const elapsed = scrapeElapsedMs(shown, now)
  const remaining = running ? scrapeRemainingLabel(estimate.totalSec, elapsed) : null
  const delta = finished === 'done' ? scrapeJobDelta(shown) : null

  // Elapsed-vs-estimate rather than phase count: the scrape is most of the run,
  // so a per-phase fraction sits at 0% then jumps. Capped so it never reads as
  // complete while work continues.
  const doneCount = shown.phases?.filter((p) => p.status === 'ok').length ?? 0
  const pct = running && estimate.totalSec
    ? Math.min(97, Math.round((elapsed / (estimate.totalSec * 1000)) * 100))
    : Math.round((doneCount / Math.max(knownPhases.length, 1)) * 100)

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Pipeline run in progress"
    >
      <div className="w-full rounded-lg border border-white/10 bg-neutral-900/95 p-3 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          {running
            ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
            : finished === 'done'
              ? <Check className="h-3.5 w-3.5 text-primary" />
              : <X className="h-3.5 w-3.5 text-rose-400" />}
          <span className="flex-1 text-[11px] font-semibold text-foreground/85">
            {running ? 'Scraping…' : finished === 'done' ? 'Scrape complete' : `Run ${finished}`}
          </span>
          <span className="text-[9px] tabular-nums text-foreground/40">
            {formatScrapeDuration(elapsed)}
          </span>
        </div>

        <p className="mb-2 text-[9px] leading-relaxed text-foreground/45">
          {running
            ? estimate.totalSec
              ? `Running ${formatScrapeDuration(elapsed)}${remaining ? ` · ${remaining}` : ''}. Typical run is about ${formatScrapeDuration(estimate.totalSec * 1000)} (median of ${estimate.samples}).`
              : 'The feed is being rebuilt. First tracked run, so no estimate yet.'
            : finished === 'done'
              ? delta != null && delta > 0 ? `${delta} new job${delta === 1 ? '' : 's'} in the feed.` : 'Feed rebuilt.'
              : 'Check the pipeline log on your Mac for details.'}
        </p>

        <div className="mb-2 h-0.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ol className="mb-2 flex flex-col gap-1">
          {knownPhases.map((name) => {
            const phase = phaseFor(shown.phases ?? [], name)
            const active = running && shown.phase === name
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

        {running ? (
          <button
            onClick={() => void cancel()}
            className="w-full rounded border border-rose-500/40 px-2 py-1 text-[10px] font-semibold text-rose-300 transition-colors hover:bg-rose-500/10"
          >
            Stop run
          </button>
        ) : (
          <button
            onClick={acknowledgeFinish}
            className="w-full rounded border border-primary/40 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Continue
          </button>
        )}

        <p className="mt-2 text-center text-[8px] text-foreground/25">
          Runs on your Mac — quitting the dock won't stop it.
        </p>
      </div>
    </div>
  )
}
