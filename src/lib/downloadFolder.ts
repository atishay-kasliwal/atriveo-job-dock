const INVALID_FOLDER_CHARS = /[\/\\:*?"<>|\u0000-\u001f]/g

export function sanitizeDownloadFolderName(raw: string): string {
  return raw
    .trim()
    .replace(INVALID_FOLDER_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .slice(0, 80)
}

export function resolveDownloadFolderName(raw?: string | null): string | undefined {
  const folderName = sanitizeDownloadFolderName(raw ?? '')
  return folderName.length > 0 ? folderName : undefined
}

export function formatDownloadFolderPreview(raw?: string | null): string {
  const folderName = sanitizeDownloadFolderName(raw ?? '')
  return folderName.length > 0 ? `~/Downloads/${folderName}` : '~/Downloads/<source folder>'
}
