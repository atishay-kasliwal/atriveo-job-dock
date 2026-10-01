import { invoke } from '@tauri-apps/api/core'
import { queryClient } from '@/lib/queryClient'
import { useFeedStore } from '@/stores/feedStore'
import { DEMO_BASE } from '@/config/connection'
import { buildDemoFeed } from './demoData'

/**
 * A scripted walk through demo mode, run when the app is launched with
 * ATRIVEO_DOCK_TOUR=1. It exists to record the README video: it drives the
 * same store actions and backend calls a user's clicks would, so what is
 * filmed is the real UI reacting, not a mock-up.
 */

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function post(path: string, body: unknown) {
  await fetch(`${DEMO_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function type(text: string) {
  const { setSearch } = useFeedStore.getState()
  for (let i = 1; i <= text.length; i += 1) {
    setSearch(text.slice(0, i))
    await wait(90)
  }
}

export async function runTour(): Promise<void> {
  // Stay above other windows while recording so nothing covers the dock.
  await invoke('toggle_always_on_top').catch(() => {})
  const store = useFeedStore.getState()
  store.setTab('hour')
  store.setSearch('')
  await wait(2500)

  await type('machine')
  await wait(2200)
  store.setSearch('')
  await wait(1200)

  store.setTab('today')
  await wait(2800)
  store.setTab('week')
  await wait(2800)
  store.setTab('hour')
  await wait(1500)

  // Build resumes for the strongest matches that don't have one yet.
  const targets = buildDemoFeed()
    .filter((j) => (j.score_pct ?? 0) >= 60)
    .slice(4, 7)
  for (const j of targets) {
    await post('/compile-enqueue', { job_url: j.job_url, company: j.company, title: j.title, score_pct: j.score_pct })
    await wait(400)
  }
  await wait(8000)

  // A scrape: the run panel walks its phases, closes itself, and the feed grows.
  await post('/scrape/start', {})
  await queryClient.invalidateQueries({ queryKey: ['scrape', 'status'] })
  await wait(25_000)

  store.setTab('create')
  await wait(4500)
  store.setTab('settings')
  await wait(4500)
  store.setTab('hour')
  await invoke('toggle_always_on_top').catch(() => {})
}
