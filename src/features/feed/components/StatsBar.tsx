import { TrendingUp, Zap, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatsBarProps {
  matches: number
  strong: number
  newCount: number
}

function MiniBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="mt-1 h-0.5 w-full overflow-hidden rounded-full bg-white/8">
      <div
        className={cn('h-full rounded-full transition-all duration-500', color)}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}

function Stat({
  label, value, icon: Icon, barPct, barColor, accent,
}: {
  label: string
  value: string | number
  icon: React.ElementType
  barPct: number
  barColor: string
  accent?: boolean
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col px-3">
      <div className="flex items-center gap-1 text-foreground/30">
        <Icon className="h-2.5 w-2.5 shrink-0" />
        <span className="text-[8px] font-bold uppercase tracking-[0.14em]">{label}</span>
      </div>
      <span className={cn('mt-0.5 text-[17px] font-bold tabular-nums leading-none', accent ? 'text-primary' : 'text-foreground/80')}>
        {value}
      </span>
      <MiniBar pct={barPct} color={barColor} />
    </div>
  )
}

function Divider() {
  return <div className="h-8 w-px shrink-0 bg-white/6" />
}

export function StatsBar({ matches, strong, newCount }: StatsBarProps) {
  const strongPct  = matches > 0 ? Math.round((strong / matches) * 100) : 0
  const newPct     = matches > 0 ? Math.min(Math.round((newCount / matches) * 100), 100) : 0

  return (
    <div className="flex shrink-0 items-center border-b border-white/6 px-2 py-2">
      <Stat
        label="Matches"
        value={matches}
        icon={TrendingUp}
        barPct={100}
        barColor="bg-foreground/20"
      />
      <Divider />
      <Stat
        label="Strong"
        value={strong}
        icon={Zap}
        barPct={strongPct}
        barColor="bg-primary/70"
        accent
      />
      <Divider />
      <Stat
        label="New"
        value={newCount > 0 ? `+${newCount}` : '0'}
        icon={Sparkles}
        barPct={newPct}
        barColor="bg-[var(--status-live)]/70"
        accent={newCount > 0}
      />
    </div>
  )
}
