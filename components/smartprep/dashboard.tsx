"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Header } from "./header"
import { SearchBar } from "./search-bar"
import { VideoSidebar } from "./video-sidebar"
import { YouTubePlayer } from "./youtube-player"
import { CountdownTimer } from "./countdown-timer"
import { AttentionPopup } from "./attention-popup"
import { QuickLinks } from "./quick-links"
import { ApiError, fetchAttentionCheck, fetchRecommendations, searchVideos } from "@/lib/api"
import type { VideoRecommendation, AttentionCheck, VideoSearchParams, SubjectFilter } from "@/lib/types"

const USER_ID = 1
const CHECK_INTERVAL = 15 * 60 // 15 minutes in seconds
const MIN_QUERY_LENGTH = 2
// Desktop: fixed-width right column that scrolls on its own; height leaves room for header, search bar and the fixed timer
const SIDEBAR_CLASSES = "lg:w-96 lg:shrink-0 lg:sticky lg:top-4 lg:h-[calc(100dvh-15.5rem)]"

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? `${fallback} ${err.message}` : fallback
}

export function Dashboard() {
  // Recommended videos state
  const [recommended, setRecommended] = useState<VideoRecommendation[]>([])
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(true)
  const [recommendedError, setRecommendedError] = useState<string | null>(null)

  // Search state (activeSearch === null means the sidebar shows recommendations)
  const [activeSearch, setActiveSearch] = useState<VideoSearchParams | null>(null)
  const [searchResults, setSearchResults] = useState<VideoRecommendation[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)

  // Player state
  const [selectedVideo, setSelectedVideo] = useState<VideoRecommendation | null>(null)
  // Browsers block autoplay with sound until the user interacts, so the first auto-play is muted
  const [isAutoMuted, setIsAutoMuted] = useState(true)

  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(CHECK_INTERVAL)
  const [isTimerActive, setIsTimerActive] = useState(false)

  // Attention check state
  const [showAttentionPopup, setShowAttentionPopup] = useState(false)
  const [attentionCheck, setAttentionCheck] = useState<AttentionCheck | null>(null)
  const [isLoadingCheck, setIsLoadingCheck] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  const playerRef = useRef<HTMLElement | null>(null)

  // Handle video selection
  const handleSelectVideo = useCallback((video: VideoRecommendation) => {
    setIsAutoMuted(false)
    setSelectedVideo(video)
    setTimeRemaining(CHECK_INTERVAL)
    setIsTimerActive(true)

    // Bring the player into view (the list sits below it on mobile/tablet)
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    playerRef.current?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" })
  }, [])

  // Load video recommendations
  useEffect(() => {
    const controller = new AbortController()

    async function loadRecommendations() {
      setIsLoadingRecommended(true)
      setRecommendedError(null)

      try {
        const list = await fetchRecommendations(USER_ID, controller.signal)
        setRecommended(list)
        // Auto-play the first recommendation
        if (list.length > 0) {
          setSelectedVideo((current) => current ?? list[0])
          setIsTimerActive(true)
        }
      } catch (err) {
        if (controller.signal.aborted) return
        console.error(err)
        setRecommendedError(errorMessage(err, "Unable to load video recommendations."))
      } finally {
        if (!controller.signal.aborted) setIsLoadingRecommended(false)
      }
    }

    loadRecommendations()
    return () => controller.abort()
  }, [])

  // Search (called by SearchBar after its 400ms debounce)
  const handleSearch = useCallback(async (query: string, subject: SubjectFilter) => {
    searchAbortRef.current?.abort()

    // Cleared or too short: fall back to recommendations
    if (query.length < MIN_QUERY_LENGTH) {
      searchAbortRef.current = null
      setActiveSearch(null)
      setSearchResults([])
      setSearchError(null)
      setIsSearching(false)
      return
    }

    const controller = new AbortController()
    searchAbortRef.current = controller
    setActiveSearch({ query, subject })
    setIsSearching(true)
    setSearchError(null)

    try {
      const results = await searchVideos({ query, subject }, controller.signal)
      setSearchResults(results)
    } catch (err) {
      if (controller.signal.aborted) return
      console.error(err)
      setSearchResults([])
      setSearchError(errorMessage(err, "Search failed."))
    } finally {
      if (searchAbortRef.current === controller) setIsSearching(false)
    }
  }, [])

  // Cancel any in-flight search on unmount
  useEffect(() => () => searchAbortRef.current?.abort(), [])

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
  }, [isTimerActive, showAttentionPopup, triggerAttentionCheck])

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

  // What the sidebar shows: search results while searching, otherwise recommendations
  const isSearchMode = activeSearch !== null
  const sidebarSubtitle = activeSearch
    ? `"${activeSearch.query}" in ${activeSearch.subject === "All" ? "all subjects" : activeSearch.subject}`
    : undefined

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <div className="border-b border-border bg-card/30 px-4 py-3">
        <div className="max-w-screen-2xl mx-auto">
          <SearchBar onSearch={handleSearch} isSearching={isSearching} />
        </div>
      </div>

      <main className="flex-1 w-full max-w-screen-2xl mx-auto px-3 sm:px-4 pt-4 pb-28 flex flex-col lg:flex-row lg:items-start gap-4">
        {/* Player first in the DOM so it is always on top on mobile/tablet; sticky beside the list on desktop */}
        <section
          ref={playerRef}
          aria-label="Video player and study timer"
          className="w-full min-w-0 lg:flex-1 lg:sticky lg:top-4 scroll-mt-4"
        >
          <YouTubePlayer
            video={selectedVideo}
            isPaused={showAttentionPopup}
            muted={isAutoMuted}
          />
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
            className={SIDEBAR_CLASSES}
          />
        ) : (
          <VideoSidebar
            variant="recommended"
            videos={recommended}
            selectedVideo={selectedVideo}
            onSelectVideo={handleSelectVideo}
            isLoading={isLoadingRecommended}
            error={recommendedError}
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
