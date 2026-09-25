"use client"

import type { VideoRecommendation } from "@/lib/types"

interface YouTubePlayerProps {
  video: VideoRecommendation | null
  isPaused: boolean
  muted?: boolean
}

// Extract the 11-char video ID from watch?v=, youtu.be/, /embed/ or /shorts/ URLs
export function getYouTubeId(url: string | undefined | null): string | null {
  if (!url) return null
  const match = url.match(/(?:[?&]v=|youtu\.be\/|\/embed\/|\/shorts\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : null
}

export function YouTubePlayer({ video, isPaused, muted = false }: YouTubePlayerProps) {
  const videoId = getYouTubeId(video?.youtubeUrl)

  if (!videoId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-white">
        <div className="text-center">
          <div className="text-6xl mb-4">▶</div>
          <p className="text-xl">Select a video to start</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-black p-4">
      <div className="w-full max-w-5xl aspect-video">
        <iframe
          // key forces a fresh iframe per video so autoplay fires on every switch
          key={`${videoId}-${muted}`}
          width="100%"
          height="100%"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&mute=${muted ? 1 : 0}&rel=0&playsinline=1`}
          title={video?.videoTitle || "YouTube video"}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className={`rounded-lg w-full h-full ${isPaused ? "pointer-events-none opacity-50" : ""}`}
        />
      </div>
    </div>
  )
}
