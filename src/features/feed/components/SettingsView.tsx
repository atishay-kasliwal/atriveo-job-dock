import { useState, useEffect } from 'react'
import { Loader2, AlertCircle, RotateCcw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useFeedStore } from '@/stores/feedStore'
import { formatDownloadFolderPreview } from '@/lib/downloadFolder'
import { ConnectionSettings } from './ConnectionSettings'
import {
  fetchResumeProfile,
  saveResumeProfile,
  RESUME_PROFILE_FIELDS,
  type ResumeProfile,
} from '@/api/resumeProfile'

export function SettingsView() {
  const {
    resumeDownloadFolderName,
    setResumeDownloadFolderName,
    autoScrapeHourly,
    setAutoScrapeHourly,
  } = useFeedStore()
  const [profile, setProfile] = useState<ResumeProfile | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [saving, setSaving]   = useState(false)
  const [saved, setSaved]     = useState(false)

  // The sidecar owns these values — load them fresh rather than caching a copy
  // that could drift from what the resume engine actually prints.
  useEffect(() => {
    let cancelled = false
    fetchResumeProfile()
      .then((p) => { if (!cancelled) setProfile(p) })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : String(e)) })
    return () => { cancelled = true }
  }, [])

  async function handleSave() {
    if (!profile) return
    setSaving(true)
    setError(null)
    try {
      setProfile(await saveResumeProfile(profile))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const downloadFolderPreview = formatDownloadFolderPreview(resumeDownloadFolderName)

  return (
    <div className="dock-scroll flex flex-1 flex-col gap-3 overflow-y-auto px-4 pb-4 pt-3">

      <ConnectionSettings />

      {/* ── Downloads folder ── */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-foreground/25">
            Resume folder
          </span>
          <button
            type="button"
            onClick={() => setResumeDownloadFolderName('')}
            className={cn(
              'text-[9px] font-medium transition-colors',
              resumeDownloadFolderName
                ? 'text-foreground/35 hover:text-foreground/60'
                : 'cursor-default text-foreground/15',
            )}
          >
            Use default
          </button>
        </div>
        <input
          value={resumeDownloadFolderName}
          onChange={(e) => setResumeDownloadFolderName(e.target.value)}
          placeholder="Custom folder name in Downloads"
          className="mt-1.5 w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] text-foreground placeholder:text-foreground/20 outline-none transition-all focus:border-primary/30 focus:bg-white/[0.07]"
        />
        <p className="mt-1 text-[9px] text-foreground/25">{downloadFolderPreview}</p>
      </section>

      {/* ── Pipeline automation ── */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-[9px] font-semibold uppercase tracking-widest text-foreground/25">
              Pipeline automation
            </span>
            <p className="mt-1 text-[9px] leading-relaxed text-foreground/25">
              Automatically start a fresh scrape at :45 past each hour while the dock is open.
            </p>
            <p className="mt-1 text-[8.5px] leading-relaxed text-foreground/20">
              This keeps fresh jobs ready by the top of the hour. If your Mac was asleep or the dock
              was closed at :45, it runs once as soon as the dock is back, then returns to :45.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={autoScrapeHourly}
            onClick={() => setAutoScrapeHourly(!autoScrapeHourly)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-full border px-2 py-1 text-[9px] font-semibold transition-all',
              autoScrapeHourly
                ? 'border-primary/35 bg-primary/15 text-primary'
                : 'border-white/[0.08] bg-white/[0.04] text-foreground/35 hover:text-foreground/60',
            )}
          >
            <span
              className={cn(
                'h-2 w-2 rounded-full transition-colors',
                autoScrapeHourly ? 'bg-primary' : 'bg-foreground/25',
              )}
            />
            {autoScrapeHourly ? ':45 on' : ':45 off'}
          </button>
        </div>
      </section>

      {/* ── Resume identity ── */}
      <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2.5">
        <span className="text-[9px] font-semibold uppercase tracking-widest text-foreground/25">
          Resume identity
        </span>
        <p className="mt-1 text-[9px] leading-relaxed text-foreground/25">
          These fields control the name, title, contact details, and links printed at the top of
          every tailored resume. They are stored by the Tailor service and used on the next build.
        </p>

        {!profile && error ? (
          <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-rose-500/15 bg-rose-500/[0.04] px-2.5 py-2">
            <AlertCircle className="mt-px h-3 w-3 shrink-0 text-rose-400/70" />
            <p className="text-[9px] leading-relaxed text-rose-400/70">{error}</p>
          </div>
        ) : !profile ? (
          <div className="mt-3 flex items-center gap-1.5 text-[9px] text-foreground/25">
            <Loader2 className="h-3 w-3 animate-spin" />
            Loading from Tailor service…
          </div>
        ) : (
          <>
            <div className="mt-2.5 space-y-2">
              {RESUME_PROFILE_FIELDS.map(({ key, label, hint }) => (
                <label key={key} className="block">
                  <span className="text-[9px] font-medium text-foreground/40">{label}</span>
                  <input
                    value={profile[key]}
                    onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                    className="mt-0.5 w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-1.5 text-[11px] text-foreground placeholder:text-foreground/20 outline-none transition-all focus:border-primary/30 focus:bg-white/[0.07]"
                  />
                  <span className="mt-0.5 block text-[8.5px] text-foreground/20">{hint}</span>
                </label>
              ))}
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
                {saving ? <><Loader2 className="h-3 w-3 animate-spin" />Saving…</> : 'Save'}
              </button>
              {saved && <span className="text-[9px] text-emerald-400/80">Saved ✓</span>}
              {error && <span className="min-w-0 truncate text-[9px] text-rose-400/70">{error}</span>}
            </div>

            <p className="mt-2 flex items-start gap-1 text-[8.5px] leading-relaxed text-foreground/20">
              <RotateCcw className="mt-px h-2.5 w-2.5 shrink-0" />
              Clear a field and save to restore its default. Location here is only a fallback; if a
              posting clearly names one location, that posting still wins.
            </p>
          </>
        )}
      </section>
    </div>
  )
}
