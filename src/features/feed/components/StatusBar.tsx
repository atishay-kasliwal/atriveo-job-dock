import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatusBarProps {
  lastSyncedAt: Date | null
  jobCount: number
  isLoading: boolean
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function StatusBar({ lastSyncedAt, jobCount, isLoading }: StatusBarProps) {
  return (
    <div className="flex shrink-0 items-center justify-between border-t border-white/6 px-4 py-2">
      <div className="flex items-center gap-1.5">
        <RefreshCw
          className={cn(
            'h-3 w-3 text-foreground/25 transition-all',
            isLoading && 'animate-spin text-primary/60',
          )}
        />
        <span className="text-[10px] text-foreground/30 tabular-nums">
          {isLoading
            ? 'Syncing…'
            : lastSyncedAt
            ? `Updated ${fmtTime(lastSyncedAt)}`
            : 'Not synced'}
        </span>
      </div>
      <span className="text-[10px] font-medium text-foreground/28 tabular-nums">
        {jobCount.toLocaleString()} {jobCount === 1 ? 'job' : 'jobs'}
      </span>
    </div>
  )
}
