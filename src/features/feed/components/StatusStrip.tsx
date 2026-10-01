interface StatusStripProps {
  lastSyncedAt: Date | null
  keywords: string[]
}

function timeAgoShort(date: Date): string {
  const min = Math.floor((Date.now() - date.getTime()) / 60_000)
  if (min < 1)  return 'just now'
  if (min < 60) return `${min}m ago`
  return `${Math.floor(min / 60)}h ago`
}

export function StatusStrip({ lastSyncedAt, keywords }: StatusStripProps) {
  return (
    <div className="flex shrink-0 items-center gap-0 border-b border-white/5 px-4 py-2">
      <span className="text-[10px] text-foreground/35">
        Last updated{' '}
        <strong className="font-semibold text-foreground/55">
          {lastSyncedAt ? timeAgoShort(lastSyncedAt) : '—'}
        </strong>
      </span>
      {keywords.length > 0 && (
        <>
          <span className="mx-2 text-foreground/20">·</span>
          <div className="flex items-center gap-1.5 overflow-hidden">
            {keywords.map((kw) => (
              <span
                key={kw}
                className="shrink-0 text-[9px] font-bold uppercase tracking-[0.14em] text-foreground/30"
              >
                {kw}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
