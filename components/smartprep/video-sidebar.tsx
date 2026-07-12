"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Spinner } from "@/components/ui/spinner"
import { Play, Youtube, AlertCircle, BookOpen, Search } from "lucide-react"
import type { VideoRecommendation } from "@/lib/types"

interface VideoSidebarProps {
  videos: VideoRecommendation[]
  selectedVideo: VideoRecommendation | null
  onSelectVideo: (video: VideoRecommendation) => void
  isLoading: boolean
  error: string | null
  onSearch: (subject: string, chapter: string) => void
}

export function VideoSidebar({
  videos,
  selectedVideo,
  onSelectVideo,
  isLoading,
  error,
  onSearch
}: VideoSidebarProps) {
  const [searchSubject, setSearchSubject] = useState("")
  const [searchChapter, setSearchChapter] = useState("")

  const handleSearch = () => {
    if (searchSubject.trim() && searchChapter.trim()) {
      onSearch(searchSubject.trim(), searchChapter.trim())
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch()
  }

  return (
    <aside className="w-full lg:w-80 shrink-0 border-r border-border bg-card/50 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/20 to-accent/20">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/20 animate-pulse-border border border-primary/50">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="font-semibold text-foreground">Recommended Videos</h2>
            <p className="text-xs text-muted-foreground">AI-powered suggestions for you</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="p-3 border-b border-border space-y-2">
        <input
          type="text"
          placeholder="Subject (e.g. Biology)"
          value={searchSubject}
          onChange={(e) => setSearchSubject(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
        />
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Topic (e.g. Mitosis)"
            value={searchChapter}
            onChange={(e) => setSearchChapter(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Search className="h-4 w-4 text-white" />
          </button>
        </div>
      </div>

      {/* Video List */}
      <ScrollArea className="flex-1" id="video-list">
        <div className="p-3 space-y-3">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <Spinner className="h-8 w-8 text-primary" />
              <p className="text-sm text-muted-foreground">Loading recommendations...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-6 w-6 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-4">
              <div className="p-3 rounded-full bg-success/10">
                <Youtube className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm text-muted-foreground">
                No weak topics found! Search above to explore any topic 🎯
              </p>
            </div>
          ) : (
            videos.map((video, index) => {
              const isSelected = selectedVideo?.youtubeUrl === video.youtubeUrl
              return (
                <button
                  key={`${video.youtubeUrl}-${index}`}
                  onClick={() => onSelectVideo(video)}
                  className={`w-full text-left p-3 rounded-xl border transition-all duration-300 group
                    ${isSelected
                      ? 'bg-primary/10 border-primary shadow-lg shadow-primary/20 animate-glow'
                      : 'bg-card/80 border-border hover:border-primary/50 hover:bg-secondary/50 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10'
                    }
                    glassmorphism
                  `}
                >
                  <div className="flex items-start gap-3">
                    <div className={`shrink-0 p-2 rounded-lg transition-colors ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted group-hover:bg-primary/20'}`}>
                      <Play className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        <Badge variant="secondary" className="text-xs bg-primary/20 text-primary border-0">
                          {video.subject}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-accent/50 text-accent">
                          {video.chapter}
                        </Badge>
                      </div>
                      <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                        {video.videoTitle}
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