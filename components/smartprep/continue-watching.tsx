"use client"

import { useState } from "react"
import { Play, RotateCcw, Youtube } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, decodeHtml } from "@/lib/utils"
import { formatClockTime, type HistoryEntry } from "@/lib/video-history"
import { getYouTubeId } from "@/lib/youtube"

// Built only from local history: no network call besides the thumbnail image itself
interface ContinueWatchingProps {
  /** Unfinished videos, most recent first; the first is the main card, the next two go under "More to continue" */
  entries: HistoryEntry[]
  onResume: (entry: HistoryEntry) => void
  onStartOver: (entry: HistoryEntry) => void
}

function progressFraction(entry: HistoryEntry): number {
  const duration = entry.durationSeconds ?? 0
  return duration > 0 ? Math.min(1, (entry.progressSeconds ?? 0) / duration) : 0
}

function ProgressBar({ entry, className }: { entry: HistoryEntry; className?: string }) {
  const percent = Math.round(progressFraction(entry) * 100)
  return (
    <div
      role="progressbar"
      aria-label="Watched"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div className="h-full rounded-full bg-gradient-accent" style={{ width: `${percent}%` }} />
    </div>
  )
}

// Plain <img> from YouTube's thumbnail server; removed if it can't load
function Thumbnail({ entry, className }: { entry: HistoryEntry; className?: string }) {
  const [failed, setFailed] = useState(false)
  const id = getYouTubeId(entry.youtubeUrl)
  if (!id || failed) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn("object-cover", className)}
    />
  )
}

export function ContinueWatching({ entries, onResume, onStartOver }: ContinueWatchingProps) {
  const [main, ...rest] = entries
  if (!main) return null
  const more = rest.slice(0, 2)

  return (
    <section aria-label="Continue watching" className="w-full space-y-3">
      <div className="surface overflow-hidden rounded-2xl border border-primary/30 shadow-raised">
        <div className="flex flex-col sm:flex-row">
          <div className="relative aspect-video w-full shrink-0 bg-gradient-to-br from-primary/25 via-background to-info/15 sm:w-1/2">
            <Thumbnail entry={main} className="absolute inset-0 h-full w-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded-full bg-black/55 p-3 backdrop-blur">
                <Play className="h-7 w-7 text-white" />
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary-soft">Continue watching</p>
            <div className="min-w-0">
              <h2 className="line-clamp-2 font-semibold text-foreground">{decodeHtml(main.videoTitle)}</h2>
              {main.channel && (
                <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <Youtube className="h-3 w-3" />
                  {main.channel}
                </p>
              )}
            </div>
            <div className="space-y-1">
              <ProgressBar entry={main} />
              <p className="text-xs text-muted-foreground">
                {formatClockTime(main.progressSeconds ?? 0)} of {formatClockTime(main.durationSeconds ?? 0)}
              </p>
            </div>
            <div className="mt-auto flex flex-wrap gap-2">
              <Button onClick={() => onResume(main)}>
                <Play className="h-4 w-4" />
                Resume from {formatClockTime(main.progressSeconds ?? 0)}
              </Button>
              <Button variant="outline" onClick={() => onStartOver(main)}>
                <RotateCcw className="h-4 w-4" />
                Start over
              </Button>
            </div>
          </div>
        </div>
      </div>

      {more.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-foreground">More to continue</h3>
          <ul className="grid gap-3 sm:grid-cols-2">
            {more.map((entry) => (
              <li key={entry.youtubeUrl}>
                <button
                  type="button"
                  onClick={() => onResume(entry)}
                  aria-label={`Resume "${decodeHtml(entry.videoTitle)}" from ${formatClockTime(entry.progressSeconds ?? 0)}`}
                  className="surface card-interactive flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-all hover:-translate-y-0.5"
                >
                  <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-lg bg-muted">
                    <Thumbnail entry={entry} className="absolute inset-0 h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="line-clamp-2 text-sm font-medium text-foreground">{decodeHtml(entry.videoTitle)}</p>
                    <ProgressBar entry={entry} className="h-1" />
                    <p className="text-xs text-muted-foreground">Resume from {formatClockTime(entry.progressSeconds ?? 0)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
