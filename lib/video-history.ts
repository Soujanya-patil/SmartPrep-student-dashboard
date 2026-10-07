import type { VideoRecommendation } from "./types"
import { getYouTubeId } from "./youtube"

/** Videos the user opened, newest first. Stored per user in localStorage only: no backend involved. */
export interface HistoryEntry extends VideoRecommendation {
  /** When the video was last opened (epoch ms) */
  watchedAt: number
}

export const HISTORY_LIMIT = 50

export function historyStorageKey(userId: number): string {
  return `smartprep_video_history_${userId}`
}

// Same video under different URL shapes (watch?v=, embed/, youtu.be) counts once
function videoKey(url: string): string {
  return getYouTubeId(url) ?? url
}

function isHistoryEntry(v: unknown): v is HistoryEntry {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return (
    typeof o.youtubeUrl === "string" &&
    o.youtubeUrl !== "" &&
    typeof o.videoTitle === "string" &&
    typeof o.channel === "string" &&
    typeof o.subject === "string" &&
    typeof o.chapter === "string" &&
    typeof o.watchedAt === "number" &&
    (o.thumbnail === undefined || typeof o.thumbnail === "string")
  )
}

/** Reads a user's history; anything unreadable (bad JSON, blocked storage) is treated as empty */
export function readHistory(userId: number): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(historyStorageKey(userId))
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isHistoryEntry).slice(0, HISTORY_LIMIT)
  } catch {
    return []
  }
}

export function writeHistory(userId: number, entries: HistoryEntry[]): void {
  try {
    window.localStorage.setItem(historyStorageKey(userId), JSON.stringify(entries.slice(0, HISTORY_LIMIT)))
  } catch {
    // Storage full or blocked: history just won't persist this time
  }
}

/** Moves (or adds) a video to the top of the history */
export function addToHistory(entries: HistoryEntry[], video: VideoRecommendation, now = Date.now()): HistoryEntry[] {
  const key = videoKey(video.youtubeUrl)
  const entry: HistoryEntry = {
    subject: video.subject,
    chapter: video.chapter,
    videoTitle: video.videoTitle,
    channel: video.channel,
    youtubeUrl: video.youtubeUrl,
    ...(video.thumbnail ? { thumbnail: video.thumbnail } : {}),
    watchedAt: now,
  }
  return [entry, ...entries.filter((e) => videoKey(e.youtubeUrl) !== key)].slice(0, HISTORY_LIMIT)
}

export function removeFromHistory(entries: HistoryEntry[], youtubeUrl: string): HistoryEntry[] {
  const key = videoKey(youtubeUrl)
  return entries.filter((e) => videoKey(e.youtubeUrl) !== key)
}

const relativeFormat = new Intl.RelativeTimeFormat("en", { numeric: "auto" })

/** "just now", "5 minutes ago", "yesterday", "3 weeks ago"… */
export function formatWatchedAt(watchedAt: number, now: number): string {
  const seconds = Math.round((watchedAt - now) / 1000)
  const abs = Math.abs(seconds)
  if (abs < 45) return "just now"
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), "minute")
  if (abs < 86_400) return relativeFormat.format(Math.round(seconds / 3600), "hour")
  if (abs < 7 * 86_400) return relativeFormat.format(Math.round(seconds / 86_400), "day")
  if (abs < 30 * 86_400) return relativeFormat.format(Math.round(seconds / (7 * 86_400)), "week")
  if (abs < 365 * 86_400) return relativeFormat.format(Math.round(seconds / (30 * 86_400)), "month")
  return relativeFormat.format(Math.round(seconds / (365 * 86_400)), "year")
}
