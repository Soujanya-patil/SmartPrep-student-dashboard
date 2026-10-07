"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "./header"
import { SearchBar } from "./search-bar"
import { VideoSidebar } from "./video-sidebar"
import { YouTubePlayer } from "./youtube-player"
import { CountdownTimer } from "./countdown-timer"
import { AttentionPopup } from "./attention-popup"
import { QuickLinks } from "./quick-links"
import { CHECK_INTERVAL, useDashboardField, useDashboardStore, useIsSlow } from "./dashboard-store"
import { SidebarTabs } from "./sidebar-tabs"
import { fetchAttentionCheck } from "@/lib/api"
import type { VideoRecommendation, AttentionCheck } from "@/lib/types"
import { ContinueWatching } from "./continue-watching"
import {
  formatClockTime,
  formatWatchedAt,
  isUnfinished,
  resumeSecondsFor,
  unfinishedEntries,
  type HistoryEntry,
} from "@/lib/video-history"

// Desktop: fixed-width right column that scrolls on its own; height leaves room for header, search bar and the fixed timer
const SIDEBAR_CLASSES = "lg:w-96 lg:shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-15.5rem)]"

const WAKING_UP = "Waking up the server, this can take up to 2 minutes…"

export function Dashboard() {
  // Videos, search, the selected video and the timer live in a store in the root layout, so they
  // survive a visit to another page. Recommendations and search are fetched by the store.
  const {
    data,
    retryRecommendations,
    search: handleSearch,
    recordWatched,
    removeFromHistory,
    clearHistory,
    saveVideoProgress,
    startOver,
  } = useDashboardStore()
  const { recommended, recommendedStatus, recommendedError, recommendedSince } = data
  const { activeSearch, searchResults, isSearching, searchError, searchSince } = data
  const isLoadingRecommended = recommendedStatus === "idle" || recommendedStatus === "loading"
  const recommendedSlow = useIsSlow(recommendedSince)
  const searchSlow = useIsSlow(searchSince)
  const { history, historyLoaded } = data
  const [sidebarTab, setSidebarTab] = useDashboardField("sidebarTab")

  // "5 minutes ago" labels in the History tab; refreshed every minute (0 until mounted, so nothing renders on the server)
  const [now, setNow] = useState(0)
  useEffect(() => {
    setNow(Date.now())
    const interval = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  // Player state
  const [selectedVideo, setSelectedVideo] = useDashboardField("selectedVideo")
  const [isAutoMuted, setIsAutoMuted] = useDashboardField("isAutoMuted")

  // Timer state: the countdown only runs while this page is mounted, so it pauses while the user is away
  const [timeRemaining, setTimeRemaining] = useDashboardField("timeRemaining")
  const [isTimerActive, setIsTimerActive] = useDashboardField("isTimerActive")

  // Attention check state
  const [showAttentionPopup, setShowAttentionPopup] = useState(false)
  const [attentionCheck, setAttentionCheck] = useState<AttentionCheck | null>(null)
  const [isLoadingCheck, setIsLoadingCheck] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const playerRef = useRef<HTMLElement | null>(null)

  // Handle video selection
  const handleSelectVideo = useCallback((video: VideoRecommendation) => {
    // History only changes when the user picks a video, never when recommendations or search results arrive
    recordWatched(video)
    setIsAutoMuted(false)
    setSelectedVideo(video)
    setTimeRemaining(CHECK_INTERVAL)
    setIsTimerActive(true)

    // Bring the player into view (the list sits below it on mobile/tablet)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    playerRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  }, [recordWatched, setIsAutoMuted, setSelectedVideo, setTimeRemaining, setIsTimerActive])

  // Trigger attention check
  const triggerAttentionCheck = useCallback(async () => {
    setShowAttentionPopup(true)
    setIsLoadingCheck(true)
    setCheckError(null)

    try {
      const data = await fetchAttentionCheck(selectedVideo?.subject || "", selectedVideo?.chapter || "")
      setAttentionCheck(data)
    } catch {
      setCheckError("Unable to load the attention check question.")
      // Mock data for development/demo
      setAttentionCheck({
        question: "What is the derivative of x²?",
        optionA: "x",
        optionB: "2x",
        optionC: "2x²",
        optionD: "x³",
        correctOption: "B",
        encouragement: "Great job! You're paying attention and learning well!",
        hint: "Remember, the power rule states that the derivative of xⁿ is n·xⁿ⁻¹"
      })
      setCheckError(null)
    } finally {
      setIsLoadingCheck(false)
    }
  }, [selectedVideo])

  // Timer countdown effect
  useEffect(() => {
    if (!isTimerActive || showAttentionPopup) return

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          triggerAttentionCheck()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [isTimerActive, showAttentionPopup, triggerAttentionCheck, setTimeRemaining])

  // Handle attention check answer
  const handleAnswer = () => {
    // Answer is processed in the popup component
    // We could track stats here if needed
  }

  // Handle continue after attention check
  const handleContinue = () => {
    setShowAttentionPopup(false)
    setAttentionCheck(null)
    setTimeRemaining(CHECK_INTERVAL)
    // Timer will resume automatically via useEffect
  }

  // Half-watched videos, most recent first (local history only)
  const unfinished = historyLoaded ? unfinishedEntries(history) : []

  const handleStartOver = (entry: HistoryEntry) => {
    startOver(entry.youtubeUrl)
    handleSelectVideo(entry)
  }

  const sidebarTabs = (
    <SidebarTabs
      active={sidebarTab}
      onChange={setSidebarTab}
      historyCount={history.length}
      onClearHistory={clearHistory}
    />
  )

  // What the sidebar shows: search results while searching, otherwise the Recommended or History tab
  const isSearchMode = activeSearch !== null
  const sidebarSubtitle = activeSearch
    ? `"${activeSearch.query}" in ${activeSearch.subject === "All" ? "all subjects" : activeSearch.subject}`
    : undefined

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <div className="border-b border-border bg-card/30 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto">
          <SearchBar onSearch={handleSearch} isSearching={isSearching} initialQuery={activeSearch?.query ?? ""} />
        </div>
      </div>

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Player first in the DOM so it is always on top on mobile/tablet; sticky beside the list on desktop */}
        <section
          ref={playerRef}
          aria-label="Video player and study timer"
          className="w-full min-w-0 lg:flex-1 lg:sticky lg:top-4 scroll-mt-4"
        >
          {!selectedVideo && unfinished.length > 0 ? (
            // Comes only from local history: works while the backend is asleep or failing
            <ContinueWatching entries={unfinished.slice(0, 3)} onResume={handleSelectVideo} onStartOver={handleStartOver} />
          ) : (
            <YouTubePlayer
              video={selectedVideo}
              isPaused={showAttentionPopup}
              muted={isAutoMuted}
              startSeconds={selectedVideo ? resumeSecondsFor(history, selectedVideo.youtubeUrl) : 0}
              onProgress={saveVideoProgress}
              emptyText={
                isLoadingRecommended
                  ? recommendedSlow
                    ? WAKING_UP
                    : "Loading your recommended videos…"
                  : recommendedStatus === "error"
                    ? history.length > 0
                      ? "Recommendations are unavailable right now. Open the History tab to keep watching."
                      : "Couldn't load your videos. Use Retry in the list."
                    : undefined
              }
            />
          )}
          <QuickLinks className="mt-4" />
        </section>

        {isSearchMode ? (
          <VideoSidebar
            variant="search"
            title="Search Results"
            subtitle={sidebarSubtitle}
            videos={searchResults}
            selectedVideo={selectedVideo}
            onSelectVideo={handleSelectVideo}
            isLoading={isSearching}
            error={searchError}
            slowMessage={searchSlow ? WAKING_UP : undefined}
            onRetry={activeSearch ? () => handleSearch(activeSearch.query, activeSearch.subject) : undefined}
            className={SIDEBAR_CLASSES}
          />
        ) : sidebarTab === "history" ? (
          <VideoSidebar<HistoryEntry>
            variant="history"
            title="Watch History"
            subtitle="Videos you've opened, newest first"
            tabs={sidebarTabs}
            videos={history}
            selectedVideo={selectedVideo}
            onSelectVideo={handleSelectVideo}
            isLoading={!historyLoaded}
            error={null}
            getMeta={(entry) => (now > 0 ? `Watched ${formatWatchedAt(entry.watchedAt, now)}` : "")}
            onRemove={(entry) => removeFromHistory(entry.youtubeUrl)}
            getProgress={(entry) =>
              entry.finished
                ? { fraction: 1, label: "Watched" }
                : isUnfinished(entry)
                  ? {
                      fraction: Math.min(1, (entry.progressSeconds ?? 0) / (entry.durationSeconds ?? 1)),
                      label: `Continue from ${formatClockTime(entry.progressSeconds ?? 0)}`,
                    }
                  : null
            }
            className={SIDEBAR_CLASSES}
          />
        ) : (
          <VideoSidebar
            variant="recommended"
            tabs={sidebarTabs}
            videos={recommended}
            selectedVideo={selectedVideo}
            onSelectVideo={handleSelectVideo}
            isLoading={isLoadingRecommended}
            error={recommendedError}
            slowMessage={recommendedSlow ? WAKING_UP : undefined}
            onRetry={retryRecommendations}
            className={SIDEBAR_CLASSES}
          />
        )}
      </main>

      <CountdownTimer
        timeRemaining={timeRemaining}
        totalTime={CHECK_INTERVAL}
        isActive={isTimerActive && !showAttentionPopup}
      />

      <AttentionPopup
        isOpen={showAttentionPopup}
        check={attentionCheck}
        isLoading={isLoadingCheck}
        error={checkError}
        onAnswer={handleAnswer}
        onContinue={handleContinue}
      />
    </div>
  )
}
