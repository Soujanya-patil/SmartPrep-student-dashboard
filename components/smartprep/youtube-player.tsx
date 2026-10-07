"use client"

import { useEffect, useRef, useState } from "react"
import { AlertTriangle, ExternalLink, Play, Youtube } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { decodeHtml } from "@/lib/utils"
import type { VideoRecommendation } from "@/lib/types"
import type { ProgressUpdate } from "@/lib/video-history"
import { getYouTubeId, youtubeWatchUrl } from "@/lib/youtube"
import { YT_STATE, loadYouTubeIframeApi, type YTPlayer } from "@/lib/youtube-iframe-api"

interface YouTubePlayerProps {
  video: VideoRecommendation | null
  isPaused: boolean
  muted?: boolean
  /** Replaces the "Ready to Learn?" message while there is no video yet (e.g. still loading) */
  emptyText?: string
  /** Where to start the video. Read once, when the player is created for a video. */
  startSeconds?: number
  /** Called with playback progress: every 5s while playing, and on pause, end, tab hide and leaving */
  onProgress?: (video: VideoRecommendation, update: ProgressUpdate) => void
}

const SAVE_EVERY_MS = 5000

type PlayerError = "unavailable" | "load"

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

export function YouTubePlayer({ video, isPaused, muted = false, emptyText, startSeconds = 0, onProgress }: YouTubePlayerProps) {
  const videoId = getYouTubeId(video?.youtubeUrl)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const playerRef = useRef<YTPlayer | null>(null)
  const [playerError, setPlayerError] = useState<PlayerError | null>(null)
  // Was the video playing when the attention popup paused it? Then resume it when the popup closes.
  const resumeAfterPopupRef = useRef(false)

  // Latest props for the long-lived player callbacks, without recreating the player when they change
  const latest = useRef({ video, startSeconds, muted, isPaused, onProgress })
  useEffect(() => {
    latest.current = { video, startSeconds, muted, isPaused, onProgress }
  })

  // One player per video: created when the video changes, destroyed when it changes again or the page is left.
  // In development, StrictMode mounts twice; the first run is cancelled before its player is ever created.
  useEffect(() => {
    const container = containerRef.current
    if (!videoId || !container) return

    setPlayerError(null)
    resumeAfterPopupRef.current = false
    const playingVideo = latest.current.video
    let cancelled = false
    let player: YTPlayer | null = null
    let ready = false
    let errored = false
    let interval: ReturnType<typeof setInterval> | null = null

    // Never saves after a player error (unavailable / embedding blocked) or before the player is ready
    const save = (ended = false) => {
      if (!player || !ready || errored || !playingVideo) return
      try {
        const duration = player.getDuration()
        if (!(duration > 0)) return
        const current = ended ? duration : player.getCurrentTime()
        latest.current.onProgress?.(playingVideo, { currentSeconds: current, durationSeconds: duration, ended })
      } catch {
        // The player is gone (e.g. its iframe was removed): nothing to save
      }
    }
    const stopInterval = () => {
      if (interval !== null) clearInterval(interval)
      interval = null
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") save()
    }
    const onPageHide = () => save()

    // YouTube replaces this element with its iframe, so React must not own it
    const target = document.createElement("div")
    target.style.width = "100%"
    target.style.height = "100%"
    container.appendChild(target)

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled) return
        const start = Math.max(0, Math.floor(latest.current.startSeconds))
        player = new YT.Player(target, {
          videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            autoplay: 1,
            mute: latest.current.muted ? 1 : 0,
            rel: 0,
            playsinline: 1,
            start,
            origin: window.location.origin,
          },
          events: {
            onReady: (event) => {
              ready = true
              if (latest.current.isPaused) event.target.pauseVideo()
            },
            onStateChange: (event) => {
              if (event.data === YT_STATE.PLAYING) {
                stopInterval()
                interval = setInterval(() => save(), SAVE_EVERY_MS)
                return
              }
              stopInterval()
              if (event.data === YT_STATE.PAUSED) save()
              if (event.data === YT_STATE.ENDED) save(true)
            },
            onError: () => {
              errored = true
              stopInterval()
              setPlayerError("unavailable")
            },
          },
        })
        playerRef.current = player
      })
      .catch(() => {
        if (!cancelled) setPlayerError("load")
      })

    document.addEventListener("visibilitychange", onVisibilityChange)
    window.addEventListener("pagehide", onPageHide)

    return () => {
      cancelled = true
      document.removeEventListener("visibilitychange", onVisibilityChange)
      window.removeEventListener("pagehide", onPageHide)
      stopInterval()
      save() // switching videos or leaving the page
      try {
        player?.destroy()
      } catch {
        // Already gone
      }
      if (playerRef.current === player) playerRef.current = null
      container.replaceChildren()
    }
  }, [videoId])

  // Attention popup: pause through the player API, and resume only if it was playing before
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    try {
      if (isPaused) {
        resumeAfterPopupRef.current = player.getPlayerState() === YT_STATE.PLAYING
        player.pauseVideo()
      } else if (resumeAfterPopupRef.current) {
        resumeAfterPopupRef.current = false
        player.playVideo()
      }
    } catch {
      // Player not ready yet: onReady applies the pause instead
    }
  }, [isPaused])

  // The first auto-play is muted (browser autoplay rules); choosing a video turns the sound on
  useEffect(() => {
    const player = playerRef.current
    if (!player) return
    try {
      if (muted) player.mute()
      else player.unMute()
    } catch {
      // Player not ready yet: it was created with the right mute setting
    }
  }, [muted])

  return (
    <div className="w-full">
      {/* 16:9 frame is always reserved, so the layout never jumps when a video loads */}
      <div className="relative w-full aspect-video overflow-hidden rounded-2xl bg-black border border-primary/30 shadow-raised">
        {videoId ? (
          <>
            <div
              ref={containerRef}
              className={`absolute inset-0 transition-opacity ${isPaused ? "pointer-events-none opacity-50" : ""}`}
              aria-label={video ? decodeHtml(video.videoTitle) : "YouTube video"}
            />
            {playerError && video && (
              <div
                role="alert"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/90 px-4 text-center"
              >
                <div className="p-3 rounded-full bg-destructive/15">
                  <AlertTriangle className="h-7 w-7 text-destructive" />
                </div>
                <p className="text-base text-foreground">
                  {playerError === "load"
                    ? "The YouTube player couldn't load."
                    : "This video can't be played here. It may be unavailable or blocked from embedding."}
                </p>
                <WatchOnYouTube url={video.youtubeUrl} className="text-sm" />
              </div>
            )}
          </>
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
