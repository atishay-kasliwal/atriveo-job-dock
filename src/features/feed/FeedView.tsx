import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { FileCheck, X } from 'lucide-react'
import { TitleBar }     from './components/TitleBar'
import { TabBar }       from './components/TabBar'
import { ScopeBar }     from './components/ScopeBar'
import { BottomKpi }    from './components/BottomKpi'
import { SessionBar }   from './components/SessionBar'
import { SearchBar }    from './components/SearchBar'
import { JobList }      from './components/JobList'
import { CreateView }   from './components/CreateView'
import { SettingsView } from './components/SettingsView'
import { FooterBar }    from './components/FooterBar'
import { ScrapeOverlay } from './components/ScrapeOverlay'
import { AtriveoLogo }  from '@/components/AtriveoLogo'
import { useFeedStore }  from '@/stores/feedStore'
import { windowManager } from '@/platform/window/WindowManager'
import { SYNC_CONFIG }   from '@/config/sync'
import { useJobs }       from '@/api/useJobs'
import { normalizeJobUrl } from '@/lib/normalizeJobUrl'
import { resolveTailorLocation, seedTailorJobContext } from '@/api/tailorJobContext'
import type { Job, FeedScope, FeedTab } from '@/domain/job'
import { cn }            from '@/lib/utils'
import { TAILOR_BASE, TAILOR_TOKEN } from '@/config/tailor'

const HOUR_MS = 3_600_000

type FeedWindowTab = Extract<FeedTab, 'hour' | 'today' | 'yesterday' | 'week'>

export type FailureKind = 'content' | 'gated' | 'error'

export interface QueueEntry {
  position: number
  stage: string | null
  status: string | null
  company: string
  error: string | null
  failureKind: FailureKind | null
}

interface FetchResult {
  pdfMap: Map<string, string>
  queueMap: Map<string, QueueEntry>
  running: number
  queued: number
}

type RawQueueJob = { job_url: string; company: string; resume?: { pdf_path?: string | null; stage?: string | null; status?: string | null; error?: string | null; failure_reason?: string | null } }

function parseQueueJobs(rawJobs: RawQueueJob[]): FetchResult {
  const pdfMap  = new Map<string, string>()
  const queueMap = new Map<string, QueueEntry>()
  const TERMINAL_STATUSES = new Set(['success', 'done', 'completed', 'failed'])
  let activePos = 0
  let runningCount = 0
  let queuedCount = 0

  for (const j of rawJobs) {
    if (!j.job_url) continue
    const key = normalizeJobUrl(j.job_url)
    if (j.resume?.pdf_path) pdfMap.set(key, j.resume.pdf_path)
    const err = j.resume?.error ?? null
    const status = j.resume?.status ?? null
    const failureReason = j.resume?.failure_reason ?? null
    const isFailed = status === 'failed' || (status !== 'success' && failureReason != null)

    let failureKind: FailureKind | null = null
    if (isFailed) {
      const msg = err ?? failureReason ?? ''
      if (/unsupported.?jd|unsupported jd/i.test(msg))        failureKind = 'content'
      else if (/intern role|level mismatch|senior.*profile|junior.*profile/i.test(msg)) failureKind = 'gated'
      else failureKind = 'error'
    }

    const isActive = !TERMINAL_STATUSES.has(status ?? '') && !isFailed
    if (isActive) {
      activePos++
      if (status === 'running') runningCount++
      else queuedCount++
    }
    queueMap.set(key, {
      position:    isActive ? activePos : 0,
      stage:       j.resume?.stage ?? null,
      status:      isFailed ? 'failed' : status,
      company:     j.company,
      error:       err,
      failureKind,
    })
  }
  return { pdfMap, queueMap, running: runningCount, queued: queuedCount }
}

async function fetchQueueData(signal: AbortSignal, feedUrls: string[] = [], doLookup = false): Promise<FetchResult> {
  try {
    const res = await fetch(`${TAILOR_BASE}/compile-queue?limit=2000`, {
      headers: { 'X-Tailor-Token': TAILOR_TOKEN },
      signal,
    })
    if (!res.ok) return { pdfMap: new Map(), queueMap: new Map(), running: 0, queued: 0 }
    const data = await res.json() as { jobs: RawQueueJob[] }
    const result = parseQueueJobs(data.jobs)

    // Supplemental lookup — only on first poll after jobs load, not every 3s
    // Finds feed URLs processed in old sessions beyond the 2000-record window
    if (doLookup && feedUrls.length > 0) {
      const missing = feedUrls.filter((u) => !result.queueMap.has(u))
      if (missing.length > 0) {
        try {
          const lookupRes = await fetch(`${TAILOR_BASE}/compile-queue/lookup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Tailor-Token': TAILOR_TOKEN },
            signal,
            body: JSON.stringify({ urls: missing }),
          })
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json() as { jobs: RawQueueJob[] }
            const extra = parseQueueJobs(lookupData.jobs)
            for (const [k, v] of extra.pdfMap)   result.pdfMap.set(k, v)
            for (const [k, v] of extra.queueMap) result.queueMap.set(k, v)
          }
        } catch { /* lookup is best-effort */ }
      }
    }

    return result
  } catch {
    return { pdfMap: new Map(), queueMap: new Map(), running: 0, queued: 0 }
  }
}

function isVisibleJob(id: string, hiddenIds: Set<string>) {
  return !hiddenIds.has(id)
}

function matchesSearch(job: Job, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    job.title.toLowerCase().includes(q) ||
    job.company.toLowerCase().includes(q) ||
    job.tags.some((tag) => tag.toLowerCase().includes(q))
  )
}

function latestVisibleHourSession(rawJobs: Job[], hiddenIds: Set<string>) {
  let latestBatch = 0
  for (const job of rawJobs) {
    if (!isVisibleJob(job.id, hiddenIds)) continue
    latestBatch = Math.max(latestBatch, job.postedAt.getTime())
  }
  if (latestBatch === 0) return { latestBatch: 0, latestSessionId: null as string | null }

  const latestJobs = rawJobs.filter((job) => isVisibleJob(job.id, hiddenIds) && job.postedAt.getTime() === latestBatch)
  const latestSessionId = latestJobs.find((job) => job.sessionId)?.sessionId ?? null
  return { latestBatch, latestSessionId }
}

function filterPreScopeJobs(
  jobs: Job[],
  {
    windowTab,
    rawJobs,
    hiddenIds,
    selectedSession,
  }: {
    windowTab: FeedWindowTab
    rawJobs: Job[]
    hiddenIds: Set<string>
    selectedSession: string | null
  },
) {
  const now = Date.now()

  if (selectedSession) {
    return jobs.filter((job) => isVisibleJob(job.id, hiddenIds) && job.sessionId === selectedSession)
  }

  if (windowTab === 'yesterday' || windowTab === 'week') {
    return jobs.filter((job) => isVisibleJob(job.id, hiddenIds))
  }

  if (windowTab === 'today') {
    const midnight = new Date()
    midnight.setHours(0, 0, 0, 0)
    return jobs.filter((job) => isVisibleJob(job.id, hiddenIds) && job.postedAt.getTime() >= midnight.getTime())
  }

  const strictHourCount = rawJobs.filter(
    (job) => isVisibleJob(job.id, hiddenIds) && (now - job.postedAt.getTime()) < HOUR_MS,
  ).length
  if (strictHourCount > 0) {
    return jobs.filter((job) => isVisibleJob(job.id, hiddenIds) && (now - job.postedAt.getTime()) < HOUR_MS)
  }

  const { latestBatch, latestSessionId } = latestVisibleHourSession(rawJobs, hiddenIds)
  if (latestBatch === 0) return []
  return jobs.filter((job) => {
    if (!isVisibleJob(job.id, hiddenIds)) return false
    return latestSessionId ? job.sessionId === latestSessionId : job.postedAt.getTime() === latestBatch
  })
}

const BATCH_CHUNK = 50

interface EnqueueResult {
  skippedSuccessUrls: string[]  // already_success — have PDFs, need lookup
}

async function enqueueBatch(jobs: Job[]): Promise<EnqueueResult> {
  const skippedSuccessUrls: string[] = []
  for (let i = 0; i < jobs.length; i += BATCH_CHUNK) {
    const chunk = jobs.slice(i, i + BATCH_CHUNK)
    await Promise.all(chunk.map(async (job) => {
      if (!job.description?.trim()) return
      try {
        await seedTailorJobContext({
          jobUrl: job.applyUrl,
          company: job.company,
          title: job.title,
          location: job.location,
          description: job.description,
        })
      } catch (err) {
        console.warn('Could not seed tailor job context', err)
      }
    }))
    const res = await fetch(`${TAILOR_BASE}/compile-enqueue-batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tailor-Token': TAILOR_TOKEN },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        jobs: chunk.map((j) => ({
          job_url:   j.applyUrl,
          company:   j.company,
          title:     j.title,
          // See enqueueTailorJob in JobCard — dropping this clears the
          // scraped location rather than leaving it alone.
          location:  resolveTailorLocation(j),
          score_pct: j.scorePct,
        })),
      }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as { error?: string }
      throw new Error(data.error ?? `HTTP ${res.status}`)
    }
    const data = await res.json() as { results?: Array<{ jobUrl: string; skipped?: boolean; reason?: string }> }
    for (const r of data.results ?? []) {
      if (r.skipped && r.reason === 'already_success') skippedSuccessUrls.push(r.jobUrl)
    }
  }
  return { skippedSuccessUrls }
}

// Fetch pdf_paths for specific job URLs that were skipped as already_success
async function lookupPdfPaths(urls: string[]): Promise<Map<string, string>> {
  if (!urls.length) return new Map()
  try {
    const res = await fetch(`${TAILOR_BASE}/compile-queue/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Tailor-Token': TAILOR_TOKEN },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ urls }),
    })
    if (!res.ok) return new Map()
    const data = await res.json() as { jobs?: Array<{ job_url: string; resume?: { pdf_path?: string | null } }> }
    const map = new Map<string, string>()
    for (const j of data.jobs ?? []) {
      if (j.job_url && j.resume?.pdf_path) {
        map.set(normalizeJobUrl(j.job_url), j.resume.pdf_path)
      }
    }
    return map
  } catch {
    return new Map()
  }
}

export function FeedView() {
  const [isPinned, setIsPinned]     = useState(false)
  const [lastSynced, setLastSynced] = useState<Date>(new Date())
  const [syncIn, setSyncIn]         = useState(SYNC_CONFIG.JOB_POLL_INTERVAL_MS / 1000)
  const [booted, setBooted]         = useState(false)
  const [sortBy, setSortBy]         = useState<'score' | 'company' | 'resume'>('score')
  const [selectedSession, setSelectedSession] = useState<string | null>(null)
  const [scope, setScope]             = useState<FeedScope>('others')
  const [bulkQueuing, setBulkQueuing] = useState(false)
  const [bulkMsg, setBulkMsg]         = useState<string | null>(null)
  const [tailorStats, setTailorStats] = useState<{ queued: number; running: number } | null>(null)
  // Seed pdfMap from persisted resume paths so the Download button shows
  // immediately on launch, before the queue poll returns (and even for jobs
  // that have since fallen out of the tailor queue window).
  const [pdfMap, setPdfMap]           = useState<Map<string, string>>(
    () => new Map(useFeedStore.getState().resumePaths),
  )
  const [queueMap, setQueueMap]       = useState<Map<string, QueueEntry>>(new Map())

  // Single AbortController for in-flight pdfMap fetches — prevents concurrent requests
  const pdfFetchController = useRef<AbortController | null>(null)
  // Ref so refreshPdfMap can read current feed URLs without a stale closure
  const feedUrlsRef = useRef<string[]>([])
  // Tracks whether a supplemental lookup has already run for the current feedUrls set
  const lookupDoneRef = useRef(false)

  const {
    activeTab, searchQuery, hiddenIds, savedIds,
    selectedIds, selectAll, clearSelected,
    archivedIds, appliedIds, topListCompanies,
    setTab, setSearch,
    rememberResumePaths,
  } = useFeedStore()

  // Create and Settings replace the feed entirely — keep a real tab for the
  // query key, but don't fetch while either is showing.
  const isFeedTab = activeTab !== 'create' && activeTab !== 'settings'
  const feedTab = isFeedTab ? activeTab : 'hour'
  const { data: rawJobs = [], isFetching, isError, error, refetch } = useJobs({ enabled: booted && isFeedTab, tab: feedTab })
  // Always fetch today's full job list so the session bar shows all sessions regardless of active tab
  // staleTime: 0 so it always re-fetches on mount and doesn't serve a stale empty cache
  const { data: todayJobs = [] } = useJobs({ enabled: booted, tab: 'today', staleTime: 0 })

  // Keep a ref of all unique feed URLs so the queue poller can do supplemental lookups.
  // Reset lookupDone whenever jobs change so new sessions get a fresh lookup pass.
  useEffect(() => {
    const seen = new Set<string>()
    for (const j of [...rawJobs, ...todayJobs]) {
      if (j.applyUrl) seen.add(j.applyUrl)
    }
    feedUrlsRef.current = [...seen]
    lookupDoneRef.current = false  // new jobs — run supplemental lookup again
  }, [rawJobs, todayJobs])

  // The feed comes from the local sidecar, which needs no session, so there is
  // nothing to wait for before querying. Applies go straight to the tracker at
  // the click (see JobList); the hourly queue flush this used to run synced to
  // an endpoint the dock can no longer authenticate against.
  useEffect(() => { setBooted(true) }, [])

  // Pure countdown — no side effects inside the updater
  useEffect(() => {
    const id = setInterval(() => setSyncIn((s) => (s <= 1 ? 0 : s - 1)), 1000)
    return () => clearInterval(id)
  }, [])

  // Trigger refetch when countdown reaches zero
  useEffect(() => {
    if (syncIn !== 0) return
    void refetch().then(() => setLastSynced(new Date()))
    setSyncIn(SYNC_CONFIG.JOB_POLL_INTERVAL_MS / 1000)
  }, [syncIn, refetch])

  const preScopeJobs = useMemo<Job[]>(() => {
    // When a session is selected, source from todayJobs (full day) so previous
    // sessions aren't cut off by the active tab's time window.
    const source = selectedSession ? todayJobs : rawJobs
    let list: Job[] = source.map((j) => ({
      ...j,
      isSaved:    savedIds.has(j.id),
      isHidden:   hiddenIds.has(j.id),
      isTopList:  topListCompanies.has(j.company.toLowerCase().trim()),
      resumeFile: pdfMap.get(normalizeJobUrl(j.applyUrl)) ?? j.resumeFile,
    }))
    list = filterPreScopeJobs(list, { windowTab: feedTab, rawJobs, hiddenIds, selectedSession })
    if (searchQuery.trim()) list = list.filter((job) => matchesSearch(job, searchQuery))
    return list
  }, [rawJobs, todayJobs, feedTab, searchQuery, hiddenIds, savedIds, pdfMap, selectedSession, topListCompanies])

  const jobs = useMemo<Job[]>(() => {
    let list = [...preScopeJobs]
    if (scope === 'top500') list = list.filter((j) => j.isTopList)
    if (scope === 'others') list = list.filter((j) => !j.isTopList)

    if (sortBy === 'company') {
      return list.sort((a, b) => a.company.localeCompare(b.company))
    }
    if (sortBy === 'resume') {
      return list.sort((a, b) => {
        const aHas = a.resumeFile != null && a.resumeFile !== '' ? 1 : 0
        const bHas = b.resumeFile != null && b.resumeFile !== '' ? 1 : 0
        return bHas - aHas || b.scorePct - a.scorePct
      })
    }
    return list.sort((a, b) => b.scorePct - a.scorePct)
  }, [preScopeJobs, sortBy, scope])

  const counts = useMemo(() => {
    const now = Date.now()
    const msH = 3_600_000
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0)
    const midnightMs = midnight.getTime()
    const visToday = todayJobs.filter((j) => !hiddenIds.has(j.id))
    const visRaw   = rawJobs.filter((j) => !hiddenIds.has(j.id))
    return {
      hour:      visToday.filter((j) => now - j.postedAt.getTime() < msH).length,
      today:     visToday.filter((j) => j.postedAt.getTime() >= midnightMs).length,
      // yesterday + week: API pre-filters — just count what came back
      yesterday: feedTab === 'yesterday' ? visRaw.length : undefined,
      week:      feedTab === 'week'      ? visRaw.length : undefined,
    }
  }, [rawJobs, todayJobs, feedTab, hiddenIds])

  // Auto-tab switch when current tab is empty (not hour — hour falls back to 2h window)
  useEffect(() => {
    if (isFetching || isError) return
    if (jobs.length > 0) return
    if (activeTab === 'today' && (counts.week ?? 0) > 0) setTab('week')
  }, [jobs.length, isFetching, isError, activeTab, counts, setTab])

  const strong = jobs.filter((j) => j.scorePct >= 70).length

  const scopeCounts = useMemo(() => {
    return {
      all:    preScopeJobs.length,
      top500: preScopeJobs.filter((j) => j.isTopList).length,
      others: preScopeJobs.filter((j) => !j.isTopList).length,
    }
  }, [preScopeJobs])

  function refreshPdfMap() {
    pdfFetchController.current?.abort()
    const controller = new AbortController()
    pdfFetchController.current = controller
    const doLookup = !lookupDoneRef.current
    if (doLookup) lookupDoneRef.current = true
    fetchQueueData(controller.signal, feedUrlsRef.current, doLookup).then((r) => {
      if (!controller.signal.aborted) {
        // Merge into existing pdfMap so supplemental lookup results aren't wiped each poll
        setPdfMap((prev) => {
          const next = new Map(prev)
          for (const [k, v] of r.pdfMap) next.set(k, v)
          return next
        })
        // Persist every PDF path we see so the Download button survives restarts
        // and jobs falling out of the tailor queue window.
        if (r.pdfMap.size > 0) rememberResumePaths([...r.pdfMap])
        setQueueMap(r.queueMap)
        setTailorStats({ queued: r.queued, running: r.running })
      }
    })
  }

  // Poll queue every 3s — single request, derives all state including live indicator
  useEffect(() => {
    let cancelled = false

    async function poll() {
      if (!cancelled) refreshPdfMap()
    }

    void poll()

    const id = setInterval(() => { void poll() }, 3000)
    return () => {
      cancelled = true
      clearInterval(id)
      pdfFetchController.current?.abort()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const visibleIds    = useMemo(() => jobs.map((j) => j.id), [jobs])
  const allSelected   = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id))
  const someSelected  = visibleIds.some((id) => selectedIds.has(id))
  const selectedCount = visibleIds.filter((id) => selectedIds.has(id)).length

  // M3: clear stale bulk error when selection changes
  useEffect(() => { setBulkMsg(null) }, [selectedCount])

  async function handleBulkCompile() {
    const toQueue = jobs.filter((j) => selectedIds.has(j.id))
    if (!toQueue.length) return
    setBulkQueuing(true)
    setBulkMsg(`Queuing ${toQueue.length} jobs…`)
    try {
      const { skippedSuccessUrls } = await enqueueBatch(toQueue)
      // Immediately look up pdf_paths for jobs skipped as already_success
      // (they fall outside the paginated queue list but already have PDFs built)
      if (skippedSuccessUrls.length > 0) {
        lookupPdfPaths(skippedSuccessUrls).then((extra) => {
          if (extra.size > 0) {
            setPdfMap((prev) => {
              const next = new Map(prev)
              for (const [k, v] of extra) next.set(k, v)
              return next
            })
            rememberResumePaths([...extra])
          }
        })
      }
      refreshPdfMap()
      const newCount = toQueue.length - skippedSuccessUrls.length
      setBulkMsg(
        skippedSuccessUrls.length > 0
          ? `Queued ${newCount}, ${skippedSuccessUrls.length} already done`
          : `Queued ${toQueue.length} job${toQueue.length === 1 ? '' : 's'}`,
      )
      clearSelected()
    } catch (err) {
      setBulkMsg(err instanceof Error ? err.message : 'Failed to queue')
    } finally {
      setBulkQueuing(false)
    }
  }

  // refetch() alone updates the cache — invalidateQueries would trigger a redundant second fetch
  const handleRefresh = useCallback(async () => {
    await refetch()
    setLastSynced(new Date())
    setSyncIn(SYNC_CONFIG.JOB_POLL_INTERVAL_MS / 1000)
  }, [refetch])

  // A run rewrites every window, so refresh all feed tabs and the Today
  // counts, not just the tab on screen.
  const queryClient = useQueryClient()
  const handleScrapeComplete = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['jobs'] })
    setLastSynced(new Date())
    setSyncIn(SYNC_CONFIG.JOB_POLL_INTERVAL_MS / 1000)
  }, [queryClient])

  return (
    <>
      <TitleBar isPinned={isPinned} onTogglePin={() => { setIsPinned((p) => !p); void windowManager.togglePin() }} isLive={!isError && !isFetching} />
      <TabBar active={activeTab} counts={counts} onSelect={(tab) => { setTab(tab); setSelectedSession(null) }} />

      {activeTab === 'create' ? (
        <CreateView />
      ) : activeTab === 'settings' ? (
        <SettingsView />
      ) : (
        <>
          <ScopeBar active={scope} counts={scopeCounts} onSelect={setScope} />
          <div className="flex items-center gap-2 px-3 pb-1.5">
            <button
              onClick={() => selectAll(visibleIds)}
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                allSelected
                  ? 'border-primary bg-primary/20 text-primary'
                  : someSelected
                  ? 'border-primary/50 bg-primary/10 text-primary/70'
                  : 'border-white/20 text-foreground/30 hover:border-white/40 hover:text-foreground/60',
              )}
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              {someSelected && !allSelected
                ? <span className="text-[8px] font-bold leading-none">–</span>
                : <span className="text-[8px] font-bold leading-none">✓</span>
              }
            </button>
            <SearchBar value={searchQuery} onChange={setSearch} />
            <button
              onClick={() => setSortBy((s) => s === 'score' ? 'company' : s === 'company' ? 'resume' : 'score')}
              className="flex shrink-0 items-center gap-1 rounded border border-white/10 px-1.5 py-1 text-[8px] font-bold uppercase tracking-wide text-foreground/35 transition-colors hover:border-white/20 hover:text-foreground/65"
              title={`Sort: ${sortBy}`}
            >
              <span className="tabular-nums text-foreground/50">{jobs.length}</span>
              <span className="text-foreground/20">·</span>
              {sortBy === 'score' ? '# Score' : sortBy === 'company' ? 'A–Z' : '✓ PDF'}
            </button>
          </div>

          {isError ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <AtriveoLogo size="lg" className="mb-1" />
              <p className="text-[11px] text-foreground/35">Could not load jobs</p>
              {error instanceof Error && (
                <p className="max-w-full break-all font-mono text-[9px] text-foreground/25">{error.message}</p>
              )}
              <button
                onClick={() => void handleRefresh()}
                className="mt-1 rounded-md bg-primary/15 px-4 py-1.5 text-[10px] font-semibold text-primary hover:bg-primary/25"
              >
                Retry
              </button>
            </div>
          ) : (
            <JobList
              jobs={jobs}
              queueMap={queueMap}
              activeTab={activeTab}
              counts={counts}
              onAlreadySuccess={(jobUrl) => {
                lookupPdfPaths([jobUrl]).then((extra) => {
                  if (extra.size > 0) {
                    setPdfMap((prev) => {
                      const next = new Map(prev)
                      for (const [k, v] of extra) next.set(k, v)
                      return next
                    })
                    rememberResumePaths([...extra])
                  }
                })
              }}
            />
          )}
        </>
      )}

      {/* Tailor live indicator */}
      {activeTab !== 'create' && tailorStats && (tailorStats.running > 0 || tailorStats.queued > 0) && (
        <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[9px] text-foreground/40">
            {tailorStats.running > 0 && <span className="text-emerald-400/80">{tailorStats.running} building</span>}
            {tailorStats.running > 0 && tailorStats.queued > 0 && <span className="text-foreground/25"> · </span>}
            {tailorStats.queued > 0 && <span>{tailorStats.queued} queued</span>}
          </span>
        </div>
      )}

      {/* Bulk compile bar */}
      {activeTab !== 'create' && someSelected && (
        <div className="flex shrink-0 items-center gap-2 border-t border-white/[0.06] bg-white/[0.03] px-3 py-2">
          <span className="text-[10px] font-semibold text-foreground/60">
            {selectedCount} selected
          </span>
          <div className="flex-1" />
          {bulkMsg && (
            <span className={cn(
              'text-[9px]',
              bulkMsg.startsWith('Queued') ? 'text-emerald-400/80' : 'text-rose-400/80',
            )}>
              {bulkMsg}
            </span>
          )}
          <button
            onClick={() => { clearSelected(); setBulkMsg(null) }}
            className="flex h-6 w-6 items-center justify-center rounded border border-white/10 text-foreground/35 hover:text-foreground/65"
            title="Clear selection"
          >
            <X className="h-3 w-3" />
          </button>
          <button
            onClick={() => { void handleBulkCompile() }}
            disabled={bulkQueuing}
            className={cn(
              'flex items-center gap-1.5 rounded-md border border-emerald-500/30 px-3 py-1 text-[9px] font-bold uppercase tracking-wide text-emerald-400 transition-all active:scale-95',
              bulkQueuing ? 'opacity-50' : 'hover:border-emerald-500/60 hover:text-emerald-300',
            )}
          >
            <FileCheck className="h-3 w-3" />
            {bulkQueuing ? 'Queuing…' : 'Create Resumes'}
          </button>
        </div>
      )}

      {!isFeedTab ? null : (
        <>
          <SessionBar
            jobs={todayJobs}
            hiddenIds={hiddenIds}
            selectedSession={selectedSession}
            onSelect={setSelectedSession}
          />
          <BottomKpi
            matches={jobs.length}
            strong={strong}
            hour={counts.hour}
            today={counts.today}
            lastSyncedAt={lastSynced}
          />
        </>
      )}
      <FooterBar
        total={jobs.length}
        actioned={appliedIds.size + archivedIds.size}
        applied={appliedIds.size}
        archived={archivedIds.size}
        isLoading={isFetching}
        syncIn={syncIn}
        onRefresh={() => void handleRefresh()}
      />
      {/* Blocks the dock while a run rewrites the feed underneath it. */}
      <ScrapeOverlay onComplete={handleScrapeComplete} />
    </>
  )
}
