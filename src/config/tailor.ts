// Where the tailor sidecar lives and the token it expects. Set at launch from
// the user's connection settings (see connection.ts), never compiled in: the
// app ships publicly, and the token guards a service that can be reachable
// from the internet through a tunnel.
export let TAILOR_BASE = 'http://localhost:8787'
export let TAILOR_TOKEN = ''

export function setTailorConnection(base: string, token: string) {
  TAILOR_BASE = base
  TAILOR_TOKEN = token
}
