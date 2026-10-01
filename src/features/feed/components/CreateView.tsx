import { useState, useEffect, useRef } from 'react'
import { Download, Sparkles, CheckCircle2, CheckCheck, AlertCircle, Loader2, FileText, FolderCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import { TAILOR_BASE, TAILOR_TOKEN } from '@/config/tailor'
import { normalizeJobUrl } from '@/lib/normalizeJobUrl'
import { createTrackerJob } from '@/api/jobTracker'
import { useFeedStore } from '@/stores/feedStore'
import { saveToDownloads, downloadsStatus } from '@/platform/shell/saveToDownloads'

const MIN_JD = 400

interface BuildEntry {
  jobUrl:         string
  company:        string
  title:          string
  status:         'queued' | 'building' | 'done' | 'failed'
  stage:          string | null
  pdfPath:        string | null
  error:          string | null
  trackerAsked:   boolean
  addedToTracker: boolean
  createdAt?:     number  // epoch ms when the build was queued
}

const BUILDS_KEY = 'atriveo-create-builds'

// Persisted memory for the Create tab's build queue — so your resume builds
// (and their Download links) survive restarts instead of vanishing.
function loadBuilds(): BuildEntry[] {
  try {
    const raw = localStorage.getItem(BUILDS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw) as BuildEntry[]
    return Array.isArray(arr) ? arr.slice(0, 50) : []
  } catch { return [] }
}

function saveBuilds(builds: BuildEntry[]) {
  try { localStorage.setItem(BUILDS_KEY, JSON.stringify(builds.slice(0, 50))) } catch { /* ignore */ }
}

// Short "Jul 12 · 3:45 PM" style stamp for a build's creation time.
function buildStamp(ms?: number): string {
  if (!ms || !Number.isFinite(ms)) return ''
  const d = new Date(ms)
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${date} · ${time}`
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
}

function manualJobUrl(company: string, title: string) {
  return `manual://${slugify(company)}-${slugify(title)}-${Date.now()}`
}

const STAGE_LABELS: Record<string, string> = {
  QUEUED:    'Waiting in queue',
  GATED:     'Checking job description',
  COMPOSED:  'Writing your resume',
  OPTIMIZED: 'Optimising content',
  TEX:       'Typesetting',
  PDF:       'Generating PDF',
  SUCCESS:   'Done',
}

const STAGE_PCT: Record<string, number> = {
  QUEUED: 5, GATED: 18, COMPOSED: 38, OPTIMIZED: 55, TEX: 72, PDF: 88, SUCCESS: 100,
}

export function CreateView() {
  const [company, setCompany]       = useState('')
  const [title, setTitle]           = useState('')
  // Sets the city printed in the resume header, so a Seattle posting doesn't
  // ship a New York resume. Blank falls back to the home city in the profile.
  const [location, setLocation]     = useState('')
  const [jd, setJd]                 = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [builds, setBuilds]         = useState<BuildEntry[]>(loadBuilds)
  const pollRef                     = useRef<ReturnType<typeof setInterval> | null>(null)
  const [coverState, setCoverState]   = useState<Record<string, 'idle' | 'building' | 'done' | 'error'>>({})
  const [downloadErr, setDownloadErr] = useState<Record<string, string>>({})
  const [downloadOk, setDownloadOk]   = useState<Record<string, boolean>>({})
  // jobUrl → display path of a copy that already exists on disk (e.g.
  // "~/Downloads/Walmart (13thJuly)/Atishay Kasliwal.pdf"). Survives restarts
  // because it's read from the filesystem, not from click state.
  const [savedTo, setSavedTo]         = useState<Record<string, string>>({})
  // Read-only here — the folder itself is edited in the Settings tab.
  const { resumeDownloadFolderName } = useFeedStore()
  const companyRef = useRef<HTMLInputElement>(null)
  // Draggable divider: user-adjustable form height (px), persisted.
  const [formHeight, setFormHeight] = useState<number>(() => {
    const saved = Number(localStorage.getItem('atriveo-create-form-h'))
    return Number.isFinite(saved) && saved >= 180 ? saved : 320
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingRef  = useRef(false)

  useEffect(() => {
    companyRef.current?.focus()
  }, [])

  // Persist the build queue whenever it changes so it survives restarts.
  useEffect(() => { saveBuilds(builds) }, [builds])

  // Draggable divider: adjust the form height by dragging the handle.
  useEffect(() => {
    function onMove(e: MouseEvent) {
      if (!draggingRef.current || !containerRef.current) return
      const top = containerRef.current.getBoundingClientRect().top
      // Clamp so neither the form nor the queue collapses entirely.
      const h = Math.max(180, Math.min(e.clientY - top, containerRef.current.clientHeight - 120))
      setFormHeight(h)
    }
    function onUp() {
      if (!draggingRef.current) return
      draggingRef.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      localStorage.setItem('atriveo-create-form-h', String(formHeight))
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [formHeight])

  // Hydrate from the server on mount: pull past manual:// builds from the
  // tailor queue so they reappear even after a fresh install (not just builds
  // made in this session). Merges with the locally-persisted list.
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' }
        if (TAILOR_TOKEN) headers['x-tailor-token'] = TAILOR_TOKEN
        const res = await fetch(`${TAILOR_BASE}/compile-queue?limit=2000`, { headers })
        if (!res.ok) return
        const data = await res.json() as { jobs?: Array<{ job_url: string; company?: string; title?: string; batch_time?: string | null; resume?: { status?: string; stage?: string; pdf_path?: string | null; error?: string | null; failure_reason?: string | null; batch_time?: string | null } }> }
        const manual = (data.jobs ?? []).filter((j) => String(j.job_url).startsWith('manual://'))
        if (cancelled || manual.length === 0) return
        setBuilds((prev) => {
          const seen = new Set(prev.map((b) => normalizeJobUrl(b.jobUrl)))
          const fromServer: BuildEntry[] = manual
            .filter((j) => !seen.has(normalizeJobUrl(j.job_url)))
            .map((j) => {
              const r = j.resume ?? {}
              const isFailed = r.status === 'failed' || (r.status !== 'success' && r.failure_reason != null)
              const isDone   = r.status === 'success' && r.pdf_path != null
              return {
                jobUrl:  j.job_url,
                company: j.company ?? 'Unknown',
                title:   j.title ?? 'role',
                status:  isDone ? 'done' : isFailed ? 'failed' : r.status === 'running' ? 'building' : 'queued',
                stage:   r.stage ?? null,
                pdfPath: r.pdf_path ?? null,
                error:   isFailed ? (r.error ?? r.failure_reason ?? 'Failed') : null,
                trackerAsked:   isDone,
                addedToTracker: false,
                createdAt: (() => {
                  const t = j.batch_time ?? r.batch_time
                  const ms = t ? Date.parse(t) : NaN
                  return Number.isFinite(ms) ? ms : undefined
                })(),
              } as BuildEntry
            })
          return fromServer.length ? [...prev, ...fromServer].slice(0, 50) : prev
        })
      } catch { /* best-effort */ }
    }
    void hydrate()
    return () => { cancelled = true }
  }, [])

  // Which finished builds we need to look up on disk. Keyed as a flat string so
  // the effect below doesn't re-run on every 3s poll tick (which hands back a
  // fresh `builds` array even when nothing about the finished ones changed).
  const doneKey = builds
    .filter((b) => b.status === 'done' && b.pdfPath)
    .map((b) => `${b.jobUrl}\t${b.pdfPath}`)
    .join('\n')

  // Ask the filesystem which of those resumes are already saved in the
  // Downloads folder, so a rebuilt/reopened dock still shows "Saved" and the
  // exact folder instead of pretending nothing was ever downloaded.
  useEffect(() => {
    if (!doneKey) { setSavedTo({}); return }
    let cancelled = false
    void (async () => {
      const pairs = doneKey.split('\n').map((s) => s.split('\t') as [string, string])
      const entries = await Promise.all(pairs.map(async ([jobUrl, pdfPath]) => {
        try {
          const st = await downloadsStatus(pdfPath, resumeDownloadFolderName)
          return [jobUrl, st.exists ? st.displayPath : ''] as const
        } catch { return [jobUrl, ''] as const }
      }))
      if (cancelled) return
      setSavedTo(Object.fromEntries(entries.filter(([, p]) => p)))
    })()
    return () => { cancelled = true }
  }, [doneKey, resumeDownloadFolderName])

  // Poll active builds every 3s
  useEffect(() => {
    const active = builds.filter((b) => b.status === 'queued' || b.status === 'building')
    if (active.length === 0) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
      return
    }
    if (pollRef.current) return
    pollRef.current = setInterval(() => { void pollBuilds() }, 3000)
    return () => {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    }
  }, [builds])

  async function pollBuilds() {
    const urls = builds
      .filter((b) => b.status === 'queued' || b.status === 'building')
      .map((b) => b.jobUrl)
    if (urls.length === 0) return
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (TAILOR_TOKEN) headers['x-tailor-token'] = TAILOR_TOKEN
      const res = await fetch(`${TAILOR_BASE}/compile-queue/lookup`, {
        method: 'POST', headers,
        body: JSON.stringify({ urls }),
      })
      if (!res.ok) return
      const data = await res.json() as { jobs?: Array<{ job_url: string; resume?: { status?: string; stage?: string; pdf_path?: string | null; error?: string | null; failure_reason?: string | null } }> }
      const map = new Map((data.jobs ?? []).map((j) => [normalizeJobUrl(j.job_url), j]))
      setBuilds((prev) => prev.map((b) => {
        const hit = map.get(normalizeJobUrl(b.jobUrl))
        if (!hit?.resume) return b
        const r = hit.resume
        const isFailed = r.status === 'failed' || (r.status !== 'success' && r.failure_reason != null)
        const isDone   = r.status === 'success' && r.pdf_path != null
        return {
          ...b,
          stage:   r.stage ?? b.stage,
          pdfPath: r.pdf_path ?? b.pdfPath,
          status:  isDone ? 'done' : isFailed ? 'failed' : r.status === 'running' ? 'building' : b.status,
          error:   isFailed ? (r.error ?? r.failure_reason ?? 'Failed') : b.error,
        }
      }))
    } catch { /* silent */ }
  }

  async function handleSubmit() {
    setError(null)
    const c = company.trim()
    const t = title.trim()
    const loc = location.trim()
    const d = jd.trim()
    if (!c) { setError('Enter a company name'); return }
    if (!t) { setError('Enter a role / title'); return }
    if (d.length < MIN_JD) { setError(`Need at least ${MIN_JD} characters`); return }

    const jobUrl = manualJobUrl(c, t)
    setSubmitting(true)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (TAILOR_TOKEN) headers['x-tailor-token'] = TAILOR_TOKEN
      const jdRes = await fetch(`${TAILOR_BASE}/manual-jd`, {
        method: 'POST', headers,
        body: JSON.stringify({ job_url: jobUrl, company: c, title: t, location: loc, description: d }),
      })
      const jdData = await jdRes.json().catch(() => ({})) as { ok?: boolean; error?: string }
      if (!jdRes.ok || !jdData.ok) throw new Error(jdData.error ?? 'Could not save the job description')
      const res = await fetch(`${TAILOR_BASE}/compile-enqueue`, {
        method: 'POST', headers,
        body: JSON.stringify({ job_url: jobUrl, company: c, title: t, score_pct: 100, force: true }),
      })
      const data = await res.json() as { ok?: boolean; skipped?: boolean; error?: string }
      if (!data.ok && !data.skipped) throw new Error(data.error ?? 'Enqueue failed')
      setBuilds((prev) => [{
        jobUrl, company: c, title: t,
        status: 'queued', stage: 'QUEUED',
        pdfPath: null, error: null,
        trackerAsked: false, addedToTracker: false,
        createdAt: Date.now(),
      }, ...prev])
      setCompany(''); setTitle(''); setLocation(''); setJd('')
      companyRef.current?.focus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to start')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDownload(b: BuildEntry) {
    if (!b.pdfPath) return
    try {
      setDownloadErr((p) => ({ ...p, [b.jobUrl]: '' }))
      await saveToDownloads(b.pdfPath, resumeDownloadFolderName)
      setDownloadOk((p) => ({ ...p, [b.jobUrl]: true }))
      setTimeout(() => setDownloadOk((p) => ({ ...p, [b.jobUrl]: false })), 3000)
      // Re-read the destination so the row keeps showing the folder after the
      // transient "Saved!" flash fades.
      try {
        const st = await downloadsStatus(b.pdfPath, resumeDownloadFolderName)
        if (st.exists) setSavedTo((p) => ({ ...p, [b.jobUrl]: st.displayPath }))
      } catch { /* the copy succeeded; the label is cosmetic */ }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setDownloadErr((p) => ({ ...p, [b.jobUrl]: msg }))
      setTimeout(() => setDownloadErr((p) => ({ ...p, [b.jobUrl]: '' })), 5000)
    }
  }

  function handleAddToTracker(b: BuildEntry) {
    // Write to the real atriveo.com tracker (job-tracker-api). manual:// URLs
    // have no real job link, so only company/role are sent.
    void createTrackerJob({ company: b.company, role: b.title }).catch((err) => {
      console.error('Tracker add failed', err)
    })
    setBuilds((prev) => prev.map((x) => x.jobUrl === b.jobUrl ? { ...x, addedToTracker: true, trackerAsked: true } : x))
  }

  function handleSkipTracker(b: BuildEntry) {
    setBuilds((prev) => prev.map((x) => x.jobUrl === b.jobUrl ? { ...x, trackerAsked: true } : x))
  }

  async function handleCover(b: BuildEntry) {
    const state = coverState[b.jobUrl] ?? 'idle'
    if (state === 'building') return
    setCoverState((p) => ({ ...p, [b.jobUrl]: 'building' }))
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      if (TAILOR_TOKEN) headers['x-tailor-token'] = TAILOR_TOKEN
      const res = await fetch(`${TAILOR_BASE}/cover-enqueue`, {
        method: 'POST', headers,
        body: JSON.stringify({ job_url: b.jobUrl, company: b.company, title: b.title }),
      })
      const data = await res.json().catch(() => ({})) as { ok?: boolean; pdf_path?: string; error?: string }
      if (!res.ok || !data.ok || !data.pdf_path) throw new Error(data.error ?? 'Cover letter failed')
      setCoverState((p) => ({ ...p, [b.jobUrl]: 'done' }))
      // Auto-save the cover letter to Downloads
      try { await saveToDownloads(data.pdf_path, resumeDownloadFolderName) } catch { /* best-effort */ }
    } catch {
      setCoverState((p) => ({ ...p, [b.jobUrl]: 'error' }))
      setTimeout(() => setCoverState((p) => ({ ...p, [b.jobUrl]: 'idle' })), 5000)
    }
  }

  const jdLen    = jd.trim().length
  const canSubmit = company.trim() && title.trim() && jdLen >= MIN_JD
  const jdPct    = Math.min(jdLen / MIN_JD, 1)

  return (
    <div ref={containerRef} className="flex flex-1 flex-col overflow-hidden">

      {/* ── Form — resizable height (drag the divider below to adjust) ── */}
      <div className="shrink-0 flex flex-col items-center overflow-y-auto px-4 pt-4 pb-2" style={{ height: formHeight }}>
        <div className="w-full space-y-2">

          {/* Header */}
          <div className="text-center mb-1">
            <div className="flex items-center justify-center gap-1.5 mb-0.5">
              <Sparkles className="h-3 w-3 text-primary/50" />
              <span className="text-[11px] font-semibold tracking-wide text-foreground/60">Build a Tailored Resume</span>
            </div>
            <p className="text-[9px] text-foreground/25">
              Paste the full job description to generate a role-specific resume PDF.
            </p>
            <p className="text-[8.5px] text-foreground/20">
              Best results come from the complete posting and a current resume identity in Settings.
            </p>
          </div>

          {/* Company + Role */}
          <div className="flex gap-2">
            <input
              ref={companyRef}
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Company"
              className="flex-1 min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] text-foreground placeholder:text-foreground/20 outline-none transition-all focus:border-primary/30 focus:bg-white/[0.07]"
            />
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Role / Title"
              className="flex-1 min-w-0 rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] text-foreground placeholder:text-foreground/20 outline-none transition-all focus:border-primary/30 focus:bg-white/[0.07]"
            />
          </div>

          {/* Job location — sets the city printed in the resume header */}
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Job location (optional) — e.g. Seattle, WA"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2 text-[11px] text-foreground placeholder:text-foreground/20 outline-none transition-all focus:border-primary/30 focus:bg-white/[0.07]"
            onKeyDown={(e) => { if (e.key === 'Tab') { e.preventDefault(); document.querySelector<HTMLTextAreaElement>('textarea')?.focus() } }}
          />

          {/* JD textarea */}
          <div className="relative">
            <textarea
              value={jd}
              onChange={(e) => setJd(e.target.value)}
              placeholder="Paste the full job description…"
              rows={22}
              className="w-full resize-none rounded-lg border border-white/[0.08] bg-white/[0.05] px-3 py-2.5 text-[11px] text-foreground placeholder:text-foreground/20 outline-none transition-all focus:border-primary/30 focus:bg-white/[0.07] leading-relaxed"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSubmit) {
                  e.preventDefault(); void handleSubmit()
                }
              }}
            />
            {jdLen > 0 && jdLen < MIN_JD && (
              <div className="pointer-events-none absolute bottom-2.5 right-2.5">
                <svg width="16" height="16" viewBox="0 0 18 18" className="-rotate-90">
                  <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/[0.08]" />
                  <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="2"
                    className="text-primary/50"
                    strokeDasharray={`${2 * Math.PI * 7}`}
                    strokeDashoffset={`${2 * Math.PI * 7 * (1 - jdPct)}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.2s' }}
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between gap-2">
            <span className={cn(
              'text-[9px] tabular-nums transition-colors',
              jdLen === 0    ? 'text-foreground/20' :
              jdLen < MIN_JD ? 'text-foreground/35' :
                               'text-emerald-400/60',
            )}>
              {jdLen >= MIN_JD ? '✓ ready' : `${jdLen} / ${MIN_JD}`}
            </span>
            {error && <span className="min-w-0 truncate text-[9px] text-rose-400/80">{error}</span>}
            <button
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || submitting}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all duration-150 active:scale-95',
                canSubmit && !submitting
                  ? 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/20 hover:border-primary/40'
                  : 'bg-white/[0.04] text-foreground/20 border border-white/[0.06] cursor-not-allowed',
              )}
            >
              {submitting
                ? <><Loader2 className="h-3 w-3 animate-spin" />Starting…</>
                : <><Sparkles className="h-3 w-3" />Build</>
              }
            </button>
          </div>
        </div>
      </div>

      {/* ── Draggable divider — resize the form area up/down ── */}
      <div
        onMouseDown={() => {
          draggingRef.current = true
          document.body.style.cursor = 'row-resize'
          document.body.style.userSelect = 'none'
        }}
        className="group relative flex h-2.5 shrink-0 cursor-row-resize items-center justify-center border-t border-white/[0.05]"
        title="Drag to resize"
      >
        <div className="h-[3px] w-8 rounded-full bg-white/15 transition-colors group-hover:bg-primary/50" />
      </div>

      {/* ── Queue / history — fills remaining space ── */}
      <div className="flex flex-1 flex-col min-h-0">

        {/* Section label */}
        <div className="shrink-0 flex items-center justify-between px-4 py-2">
          <span className="text-[9px] font-semibold uppercase tracking-widest text-foreground/20">Queue</span>
          <div className="flex items-center gap-2">
            {builds.some((b) => b.status === 'done' || b.status === 'failed') && (
              <button
                onClick={() => setBuilds((prev) => prev.filter((b) => b.status === 'queued' || b.status === 'building'))}
                className="text-[9px] font-medium text-foreground/25 transition-colors hover:text-foreground/55"
                title="Clear finished builds"
              >
                Clear done
              </button>
            )}
            {builds.length > 0 && (
              <span className="text-[9px] tabular-nums text-foreground/20">{builds.length}</span>
            )}
          </div>
        </div>

        {/* List */}
        <div className="dock-scroll flex-1 overflow-y-auto px-3 pb-2 space-y-1">
          {builds.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-1 py-6 text-center">
              <p className="text-[9px] text-foreground/15">Builds will appear here</p>
            </div>
          ) : builds.map((b, i) => {
            const pct      = STAGE_PCT[b.stage ?? 'QUEUED'] ?? 5
            const label    = STAGE_LABELS[b.stage ?? 'QUEUED'] ?? b.stage
            const dlErr    = downloadErr[b.jobUrl]
            const dlOk     = downloadOk[b.jobUrl]
            const savedAt  = savedTo[b.jobUrl]
            const isActive = b.status === 'queued' || b.status === 'building'

            return (
              <div
                key={b.jobUrl}
                className={cn(
                  'rounded-xl border px-3 py-2.5 space-y-2 transition-all',
                  b.status === 'done'   ? 'border-white/[0.07] bg-white/[0.03]' :
                  b.status === 'failed' ? 'border-rose-500/10 bg-rose-500/[0.03]' :
                                          'border-white/[0.05] bg-white/[0.02]',
                )}
              >
                {/* Top row */}
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'w-4 shrink-0 text-right text-[11px] font-bold tabular-nums',
                    b.status === 'done'     ? 'text-emerald-400' :
                    b.status === 'failed'   ? 'text-rose-400' :
                    b.status === 'building' ? 'text-primary' :
                                              'text-foreground/30',
                    b.status === 'building' && 'animate-pulse',
                  )}>{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-semibold text-foreground/80">{b.company}</span>
                    <span className="mx-1 text-foreground/15">·</span>
                    <span className="text-[10px] text-foreground/40">{b.title}</span>
                  </div>
                  {b.createdAt && (
                    <span className="shrink-0 text-[8.5px] tabular-nums text-foreground/25">{buildStamp(b.createdAt)}</span>
                  )}
                  {b.status === 'done' && (
                    b.addedToTracker
                      ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-emerald-400/80" aria-label="Added to tracker" />
                      : <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-400/60" aria-label="Resume built" />
                  )}
                  {b.status === 'failed' && (
                    <AlertCircle className="h-3.5 w-3.5 shrink-0 text-rose-400/60" />
                  )}
                  {isActive && (
                    <span className="text-[8px] font-bold uppercase tracking-wide text-foreground/25">
                      {b.status === 'building' ? 'Building' : 'Queued'}
                    </span>
                  )}
                </div>

                {/* Progress */}
                {isActive && (
                  <div className="space-y-1">
                    <div className="h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-primary/40 transition-all duration-700" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="text-[8px] text-foreground/20">{label}</p>
                  </div>
                )}

                {/* Error */}
                {b.status === 'failed' && b.error && (
                  <p className="text-[9px] text-rose-400/55">{b.error}</p>
                )}

                {/* Done: download + cover on row 1, tracker prompt on row 2 */}
                {b.status === 'done' && (
                  <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {/* Download pill */}
                    <button
                      onClick={() => void handleDownload(b)}
                      title={savedAt ? `Already in ${savedAt} — click to overwrite` : 'Save to Downloads'}
                      className={cn(
                        'flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-semibold transition-all active:scale-95',
                        dlErr            ? 'bg-rose-500/10 text-rose-400/80' :
                        dlOk || savedAt  ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15' :
                                           'bg-emerald-500/10 text-emerald-400/70 hover:text-emerald-400 hover:bg-emerald-500/15',
                      )}
                    >
                      {savedAt && !dlErr
                        ? <FolderCheck className="h-3 w-3" />
                        : <Download className="h-3 w-3" />}
                      {dlErr ? 'Not found' : dlOk ? 'Saved!' : savedAt ? 'Saved' : 'Download'}
                    </button>

                    {/* Cover letter pill */}
                    {(() => {
                      const cs = coverState[b.jobUrl] ?? 'idle'
                      return (
                        <button
                          onClick={() => void handleCover(b)}
                          disabled={cs === 'building'}
                          className={cn(
                            'flex items-center gap-1 rounded-md px-2.5 py-1 text-[9px] font-semibold transition-all active:scale-95',
                            cs === 'error'    ? 'bg-rose-500/10 text-rose-400/80' :
                            cs === 'done'     ? 'bg-violet-500/10 text-violet-400 cursor-default' :
                            cs === 'building' ? 'bg-violet-500/10 text-violet-400/60 cursor-default' :
                                                'bg-violet-500/10 text-violet-400/70 hover:text-violet-400 hover:bg-violet-500/15',
                          )}
                          title={cs === 'done' ? 'Cover letter saved to Downloads' : 'Generate cover letter'}
                        >
                          <FileText className={cn('h-3 w-3', cs === 'building' && 'animate-pulse')} />
                          {cs === 'error' ? 'Failed' : cs === 'done' ? 'Cover ✓' : cs === 'building' ? 'Building' : 'Cover'}
                        </button>
                      )
                    })()}
                    <div className="flex-1" />
                  </div>

                  {/* Where the saved copy actually lives — read from disk, so
                      it's still here after a restart. */}
                  {savedAt && (
                    <p className="truncate text-[8.5px] text-emerald-400/45" title={savedAt}>{savedAt}</p>
                  )}

                  {/* Tracker prompt — only while pending; once answered the
                      double-tick in the top row conveys tracked status. */}
                  {!b.trackerAsked && (
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-foreground/25">Add to tracker?</span>
                      <div className="flex-1" />
                      <button
                        onClick={() => handleAddToTracker(b)}
                        className="rounded-md border border-primary/20 px-2.5 py-1 text-[9px] font-semibold text-primary/70 hover:border-primary/40 hover:text-primary transition-all"
                      >
                        Yes
                      </button>
                      <button
                        onClick={() => handleSkipTracker(b)}
                        className="rounded-md border border-white/[0.07] px-2.5 py-1 text-[9px] text-foreground/25 hover:text-foreground/50 transition-all"
                      >
                        Skip
                      </button>
                    </div>
                  )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
