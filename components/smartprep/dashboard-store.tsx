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
import {
  addToHistory,
  clearProgress,
  historyStorageKey,
  readHistory,
  removeFromHistory,
  saveProgress,
  unfinishedEntries,
  writeHistory,
  type HistoryEntry,
  type ProgressUpdate,
} from "@/lib/video-history"

export const CHECK_INTERVAL = 15 * 60 // 15 minutes in seconds
const MIN_QUERY_LENGTH = 2
// Show the "waking up the server" note once a request has taken this long
const SLOW_AFTER_MS = 5_000
// Render's free plan can take a minute or two to wake up; give up (and offer Retry) after this
const REQUEST_TIMEOUT_MS = 150_000

type LoadStatus = "idle" | "loading" | "ready" | "error"

export type SidebarTab = "recommended" | "history"

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
  /** Videos this user opened, newest first. Comes only from localStorage, never from the backend. */
  history: HistoryEntry[]
  /** False until this user's history has been read from localStorage */
  historyLoaded: boolean
  sidebarTab: SidebarTab
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
    history: [],
    historyLoaded: false,
    sidebarTab: "recommended",
  }
}

interface DashboardStore {
  data: DashboardData
  setData: Dispatch<SetStateAction<DashboardData>>
  retryRecommendations: () => void
  search: (query: string, subject: SubjectFilter) => void
  /** Puts a video the user chose to watch at the top of their history */
  recordWatched: (video: VideoRecommendation) => void
  removeFromHistory: (youtubeUrl: string) => void
  clearHistory: () => void
  /** Saves playback progress into the video's history entry (in place, never reordered) */
  saveVideoProgress: (video: VideoRecommendation, update: ProgressUpdate) => void
  /** "Start over": forgets one video's saved position */
  startOver: (youtubeUrl: string) => void
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
        setData((d) => {
          if (d.ownerId !== id) return d
          // Auto-play the first recommendation only when nothing is selected and there's no half-watched
          // video to offer (then the Continue Watching screen shows instead)
          const history = d.historyLoaded ? d.history : readHistory(id)
          const autoPick =
            list.length > 0 && !d.selectedVideo && unfinishedEntries(history).length === 0 ? list[0] : null
          const selected = d.selectedVideo ?? autoPick
          return {
            ...d,
            recommended: list,
            recommendedStatus: "ready",
            recommendedSince: null,
            selectedVideo: selected,
            isTimerActive: list.length > 0 && selected ? true : d.isTimerActive,
          }
        })
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

  // ----- video history (localStorage only, per user) -----

  // Read after mount, never during render, so server and client HTML match
  useEffect(() => {
    if (data.ownerId === null || data.historyLoaded) return
    setData((d) => (d.ownerId === null || d.historyLoaded ? d : { ...d, history: readHistory(d.ownerId), historyLoaded: true }))
  }, [data.ownerId, data.historyLoaded])

  // Save every change. Skipped until loaded, so a user switch can't overwrite the new user's saved history.
  useEffect(() => {
    if (data.ownerId === null || !data.historyLoaded) return
    writeHistory(data.ownerId, data.history)
  }, [data.ownerId, data.historyLoaded, data.history])

  // Another tab changed this user's history: pick it up
  useEffect(() => {
    const ownerId = data.ownerId
    if (ownerId === null) return
    const key = historyStorageKey(ownerId)
    const onStorage = (e: StorageEvent) => {
      if (e.key !== key && e.key !== null) return
      setData((d) => (d.ownerId === ownerId ? { ...d, history: readHistory(ownerId), historyLoaded: true } : d))
    }
    window.addEventListener("storage", onStorage)
    return () => window.removeEventListener("storage", onStorage)
  }, [data.ownerId])

  const recordWatched = useCallback((video: VideoRecommendation) => {
    setData((d) => (d.historyLoaded ? { ...d, history: addToHistory(d.history, video) } : d))
  }, [])

  const removeHistoryEntry = useCallback((youtubeUrl: string) => {
    setData((d) => ({ ...d, history: removeFromHistory(d.history, youtubeUrl) }))
  }, [])

  const clearHistory = useCallback(() => {
    setData((d) => ({ ...d, history: [] }))
  }, [])

  // Latest data for saveVideoProgress, which can run while the page is closing (pagehide)
  const dataRef = useRef(data)
  useEffect(() => {
    dataRef.current = data
  })

  const saveVideoProgress = useCallback((video: VideoRecommendation, update: ProgressUpdate) => {
    const current = dataRef.current
    const ownerId = current.ownerId
    if (ownerId === null || !current.historyLoaded) return
    const next = saveProgress(current.history, video, update)
    if (next === current.history) return
    // Written right away as well: on pagehide the page may be gone before React's next effect runs
    writeHistory(ownerId, next)
    setData((d) => (d.ownerId === ownerId ? { ...d, history: saveProgress(d.history, video, update) } : d))
  }, [])

  const startOver = useCallback((youtubeUrl: string) => {
    setData((d) => ({ ...d, history: clearProgress(d.history, youtubeUrl) }))
  }, [])

  // No abort-on-unmount here: this provider lives as long as the page, and in development StrictMode's
  // simulated unmount would cancel the one-time recommendations request and leave it loading forever.

  const value = useMemo<DashboardStore>(
    () => ({
      data,
      setData,
      retryRecommendations,
      search,
      recordWatched,
      removeFromHistory: removeHistoryEntry,
      clearHistory,
      saveVideoProgress,
      startOver,
    }),
    [data, retryRecommendations, search, recordWatched, removeHistoryEntry, clearHistory, saveVideoProgress, startOver]
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
