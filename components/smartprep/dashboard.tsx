"use client"

import { useState, useEffect, useCallback } from "react"
import { Header } from "./header"
import { VideoSidebar } from "./video-sidebar"
import { YouTubePlayer } from "./youtube-player"
import { CountdownTimer } from "./countdown-timer"
import { AttentionPopup } from "./attention-popup"
import type { VideoRecommendation, AttentionCheck } from "@/lib/types"

const API_BASE_URL = "http://localhost:8081/api"
const USER_ID = 1
const CHECK_INTERVAL = 15 * 60

export function Dashboard() {
  const [videos, setVideos] = useState<VideoRecommendation[]>([])
  const [selectedVideo, setSelectedVideo] = useState<VideoRecommendation | null>(null)
  const [isLoadingVideos, setIsLoadingVideos] = useState(true)
  const [videoError, setVideoError] = useState<string | null>(null)
  const [timeRemaining, setTimeRemaining] = useState(CHECK_INTERVAL)
  const [isTimerActive, setIsTimerActive] = useState(false)
  const [showAttentionPopup, setShowAttentionPopup] = useState(false)
  const [attentionCheck, setAttentionCheck] = useState<AttentionCheck | null>(null)
  const [isLoadingCheck, setIsLoadingCheck] = useState(false)
  const [checkError, setCheckError] = useState<string | null>(null)

  useEffect(() => {
    async function loadRecommendations() {
      setIsLoadingVideos(true)
      setVideoError(null)
      try {
        const response = await fetch(`${API_BASE_URL}/videos/recommend/${USER_ID}`)
        if (!response.ok) throw new Error(`Server error: ${response.status}`)
        const text = await response.text()
        const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
        const data = JSON.parse(cleaned)
        setVideos(data)
      } catch (error) {
        console.error("API Error:", error)
        setVideoError("Unable to load recommendations: " + error)
      } finally {
        setIsLoadingVideos(false)
      }
    }
    loadRecommendations()
  }, [])

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
  }, [isTimerActive, showAttentionPopup])

  const triggerAttentionCheck = useCallback(async () => {
    setShowAttentionPopup(true)
    setIsLoadingCheck(true)
    setCheckError(null)
    try {
      const params = new URLSearchParams({
        subject: selectedVideo?.subject || "",
        chapter: selectedVideo?.chapter || ""
      })
      const response = await fetch(`${API_BASE_URL}/videos/attention-check?${params}`)
      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      const text = await response.text()
      const cleaned = text.replace(/```json/g, '').replace(/```/g, '').trim()
      const data = JSON.parse(cleaned)
      setAttentionCheck(data)
    } catch (error) {
      console.error("Attention check error:", error)
      setCheckError("Unable to load the attention check question.")
    } finally {
      setIsLoadingCheck(false)
    }
  }, [selectedVideo])

  // ✅ handleSearch is now INSIDE the component
  const handleSearch = async (subject: string, chapter: string) => {
    setIsLoadingVideos(true)
    setVideoError(null)
    try {
      const response = await fetch(
        `${API_BASE_URL}/videos/search?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}`
      )
      if (!response.ok) throw new Error(`Server error: ${response.status}`)
      const data = await response.json()
      setVideos(data)
    } catch (error) {
      console.error("Search error:", error)
      setVideoError("Search failed. Please try again!")
    } finally {
      setIsLoadingVideos(false)
    }
  }

  const handleSelectVideo = (video: VideoRecommendation) => {
    setSelectedVideo(video)
    setTimeRemaining(CHECK_INTERVAL)
    setIsTimerActive(true)
  }

  const handleAnswer = () => {}

  const handleContinue = () => {
    setShowAttentionPopup(false)
    setAttentionCheck(null)
    setTimeRemaining(CHECK_INTERVAL)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />
      <main className="flex-1 flex flex-col lg:flex-row pb-16">
        <VideoSidebar
          videos={videos}
          selectedVideo={selectedVideo}
          onSelectVideo={handleSelectVideo}
          isLoading={isLoadingVideos}
          error={videoError}
          onSearch={handleSearch}
        />
        <YouTubePlayer
          video={selectedVideo}
          isPaused={showAttentionPopup}
        />
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