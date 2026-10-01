import { Pin } from 'lucide-react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { LogicalSize } from '@tauri-apps/api/dpi'
import { windowManager } from '@/platform/window/WindowManager'
import { cn } from '@/lib/utils'
import { AtriveoLogo } from '@/components/AtriveoLogo'
import { getConnection } from '@/config/connection'

interface TitleBarProps {
  isPinned: boolean
  onTogglePin: () => void
  isLive: boolean
}

export function TitleBar({ isPinned, onTogglePin, isLive }: TitleBarProps) {
  return (
    <header
      data-tauri-drag-region
      className="flex h-10 shrink-0 select-none items-center justify-between px-4"
    >
      {/* Traffic lights */}
      <div className="flex items-center gap-[7px]">
        <button
          aria-label="Close"
          onClick={() => void windowManager.hide()}
          className="h-3 w-3 rounded-full bg-[var(--tl-red)] outline-none transition-opacity hover:opacity-80 active:scale-90"
        />
        <button aria-label="Minimise" onClick={() => void getCurrentWindow().minimize()} className="h-3 w-3 rounded-full bg-[var(--tl-yellow)] outline-none transition-opacity hover:opacity-80 active:scale-90" />
        <button
          aria-label="Compact / Expand"
          onClick={() => {
            const win = getCurrentWindow()
            void win.innerSize().then((size) => {
              const compactH = 48
              const fullH = 780
              void win.setSize(new LogicalSize(size.width, size.height <= compactH + 20 ? fullH : compactH))
            })
          }}
          className="h-3 w-3 rounded-full bg-[var(--tl-green)] outline-none transition-opacity hover:opacity-80 active:scale-90"
        />
      </div>

      {/* Brand */}
      <div
        data-tauri-drag-region
        className="pointer-events-none flex items-center gap-2"
      >
        <AtriveoLogo size="sm" />
        <span className="text-[10px] font-bold tracking-[0.22em] uppercase text-foreground/50">
          Atriveo Dock
        </span>
      </div>

      {/* Right cluster */}
      <div className="flex items-center gap-2">
        {getConnection().demo ? (
          <div className="flex items-center gap-1" title="Sample data — connect a backend in Settings">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-300" />
            <span className="text-[9px] font-bold uppercase tracking-wide text-amber-300">Demo</span>
          </div>
        ) : isLive && (
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--status-live)] shadow-[0_0_6px_var(--status-live)]" />
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--status-live)]">Live</span>
          </div>
        )}

        {/* Pin toggle — always visible, changes appearance on state */}
        <button
          aria-label={isPinned ? 'Unpin — let other windows go on top' : 'Pin — keep above all windows'}
          onClick={onTogglePin}
          title={isPinned ? 'Click to unpin' : 'Pin on top of all windows'}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold transition-all duration-150',
            isPinned
              ? 'bg-primary/20 text-primary ring-1 ring-primary/30 hover:bg-primary/15'
              : 'bg-white/6 text-foreground/45 ring-1 ring-white/8 hover:bg-white/10 hover:text-foreground/75',
          )}
        >
          <Pin className={cn('h-3 w-3', isPinned && 'fill-current')} />
          <span>{isPinned ? 'Pinned' : 'Pin'}</span>
        </button>
      </div>
    </header>
  )
}
