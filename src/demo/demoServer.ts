import { invoke } from '@tauri-apps/api/core'
import type { ApiJob } from '@/api/jobMapper'
import { DEMO_BASE } from '@/config/connection'
import { buildDemoFeed, demoJob, DEMO_FRESH_SEEDS } from './demoData'

/**
 * An in-process stand-in for the tailor sidecar, used in demo mode.
 *
 * It answers the dock's own fetch calls to DEMO_BASE, so every screen runs its
 * real code path (feed parsing, queue polling, the scrape panel) with no
 * backend and no network. Resumes "build" one at a time like the real worker
 * and resolve to a bundled sample PDF; a scrape walks the four real phases and
 * then adds new postings to the feed.
 */

type ResumeStatus = 'queued' | 'running' | 'success' | 'failed'

interface QueueRow {
  job_url: string
  company: string
  title: string
  score_pct: number
  batch_time: string | null
  resume: {
    status: ResumeStatus
    stage: string
    pdf_path: string | null
    error: string | null
    failure_reason: string | null
    fallback: string | null
    updated_at: string
  }
}

const BUILD_MS = 2_200
const PHASES = [
  { name: 'scrape', ms: 14_000 },
  { name: 'jd_export', ms: 2_000 },
  { name: 'feed_deploy', ms: 3_000 },
  { name: 'resume_queue', ms: 2_000 },
] as const
const RUN_MS = PHASES.reduce((sum, p) => sum + p.ms, 0)

const feed: ApiJob[] = buildDemoFeed()
const queue = new Map<string, QueueRow>()
let samplePdf: string | null = null
let buildStartedAt = 0

let run: { id: string; startedAt: number; cancelledAt?: number; jobsBefore: number; added: boolean } | null = null

const iso = (ms: number) => new Date(ms).toISOString()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function row(job: ApiJob, status: ResumeStatus, extra: Partial<QueueRow['resume']> = {}): QueueRow {
  return {
    job_url: job.job_url ?? '',
    company: job.company ?? '',
    title: job.title ?? '',
    score_pct: job.score_pct ?? 0,
    batch_time: job.batch_time ?? null,
    resume: {
      status,
      stage: status === 'success' ? 'SUCCESS' : status === 'running' ? 'COMPOSING' : 'QUEUED',
      pdf_path: status === 'success' ? samplePdf : null,
      error: null,
      failure_reason: null,
      fallback: null,
      updated_at: iso(Date.now()),
      ...extra,
    },
  }
}

function enqueue(job: { job_url: string; company?: string; title?: string; score_pct?: number }, force = false) {
  const existing = queue.get(job.job_url)
  if (existing && !force && existing.resume.status !== 'failed') {
    return { ok: true, jobUrl: job.job_url, skipped: true, reason: `already_${existing.resume.status}` }
  }
  const source = feed.find((j) => j.job_url === job.job_url)
  queue.set(job.job_url, row({
    job_url: job.job_url,
    company: job.company ?? source?.company,
    title: job.title ?? source?.title,
    score_pct: job.score_pct ?? source?.score_pct ?? 0,
    batch_time: source?.batch_time ?? iso(Date.now()),
  }, 'queued'))
  return { ok: true, jobUrl: job.job_url, skipped: false }
}

/** One build at a time, like the real worker. Low-fit postings get the basic resume. */
function tickWorker() {
  const now = Date.now()
  const running = [...queue.values()].find((r) => r.resume.status === 'running')
  if (running) {
    if (now - buildStartedAt < BUILD_MS) return
    running.resume = {
      ...running.resume,
      status: 'success',
      stage: 'SUCCESS',
      pdf_path: samplePdf,
      fallback: running.score_pct < 45 ? 'basic' : null,
      updated_at: iso(now),
    }
  }
  const next = [...queue.values()].find((r) => r.resume.status === 'queued')
  if (next) {
    next.resume = { ...next.resume, status: 'running', stage: 'COMPOSING', updated_at: iso(now) }
    buildStartedAt = now
  }
}

function runState() {
  if (!run) {
    return { running: false, state: { runId: null, status: 'idle', phase: null, phases: [] } }
  }
  const end = run.cancelledAt ?? Date.now()
  const elapsed = end - run.startedAt
  const phases = []
  let offset = 0
  let phase: string | null = null
  for (const p of PHASES) {
    if (elapsed < offset) break
    const done = elapsed >= offset + p.ms
    const status = done ? 'ok' : run.cancelledAt ? 'cancelled' : 'running'
    phases.push({
      name: p.name,
      status,
      startedAt: iso(run.startedAt + offset),
      ...(done ? { finishedAt: iso(run.startedAt + offset + p.ms), exitCode: 0 } : {}),
    })
    if (!done) phase = p.name
    offset += p.ms
  }
  const finished = !!run.cancelledAt || elapsed >= RUN_MS
  if (finished && !run.cancelledAt && !run.added) addFreshJobs(run.startedAt + RUN_MS)
  const status = run.cancelledAt ? 'cancelled' : finished ? 'done' : 'running'
  return {
    running: !finished,
    state: {
      runId: run.id,
      status,
      phase: finished ? null : phase,
      phases,
      startedAt: iso(run.startedAt),
      updatedAt: iso(end),
      finishedAt: finished ? iso(run.cancelledAt ?? run.startedAt + RUN_MS) : null,
      jobsBefore: run.jobsBefore,
      jobsAfter: finished && !run.cancelledAt ? run.jobsBefore + DEMO_FRESH_SEEDS.length : null,
      exitCode: finished ? 0 : null,
    },
  }
}

function addFreshJobs(at: number) {
  if (!run) return
  run.added = true
  const fresh = DEMO_FRESH_SEEDS.map((s) => demoJob(s, new Date(at)))
  feed.unshift(...fresh)
  for (const j of fresh) enqueue({ job_url: j.job_url ?? '' })
}

function feedFor(type: string): ApiJob[] {
  const latest = feed.reduce((m, j) => (j.batch_time && j.batch_time > m ? j.batch_time : m), '')
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)
  const yesterday = dayStart.getTime() - 86_400_000
  const t = (j: ApiJob) => Date.parse(j.batch_time ?? '')
  switch (type) {
    case 'hour': return feed.filter((j) => j.batch_time === latest)
    case 'today': return feed.filter((j) => t(j) >= dayStart.getTime())
    case 'yesterday': return feed.filter((j) => t(j) >= yesterday && t(j) < dayStart.getTime())
    default: return feed
  }
}

async function body(init?: RequestInit): Promise<Record<string, unknown>> {
  try { return JSON.parse(String(init?.body ?? '{}')) } catch { return {} }
}

let profile = {
  name: 'Alex Rivera',
  title: 'Software Engineer',
  email: 'alex.rivera@example.com',
  phone: '555-0142',
  location: 'San Francisco, CA',
  linkedin: 'https://www.linkedin.com/in/example',
  github: 'https://github.com/example',
  portfolio: 'https://example.com',
}

async function handle(url: URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase()
  const path = url.pathname

  if (path === '/health') return json({ ok: true, mongo: true, pipeline: 'demo' })
  if (path === '/jobs') return json({ ok: true, jobs: feedFor(url.searchParams.get('type') ?? 'today') })

  if (path === '/compile-queue') return json({ ok: true, jobs: [...queue.values()] })
  if (path === '/compile-queue/stats') {
    const rows = [...queue.values()]
    const queued = rows.filter((r) => r.resume.status === 'queued').length
    const running = rows.filter((r) => r.resume.status === 'running').length
    return json({ ok: true, queued, running, active: queued + running })
  }
  if (path === '/compile-queue/lookup') {
    const urls = ((await body(init)).urls as string[] | undefined) ?? []
    return json({ ok: true, jobs: urls.map((u) => queue.get(u)).filter((r) => r?.resume.pdf_path) })
  }
  if (path === '/compile-enqueue' && method === 'POST') {
    const b = await body(init)
    return json(enqueue(b as { job_url: string }, b.force === true))
  }
  if (path === '/compile-enqueue-batch' && method === 'POST') {
    const jobs = (((await body(init)).jobs as { job_url: string }[] | undefined) ?? []).slice(0, 50)
    return json({ ok: true, results: jobs.map((j) => enqueue(j)) })
  }
  if (path === '/cover-enqueue' && method === 'POST') return json({ ok: true, pdf_path: samplePdf })
  if (path === '/manual-jd' && method === 'POST') return json({ ok: true })

  if (path === '/scrape/status') {
    return json({
      ok: true,
      ...runState(),
      knownPhases: PHASES.map((p) => p.name),
      estimate: { totalSec: RUN_MS / 1000, samples: 5, byPhase: Object.fromEntries(PHASES.map((p) => [p.name, p.ms / 1000])) },
    })
  }
  if (path === '/scrape/start' && method === 'POST') {
    if (run && runState().running) return json({ ok: false, error: 'already running' }, 409)
    run = { id: `demo-${Date.now()}`, startedAt: Date.now(), jobsBefore: feed.length, added: false }
    return json({ ok: true, runId: run.id })
  }
  if (path === '/scrape/cancel' && method === 'POST') {
    if (run && runState().running) run.cancelledAt = Date.now()
    return json({ ok: true })
  }
  if (path === '/scrape/log') return json({ ok: true, lines: ['Demo mode — no real scrape runs.'] })

  if (path === '/resume-profile') {
    if (method !== 'GET') profile = { ...profile, ...(await body(init)) }
    return json({ ok: true, profile })
  }

  // The job tracker lives on the same demo origin.
  if (path === '/api/jobs' && method === 'POST') return json({ ok: true }, 201)

  return json({ ok: false, error: `demo backend has no route for ${method} ${path}` }, 404)
}

/** Starts the demo backend; every fetch to DEMO_BASE is answered here. */
export async function installDemoBackend(): Promise<void> {
  try {
    samplePdf = await invoke<string>('demo_resume_path')
  } catch {
    samplePdf = null
  }
  // A few postings already have resumes, as they would after an hourly run.
  for (const j of feed.slice(0, 4)) queue.set(j.job_url ?? '', row(j, 'success'))

  setInterval(tickWorker, 400)

  const realFetch = window.fetch.bind(window)
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!href.startsWith(DEMO_BASE)) return realFetch(input, init)
    return handle(new URL(href), init)
  }
}

/** Used by the scripted tour to start a run the same way the scrape button does. */
export function demoFeedUrls(): string[] {
  return feed.map((j) => j.job_url ?? '')
}
