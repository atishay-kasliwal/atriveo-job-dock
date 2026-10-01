import { Sparkles, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { FeedTab } from '@/domain/job'

interface Tab { id: FeedTab; label: string }

const FEED_TABS: Tab[] = [
  { id: 'hour',      label: 'Hour'      },
  { id: 'today',     label: 'Today'     },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week',      label: 'Week'      },
]

interface TabBarProps {
  active: FeedTab
  counts?: Partial<Record<FeedTab, number>>
  onSelect: (tab: FeedTab) => void
}

export function TabBar({ active, onSelect }: TabBarProps) {
  const isCreate   = active === 'create'
  const isSettings = active === 'settings'

  return (
    <nav
      className="flex shrink-0 items-center px-3 pb-2 gap-1"
      aria-label="Feed tabs"
    >
      {/* Feed time tabs — each takes equal share of available space */}
      {FEED_TABS.map((tab) => {
        const active_ = tab.id === active
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active_}
            onClick={() => onSelect(tab.id)}
            className={cn(
              'flex flex-1 items-center justify-center gap-1 rounded-full py-[5px] text-[10.5px] font-medium transition-all duration-150',
              active_
                ? 'bg-primary/16 text-primary ring-1 ring-primary/20'
                : 'text-foreground/40 hover:bg-white/5 hover:text-foreground/70',
            )}
          >
            {tab.label}
          </button>
        )
      })}

      {/* Separator */}
      <div className="mx-0.5 h-3.5 w-px shrink-0 bg-white/[0.08]" />

      {/* Create — fixed width, distinct */}
      <button
        role="tab"
        aria-selected={isCreate}
        onClick={() => onSelect('create')}
        className={cn(
          'flex shrink-0 items-center gap-1.5 rounded-full px-3 py-[5px] text-[10.5px] font-semibold transition-all duration-150',
          isCreate
            ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
            : 'bg-white/[0.05] text-foreground/50 hover:bg-white/[0.08] hover:text-foreground/80',
        )}
      >
        <Sparkles className="h-3 w-3" />
        Create
      </button>

      {/* Settings — icon only, so the feed tabs keep their width */}
      <button
        role="tab"
        aria-selected={isSettings}
        aria-label="Settings"
        title="Settings"
        onClick={() => onSelect('settings')}
        className={cn(
          'flex h-[23px] w-[23px] shrink-0 items-center justify-center rounded-full transition-all duration-150',
          isSettings
            ? 'bg-primary/20 text-primary ring-1 ring-primary/30'
            : 'bg-white/[0.05] text-foreground/40 hover:bg-white/[0.08] hover:text-foreground/70',
        )}
      >
        <Settings className="h-3 w-3" />
      </button>
    </nav>
  )
}
