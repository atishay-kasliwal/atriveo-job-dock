import { load } from '@tauri-apps/plugin-store'
import { setTailorConnection } from './tailor'
import { setTrackerConnection } from './jobTracker'

/**
 * How the dock reaches its backend, stored per user in
 * ~/Library/Application Support/com.atriveo.dock/connection.json.
 *
 * Until a connection is saved the dock runs in demo mode, so a fresh install
 * shows a working feed instead of an error about a sidecar that isn't there.
 */
export interface Connection {
  tailorBase: string
  tailorToken: string
  trackerBase: string
  trackerToken: string
  demo: boolean
}

export const DEFAULT_TAILOR_BASE = 'http://localhost:8787'
/** Requests to this origin are answered in-process by the demo backend. */
export const DEMO_BASE = 'https://demo.atriveo.invalid'

const STORE_FILE = 'connection.json'
const STORE_KEY = 'connection'

let current: Connection = normalize(undefined)

function normalize(saved: Partial<Connection> | undefined): Connection {
  return {
    tailorBase: saved?.tailorBase?.trim() || DEFAULT_TAILOR_BASE,
    tailorToken: saved?.tailorToken?.trim() ?? '',
    trackerBase: saved?.trackerBase?.trim() ?? '',
    trackerToken: saved?.trackerToken?.trim() ?? '',
    demo: saved ? saved.demo === true : true,
  }
}

function apply(c: Connection) {
  if (c.demo) {
    setTailorConnection(DEMO_BASE, 'demo')
    setTrackerConnection(DEMO_BASE, 'demo')
  } else {
    setTailorConnection(c.tailorBase.replace(/\/+$/, ''), c.tailorToken)
    setTrackerConnection(c.trackerBase.replace(/\/+$/, ''), c.trackerToken)
  }
}

export async function loadConnection(): Promise<Connection> {
  try {
    const store = await load(STORE_FILE, { defaults: {}, autoSave: false })
    current = normalize(await store.get<Partial<Connection>>(STORE_KEY))
  } catch {
    // No Tauri runtime (e.g. `npm run dev` in a browser): stay in demo mode.
    current = normalize(undefined)
  }
  apply(current)
  return current
}

export async function saveConnection(next: Connection): Promise<void> {
  const store = await load(STORE_FILE, { defaults: {}, autoSave: false })
  await store.set(STORE_KEY, normalize(next))
  await store.save()
}

export function getConnection(): Connection {
  return current
}
