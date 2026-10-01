import { cn } from '@/lib/utils'

interface ColumnHeaderProps {
  allSelected: boolean
  someSelected: boolean
  onToggleSelectAll: () => void
}

export function ColumnHeader({ allSelected, someSelected, onToggleSelectAll }: ColumnHeaderProps) {
  return (
    <div className="flex shrink-0 items-center border-b border-white/[0.06] bg-white/[0.02] px-3 py-1.5">
      {/* Select-all checkbox */}
      <button
        onClick={onToggleSelectAll}
        className={cn(
          'flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border transition-colors',
          allSelected
            ? 'border-primary bg-primary/20 text-primary'
            : someSelected
            ? 'border-primary/50 bg-primary/10 text-primary/70'
            : 'border-white/15 text-transparent hover:border-white/30',
        )}
        title={allSelected ? 'Deselect all' : 'Select all'}
        aria-label="Select all jobs"
      >
        {allSelected  && <span className="text-[7px] font-bold leading-none">✓</span>}
        {someSelected && !allSelected && <span className="text-[7px] font-bold leading-none">–</span>}
      </button>

      <span className="w-7 shrink-0" />
      <span className="flex-1 text-[8px] font-bold uppercase tracking-[0.16em] text-foreground/22">Company · Role</span>
      <span className="w-10 pr-3 text-right text-[8px] font-bold uppercase tracking-[0.16em] text-foreground/22">Score</span>
      <span className="w-3 shrink-0" />
    </div>
  )
}
