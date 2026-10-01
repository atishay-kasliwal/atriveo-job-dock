import { TAILOR_BASE, TAILOR_TOKEN } from '@/config/tailor'

const MIN_TAILOR_DESCRIPTION_CHARS = 400
const CISCO_APEX_TITLE = 'ai software engineer'
const CISCO_APEX_LOCATION = 'Apex, NC'

export interface TailorJobContextInput {
  jobUrl: string
  company: string
  title: string
  location?: string | null
  description?: string | null
}

function clean(value?: string | null): string {
  return typeof value === 'string' ? value.trim() : ''
}

function isCiscoApexPosting(company: string, title: string): boolean {
  return clean(company).toLowerCase() === 'cisco'
    && clean(title).toLowerCase() === CISCO_APEX_TITLE
}

export function resolveTailorLocation(input: Pick<TailorJobContextInput, 'company' | 'title' | 'location'>): string {
  // Temporary known-good correction while the posting-location path is being
  // tightened end to end. This keeps the Cisco AI Software Engineer resume
  // local to Apex instead of silently falling back to the home city.
  if (isCiscoApexPosting(input.company, input.title)) return CISCO_APEX_LOCATION
  return clean(input.location)
}

function headers(): Record<string, string> {
  const result: Record<string, string> = { 'Content-Type': 'application/json' }
  if (TAILOR_TOKEN) result['x-tailor-token'] = TAILOR_TOKEN
  return result
}

export async function seedTailorJobContext(input: TailorJobContextInput): Promise<boolean> {
  const description = clean(input.description)
  if (description.length < MIN_TAILOR_DESCRIPTION_CHARS) return false

  const res = await fetch(`${TAILOR_BASE}/manual-jd`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({
      job_url: input.jobUrl,
      company: input.company,
      title: input.title,
      location: resolveTailorLocation(input),
      description,
    }),
  })
  const data = await res.json().catch(() => ({})) as { ok?: boolean; error?: string }
  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? 'Could not save the job description')
  }
  return true
}
