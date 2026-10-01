import { Providers } from './providers'
import { FeedView } from '@/features/feed/FeedView'
import { getCurrentWindow } from '@tauri-apps/api/window'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const resize = (dir: string) => (e: React.MouseEvent) => {
  e.preventDefault()
  void (getCurrentWindow() as any).startResizeDragging(dir)
}

export function App() {
  return (
    <Providers>
      <div className="relative h-screen w-screen overflow-hidden">

        {/* Right-edge handle — drag to change width */}
        <div
          className="absolute right-0 top-0 z-50 h-[calc(100%-8px)] w-2 cursor-col-resize opacity-0 transition-opacity duration-150 hover:opacity-100"
          style={{ background: 'linear-gradient(to right, transparent, oklch(0.8 0.14 205 / 0.25))' }}
          onMouseDown={resize('East')}
        />

        {/* Bottom-edge handle — drag to change height */}
        <div
          className="absolute bottom-0 left-0 z-50 flex h-2 w-[calc(100%-8px)] cursor-ns-resize items-center justify-center opacity-0 transition-opacity duration-150 hover:opacity-100"
          onMouseDown={resize('South')}
        >
          <div className="h-0.5 w-8 rounded-full bg-white/25" />
        </div>

        {/* Corner handle */}
        <div
          className="absolute bottom-0 right-0 z-50 h-4 w-4 cursor-nwse-resize opacity-0 transition-opacity duration-150 hover:opacity-100"
          onMouseDown={resize('SouthEast')}
        />

        <main
          className="flex h-full w-full flex-col overflow-hidden rounded-r-2xl bg-dock-glass backdrop-blur-3xl backdrop-saturate-200"
          style={{
            borderRight:  '1px solid oklch(1 0 0 / 0.10)',
            borderTop:    '1px solid oklch(1 0 0 / 0.07)',
            borderBottom: '1px solid oklch(1 0 0 / 0.07)',
            boxShadow:    '4px 0 40px -4px oklch(0 0 0 / 0.45)',
          }}
          aria-label="Atriveo Dock"
        >
          <FeedView />
        </main>
      </div>
    </Providers>
  )
}
