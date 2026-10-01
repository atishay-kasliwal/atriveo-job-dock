import type { Job } from '@/domain/job'
import { normalizeJobUrl } from '@/lib/normalizeJobUrl'

// Raw shape returned by GET /api/jobs (flat list)
export interface ApiJob {
  job_url?:           string | null
  session_id?:        string | null
  batch_time?:        string | null
  company?:           string | null
  title?:             string | null
  location?:          string | null
  level?:             string | null
  score?:             number | null
  score_pct?:         number | null
  ats_score?:         number | null
  fit_score?:         number | null
  competition_score?: number | null
  summary?:           string | null
  search_term?:       string | null
  site?:              string | null
  date_posted?:       string | null
  min_exp?:           number | null
  max_exp?:           number | null
  pipeline?:          string | null
}

export interface EverJobsLocation {
  city?: string | null
  state?: string | null
  country?: string | null
  region?: string | null
  name?: string | null
}

export interface EverJobsCompensation {
  interval?: string | null
  minAmount?: number | null
  maxAmount?: number | null
  currency?: string | null
}

export interface EverJobsJob {
  id?: string | null
  site?: string | null
  title?: string | null
  companyName?: string | null
  company?: string | null
  jobUrl?: string | null
  url?: string | null
  location?: string | EverJobsLocation | null
  datePosted?: string | null
  postedAt?: string | null
  description?: string | null
  summary?: string | null
  isRemote?: boolean | null
  jobType?: string | string[] | null
  compensation?: string | EverJobsCompensation | null
  score?: number | null
  matchScore?: number | null
}

function mapLevel(raw: string | null | undefined): Job['level'] | undefined {
  if (!raw) return undefined
  const l = raw.toLowerCase()
  if (l === 'entry' || l === 'new grad') return 'entry'
  if (l === 'mid') return 'mid'
  if (l === 'senior') return 'senior'
  if (l === 'staff') return 'staff'
  if (l === 'principal') return 'principal'
  return undefined
}

function mapWorkMode(location: string): Job['workMode'] | undefined {
  if (!location) return undefined
  const l = location.toLowerCase()
  if (l.includes('remote')) return 'remote'
  if (l.includes('hybrid')) return 'hybrid'
  return 'onsite'
}

function safeString(value: string | null | undefined, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value : fallback
}

function safeDate(value: string | null | undefined): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function safeApplyUrl(rawUrl: string | null | undefined): string | null {
  if (typeof rawUrl !== 'string' || !rawUrl.trim()) return null
  try {
    new URL(rawUrl)
    return normalizeJobUrl(rawUrl)
  } catch {
    return null
  }
}

function stringifyLocation(rawLocation: string | EverJobsLocation | null | undefined): string {
  if (typeof rawLocation === 'string' && rawLocation.trim()) return rawLocation.trim()
  if (!rawLocation || typeof rawLocation !== 'object') return 'Remote'

  const record = rawLocation as EverJobsLocation
  const parts = [record.city, record.state, record.region, record.country, record.name].filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
  return parts.join(', ') || 'Remote'
}

function stringifyCompensation(rawCompensation: string | EverJobsCompensation | null | undefined): string | undefined {
  if (typeof rawCompensation === 'string' && rawCompensation.trim()) return rawCompensation.trim()
  if (!rawCompensation || typeof rawCompensation !== 'object') return undefined

  const currency = safeString(rawCompensation.currency)
  const minimum = rawCompensation.minAmount
  const maximum = rawCompensation.maxAmount
  const interval = safeString(rawCompensation.interval)
  const range = minimum != null && maximum != null
    ? `${minimum.toLocaleString()}–${maximum.toLocaleString()}`
    : minimum != null
      ? minimum.toLocaleString()
      : maximum != null
        ? maximum.toLocaleString()
        : ''

  if (!range) return undefined
  return [currency, range, interval].filter(Boolean).join(' ')
}

function mapWorkType(rawJobType: string | string[] | null | undefined): Job['jobType'] {
  const value = Array.isArray(rawJobType) ? rawJobType[0] : rawJobType
  if (!value) return 'full-time'

  const normalized = value.toLowerCase().replace(/[\s_-]/g, '')
  if (normalized === 'parttime') return 'part-time'
  if (normalized === 'contract') return 'contract'
  return 'full-time'
}

export function mapApiJob(raw: ApiJob): Job | null {
  const title = safeString(raw.title)
  const company = safeString(raw.company)
  const location = safeString(raw.location)
  const applyUrl = safeApplyUrl(raw.job_url)
  const postedAt = safeDate(raw.batch_time ?? raw.date_posted)

  // No location is kept, not dropped: ~30% of LinkedIn rows arrive without one,
  // and blank already means "home city" in the resume header.
  if (!title || !company || !applyUrl || !postedAt) return null

  return {
    id: applyUrl,
    source: 'atriveo',
    title,
    company,
    location,
    salary: undefined,
    postedAt,
    status: 'live',
    scorePct: raw.score_pct ?? 0,
    scoreDelta: null,
    atsScore: raw.ats_score ?? undefined,
    fitScore: raw.fit_score ?? undefined,
    competitionScore: raw.competition_score ?? undefined,
    tags: raw.search_term ? [raw.search_term] : [],
    applyUrl,
    isHidden: false,
    isSaved: false,
    hasApplied: false,
    isImportant: (raw.score_pct ?? 0) >= 70,
    isTopList: false,
    description: raw.summary ?? undefined,
    level: mapLevel(raw.level),
    jobType: 'full-time',
    workMode: mapWorkMode(location),
    sessionId: raw.session_id ?? undefined,
    batchTime: safeDate(raw.batch_time) ?? undefined,
  }
}

export function mapEverJobsApiJob(raw: EverJobsJob): Job | null {
  const title = safeString(raw.title)
  const company = safeString(raw.companyName ?? raw.company)
  const location = stringifyLocation(raw.location)
  const applyUrl = safeApplyUrl(raw.jobUrl ?? raw.url)
  const postedAt = safeDate(raw.datePosted ?? raw.postedAt)

  if (!title || !company || !applyUrl || !postedAt) return null

  return {
    id: applyUrl,
    source: 'ever-jobs',
    title,
    company,
    location,
    salary: stringifyCompensation(raw.compensation),
    postedAt,
    status: 'live',
    scorePct: raw.score ?? raw.matchScore ?? 0,
    scoreDelta: null,
    tags: [raw.site ?? 'ever-jobs'].filter(Boolean),
    applyUrl,
    isHidden: false,
    isSaved: false,
    hasApplied: false,
    isImportant: (raw.score ?? raw.matchScore ?? 0) >= 70,
    isTopList: false,
    description: raw.description ?? raw.summary ?? undefined,
    level: undefined,
    jobType: mapWorkType(raw.jobType),
    workMode: raw.isRemote ? 'remote' : mapWorkMode(location),
    sessionId: undefined,
    batchTime: postedAt,
  }
}
