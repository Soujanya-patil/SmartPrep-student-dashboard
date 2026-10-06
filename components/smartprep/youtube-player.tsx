"use client"

import { Play, Youtube } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { decodeHtml } from "@/lib/utils"
import type { VideoRecommendation } from "@/lib/types"

interface YouTubePlayerProps {
  video: VideoRecommendation | null
  isPaused: boolean
  muted?: boolean
  /** Replaces "Select a video to start" while there is no video yet (e.g. still loading) */
  emptyText?: string
}

// Extract the 11-char video ID from watch?v=, youtu.be/, /embed/ or /shorts/ URLs
export function getYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null
  const match = url.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : null
}

export function YouTubePlayer({ video, isPaused, muted = false, emptyText }: YouTubePlayerProps) {
  const videoId = getYouTubeId(video?.youtubeUrl)

  return (
    <div className="w-full">
      {/* 16:9 frame is always reserved, so the layout never jumps when a video loads */}
      <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-black border border-primary/30 shadow-raised">
        {videoId ? (
          <iframe
            // key forces a fresh iframe per video so autoplay fires on every switch
            key={`${videoId}-${muted}`}
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muted ? 1 : 0}&rel=0&playsinline=1`}
            title={video ? decodeHtml(video.videoTitle) : "YouTube video"}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className={`absolute inset-0 h-full w-full border-0 transition-opacity ${isPaused ? "pointer-events-none opacity-50" : ""}`}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-primary/25 via-background to-info/15 text-center px-4">
            <div className="p-4 rounded-full bg-primary/20 border border-primary/40">
              <Play className="h-8 w-8 text-primary-soft" />
            </div>
            <p className="text-base sm:text-lg text-foreground" role="status">{emptyText ?? "Select a video to start"}</p>
          </div>
        )}
      </div>

      {/* Now playing */}
      {video && videoId && (
        <div className="surface mt-3 rounded-xl border border-border px-4 py-3">
          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-medium text-success">
              <span className="h-2 w-2 rounded-full bg-success animate-pulse" />
              Now playing
            </span>
            <Badge variant="secondary" className="text-xs bg-primary/20 text-primary-soft border-0">
              {video.subject}
            </Badge>
            {video.chapter && (
              <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                {video.chapter}
              </Badge>
            )}
          </div>
          <h2 className="font-semibold text-sm sm:text-base text-foreground line-clamp-2">
            {decodeHtml(video.videoTitle)}
          </h2>
          {video.channel && (
            <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <Youtube className="h-3 w-3" />
              {video.channel}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
