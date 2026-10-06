"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Skeleton } from "@/components/ui/skeleton"
import { Play, Youtube, AlertCircle, BookOpen, SearchX, RefreshCw, Loader2 } from "lucide-react"
import { cn, decodeHtml } from "@/lib/utils"
import type { VideoRecommendation } from "@/lib/types"

interface VideoSidebarProps {
  videos: VideoRecommendation[]
  selectedVideo: VideoRecommendation | null
  onSelectVideo: (video: VideoRecommendation) => void
  isLoading: boolean
  error: string | null
  variant?: "recommended" | "search"
  title?: string
  subtitle?: string
  className?: string
  /** Shown above the skeletons when loading is taking a while (e.g. the backend is waking up) */
  slowMessage?: string
  /** Adds a Retry button to the error state */
  onRetry?: () => void
}

function VideoCardSkeleton() {
  return (
    <div className="p-3 rounded-xl border border-border bg-card/80 surface">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-lg bg-primary/20" />
        <div className="flex-1 space-y-2">
          <div className="flex gap-1.5">
            <Skeleton className="h-4 w-16 rounded-full bg-primary/20" />
            <Skeleton className="h-4 w-20 rounded-full bg-muted" />
          </div>
          <Skeleton className="h-3.5 w-full bg-muted" />
          <Skeleton className="h-3.5 w-3/4 bg-muted" />
          <Skeleton className="h-3 w-24 bg-muted" />
        </div>
      </div>
    </div>
  )
}

export function VideoSidebar({
  videos,
  selectedVideo,
  onSelectVideo,
  isLoading,
  error,
  variant = "recommended",
  title = "Recommended Videos",
  subtitle = "AI-powered suggestions for you",
  className,
  slowMessage,
  onRetry
}: VideoSidebarProps) {
  const isSearch = variant === "search"

  return (
    <aside
      className={cn(
        "w-full flex flex-col overflow-hidden rounded-2xl border border-border bg-card/50 surface",
        className
      )}
    >
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/20 via-info/10 to-accent/15">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/20 border border-primary/50">
            <BookOpen className="h-5 w-5 text-primary-soft" />
          </div>
          <div className="min-w-0">
            <h2 className="font-semibold text-foreground">{title}</h2>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
          </div>
        </div>
      </div>

      {/* Video List */}
      <ScrollArea className="lg:flex-1 lg:min-h-0" id="video-list">
        <div className="p-3 space-y-3" aria-busy={isLoading}>
          {isLoading ? (
            <>
              {slowMessage && (
                <p role="status" className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
                  <Loader2 className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-primary-soft" />
                  {slowMessage}
                </p>
              )}
              {Array.from({ length: 5 }, (_, i) => <VideoCardSkeleton key={i} />)}
            </>
          ) : error ? (
            <div role="alert" className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  <RefreshCw className="h-4 w-4" />
                  Retry
                </Button>
              )}
            </div>
          ) : videos.length === 0 ? (
            isSearch ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                <div className="p-3 rounded-full bg-primary/10">
                  <SearchX className="h-6 w-6 text-primary-soft" />
                </div>
                <p className="text-sm font-medium text-foreground">No videos found</p>
                <p className="text-xs text-muted-foreground">
                  Try a different topic, check the spelling, or switch to &quot;All subjects&quot;.
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
                <div className="p-3 rounded-full bg-success/10">
                  <Youtube className="h-6 w-6 text-success" />
                </div>
                <p className="text-sm text-muted-foreground">No weak topics found! You&apos;re doing great!</p>
              </div>
            )
          ) : (
            videos.map((video, index) => {
              const isSelected = selectedVideo?.youtubeUrl === video.youtubeUrl
              return (
                <button
                  key={`${video.youtubeUrl}-${index}`}
                  onClick={() => onSelectVideo(video)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-300 group
                    ${isSelected
                      ? 'bg-primary/15 border-primary shadow-card'
                      : 'card-interactive bg-card/80 border-border hover:bg-secondary/60 hover:-translate-y-1 active:translate-y-0'
                    }
                    surface
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 p-2 rounded-lg transition-colors ${isSelected ? 'icon-gradient' : 'bg-muted group-hover:bg-primary/25 group-hover:text-primary-soft'}`}>
                      <Play className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="secondary" className="text-xs bg-primary/20 text-primary-soft border-0">
                          {video.subject}
                        </Badge>
                        {video.chapter && (
                          <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                            {video.chapter}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                        {decodeHtml(video.videoTitle)}
                      </h3>
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Youtube className="h-3 w-3" />
                        {video.channel}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </aside>
  )
}
