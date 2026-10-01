import { useRef, useState, useEffect, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { JobCard, COLLAPSED_H, EXPANDED_H } from './JobCard'
import { useFeedStore } from '@/stores/feedStore'
import { createTrackerJob } from '@/api/jobTracker'
import type { Job, FeedTab } from '@/domain/job'
import type { QueueEntry } from '@/features/feed/FeedView'

const BANNER_H = 28

type VirtualRow =
  | { kind: 'banner'; label: string; count: number; key: string }
  | { kind: 'job';    job: Job;       key: string }

interface JobListProps {
  jobs: Job[]
  queueMap: Map<string, QueueEntry>
  onAlreadySuccess: (jobUrl: string) => void
  activeTab: FeedTab
  counts: { hour: number; today: number; yesterday?: number; week?: number }
}

function bannerLabel(tab: FeedTab): string {
  switch (tab) {
    case 'hour':      return 'This hour'
    case 'today':     return 'Today'
    case 'yesterday': return 'Yesterday'
    case 'week':      return 'This week'
    default:          return 'Jobs'
  }
}

export function JobList({ jobs, queueMap, onAlreadySuccess, activeTab, counts }: JobListProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const [trackerError, setTrackerError] = useState<string | null>(null)

  const {
    expandedJobId, setExpanded, toggleTopList,
    toggleHide, archiveJob,
    appliedIds, toggleApplied,
    selectedIds, toggleSelected,
  } = useFeedStore()

  // Build flat virtual rows: a single banner at the top, then all jobs.
  const rows = useMemo<VirtualRow[]>(() => {
    if (jobs.length === 0) return []

    const tabCount = activeTab === 'hour' ? counts.hour
      : activeTab === 'today'     ? counts.today
      : activeTab === 'yesterday' ? (counts.yesterday ?? jobs.length)
      : activeTab === 'week'      ? (counts.week      ?? jobs.length)
      : jobs.length
    return [
      { kind: 'banner', label: bannerLabel(activeTab), count: tabCount, key: 'banner-top' },
      ...jobs.map((j) => ({ kind: 'job' as const, job: j, key: j.id })),
    ]
  }, [jobs, activeTab, counts])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => {
      const row = rows[i]
      if (!row) return COLLAPSED_H + 6
      if (row.kind === 'banner') return BANNER_H
      return row.job.id === expandedJobId ? EXPANDED_H + 6 : COLLAPSED_H + 6
    },
    overscan: 6,
  })

  useEffect(() => {
    virtualizer.measure()
  }, [expandedJobId, virtualizer])

  if (jobs.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-1.5">
        <p className="text-[12px] font-semibold text-foreground/40">No jobs in this tab</p>
        <p className="text-[10px] text-foreground/25">Try switching tabs or clearing the search</p>
      </div>
    )
  }

  return (
    <>
      {trackerError && (
        <div className="shrink-0 px-3 py-1">
          <p className="truncate text-[9px] text-rose-400/80">{trackerError}</p>
        </div>
      )}
      <div
        ref={parentRef}
        className="dock-scroll flex-1 overflow-y-auto overflow-x-hidden py-1"
        style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)', backgroundSize: '12px 12px' }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = rows[vItem.index]
            if (!row) return null

            if (row.kind === 'banner') {
              return (
                <div
                  key={row.key}
                  data-index={vItem.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: 'absolute', top: 0,
                    transform: `translateY(${vItem.start}px)`,
                    width: '100%',
                  }}
                >
                  <div className="flex items-center gap-2 px-3 pb-1 pt-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-widest text-foreground/25">
                      {row.label}
                    </span>
                    <span className="rounded-full bg-primary/15 px-2 py-px text-[11px] font-bold tabular-nums text-primary/80">
                      {row.count}
                    </span>
                    <div className="h-px flex-1 bg-white/[0.05]" />
                  </div>
                </div>
              )
            }

            const { job } = row
            const isExpanded = job.id === expandedJobId

            return (
              <div
                key={job.id}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute', top: 0,
                  transform: `translateY(${vItem.start}px)`,
                  width: '100%',
                }}
              >
                <JobCard
                  job={job}
                  index={vItem.index}
                  isExpanded={isExpanded}
                  isApplied={appliedIds.has(job.id)}
                  isSelected={selectedIds.has(job.id)}
                  onToggleExpand={() => setExpanded(isExpanded ? null : job.id)}
                  onHide={() => toggleHide(job.id)}
                  onArchive={() => archiveJob(job.id)}
                  onToggleApplied={() => {
                    const isApplied = appliedIds.has(job.id)
                    toggleApplied(job.id)
                    if (!isApplied) {
                      // Write to the real atriveo.com tracker (job-tracker-api).
                      // A failure here is now surfaced rather than logged: this
                      // is the only write, so a silent one loses the apply.
                      setTrackerError(null)
                      void createTrackerJob({ company: job.company, role: job.title, jobUrl: job.applyUrl })
                        .catch((err) => {
                          console.error('Tracker add failed', err)
                          setTrackerError('Could not add this to the tracker')
                        })
                    }
                  }}
                  queueEntry={queueMap.get(job.applyUrl)}
                  onToggleSelected={() => toggleSelected(job.id)}
                  onAlreadySuccess={onAlreadySuccess}
                  onToggleTopList={() => toggleTopList(job.company)}
                />
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
