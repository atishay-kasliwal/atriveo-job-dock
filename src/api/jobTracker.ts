// Client for the atriveo.com job tracker (job-tracker-api).
// POST /api/jobs creates an application row visible on atriveo.com.
import { JOB_TRACKER_BASE, JOB_TRACKER_TOKEN } from '@/config/jobTracker'

export interface TrackerJobInput {
  company: string
  role: string
  jobUrl?: string          // real http(s) URL only; manual:// is dropped
  applicationStatus?: string
}

// The API's job_link field is validated as a URL, so only pass real http(s)
// links. manual:// synthetic URLs (from the Create tab) are omitted.
function httpUrlOrUndefined(url?: string): string | undefined {
  if (!url) return undefined
  try {
    const u = new URL(url)
    return (u.protocol === 'http:' || u.protocol === 'https:') ? url : undefined
  } catch {
    return undefined
  }
}

/**
 * Create an application on the atriveo.com tracker.
 * Returns true on success (201), throws on hard failure.
 */
export async function createTrackerJob(input: TrackerJobInput): Promise<boolean> {
  // Tracking is optional; without one configured the apply stays in the dock.
  if (!JOB_TRACKER_BASE) return false
  const body: Record<string, unknown> = {
    company: input.company || 'Unknown',
    role:    input.role || 'Role',
    application_status: input.applicationStatus ?? 'Applied',
  }
  const link = httpUrlOrUndefined(input.jobUrl)
  if (link) body.job_link = link

  const res = await fetch(`${JOB_TRACKER_BASE}/api/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${JOB_TRACKER_TOKEN}`,
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify(body),
  })
  if (res.status === 201 || res.ok) return true
  // 409 = duplicate; treat as already-tracked success rather than an error
  if (res.status === 409) return true
  const data = await res.json().catch(() => ({})) as { error?: unknown }
  throw new Error(typeof data.error === 'string' ? data.error : `Tracker HTTP ${res.status}`)
}
