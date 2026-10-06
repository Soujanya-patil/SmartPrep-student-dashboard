"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react"
import { ApiError, fetchRecommendations, searchVideos } from "@/lib/api"
import { useSession } from "@/lib/auth"
import type { SubjectFilter, VideoRecommendation, VideoSearchParams } from "@/lib/types"

export const CHECK_INTERVAL = 15 * 60 // 15 minutes in seconds
const MIN_QUERY_LENGTH = 2
// Show the "waking up the server" note once a request has taken this long
const SLOW_AFTER_MS = 5_000
// Render's free plan can take a minute or two to wake up; give up (and offer Retry) after this
const REQUEST_TIMEOUT_MS = 150_000

type LoadStatus = "idle" | "loading" | "ready" | "error"

/**
 * Dashboard state that must survive navigating to another page and back.
 * It lives in the root layout, so leaving "/" unmounts the dashboard but not this.
 */
export interface DashboardData {
  /** The user this data belongs to; everything resets when a different user logs in */
  ownerId: number | null
  recommended: VideoRecommendation[]
  recommendedStatus: LoadStatus
  recommendedError: string | null
  /** When the current recommendations request started (epoch ms), for the "slow server" note */
  recommendedSince: number | null
  /** null means the sidebar shows recommendations */
  activeSearch: VideoSearchParams | null
  searchResults: VideoRecommendation[]
  isSearching: boolean
  searchError: string | null
  searchSince: number | null
  selectedVideo: VideoRecommendation | null
  isAutoMuted: boolean
  /** Attention-check countdown; it only ticks while the dashboard is on screen */
  timeRemaining: number
  isTimerActive: boolean
}

function initialData(ownerId: number | null): DashboardData {
  return {
    ownerId,
    recommended: [],
    recommendedStatus: "idle",
    recommendedError: null,
    recommendedSince: null,
    activeSearch: null,
    searchResults: [],
    isSearching: false,
    searchError: null,
    searchSince: null,
    selectedVideo: null,
    // Browsers block autoplay with sound until the user interacts, so the first auto-play is muted
    isAutoMuted: true,
    timeRemaining: CHECK_INTERVAL,
    isTimerActive: false,
  }
}

interface DashboardStore {
  data: DashboardData
  setData: Dispatch<SetStateAction<DashboardData>>
  retryRecommendations: () => void
  search: (query: string, subject: SubjectFilter) => void
}

const DashboardStoreContext = createContext<DashboardStore | null>(null)

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof ApiError ? `${fallback} ${err.message}` : fallback
}

/** Aborts after REQUEST_TIMEOUT_MS; `timedOut()` tells a timeout apart from a deliberate cancel */
function withTimeout(controller: AbortController): { timedOut: () => boolean; clear: () => void } {
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, REQUEST_TIMEOUT_MS)
  return { timedOut: () => timedOut, clear: () => clearTimeout(timer) }
}

const TIMEOUT_MESSAGE = "The server took too long to respond. It may still be waking up, so please try again."

export function DashboardStoreProvider({ children }: { children: ReactNode }) {
  const session = useSession()
  const userId = session.status === "valid" ? session.user.userId : null

  const [data, setData] = useState<DashboardData>(() => initialData(null))
  const recommendAbortRef = useRef<AbortController | null>(null)
  const searchAbortRef = useRef<AbortController | null>(null)
  // The user whose recommendations were last requested, so they load once, not on every visit to "/"
  const requestedForRef = useRef<number | null>(null)

  const loadRecommendations = useCallback((id: number) => {
    recommendAbortRef.current?.abort()
    const controller = new AbortController()
    recommendAbortRef.current = controller
    const timeout = withTimeout(controller)
    setData((d) => ({ ...d, recommendedStatus: "loading", recommendedError: null, recommendedSince: Date.now() }))

    fetchRecommendations(id, controller.signal)
      .then((list) => {
        if (recommendAbortRef.current !== controller) return
        setData((d) =>
          d.ownerId !== id
            ? d
            : {
                ...d,
                recommended: list,
                recommendedStatus: "ready",
                recommendedSince: null,
                // Auto-play the first recommendation, unless a video is already selected
                selectedVideo: list.length > 0 ? (d.selectedVideo ?? list[0]) : d.selectedVideo,
                isTimerActive: list.length > 0 ? true : d.isTimerActive,
              }
        )
      })
      .catch((err: unknown) => {
        if (recommendAbortRef.current !== controller) return
        if (controller.signal.aborted && !timeout.timedOut()) return
        console.error(err)
        setData((d) =>
          d.ownerId !== id
            ? d
            : {
                ...d,
                recommendedStatus: "error",
                recommendedSince: null,
                recommendedError: timeout.timedOut()
                  ? TIMEOUT_MESSAGE
                  : errorMessage(err, "Unable to load video recommendations."),
              }
        )
      })
      .finally(timeout.clear)
  }, [])

  // A different user (or a logout) starts from a clean slate; the same user keeps everything
  useEffect(() => {
    if (data.ownerId === userId) return
    recommendAbortRef.current?.abort()
    searchAbortRef.current?.abort()
    recommendAbortRef.current = null
    searchAbortRef.current = null
    requestedForRef.current = null
    setData(initialData(userId))
  }, [userId, data.ownerId])

  // Load recommendations once per user. Navigation doesn't cancel the request.
  useEffect(() => {
    if (userId === null || data.ownerId !== userId || requestedForRef.current === userId) return
    requestedForRef.current = userId
    loadRecommendations(userId)
  }, [userId, data.ownerId, loadRecommendations])

  const retryRecommendations = useCallback(() => {
    if (userId !== null) loadRecommendations(userId)
  }, [userId, loadRecommendations])

  const search = useCallback((query: string, subject: SubjectFilter) => {
    searchAbortRef.current?.abort()

    // Cleared or too short: fall back to recommendations
    if (query.length < MIN_QUERY_LENGTH) {
      searchAbortRef.current = null
      setData((d) => ({ ...d, activeSearch: null, searchResults: [], searchError: null, isSearching: false, searchSince: null }))
      return
    }

    const controller = new AbortController()
    searchAbortRef.current = controller
    const timeout = withTimeout(controller)
    setData((d) => ({ ...d, activeSearch: { query, subject }, isSearching: true, searchError: null, searchSince: Date.now() }))

    searchVideos({ query, subject }, controller.signal)
      .then((results) => {
        if (searchAbortRef.current !== controller) return
        setData((d) => ({ ...d, searchResults: results, isSearching: false, searchSince: null }))
      })
      .catch((err: unknown) => {
        if (searchAbortRef.current !== controller) return
        if (controller.signal.aborted && !timeout.timedOut()) return
        console.error(err)
        setData((d) => ({
          ...d,
          searchResults: [],
          isSearching: false,
          searchSince: null,
          searchError: timeout.timedOut() ? TIMEOUT_MESSAGE : errorMessage(err, "Search failed."),
        }))
      })
      .finally(timeout.clear)
  }, [])

  // No abort-on-unmount here: this provider lives as long as the page, and in development StrictMode's
  // simulated unmount would cancel the one-time recommendations request and leave it loading forever.

  const value = useMemo<DashboardStore>(
    () => ({ data, setData, retryRecommendations, search }),
    [data, retryRecommendations, search]
  )

  return <DashboardStoreContext.Provider value={value}>{children}</DashboardStoreContext.Provider>
}

export function useDashboardStore(): DashboardStore {
  const store = useContext(DashboardStoreContext)
  if (!store) throw new Error("useDashboardStore must be used inside <DashboardStoreProvider>")
  return store
}

/** Like useState, but the value lives in the dashboard store and survives navigation */
export function useDashboardField<K extends keyof DashboardData>(
  key: K
): [DashboardData[K], Dispatch<SetStateAction<DashboardData[K]>>] {
  const { data, setData } = useDashboardStore()
  const setField = useCallback<Dispatch<SetStateAction<DashboardData[K]>>>(
    (action) =>
      setData((d) => ({
        ...d,
        [key]: typeof action === "function" ? (action as (prev: DashboardData[K]) => DashboardData[K])(d[key]) : action,
      })),
    [key, setData]
  )
  return [data[key], setField]
}

/** True once a request that started at `since` has been running for SLOW_AFTER_MS */
export function useIsSlow(since: number | null): boolean {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (since === null) {
      setSlow(false)
      return
    }
    const remaining = since + SLOW_AFTER_MS - Date.now()
    if (remaining <= 0) {
      setSlow(true)
      return
    }
    setSlow(false)
    const timer = setTimeout(() => setSlow(true), remaining)
    return () => clearTimeout(timer)
  }, [since])
  return slow
}
