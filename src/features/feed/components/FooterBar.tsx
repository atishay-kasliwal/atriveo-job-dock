import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ScrapeButton } from './ScrapeButton'

interface FooterBarProps {
  total: number
  actioned: number
  applied: number
  archived: number
  isLoading: boolean
  syncIn: number
  onRefresh: () => void
}

function fmtSync(sec: number): string {
  if (sec >= 60) {
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${m}m ${s}s` : `${m}m`
  }
  return `${sec}s`
}

export function FooterBar({ total, actioned, applied, archived, isLoading, syncIn, onRefresh }: FooterBarProps) {
  const appliedPct  = total > 0 ? Math.min((applied  / total) * 100, 100) : 0
  const remaining   = 100 - appliedPct
  const archivedPct = total > 0 ? Math.min((archived / total) * 100, remaining) : 0

  return (
    <footer className="shrink-0 border-t border-white/[0.06] px-3 py-2">
      {/* Progress bar */}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/[0.07]">
        {/* Applied segment — primary/teal */}
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-primary/70 transition-all duration-500"
          style={{ width: `${appliedPct}%` }}
        />
        {/* Archived segment — starts after applied */}
        <div
          className="absolute top-0 h-full rounded-full bg-rose-500/50 transition-all duration-500"
          style={{ left: `${appliedPct}%`, width: `${archivedPct}%` }}
        />
      </div>

      {/* Meta row */}
      <div className="mt-1.5 flex items-center">
        <span className="text-[9px] tabular-nums text-foreground/25">
          {actioned} / {total}
        </span>
        <div className="flex-1" />
        <span className="text-[9px] tabular-nums text-foreground/20">
          {isLoading ? 'Syncing…' : `${fmtSync(syncIn)}`}
        </span>
        <button
          aria-label="Refresh feed"
          onClick={onRefresh}
          className="ml-2 rounded p-0.5 text-foreground/25 transition-all hover:text-foreground/60 active:scale-90"
        >
          <RefreshCw className={cn('h-3 w-3', isLoading && 'animate-spin')} />
        </button>
        {/* Refresh pulls the existing feed; this triggers a fresh scrape. */}
        <ScrapeButton />
      </div>
    </footer>
  )
}
