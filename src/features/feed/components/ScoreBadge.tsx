import { toScoreColor } from '@/config/theme'
import { cn } from '@/lib/utils'

const COLOR: Record<ReturnType<typeof toScoreColor>, string> = {
  green: 'text-[var(--status-live)]  bg-[var(--status-live)]/10  ring-[var(--status-live)]/25',
  cyan:  'text-[var(--score-cyan)]   bg-[var(--score-cyan)]/10   ring-[var(--score-cyan)]/25',
  amber: 'text-[var(--status-warn)]  bg-[var(--status-warn)]/10  ring-[var(--status-warn)]/25',
  red:   'text-[var(--status-danger)] bg-[var(--status-danger)]/10 ring-[var(--status-danger)]/25',
}

const DELTA_COLOR: Record<ReturnType<typeof toScoreColor>, string> = {
  green: 'text-[var(--status-live)]',
  cyan:  'text-[var(--score-cyan)]',
  amber: 'text-[var(--status-warn)]',
  red:   'text-[var(--status-danger)]',
}

interface ScoreBadgeProps {
  pct: number
  delta: number | null
}

export function ScoreBadge({ pct, delta }: ScoreBadgeProps) {
  const color = toScoreColor(pct)
  return (
    <div className="flex flex-col items-end gap-0.5">
      <span
        className={cn(
          'rounded-lg px-2 py-1 text-[14px] font-bold tabular-nums ring-1',
          COLOR[color],
        )}
      >
        {pct}<span className="text-[10px] font-semibold">%</span>
      </span>
      {delta !== null && delta !== 0 && (
        <span className={cn('text-[9px] font-semibold tabular-nums', DELTA_COLOR[color])}>
          {delta > 0 ? '▲' : '▼'} {Math.abs(delta)}
        </span>
      )}
    </div>
  )
}
