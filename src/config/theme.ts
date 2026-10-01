export const SCORE_THRESHOLDS = {
  STRONG: 70,
  GOOD:   50,
  FAIR:   30,
} as const

export type ScoreColor = 'green' | 'cyan' | 'amber' | 'red'

export function toScoreColor(pct: number): ScoreColor {
  if (pct >= SCORE_THRESHOLDS.STRONG) return 'green'
  if (pct >= SCORE_THRESHOLDS.GOOD)   return 'cyan'
  if (pct >= SCORE_THRESHOLDS.FAIR)   return 'amber'
  return 'red'
}

export const SCORE_COLOR_CLASSES: Record<ScoreColor, string> = {
  green: 'text-[var(--status-live)] bg-[var(--status-live)]/10 ring-[var(--status-live)]/30',
  cyan:  'text-[var(--score-cyan)] bg-[var(--score-cyan)]/10 ring-[var(--score-cyan)]/30',
  amber: 'text-[var(--status-warn)] bg-[var(--status-warn)]/10 ring-[var(--status-warn)]/30',
  red:   'text-[var(--status-danger)] bg-[var(--status-danger)]/10 ring-[var(--status-danger)]/30',
}
