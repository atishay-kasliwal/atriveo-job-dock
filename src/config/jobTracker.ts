// Optional job tracker that "Apply" also records to (job-tracker-api). Set at
// launch from the user's connection settings; blank means applies are only
// tracked inside the dock.
export let JOB_TRACKER_BASE = ''
export let JOB_TRACKER_TOKEN = ''

export function setTrackerConnection(base: string, token: string) {
  JOB_TRACKER_BASE = base
  JOB_TRACKER_TOKEN = token
}
