/** 'both' merges the Atriveo pipeline and the aggregator into one feed. */
export type FeedProvider = 'legacy' | 'ever-jobs' | 'both'

const DEFAULT_EVER_JOBS_SITES = ['remoteok', 'jobicy', 'arbeitnow', 'weworkremotely']

function parseCsv(value: string | undefined, fallback: string[]): string[] {
  const items = value?.split(',').map((item) => item.trim()).filter(Boolean) ?? []
  return items.length > 0 ? items : fallback
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

export interface FeedConfig {
  provider: FeedProvider
  everJobsBaseUrl: string
  everJobsSites: string[]
  everJobsResultsWanted: number
  everJobsCountry: string
  everJobsSearchTerm: string
  everJobsLocation: string
}

export function getFeedConfig(): FeedConfig {
  const provider = (import.meta.env.VITE_FEED_PROVIDER as FeedProvider | undefined) ?? 'legacy'
  const everJobsBaseUrl = (import.meta.env.VITE_EVER_JOBS_BASE_URL as string | undefined) ?? 'http://localhost:3001/api'
  const everJobsSites = parseCsv(import.meta.env.VITE_EVER_JOBS_SITES as string | undefined, DEFAULT_EVER_JOBS_SITES)
  const everJobsResultsWanted = parsePositiveInt(import.meta.env.VITE_EVER_JOBS_RESULTS_WANTED as string | undefined, 50)
  const everJobsCountry = (import.meta.env.VITE_EVER_JOBS_COUNTRY as string | undefined) ?? 'USA'
  const everJobsSearchTerm = (import.meta.env.VITE_EVER_JOBS_SEARCH_TERM as string | undefined) ?? ''
  const everJobsLocation = (import.meta.env.VITE_EVER_JOBS_LOCATION as string | undefined) ?? ''

  return {
    provider,
    everJobsBaseUrl,
    everJobsSites,
    everJobsResultsWanted,
    everJobsCountry,
    everJobsSearchTerm,
    everJobsLocation,
  }
}

export function getProviderHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const apiKey = import.meta.env.VITE_EVER_JOBS_API_KEY
  if (apiKey) headers['x-api-key'] = apiKey

  const bearerToken = import.meta.env.VITE_EVER_JOBS_TOKEN
  if (bearerToken) headers.Authorization = `Bearer ${bearerToken}`

  return headers
}
