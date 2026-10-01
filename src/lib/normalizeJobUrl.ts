// Strip tracking/session query params from job URLs so the same job
// always maps to the same canonical ID regardless of how it was fetched.
const STRIP_PARAMS = new Set([
  'refId', 'trackingId', 'trk', 'lipi', 'src', 'veh',
  'position', 'pageNum', 'ptk', 'sessionId',
])

export function normalizeJobUrl(raw: string): string {
  try {
    const url = new URL(raw)
    for (const key of [...url.searchParams.keys()]) {
      if (STRIP_PARAMS.has(key)) url.searchParams.delete(key)
    }
    url.searchParams.sort()
    return url.toString()
  } catch {
    return raw
  }
}
