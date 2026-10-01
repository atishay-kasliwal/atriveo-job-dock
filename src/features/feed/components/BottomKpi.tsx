import { Clock } from 'lucide-react'

interface KpiSpec {
  label: string
  value: number
  accentColor: string
}

interface BottomKpiProps {
  matches: number
  strong: number
  hour: number
  today: number
  lastSyncedAt: Date | null
  // Optional custom cards — when provided, these replace the default
  // Matches/Strong/Hour/Today set (used by the Create tab for its own KPIs).
  cards?: KpiSpec[]
  syncedLabel?: string
}

function timeAgoShort(date: Date): string {
  const min = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (min < 1)  return 'now'
  if (min < 60) return `${min}m`
  return `${Math.floor(min / 60)}h`
}

interface KpiCardProps {
  label: string
  value: number
  accentColor: string // tailwind bg color for the top border + circle
}

function KpiCard({ label, value, accentColor }: KpiCardProps) {
  return (
    <div className="relative flex flex-col overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.04] px-3 pb-2.5 pt-2" style={{ borderTop: `2px solid ${accentColor}` }}>
      {/* decorative circle — bottom right, matches atriveo-app pattern */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-4 -right-4 h-14 w-14 rounded-full opacity-20"
        style={{ background: accentColor }}
      />
      <span className="text-[22px] font-extrabold tabular-nums leading-none text-foreground/85" style={{ letterSpacing: '-0.03em' }}>{value}</span>
      <span className="mt-0.5 text-[8px] font-bold uppercase tracking-[0.13em] text-foreground/30">{label}</span>
    </div>
  )
}

export function BottomKpi({ matches, strong, hour, today, lastSyncedAt, cards, syncedLabel }: BottomKpiProps) {
  const specs: KpiSpec[] = cards ?? [
    { label: 'Matches', value: matches, accentColor: '#6366f1' },
    { label: 'Strong',  value: strong,  accentColor: '#22d3ee' },
    { label: 'Hour',    value: hour,    accentColor: '#a78bfa' },
    { label: 'Today',   value: today,   accentColor: '#34d399' },
  ]
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-white/[0.06] px-3 py-2.5">
      <div className="grid grid-cols-4 gap-2">
        {specs.map((s) => (
          <KpiCard key={s.label} label={s.label} value={s.value} accentColor={s.accentColor} />
        ))}
      </div>
      <div className="flex items-center gap-1 text-foreground/22">
        <Clock className="h-2.5 w-2.5" />
        <span className="text-[8.5px] tabular-nums">
          {syncedLabel ?? (lastSyncedAt ? `synced ${timeAgoShort(lastSyncedAt)} ago` : '—')}
        </span>
      </div>
    </div>
  )
}
