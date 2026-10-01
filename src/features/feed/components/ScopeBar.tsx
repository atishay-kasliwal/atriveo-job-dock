import { cn } from '@/lib/utils'
import type { FeedScope } from '@/domain/job'

interface ScopeBarProps {
  active: FeedScope
  counts: Record<FeedScope, number>
  onSelect: (scope: FeedScope) => void
}

const SCOPES: { id: FeedScope; label: string }[] = [
  { id: 'others', label: 'Others'  },
  { id: 'top500', label: 'Top List' },
  { id: 'all',    label: 'All'     },
]

export function ScopeBar({ active, counts, onSelect }: ScopeBarProps) {
  return (
    <div className="flex shrink-0 items-center gap-1 px-3 pb-1.5">
      {SCOPES.map((s) => {
        const isActive = s.id === active
        return (
          <button
            key={s.id}
            onClick={() => onSelect(s.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-[3px] text-[10px] font-medium transition-all duration-150',
              isActive
                ? 'bg-white/10 text-foreground/90'
                : 'text-foreground/35 hover:bg-white/5 hover:text-foreground/60',
            )}
          >
            {s.label}
            <span className={cn(
              'tabular-nums text-[9px]',
              isActive ? 'text-foreground/50' : 'text-foreground/25',
            )}>
              {counts[s.id]}
            </span>
          </button>
        )
      })}
    </div>
  )
}
