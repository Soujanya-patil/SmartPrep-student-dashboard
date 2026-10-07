"use client"

import { ExternalLink, Play, Youtube } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { decodeHtml } from "@/lib/utils"
import type { VideoRecommendation } from "@/lib/types"
import { getYouTubeId, youtubeWatchUrl } from "@/lib/youtube"

interface YouTubePlayerProps {
  video: VideoRecommendation | null
  isPaused: boolean
  muted?: boolean
  /** Replaces the "Ready to Learn?" message while there is no video yet (e.g. still loading) */
  emptyText?: string
}

// Opens the video on youtube.com: the fallback when it won't play in the app
function WatchOnYouTube({ url, className }: { url: string; className?: string }) {
  return (
    <a
      href={youtubeWatchUrl(url)}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-1 text-xs font-medium text-primary-soft hover:underline ${className ?? ""}`}
    >
      Watch on YouTube
      <ExternalLink className="h-3 w-3" />
    </a>
  )
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
            {video ? (
              // A selected video whose URL has no recognisable YouTube id
              <>
                <p className="text-base sm:text-lg text-foreground" role="status">This video can&apos;t be played here.</p>
                <WatchOnYouTube url={video.youtubeUrl} className="text-sm" />
              </>
            ) : emptyText ? (
              <p className="text-base sm:text-lg text-foreground" role="status">{emptyText}</p>
            ) : (
              <>
                <p className="text-lg sm:text-xl font-semibold text-foreground">Ready to Learn?</p>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Pick a video from Recommended or History, or search for a topic.
                </p>
              </>
            )}
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
          <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
            {video.channel && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Youtube className="h-3 w-3" />
                {video.channel}
              </p>
            )}
            <WatchOnYouTube url={video.youtubeUrl} />
          </div>
        </div>
      )}
    </div>
  )
}
