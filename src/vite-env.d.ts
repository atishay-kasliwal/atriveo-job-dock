/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FEED_PROVIDER?: 'legacy' | 'ever-jobs' | 'both'
  readonly VITE_EVER_JOBS_BASE_URL?: string
  readonly VITE_EVER_JOBS_SITES?: string
  readonly VITE_EVER_JOBS_RESULTS_WANTED?: string
  readonly VITE_EVER_JOBS_COUNTRY?: string
  readonly VITE_EVER_JOBS_SEARCH_TERM?: string
  readonly VITE_EVER_JOBS_LOCATION?: string
  readonly VITE_EVER_JOBS_API_KEY?: string
  readonly VITE_EVER_JOBS_TOKEN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
