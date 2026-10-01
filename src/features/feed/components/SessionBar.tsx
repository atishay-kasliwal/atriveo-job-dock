import { useRef } from 'react'
import { cn } from '@/lib/utils'
import type { Job } from '@/domain/job'

interface SessionChip {
  sessionId: string
  label: string
  count: number
}

interface SessionBarProps {
  jobs: Job[]
  hiddenIds: Set<string>
  selectedSession: string | null
  onSelect: (sessionId: string | null) => void
}

function formatSessionTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function SessionBar({ jobs, hiddenIds, selectedSession, onSelect }: SessionBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Build session chips from jobs — ordered by most recent first, excluding hidden jobs
  const sessions: SessionChip[] = (() => {
    const map = new Map<string, { time: Date; count: number }>()
    for (const job of jobs) {
      if (!job.sessionId) continue
      if (hiddenIds.has(job.id)) continue
      const existing = map.get(job.sessionId)
      if (!existing) {
        map.set(job.sessionId, { time: job.batchTime ?? job.postedAt, count: 1 })
      } else {
        existing.count++
        // Keep earliest batchTime as the canonical session time
        if ((job.batchTime ?? job.postedAt) < existing.time) {
          existing.time = job.batchTime ?? job.postedAt
        }
      }
    }
    return [...map.entries()]
      .sort((a, b) => b[1].time.getTime() - a[1].time.getTime())
      .map(([sessionId, { time, count }]) => ({
        sessionId,
        label: formatSessionTime(time),
        count,
      }))
  })()

  if (sessions.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className="dock-scroll flex shrink-0 items-center gap-1.5 overflow-x-auto overflow-y-hidden px-3 py-2"
      style={{ scrollbarWidth: 'none' }}
    >
      <span className="shrink-0 text-[8px] font-bold uppercase tracking-widest text-foreground/25">
        Sessions
      </span>
      {sessions.map((s) => {
        const isActive = selectedSession === s.sessionId
        return (
          <button
            key={s.sessionId}
            onClick={() => onSelect(isActive ? null : s.sessionId)}
            className={cn(
              'flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-semibold transition-all',
              isActive
                ? 'border-primary/50 bg-primary/15 text-primary'
                : 'border-white/10 bg-white/[0.04] text-foreground/40 hover:border-white/20 hover:text-foreground/65',
            )}
          >
            <span>{s.label}</span>
            <span className={cn(
              'rounded-full px-1 py-px text-[7px] font-bold',
              isActive ? 'bg-primary/20 text-primary/80' : 'bg-white/8 text-foreground/30',
            )}>
              {s.count}
            </span>
          </button>
        )
      })}
    </div>
  )
}
