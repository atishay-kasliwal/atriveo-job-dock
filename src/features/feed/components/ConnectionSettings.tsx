import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getConnection, saveConnection, DEFAULT_TAILOR_BASE, type Connection } from '@/config/connection'

const inputClass =
  'mt-0.5 w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] text-foreground placeholder:text-foreground/20 outline-none transition-all focus:border-primary/30 focus:bg-white/[0.07]'

/**
 * Where the dock gets its data. Saved to the app's own settings file (never
 * the repo or the app bundle), then the window reloads so every request picks
 * up the new backend.
 */
export function ConnectionSettings() {
  const [draft, setDraft] = useState<Connection>(getConnection())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (patch: Partial<Connection>) => setDraft((d) => ({ ...d, ...patch }))

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      await saveConnection(draft)
      window.location.reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[9px] font-semibold uppercase tracking-widest text-foreground/25">
            Connection
          </span>
          <p className="mt-1 text-[9px] leading-relaxed text-foreground/25">
            Demo mode runs on built-in sample jobs. Turn it off and point the dock at your own
            tailor sidecar to use a real feed.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={draft.demo}
          onClick={() => set({ demo: !draft.demo })}
          className={cn(
            'flex shrink-0 items-center gap-2 rounded-full border px-2 py-1 text-[9px] font-semibold transition-all',
            draft.demo
              ? 'border-amber-400/35 bg-amber-400/15 text-amber-300'
              : 'border-white/[0.08] bg-white/[0.04] text-foreground/35 hover:text-foreground/60',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', draft.demo ? 'bg-amber-300' : 'bg-foreground/25')} />
          {draft.demo ? 'Demo on' : 'Demo off'}
        </button>
      </div>

      <div className={cn('mt-2.5 space-y-2', draft.demo && 'pointer-events-none opacity-40')}>
        <label className="block">
          <span className="text-[9px] font-medium text-foreground/40">Sidecar URL</span>
          <input
            value={draft.tailorBase}
            onChange={(e) => set({ tailorBase: e.target.value })}
            placeholder={DEFAULT_TAILOR_BASE}
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-medium text-foreground/40">Sidecar token</span>
          <input
            type="password"
            value={draft.tailorToken}
            onChange={(e) => set({ tailorToken: e.target.value })}
            placeholder="TAILOR_TOKEN from the sidecar's .env.tailor"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-medium text-foreground/40">Job tracker URL (optional)</span>
          <input
            value={draft.trackerBase}
            onChange={(e) => set({ trackerBase: e.target.value })}
            placeholder="Records each Apply; leave blank to skip"
            className={inputClass}
          />
        </label>
        <label className="block">
          <span className="text-[9px] font-medium text-foreground/40">Job tracker token (optional)</span>
          <input
            type="password"
            value={draft.trackerToken}
            onChange={(e) => set({ trackerToken: e.target.value })}
            className={inputClass}
          />
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          onClick={() => void handleSave()}
          disabled={saving}
          className={cn(
            'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all active:scale-95',
            saving
              ? 'cursor-not-allowed border border-white/[0.06] bg-white/[0.04] text-foreground/20'
              : 'border border-primary/20 bg-primary/15 text-primary hover:border-primary/40 hover:bg-primary/25',
          )}
        >
          {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Saving…</> : 'Save & reload'}
        </button>
        {error && <span className="min-w-0 truncate text-[9px] text-rose-400/70">{error}</span>}
      </div>
    </section>
  )
}
