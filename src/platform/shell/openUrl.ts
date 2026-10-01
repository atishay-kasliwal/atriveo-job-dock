import { invoke } from '@tauri-apps/api/core'

export async function openUrl(url: string): Promise<void> {
  await invoke('open_url', { url })
}
