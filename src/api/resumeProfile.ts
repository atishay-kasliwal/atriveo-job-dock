// Resume header identity, owned by the tailor sidecar.
//
// The sidecar stores it in data/resume-profile.json and the resume engine reads
// that file directly, so editing here changes the next build — and the web
// Settings page edits the exact same values.

import { TAILOR_BASE, TAILOR_TOKEN } from '@/config/tailor'

export interface ResumeProfile {
  name:      string
  title:     string
  email:     string
  phone:     string
  location:  string
  linkedin:  string
  github:    string
  portfolio: string
}

export const RESUME_PROFILE_FIELDS: Array<{
  key:   keyof ResumeProfile
  label: string
  hint:  string
}> = [
  { key: 'name',      label: 'Name',             hint: 'Primary heading at the top of the resume' },
  { key: 'title',     label: 'Fallback title',   hint: 'Used only when the job title and JD do not provide a clear one' },
  { key: 'email',     label: 'Email',            hint: 'Shown as a clickable mailto link' },
  { key: 'phone',     label: 'Phone',            hint: 'Shown in the resume header' },
  { key: 'location',  label: 'Fallback location', hint: 'Used when a posting does not name one clear location' },
  { key: 'linkedin',  label: 'LinkedIn URL',     hint: 'Shown as a "LinkedIn" link in the header' },
  { key: 'github',    label: 'GitHub URL',       hint: 'Shown as a "GitHub" link in the header' },
  { key: 'portfolio', label: 'Portfolio URL',    hint: 'Shown as a "Portfolio" link in the header' },
]

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (TAILOR_TOKEN) h['x-tailor-token'] = TAILOR_TOKEN
  return h
}

interface ProfileResponse {
  ok?:      boolean
  profile?: ResumeProfile
  error?:   string
}

async function readProfile(res: Response): Promise<ResumeProfile> {
  const data = await res.json().catch(() => ({})) as ProfileResponse
  if (!res.ok || !data.ok || !data.profile) {
    throw new Error(data.error ?? `Tailor server unreachable (HTTP ${res.status})`)
  }
  return data.profile
}

export async function fetchResumeProfile(): Promise<ResumeProfile> {
  return readProfile(await fetch(`${TAILOR_BASE}/resume-profile`, { headers: headers(), cache: 'no-store' }))
}

/** Partial patch — omitted fields keep their current value. */
export async function saveResumeProfile(patch: Partial<ResumeProfile>): Promise<ResumeProfile> {
  return readProfile(await fetch(`${TAILOR_BASE}/resume-profile`, {
    method:  'PUT',
    headers: headers(),
    body:    JSON.stringify(patch),
  }))
}
