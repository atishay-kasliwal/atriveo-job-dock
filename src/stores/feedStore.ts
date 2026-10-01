import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { FeedTab } from '@/domain/job'

interface FeedStore {
  activeTab: FeedTab
  topListCompanies: Set<string>
  expandedJobId: string | null
  searchQuery: string
  hiddenIds: Set<string>
  savedIds: Set<string>
  archivedIds: Set<string>
  appliedIds: Set<string>
  selectedIds: Set<string>
  linkOpenedIds: Set<string>
  resumeDownloadFolderName: string
  autoScrapeHourly: boolean
  // Persisted resume PDF paths: normalized job url → pdf_path on disk.
  // Once we've ever seen a built resume, we remember it so the Download button
  // survives restarts and the job falling out of the tailor queue window.
  resumePaths: Map<string, string>

  toggleTopList: (company: string) => void
  setTab: (tab: FeedTab) => void
  setExpanded: (id: string | null) => void
  setSearch: (q: string) => void
  toggleHide: (id: string) => void
  toggleSave: (id: string) => void
  archiveJob: (id: string) => void
  toggleApplied: (id: string) => void
  toggleSelected: (id: string) => void
  selectAll: (ids: string[]) => void
  clearSelected: () => void
  setLinkOpened: (id: string) => void
  setResumeDownloadFolderName: (folderName: string) => void
  setAutoScrapeHourly: (enabled: boolean) => void
  // Remember one or more resume PDF paths (merges, never clears).
  rememberResumePaths: (entries: Array<[string, string]>) => void
}

export const useFeedStore = create<FeedStore>()(
  persist(
    (set) => {
      // Clears expandedJobId + selectedIds for a job that's leaving the feed.
      // Call this from any action that hides a job.
      function deactivate(s: FeedStore, id: string) {
        const selectedIds = new Set(s.selectedIds)
        selectedIds.delete(id)
        return {
          selectedIds,
          expandedJobId: s.expandedJobId === id ? null : s.expandedJobId,
        }
      }

      return {
        activeTab: 'hour',
        topListCompanies: new Set(),
        expandedJobId: null,
        searchQuery: '',
        hiddenIds: new Set(),
        savedIds: new Set(),
        archivedIds: new Set(),
        appliedIds: new Set(),
        selectedIds: new Set(),
        linkOpenedIds: new Set(),
        resumeDownloadFolderName: '',
        autoScrapeHourly: true,
        resumePaths: new Map(),

        toggleTopList: (company) =>
          set((s) => {
            const topListCompanies = new Set(s.topListCompanies)
            const key = company.toLowerCase().trim()
            topListCompanies.has(key) ? topListCompanies.delete(key) : topListCompanies.add(key)
            return { topListCompanies }
          }),

        setTab: (activeTab) => set({ activeTab, expandedJobId: null }),
        setExpanded: (expandedJobId) => set({ expandedJobId }),
        setSearch: (searchQuery) => set({ searchQuery }),

        toggleHide: (id) =>
          set((s) => {
            const hiddenIds = new Set(s.hiddenIds)
            const isHiding = !hiddenIds.has(id)
            hiddenIds.has(id) ? hiddenIds.delete(id) : hiddenIds.add(id)
            return { hiddenIds, ...(isHiding ? deactivate(s, id) : {}) }
          }),

        toggleSave: (id) =>
          set((s) => {
            const savedIds = new Set(s.savedIds)
            savedIds.has(id) ? savedIds.delete(id) : savedIds.add(id)
            return { savedIds }
          }),

        archiveJob: (id) =>
          set((s) => {
            const archivedIds = new Set(s.archivedIds)
            const hiddenIds = new Set(s.hiddenIds)
            archivedIds.add(id)
            hiddenIds.add(id)
            return { archivedIds, hiddenIds, ...deactivate(s, id) }
          }),

        toggleApplied: (id) =>
          set((s) => {
            const appliedIds = new Set(s.appliedIds)
            const hiddenIds = new Set(s.hiddenIds)
            if (appliedIds.has(id)) {
              appliedIds.delete(id)
              return { appliedIds }
            }
            appliedIds.add(id)
            hiddenIds.add(id)
            return { appliedIds, hiddenIds, ...deactivate(s, id) }
          }),

        toggleSelected: (id) =>
          set((s) => {
            const selectedIds = new Set(s.selectedIds)
            selectedIds.has(id) ? selectedIds.delete(id) : selectedIds.add(id)
            return { selectedIds }
          }),

        selectAll: (ids) =>
          set((s) => {
            const selectedIds = new Set(s.selectedIds)
            const allSelected = ids.every((id) => selectedIds.has(id))
            if (allSelected) {
              ids.forEach((id) => selectedIds.delete(id))
            } else {
              ids.forEach((id) => selectedIds.add(id))
            }
            return { selectedIds }
          }),

        clearSelected: () => set({ selectedIds: new Set() }),

        setLinkOpened: (id) =>
          set((s) => {
            const linkOpenedIds = new Set(s.linkOpenedIds)
            linkOpenedIds.add(id)
            return { linkOpenedIds }
          }),

        setResumeDownloadFolderName: (resumeDownloadFolderName) =>
          set({ resumeDownloadFolderName }),

        setAutoScrapeHourly: (autoScrapeHourly) =>
          set({ autoScrapeHourly }),

        rememberResumePaths: (entries) =>
          set((s) => {
            if (entries.length === 0) return {}
            const resumePaths = new Map(s.resumePaths)
            let changed = false
            for (const [url, pdf] of entries) {
              if (url && pdf && resumePaths.get(url) !== pdf) {
                resumePaths.set(url, pdf)
                changed = true
              }
            }
            return changed ? { resumePaths } : {}
          }),
      }
    },
    {
      name: 'atriveo-feed-store',
      partialize: (s) => ({
        hiddenIds:        [...s.hiddenIds],
        archivedIds:      [...s.archivedIds],
        appliedIds:       [...s.appliedIds],
        savedIds:         [...s.savedIds],
        topListCompanies: [...s.topListCompanies],
        resumePaths:      [...s.resumePaths],
        linkOpenedIds:    [...s.linkOpenedIds],
        autoScrapeHourly: s.autoScrapeHourly,
        resumeDownloadFolderName: s.resumeDownloadFolderName,
      }),
      merge: (persisted, current) => {
        const p = persisted as {
          hiddenIds?: string[]
          archivedIds?: string[]
          appliedIds?: string[]
          savedIds?: string[]
          topListCompanies?: string[]
          resumePaths?: Array<[string, string]>
          linkOpenedIds?: string[]
          autoScrapeHourly?: boolean
          resumeDownloadFolderName?: string
        }
        return {
          ...current,
          hiddenIds:        new Set(p.hiddenIds        ?? []),
          archivedIds:      new Set(p.archivedIds      ?? []),
          appliedIds:       new Set(p.appliedIds       ?? []),
          savedIds:         new Set(p.savedIds         ?? []),
          topListCompanies: new Set(p.topListCompanies ?? []),
          resumePaths:      new Map(p.resumePaths      ?? []),
          linkOpenedIds:    new Set(p.linkOpenedIds    ?? []),
          autoScrapeHourly: p.autoScrapeHourly ?? true,
          resumeDownloadFolderName: p.resumeDownloadFolderName ?? '',
        }
      },
    },
  ),
)
