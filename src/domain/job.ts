export type FeedTab    = 'hour' | 'today' | 'yesterday' | 'week' | 'create' | 'settings'
export type FeedScope  = 'all' | 'top500' | 'others'
export type JobStatus  = 'live' | 'closing' | 'closed'
export type WorkLevel  = 'entry' | 'mid' | 'senior' | 'staff' | 'principal'
export type WorkType   = 'full-time' | 'part-time' | 'contract'
export type WorkMode   = 'remote' | 'onsite' | 'hybrid'

/**
 * Which pipeline a job came from.
 *
 * 'atriveo'   — LinkedIn scrape → Mongo → deployed feed, carries a keyword score
 * 'ever-jobs' — ~180-source aggregator intake, no Atriveo scoring
 *
 * Drives the colour treatment on the card, so the two are distinguishable at a
 * glance without reading a label.
 */
export type JobSource = 'atriveo' | 'ever-jobs'

export interface Job {
  id: string
  source: JobSource
  title: string
  company: string
  location: string
  salary?: string
  postedAt: Date
  status: JobStatus
  scorePct: number
  scoreDelta: number | null
  atsScore?: number         // 0–100 keyword/ATS match
  fitScore?: number         // 0–20 role/level fit
  competitionScore?: number // 0–5 how contested (lower = better odds)
  tags: string[]
  applyUrl: string
  isHidden: boolean
  isSaved: boolean
  hasApplied: boolean
  isImportant: boolean
  isTopList: boolean
  description?: string
  level?: WorkLevel
  jobType?: WorkType
  workMode?: WorkMode
  resumeFile?: string
  sessionId?: string
  batchTime?: Date
}
