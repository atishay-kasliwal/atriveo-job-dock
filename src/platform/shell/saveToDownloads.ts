import { invoke } from '@tauri-apps/api/core'
import { resolveDownloadFolderName } from '@/lib/downloadFolder'

export async function saveToDownloads(srcPath: string, folderName?: string): Promise<string> {
  return invoke<string>('save_to_downloads', {
    srcPath,
    folderName: resolveDownloadFolderName(folderName),
  })
}

export interface DownloadsStatus {
  path:        string
  displayPath: string
  exists:      boolean
}

/**
 * Ask the backend where this PDF would land under ~/Downloads and whether a
 * copy is already sitting there. Lets the UI show "already saved · <folder>"
 * across restarts instead of only right after a click.
 */
export async function downloadsStatus(srcPath: string, folderName?: string): Promise<DownloadsStatus> {
  const raw = await invoke<{ path: string; display_path: string; exists: boolean }>('downloads_status', {
    srcPath,
    folderName: resolveDownloadFolderName(folderName),
  })
  return { path: raw.path, displayPath: raw.display_path, exists: raw.exists }
}
