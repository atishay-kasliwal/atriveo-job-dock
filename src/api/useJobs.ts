import { useQuery } from '@tanstack/react-query'
import { TAILOR_BASE, TAILOR_TOKEN } from '@/config/tailor'
import { getFeedConfig, getProviderHeaders } from './feedConfig'
import { mapApiJob, mapEverJobsApiJob, type ApiJob, type EverJobsJob } from './jobMapper'
import { normalizeJobUrl } from '@/lib/normalizeJobUrl'
import type { FeedTab, Job } from '@/domain/job'

type ApiJobsPayload =
  | ApiJob[]
  | {
      jobs?: ApiJob[]
    }

function extractJobs(payload: ApiJobsPayload): ApiJob[] {
  if (Array.isArray(payload)) return payload
  return Array.isArray(payload.jobs) ? payload.jobs : []
}

function tabToHours(tab: FeedTab): number {
  if (tab === 'hour') return 1
  if (tab === 'today') return 24
  if (tab === 'yesterday') return 48
  if (tab === 'week') return 168
  return 24
}

/**
 * The Atriveo half of the feed, read from the tailor sidecar on localhost
 * rather than application.atriveo.com.
 *
 * The hosted route serves a static snapshot the pipeline redeploys at the end
 * of a run, so the dock trailed Mongo by up to a full scrape cycle even when
 * it worked. And it authenticates with a SameSite=Strict cookie, which a
 * cross-origin WebView will not send — it ignores bearer tokens, so there was
 * no client-side fix. The sidecar is already on this machine with Mongo
 * credentials and answers from the same collections the exporter reads.
 */
async function fetchJobsFromLegacy(tab: FeedTab): Promise<Job[]> {
  const headers: Record<string, string> = {}
  if (TAILOR_TOKEN) headers['X-Tailor-Token'] = TAILOR_TOKEN
  const res = await fetch(`${TAILOR_BASE}/jobs?type=${encodeURIComponent(tab)}`, {
    headers,
    cache: 'no-store',
    // The week tab aggregates seven days of sessions and can take ~10s.
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} from the tailor sidecar — is it running on ${TAILOR_BASE}?`)
  const data = await res.json() as ApiJobsPayload
  const jobs = extractJobs(data)
  if (!Array.isArray(data) && !('jobs' in data)) {
    throw new Error(`Unexpected response shape: ${JSON.stringify(data).slice(0, 80)}`)
  }
  return jobs.map(mapApiJob).filter((job): job is Job => job !== null)
}

async function fetchJobsFromEverJobs(tab: FeedTab): Promise<Job[]> {
  const {
    everJobsBaseUrl,
    everJobsSites,
    everJobsResultsWanted,
    everJobsCountry,
    everJobsSearchTerm,
    everJobsLocation,
  } = getFeedConfig()
  const base = everJobsBaseUrl.replace(/\/$/, '')
  const endpoint = `${base.replace(/\/api$/, '')}/api/jobs/search`

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: getProviderHeaders(),
    body: JSON.stringify({
      siteType: everJobsSites,
      searchTerm: everJobsSearchTerm,
      location: everJobsLocation,
      resultsWanted: everJobsResultsWanted,
      country: everJobsCountry,
      hoursOld: tabToHours(tab),
      descriptionFormat: 'plain',
      linkedinFetchDescription: false,
    }),
  })

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} from Ever Jobs /api/jobs/search`)
  }

  const data = await res.json() as { jobs?: EverJobsJob[]; results?: EverJobsJob[] } | EverJobsJob[]
  const jobs = Array.isArray(data)
    ? data
    : Array.isArray(data.jobs)
      ? data.jobs
      : Array.isArray(data.results)
        ? data.results
        : []

  return jobs.map(mapEverJobsApiJob).filter((job): job is Job => job !== null)
}

/**
 * Both pipelines in one feed.
 *
 * allSettled, not all: the aggregator and the tailor sidecar are separate
 * localhost services, so either can be down independently. One failing must not
 * blank the whole list — that was the "Could not load jobs" wall. Only a total
 * failure of both is an error worth surfacing.
 *
 * Dedup prefers the Atriveo row when the same posting appears twice: it is the
 * one carrying the keyword score and the captured JD.
 */
async function fetchJobsFromBoth(tab: FeedTab): Promise<Job[]> {
  const [atriveo, ever] = await Promise.allSettled([
    fetchJobsFromLegacy(tab),
    fetchJobsFromEverJobs(tab),
  ])

  if (atriveo.status === 'rejected' && ever.status === 'rejected') {
    throw new Error(
      `Both feeds failed — Atriveo: ${atriveo.reason}; Ever Jobs: ${ever.reason}`,
    )
  }
  if (atriveo.status === 'rejected') console.warn('[feed] Atriveo unavailable:', atriveo.reason)
  if (ever.status === 'rejected') console.warn('[feed] Ever Jobs unavailable:', ever.reason)

  const merged: Job[] = []
  const seen = new Set<string>()
  // Atriveo first so it wins the dedup.
  for (const job of [
    ...(atriveo.status === 'fulfilled' ? atriveo.value : []),
    ...(ever.status === 'fulfilled' ? ever.value : []),
  ]) {
    const key = normalizeJobUrl(job.applyUrl)
    if (seen.has(key)) continue
    seen.add(key)
    merged.push(job)
  }

  // Scored Atriveo rows first, then aggregator rows — the aggregator has no
  // Atriveo score, so interleaving by scorePct would bury the scored ones.
  return merged.sort((a, b) => {
    if (a.source !== b.source) return a.source === 'atriveo' ? -1 : 1
    return b.scorePct - a.scorePct
  })
}

async function fetchJobs(tab: FeedTab): Promise<Job[]> {
  const { provider } = getFeedConfig()
  if (provider === 'both') return fetchJobsFromBoth(tab)
  return provider === 'ever-jobs' ? fetchJobsFromEverJobs(tab) : fetchJobsFromLegacy(tab)
}

export function useJobs({ enabled = true, tab = 'hour', staleTime = 30_000 }: { enabled?: boolean; tab?: FeedTab; staleTime?: number } = {}) {
  return useQuery({
    queryKey: ['jobs', tab, getFeedConfig().provider],
    queryFn: () => fetchJobs(tab),
    staleTime,
    enabled,
    retry: 1,
  })
}
