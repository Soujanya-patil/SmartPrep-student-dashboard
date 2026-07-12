"use client"

import { useEffect, useRef } from "react"
import { Play, Sparkles } from "lucide-react"
import type { VideoRecommendation } from "@/lib/types"

interface YouTubePlayerProps {
  video: VideoRecommendation | null
  isPaused: boolean
}

function extractVideoId(url: string): string | null {
  if (!url) return null
  
  const patterns = [
    /youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
  ]
  
  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match) return match[1]
  }
  return null
}

export function YouTubePlayer({ video, isPaused }: YouTubePlayerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const videoId = video ? extractVideoId(video.youtubeUrl) : null

  useEffect(() => {
    if (iframeRef.current && isPaused) {
      // Pause the video by posting a message to the iframe
      iframeRef.current.contentWindow?.postMessage(
        '{"event":"command","func":"pauseVideo","args":""}',
        '*'
      )
    }
  }, [isPaused])

  if (!video || !videoId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-background via-card to-secondary/20">
        <div className="text-center space-y-6 p-8 max-w-md animate-float">
          <div className="relative">
            <div className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-2xl shadow-primary/30">
              <Play className="h-10 w-10 text-white ml-1" />
            </div>
            <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-accent flex items-center justify-center animate-bounce">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Ready to Learn?</h2>
            <p className="text-muted-foreground">
              Select a video from the sidebar to start your focused study session
            </p>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span>AI-powered attention checks enabled</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-background" id="youtube-player">
      {/* Video Info Header */}
      <div className="p-4 border-b border-border bg-card/50">
        <h1 className="font-semibold text-lg text-foreground line-clamp-1">{video.videoTitle}</h1>
        <p className="text-sm text-muted-foreground">{video.channel}</p>
      </div>
      
      {/* Player Container */}
      <div className="relative w-full h-full rounded-xl overflow-hidden border border-border shadow-2xl shadow-primary/10">
  <iframe
    ref={iframeRef}
    src={`https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1`}
    className="absolute inset-0 w-full h-full"
    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
    allowFullScreen
    title={video.videoTitle}
    onError={() => window.open(video.youtubeUrl, '_blank')}
  />
  {/* Fallback button */}
<div className="absolute bottom-4 right-4">
  <a
    href={video.youtubeUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="bg-red-300 hover:bg-red-400 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
  >
    ▶ Watch on YouTube
  </a>
</div>
</div>
</div>
  )
}
