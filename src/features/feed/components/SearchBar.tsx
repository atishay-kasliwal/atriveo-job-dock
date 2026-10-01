import { Search, X } from 'lucide-react'
import { useEffect, useRef } from 'react'

interface SearchBarProps {
  value: string
  onChange: (v: string) => void
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        ref.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="relative flex flex-1 items-center">
      <Search className="pointer-events-none absolute left-2.5 h-3 w-3 text-foreground/25" />
      <input
        ref={ref}
        type="search"
        placeholder="Search…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-6 w-full rounded-md bg-white/5 pl-7 pr-8 text-[11px] text-foreground placeholder:text-foreground/25 outline-none ring-1 ring-white/7 transition-all duration-150 focus:bg-white/7 focus:ring-primary/30 focus:placeholder:text-foreground/15"
        aria-label="Search jobs"
      />
      {value ? (
        <button
          aria-label="Clear search"
          onClick={() => onChange('')}
          className="absolute right-2 rounded p-0.5 text-foreground/30 transition-colors hover:text-foreground/70"
        >
          <X className="h-3 w-3" />
        </button>
      ) : (
        <kbd className="pointer-events-none absolute right-2 flex items-center gap-px rounded border border-white/10 bg-white/5 px-1 py-px text-[8px] font-medium text-foreground/25">
          ⌘K
        </kbd>
      )}
    </div>
  )
}
