import { useState, useEffect } from 'react'
import {
  Briefcase, MessageSquare, FileCheck,
  Download, X, Archive, CheckCheck, Copy, FileText, FolderCheck,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { openUrl } from '@/platform/shell/openUrl'
import { saveToDownloads, downloadsStatus } from '@/platform/shell/saveToDownloads'
import { AtriveoLogo } from '@/components/AtriveoLogo'
import type { Job } from '@/domain/job'
import syncedDomains from '@/data/company_domains.json'
import type { QueueEntry } from '@/features/feed/FeedView'
import { resolveTailorLocation, seedTailorJobContext } from '@/api/tailorJobContext'
import { TAILOR_BASE, TAILOR_TOKEN } from '@/config/tailor'
import { useFeedStore } from '@/stores/feedStore'

export const COLLAPSED_H = 88
export const EXPANDED_H  = 295

const KNOWN_DOMAINS: Record<string, string> = {
  ...(syncedDomains as Record<string, string>),
  adobe: 'adobe.com', airbnb: 'airbnb.com', amazon: 'amazon.com',
  anthropic: 'anthropic.com', apple: 'apple.com', bytedance: 'bytedance.com',
  capitalone: 'capitalone.com', cloudflare: 'cloudflare.com', databricks: 'databricks.com',
  datadog: 'datadoghq.com', doordash: 'doordash.com', google: 'google.com',
  ibm: 'ibm.com', linkedin: 'linkedin.com', lyft: 'lyft.com',
  meta: 'meta.com', microsoft: 'microsoft.com', netflix: 'netflix.com',
  nvidia: 'nvidia.com', openai: 'openai.com', oracle: 'oracle.com',
  palantir: 'palantir.com', ramp: 'ramp.com', salesforce: 'salesforce.com',
  snowflake: 'snowflake.com', stripe: 'stripe.com', tesla: 'tesla.com',
  uber: 'uber.com', deloitte: 'deloitte.com', intuit: 'intuit.com',
  docusign: 'docusign.com', reddit: 'reddit.com', robinhood: 'robinhood.com',
  tiktok: 'tiktok.com', twilio: 'twilio.com', coinbase: 'coinbase.com',
  figma: 'figma.com', notion: 'notion.so', slack: 'slack.com',
  shopify: 'shopify.com', square: 'squareup.com',
}

function normalizeCompany(company: string): string {
  return company
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|corporation|company|co|group|services|germany|usa)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

function companyDomain(company: string): string {
  const normalized = normalizeCompany(company)
  if (KNOWN_DOMAINS[normalized]) return KNOWN_DOMAINS[normalized]
  // fuzzy: check if known key is contained in (or contains) the normalized name
  for (const [key, domain] of Object.entries(KNOWN_DOMAINS)) {
    const compactKey = key.replace(/[^a-z0-9]+/g, '')
    if (compactKey.length < 4) continue
    if (normalized.includes(compactKey) || compactKey.includes(normalized)) return domain
  }
  return `${normalized.replace(/\s+/g, '')}.com`
}

function CompanyAvatar({ company }: { company: string }) {
  const domain = companyDomain(company)
  const urls = [
    `https://logo.clearbit.com/${domain}`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128`,
  ]
  const [idx, setIdx] = useState(0)

  useEffect(() => { setIdx(0) }, [company])

  const src = idx < urls.length ? urls[idx] : null

  if (src) {
    return (
      <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden">
        <img
          key={src}
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          loading="lazy"
          className="h-full w-full object-contain"
          onError={() => setIdx((i) => i + 1)}
        />
      </div>
    )
  }

  return <AtriveoLogo size="sm" className="shrink-0" />
}

const ROLE_MAP: [RegExp, string][] = [
  [/\bai\b|\bllm\b|\bgenerative/i,           'AI Engineer'],
  [/\bmachine learning\b|\bml engineer/i,     'ML Engineer'],
  [/\bdata engineer/i,                        'Data Engineer'],
  [/\bfull.?stack/i,                          'Full Stack Engineer'],
  [/\bforward.?deployed/i,                    'Software Engineer'],
  [/\bfrontend\b|\bfront-end\b/i,             'Frontend Engineer'],
  [/\bbackend\b|\bback-end\b/i,               'Backend Engineer'],
  [/\bdevops\b|\bplatform engineer\b/i,       'Platform Engineer'],
  [/\bsecurity engineer/i,                    'Security Engineer'],
  [/\bstaff\b/i,                              'Staff Engineer'],
  [/\bprincipal\b/i,                          'Principal Engineer'],
  [/\bsenior\b/i,                             'Senior Engineer'],
]

function shortenTitle(title: string): string {
  // Strip everything after a separator — commas, dashes, pipes often introduce level/team noise
  const clean = title.split(/[,\-–|]/)[0].trim()
  const words = clean.split(/\s+/)
  // Role map first — always prefer a canonical label
  for (const [re, label] of ROLE_MAP) {
    if (re.test(title)) return label
  }
  // ≤ 3 words: return as-is (already short)
  if (words.length <= 3) return clean
  // 4+ words: take first 2 words
  return words.slice(0, 2).join(' ')
}

function timeAgo(date: Date): string {
  const s = Math.floor((Date.now() - date.getTime()) / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  return `${Math.floor(m / 60)}h`
}

interface EnqueueSingleResult {
  alreadySuccess: boolean
}

async function enqueueTailorJob(job: Job): Promise<EnqueueSingleResult> {
  if (job.description?.trim()) {
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
  }

  const res = await fetch(`${TAILOR_BASE}/compile-enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tailor-Token': TAILOR_TOKEN },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      job_url:   job.applyUrl,
      company:   job.company,
      title:     job.title,
      // The resume engine normalizes it ("Plano, TX", "Remote - US",
      // "Indiana, United States" all arrive from the scraper).
      // Omitting it is not neutral: enqueueJob $sets location unconditionally,
      // so a missing value overwrites the scraped one with null and the header
      // falls back to the home city.
      location:  resolveTailorLocation(job),
      score_pct: job.scorePct,
    }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
  const data = await res.json() as { skipped?: boolean; reason?: string }
  return { alreadySuccess: data.skipped === true && data.reason === 'already_success' }
}

// Build a template cover-letter PDF (no AI) into the job's resume folder.
async function enqueueCoverLetter(job: Job): Promise<string> {
  const res = await fetch(`${TAILOR_BASE}/cover-enqueue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tailor-Token': TAILOR_TOKEN },
    signal: AbortSignal.timeout(30000),
    body: JSON.stringify({ job_url: job.applyUrl, company: job.company, title: job.title }),
  })
  const data = await res.json().catch(() => ({})) as { ok?: boolean; pdf_path?: string; error?: string }
  if (!res.ok || !data.ok || !data.pdf_path) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data.pdf_path
}

interface JobCardProps {
  job: Job
  index: number
  isExpanded: boolean
  isApplied: boolean
  isSelected: boolean
  queueEntry?: QueueEntry
  onToggleExpand: () => void
  onHide: () => void
  onArchive: () => void
  onToggleApplied: () => void
  onToggleSelected: () => void
  onAlreadySuccess: (jobUrl: string) => void
  onToggleTopList: () => void
}

export function JobCard({
  job,
  index,
  isExpanded,
  isApplied,
  isSelected,
  queueEntry,
  onToggleExpand,
  onHide,
  onArchive,
  onToggleApplied,
  onToggleSelected,
  onAlreadySuccess,
  onToggleTopList,
}: JobCardProps) {
  const [resumeQueued, setResumeQueued]       = useState(false)
  const [resumeError, setResumeError]         = useState<string | null>(null)
  const [downloadError, setDownloadError]     = useState<string | null>(null)
  const [downloadSuccess, setDownloadSuccess] = useState(false)
  // Display path of an existing copy in Downloads, read from disk so the card
  // still reports "Saved" (and where) after a restart.
  const [savedPath, setSavedPath]             = useState<string | null>(null)
  const [coverState, setCoverState]           = useState<'idle' | 'building' | 'done' | 'error'>('idle')
  const [coverPath, setCoverPath]             = useState<string | null>(null)
  const [coverError, setCoverError]           = useState<string | null>(null)
  const [msgCopied, setMsgCopied]             = useState(false)
  const [jdCopied, setJdCopied]               = useState(false)

  // H5: linkOpened lives in Zustand so it survives virtualizer unmount/remount
  const {
    linkOpenedIds,
    setLinkOpened: storeLinkOpened,
    resumeDownloadFolderName,
  } = useFeedStore()
  const linkOpened = linkOpenedIds.has(job.id)

  // #7: clear local resumeQueued once the real queue entry arrives from the poll
  useEffect(() => {
    if (queueEntry && resumeQueued) setResumeQueued(false)
  }, [queueEntry, resumeQueued])

  const isEverJobs = job.source === 'ever-jobs'

  // Aggregator rows never went through the Atriveo keyword engine, so their
  // scorePct is 0 by absence, not by judgement. Running them through the score
  // scale would paint every one of them danger-red and read as "bad match".
  const scoreColor = isEverJobs
    ? 'text-[var(--source-ever)]'
    : job.scorePct >= 70 ? 'text-[var(--status-live)]'  :
      job.scorePct >= 50 ? 'text-[var(--score-cyan)]'   :
      job.scorePct >= 30 ? 'text-[var(--status-warn)]'  :
                           'text-[var(--status-danger)]'

  const deltaColor = job.scoreDelta && job.scoreDelta > 0
    ? 'text-[var(--status-live)]'
    : 'text-[var(--status-danger)]'

  const hasResumePdf = job.resumeFile != null && job.resumeFile.trim() !== ''

  // Look up whether this resume is already sitting in the Downloads folder.
  useEffect(() => {
    const src = job.resumeFile?.trim()
    if (!src) { setSavedPath(null); return }
    let cancelled = false
    void downloadsStatus(src, resumeDownloadFolderName)
      .then((st) => { if (!cancelled) setSavedPath(st.exists ? st.displayPath : null) })
      .catch(() => { if (!cancelled) setSavedPath(null) })
    return () => { cancelled = true }
  }, [job.resumeFile, resumeDownloadFolderName])

  function handleCopyMsg(e: React.MouseEvent) {
    e.stopPropagation()
    const msg = `Hi, I came across the ${job.title} role at ${job.company} and would love to connect. I have relevant experience and am very interested in learning more.`
    void navigator.clipboard.writeText(msg).then(() => {
      setMsgCopied(true)
      setTimeout(() => setMsgCopied(false), 1500)
    })
  }

  function handleCopyJd(e: React.MouseEvent) {
    e.stopPropagation()
    const text = job.description ?? `${job.title} at ${job.company}${job.location ? ` — ${job.location}` : ''}`
    void navigator.clipboard.writeText(text).then(() => {
      setJdCopied(true)
      setTimeout(() => setJdCopied(false), 1500)
    })
  }

  async function handleResume(e: React.MouseEvent) {
    e.stopPropagation()
    // Block if already locally queued
    if (resumeQueued) return
    // Block if queue entry exists and is not a retryable failure
    if (queueEntry) {
      const fk = queueEntry.failureKind
      // gated failures are structural (seniority/internship mismatch) — retrying won't help
      if (fk === 'gated') return
      // any non-failed status (queued, running, done) blocks re-enqueue
      if (queueEntry.status !== 'failed') return
    }
    // Block if PDF already built
    if (hasResumePdf) return
    setResumeError(null)
    try {
      const { alreadySuccess } = await enqueueTailorJob(job)
      if (alreadySuccess) {
        // PDF already exists from a prior run — notify parent to look it up
        onAlreadySuccess(job.applyUrl)
      } else {
        setResumeQueued(true)
      }
    } catch (err) {
      setResumeError(err instanceof Error ? err.message : 'Failed to queue')
    }
  }

  async function handleDownload(e: React.MouseEvent) {
    e.stopPropagation()
    if (!hasResumePdf) return
    setDownloadError(null)
    try {
      await saveToDownloads(job.resumeFile!, resumeDownloadFolderName)
      setDownloadSuccess(true)
      setTimeout(() => setDownloadSuccess(false), 3000)
      try {
        const st = await downloadsStatus(job.resumeFile!, resumeDownloadFolderName)
        if (st.exists) setSavedPath(st.displayPath)
      } catch { /* the copy succeeded; the label is cosmetic */ }
    } catch (err) {
      console.error('Download failed', err)
      const msg = err instanceof Error ? err.message : String(err)
      setDownloadError(msg)
      setTimeout(() => setDownloadError(null), 5000)
    }
  }

  async function handleCover(e: React.MouseEvent) {
    e.stopPropagation()
    // If already built, a second click downloads it to Downloads
    if (coverState === 'done' && coverPath) {
      try { await saveToDownloads(coverPath, resumeDownloadFolderName) } catch { /* ignore */ }
      return
    }
    if (coverState === 'building') return
    setCoverState('building')
    setCoverError(null)
    try {
      const pdf = await enqueueCoverLetter(job)
      setCoverPath(pdf)
      setCoverState('done')
      // Auto-save to Downloads on first build
      try { await saveToDownloads(pdf, resumeDownloadFolderName) } catch { /* best-effort */ }
    } catch (err) {
      console.error('Cover letter failed', err)
      setCoverError(err instanceof Error ? err.message : String(err))
      setCoverState('error')
      setTimeout(() => { setCoverState('idle'); setCoverError(null) }, 5000)
    }
  }

  return (
    <article
      className={cn(
        'relative mx-1.5 my-1 overflow-hidden rounded-md border border-white/[0.06] border-l-2 transition-colors duration-100',
        isExpanded ? 'bg-[#1a1a1a]' : index % 2 === 0 ? 'bg-[#161616] hover:bg-[#1c1c1c]' : 'bg-[#131313] hover:bg-[#191919]',
        isSelected && '!bg-primary/[0.07] !border-primary/20',
        // Provenance beats score for the left rail: which pipeline a row came
        // from is the first thing to read, and the score scale is meaningless
        // for aggregator rows.
        // A ring, not a bg — a bg-* class here would win tailwind-merge against
        // the zebra striping above and flatten the row (and kill its hover).
        isEverJobs
          ? 'border-l-[var(--source-ever)] ring-1 ring-inset ring-[var(--source-ever)]/15'
          : job.scorePct >= 70 ? 'border-l-[var(--status-live)]' :
            job.scorePct >= 50 ? 'border-l-[var(--score-cyan)]' :
            job.scorePct >= 30 ? 'border-l-[var(--status-warn)]' :
                                 'border-l-[var(--status-danger)]',
      )}
    >
      {/* Watermark row — index left, star right */}
      <div className="pointer-events-none absolute bottom-1 left-2 right-2 flex items-center justify-between">
        <span aria-hidden className={cn('text-[10px] tabular-nums font-bold select-none opacity-40', scoreColor)}>{index + 1}</span>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleTopList() }}
          className={cn('pointer-events-auto text-[10px] leading-none transition-all active:scale-90', job.isTopList ? 'opacity-90' : 'opacity-40 hover:opacity-70')}
          aria-label={job.isTopList ? 'Remove from Top List' : 'Add to Top List'}
        >⭐</button>
      </div>

      {/* Background graphic — subtle radial glow from score color */}
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute right-0 top-0 h-16 w-24 opacity-[0.06] blur-2xl',
          job.scorePct >= 70 ? 'bg-[var(--status-live)]' :
          job.scorePct >= 50 ? 'bg-[var(--score-cyan)]' :
          job.scorePct >= 30 ? 'bg-[var(--status-warn)]' :
                               'bg-[var(--status-danger)]',
        )}
      />
      {/* Row 1: identity + score — div wrapper so buttons don't nest inside a button */}
      <div className="flex w-full items-center gap-2 px-2 py-2">
        {/* Select checkbox */}
        <button
          onClick={() => onToggleSelected()}
          className={cn(
            'flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border transition-colors',
            isSelected ? 'border-primary bg-primary/20 text-primary' : 'border-white/15 text-transparent hover:border-white/30',
          )}
          aria-label="Select job"
        >
          {isSelected && <span className="text-[6px] font-bold leading-none">✓</span>}
        </button>

        <CompanyAvatar company={job.company} />

        {/* Clickable text area expands the card */}
        <button
          className="min-w-0 flex-1 text-left"
          onClick={onToggleExpand}
          aria-expanded={isExpanded}
        >
          <p className="truncate text-[10px] leading-snug text-foreground/40">{job.company}</p>
          <p className="truncate text-[12px] font-semibold leading-tight text-foreground/90">{shortenTitle(job.title)}</p>
        </button>

        {/* Score — also expands on click */}
        <button
          onClick={onToggleExpand}
          className="flex shrink-0 flex-col items-end gap-px"
          tabIndex={-1}
          aria-hidden
        >
          <span className={cn('text-[15px] font-bold tabular-nums leading-none', scoreColor)}>{job.scorePct}</span>
          {job.scoreDelta !== null && job.scoreDelta !== 0 && (
            <span className={cn('text-[7px] font-semibold tabular-nums', deltaColor)}>
              {job.scoreDelta > 0 ? '▲' : '▼'}{Math.abs(job.scoreDelta)}
            </span>
          )}
        </button>

        {/* Hide button */}
        <button
          onClick={onHide}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-foreground/15 transition-colors hover:bg-white/10 hover:text-foreground/50"
          aria-label="Hide job"
        >
          <X className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* Row 2: 5 core actions — evenly spaced, full width */}
      <div className="grid grid-cols-5 gap-px px-2 pb-2">
        {/* Archive */}
        <button
          onClick={(e) => { e.stopPropagation(); onArchive() }}
          className="group flex flex-col items-center gap-0.5 rounded-md py-1.5 transition-all hover:bg-rose-500/[0.07] active:scale-95"
          title="Archive"
        >
          <Archive className="h-3.5 w-3.5 text-rose-400/40 transition-colors group-hover:text-rose-400/80" />
          <span className="text-[8px] font-bold tracking-wide text-rose-400/30 group-hover:text-rose-400/70">Archive</span>
        </button>

        {/* Resume — 4 states: idle / queued (local) / in-queue (#N) / failed */}
        {(() => {
          const fk         = queueEntry?.failureKind ?? null
          // A job is failed if failureKind is set OR status is explicitly 'failed'
          const isFailed   = fk != null || queueEntry?.status === 'failed'
          const isDone     = hasResumePdf || queueEntry?.status === 'done' || queueEntry?.status === 'completed' || queueEntry?.status === 'success'
          // Only show queue state when actively in-flight (not done, not failed)
          const isInQueue  = !!queueEntry && !isFailed && !isDone
          const isBuilding = queueEntry?.status === 'running'
          // gated is not retryable (seniority mismatch); content is retryable (threshold may change)
          const isRetryable = fk === 'error' || fk === 'content' || resumeError != null
          const isBlocked   = fk === 'gated' || isDone
          // fk takes priority — even if isInQueue is somehow true, show failure label
          const label = fk === 'content' ? 'No match'
            : fk === 'gated'   ? 'Skipped'
            : fk === 'error'   ? 'Error'
            : resumeError ? 'Failed'
            : isBuilding ? 'Building'
            : isInQueue && queueEntry.position > 0 ? `#${queueEntry.position}`
            : isInQueue  ? 'Queued'
            : resumeQueued ? 'Queued'
            : 'Resume'
          const tooltip = fk === 'content'
            ? `Low confidence — click to retry with new threshold`
            : fk === 'gated'
            ? `Skipped — ${queueEntry?.error ?? 'role level mismatch'}`
            : fk === 'error'
            ? `Process error — ${queueEntry?.error ?? 'unknown'} — click to retry`
            : isInQueue ? `#${queueEntry.position} — ${queueEntry.stage ?? 'queued'}`
            : resumeError ?? 'Queue resume'
          return (
            <button
              onClick={(e) => { void handleResume(e) }}
              className={cn(
                'group flex flex-col items-center gap-0.5 rounded-md py-1.5 transition-all',
                isBlocked   ? 'cursor-default'
                : isRetryable ? 'bg-rose-500/[0.07] hover:bg-rose-500/[0.12] active:scale-95'
                : isInQueue || resumeQueued ? 'bg-primary/[0.07] active:scale-95'
                : 'hover:bg-primary/[0.07] active:scale-95',
                fk === 'gated' ? 'bg-amber-500/[0.07]' : '',
              )}
              title={tooltip}
            >
              <FileCheck className={cn('h-3.5 w-3.5 transition-colors',
                isRetryable ? 'text-rose-400/70 group-hover:text-rose-400'
                : fk === 'gated' ? 'text-amber-400/70'
                : isInQueue || resumeQueued ? 'text-primary/80'
                : 'text-primary/50 group-hover:text-primary/80')} />
              <span className={cn('text-[8px] font-bold tracking-wide transition-colors',
                isRetryable ? 'text-rose-400/60 group-hover:text-rose-400/80'
                : fk === 'gated' ? 'text-amber-400/60'
                : isBuilding ? 'text-emerald-400/70'
                : isInQueue || resumeQueued ? 'text-primary/70'
                : 'text-primary/40 group-hover:text-primary/70')}>
                {label}
              </span>
            </button>
          )
        })()}

        {/* Download — hidden when no PDF, no preview on success */}
        {hasResumePdf ? (
          <button
            onClick={(e) => { void handleDownload(e) }}
            disabled={downloadSuccess}
            className={cn(
              'group flex flex-col items-center gap-0.5 rounded-md py-1.5 transition-all',
              downloadError    ? 'bg-rose-500/[0.07]'
              : downloadSuccess ? 'bg-emerald-500/[0.07] cursor-default'
              : savedPath       ? 'bg-emerald-500/[0.07] hover:bg-emerald-500/[0.11] active:scale-95 cursor-pointer'
              : 'hover:bg-emerald-500/[0.07] active:scale-95 cursor-pointer',
            )}
            title={downloadError ?? (
              downloadSuccess ? 'Saved to Downloads'
              : savedPath     ? `Already in ${savedPath} — click to overwrite`
              : 'Download resume'
            )}
          >
            {savedPath && !downloadError && !downloadSuccess
              ? <FolderCheck className="h-3.5 w-3.5 text-emerald-400 transition-colors" />
              : <Download className={cn('h-3.5 w-3.5 transition-colors',
                  downloadError    ? 'text-rose-400/70'
                  : downloadSuccess ? 'text-emerald-400'
                  : 'text-emerald-400/70 group-hover:text-emerald-400')} />}
            <span className={cn('text-[8px] font-bold tracking-wide transition-colors',
              downloadError    ? 'text-rose-400/60'
              : downloadSuccess ? 'text-emerald-400/90'
              : savedPath       ? 'text-emerald-400/90'
              : 'text-emerald-400/60 group-hover:text-emerald-400/80')}>
              {downloadSuccess ? 'Downloaded' : savedPath ? 'Saved' : 'Download'}
            </span>
          </button>
        ) : <div />}

        {/* Cover letter — idle → building → done (click again to re-download) */}
        <button
          onClick={(e) => { void handleCover(e) }}
          disabled={coverState === 'building'}
          className={cn(
            'group flex flex-col items-center gap-0.5 rounded-md py-1.5 transition-all',
            coverState === 'error'    ? 'bg-rose-500/[0.07]'
            : coverState === 'done'   ? 'bg-violet-500/[0.08] active:scale-95'
            : coverState === 'building' ? 'bg-violet-500/[0.07] cursor-default'
            : 'hover:bg-violet-500/[0.07] active:scale-95',
          )}
          title={
            coverState === 'error'    ? (coverError ?? 'Failed')
            : coverState === 'done'   ? 'Cover letter saved to Downloads — click to save again'
            : coverState === 'building' ? 'Building cover letter…'
            : 'Generate cover letter'
          }
        >
          <FileText className={cn('h-3.5 w-3.5 transition-colors',
            coverState === 'error'    ? 'text-rose-400/70'
            : coverState === 'done'   ? 'text-violet-400'
            : coverState === 'building' ? 'text-violet-400/60 animate-pulse'
            : 'text-violet-400/60 group-hover:text-violet-400')} />
          <span className={cn('text-[8px] font-bold tracking-wide transition-colors',
            coverState === 'error'    ? 'text-rose-400/60'
            : coverState === 'done'   ? 'text-violet-400/80'
            : coverState === 'building' ? 'text-violet-400/60'
            : 'text-violet-400/50 group-hover:text-violet-400/80')}>
            {coverState === 'error' ? 'Failed'
              : coverState === 'done' ? 'Saved'
              : coverState === 'building' ? 'Building'
              : 'Cover'}
          </span>
        </button>

        {/* Apply — 3 states: idle → opened (link clicked) → applied (tracker + remove) */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (!linkOpened && !isApplied) {
              // First click: just open the link
              void openUrl(job.applyUrl)
              storeLinkOpened(job.id)
            } else if (linkOpened && !isApplied) {
              // Second click: mark applied, enqueue tracker, remove card
              onToggleApplied()
            }
          }}
          className={cn(
            'group flex flex-col items-center gap-0.5 rounded-md py-1.5 transition-all active:scale-95',
            isApplied ? 'bg-emerald-500/[0.08]' : linkOpened ? 'bg-primary/[0.08]' : 'hover:bg-primary/[0.07]',
          )}
          title={isApplied ? 'Applied' : linkOpened ? 'Click again to mark applied' : 'Open application'}
        >
          {isApplied
            ? <CheckCheck className="h-3.5 w-3.5 text-emerald-400/80" />
            : linkOpened
            ? <CheckCheck className="h-3.5 w-3.5 text-primary/70 transition-colors group-hover:text-primary" />
            : <Briefcase  className="h-3.5 w-3.5 text-primary/50 transition-colors group-hover:text-primary/80" />}
          <span className={cn('text-[8px] font-bold tracking-wide transition-colors',
            isApplied ? 'text-emerald-400/70' : linkOpened ? 'text-primary/60 group-hover:text-primary/90' : 'text-primary/40 group-hover:text-primary/70')}>
            {isApplied ? 'Applied' : linkOpened ? 'Applied?' : 'Apply'}
          </span>
        </button>
      </div>

      {/* Expanded: details + utility actions */}
      {isExpanded && (
        <div className="border-t border-white/[0.04] px-3 pb-3 pt-2">
          {job.description && (
            <p className="mb-2.5 text-[10px] leading-relaxed text-foreground/38 line-clamp-2">{job.description}</p>
          )}
          {(resumeError || downloadError) && (
            <p className="mb-2 text-[9px] text-rose-400/80">{resumeError ?? downloadError}</p>
          )}
          {savedPath && !downloadError && (
            <p className="mb-2 flex items-center gap-1 text-[9px] text-emerald-400/50" title={savedPath}>
              <FolderCheck className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{savedPath}</span>
            </p>
          )}
          {/* Score breakdown — why this job ranks where it does */}
          {(job.atsScore != null || job.fitScore != null || job.competitionScore != null) && (
            <div className="mb-2 space-y-1.5 rounded-lg bg-white/[0.03] p-2.5">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-foreground/22">Why {job.scorePct}</p>
                <span className={cn('text-[10px] font-bold tabular-nums', scoreColor)}>{job.scorePct}% overall</span>
              </div>
              {[
                { label: 'ATS match',   value: job.atsScore,         max: 100, hint: 'keyword & resume fit' },
                { label: 'Role fit',    value: job.fitScore,         max: 20,  hint: 'level & responsibilities' },
                { label: 'Open field',  value: job.competitionScore, max: 5,   hint: 'less contested', invert: true },
              ].filter((s) => s.value != null).map(({ label, value, max, hint, invert }) => {
                const raw = value as number
                const pct = Math.max(0, Math.min(100, Math.round(((invert ? max - raw : raw) / max) * 100)))
                const barColor = pct >= 66 ? 'bg-[var(--status-live)]' : pct >= 33 ? 'bg-[var(--score-cyan)]' : 'bg-[var(--status-warn)]'
                return (
                  <div key={label} className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-[9px] font-medium text-foreground/50" title={hint}>{label}</span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-7 shrink-0 text-right text-[9px] font-bold tabular-nums text-foreground/40">{pct}%</span>
                  </div>
                )
              })}
            </div>
          )}

          <div className="grid grid-cols-3 gap-x-3 gap-y-2 rounded-lg bg-white/[0.03] p-2.5">
            {[
              { label: 'Level',  value: job.level    ? job.level.charAt(0).toUpperCase() + job.level.slice(1)      : '—' },
              { label: 'Type',   value: job.jobType  ? job.jobType.replace('-', ' ')                                : '—' },
              { label: 'Mode',   value: job.workMode ? job.workMode.charAt(0).toUpperCase() + job.workMode.slice(1) : '—' },
              { label: 'Salary', value: job.salary   ?? '—' },
              { label: 'Resume', value: job.resumeFile
                  ? (() => { const p = job.resumeFile.split('/'); return `✓ ${p[p.length - 2] ?? 'Ready'}` })()
                  : queueEntry?.failureKind === 'content' ? '✗ No match'
                  : queueEntry?.failureKind === 'gated'   ? '✗ Skipped'
                  : queueEntry?.failureKind === 'error'   ? '✗ Error'
                  : queueEntry?.status === 'running' ? 'Building…'
                  : (queueEntry?.position ?? 0) > 0 ? `#${queueEntry!.position} in queue`
                  : queueEntry ? 'Queued…'
                  : resumeQueued ? 'Queued…'
                  : '—' },
              { label: 'Posted', value: timeAgo(job.postedAt) + ' ago' },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[8px] font-bold uppercase tracking-[0.12em] text-foreground/22">{label}</p>
                <p className="mt-0.5 truncate text-[10px] font-medium text-foreground/55">{value}</p>
              </div>
            ))}
          </div>

          {/* Utility actions — only visible when expanded */}
          <div className="mt-2.5 flex gap-2">
            <button
              onClick={handleCopyMsg}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-[9px] font-medium transition-all active:scale-95',
                msgCopied
                  ? 'border-primary/30 bg-primary/[0.07] text-primary'
                  : 'border-white/[0.07] text-foreground/30 hover:border-white/15 hover:text-foreground/60',
              )}
            >
              <MessageSquare className="h-3 w-3" />
              {msgCopied ? 'Copied!' : 'Copy message'}
            </button>
            <button
              onClick={handleCopyJd}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md border py-1.5 text-[9px] font-medium transition-all active:scale-95',
                jdCopied
                  ? 'border-primary/30 bg-primary/[0.07] text-primary'
                  : 'border-white/[0.07] text-foreground/30 hover:border-white/15 hover:text-foreground/60',
              )}
            >
              <Copy className="h-3 w-3" />
              {jdCopied ? 'Copied!' : 'Copy JD'}
            </button>
          </div>
        </div>
      )}
    </article>
  )
}
