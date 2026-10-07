import type { VideoRecommendation } from "./types"
import { getYouTubeId } from "./youtube"

/** Videos the user opened, newest first. Stored per user in localStorage only: no backend involved. */
export interface HistoryEntry extends VideoRecommendation {
  /** When the video was last opened (epoch ms) */
  watchedAt: number
  /** How far she got, in seconds (only saved once she has watched at least MIN_PROGRESS_SECONDS) */
  progressSeconds?: number
  durationSeconds?: number
  /** Watched to the end (or past FINISHED_FRACTION): never offered for continuing */
  finished?: boolean
}

export const HISTORY_LIMIT = 50
/** Progress below this isn't saved, so a quick peek at a video doesn't count */
export const MIN_PROGRESS_SECONDS = 10
/** Watching this much of a video counts as finished */
export const FINISHED_FRACTION = 0.95
/** Resuming starts this many seconds before the saved position, so she can re-find her place */
const RESUME_REWIND_SECONDS = 3

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
    (o.thumbnail === undefined || typeof o.thumbnail === "string") &&
    (o.progressSeconds === undefined || (typeof o.progressSeconds === "number" && o.progressSeconds >= 0)) &&
    (o.durationSeconds === undefined || (typeof o.durationSeconds === "number" && o.durationSeconds >= 0)) &&
    (o.finished === undefined || typeof o.finished === "boolean")
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

/** Moves (or adds) a video to the top of the history, keeping any saved progress */
export function addToHistory(entries: HistoryEntry[], video: VideoRecommendation, now = Date.now()): HistoryEntry[] {
  const key = videoKey(video.youtubeUrl)
  const existing = entries.find((e) => videoKey(e.youtubeUrl) === key)
  const entry: HistoryEntry = {
    subject: video.subject,
    chapter: video.chapter,
    videoTitle: video.videoTitle,
    channel: video.channel,
    youtubeUrl: video.youtubeUrl,
    ...(video.thumbnail ? { thumbnail: video.thumbnail } : {}),
    ...(existing?.progressSeconds !== undefined ? { progressSeconds: existing.progressSeconds } : {}),
    ...(existing?.durationSeconds !== undefined ? { durationSeconds: existing.durationSeconds } : {}),
    ...(existing?.finished !== undefined ? { finished: existing.finished } : {}),
    watchedAt: now,
  }
  return [entry, ...entries.filter((e) => videoKey(e.youtubeUrl) !== key)].slice(0, HISTORY_LIMIT)
}

export function removeFromHistory(entries: HistoryEntry[], youtubeUrl: string): HistoryEntry[] {
  const key = videoKey(youtubeUrl)
  return entries.filter((e) => videoKey(e.youtubeUrl) !== key)
}

// ---------- progress (Continue Watching) ----------

export interface ProgressUpdate {
  currentSeconds: number
  durationSeconds: number
  /** The player reported the end of the video */
  ended: boolean
}

/**
 * Saves playback progress into the video's entry, in place: the list is never reordered and
 * never gets a second entry for the same video. Returns `entries` unchanged when there's nothing to save.
 * A video that isn't in the history yet (the auto-played recommendation) is added once, at the top.
 */
export function saveProgress(entries: HistoryEntry[], video: VideoRecommendation, update: ProgressUpdate): HistoryEntry[] {
  const { currentSeconds, durationSeconds, ended } = update
  if (!Number.isFinite(currentSeconds) || !Number.isFinite(durationSeconds)) return entries
  const finished = ended || (durationSeconds > 0 && currentSeconds >= durationSeconds * FINISHED_FRACTION)
  if (!finished && currentSeconds < MIN_PROGRESS_SECONDS) return entries

  const key = videoKey(video.youtubeUrl)
  const index = entries.findIndex((e) => videoKey(e.youtubeUrl) === key)
  const base = index === -1 ? addToHistory(entries, video) : entries
  const at = index === -1 ? 0 : index
  const old = base[at]
  const next: HistoryEntry = {
    ...old,
    progressSeconds: Math.round(finished ? durationSeconds || currentSeconds : currentSeconds),
    durationSeconds: Math.round(durationSeconds),
    finished,
  }
  if (
    old.progressSeconds === next.progressSeconds &&
    old.durationSeconds === next.durationSeconds &&
    old.finished === next.finished
  ) {
    return base
  }
  const copy = base.slice()
  copy[at] = next
  return copy
}

/** "Start over": forget the saved position for one video */
export function clearProgress(entries: HistoryEntry[], youtubeUrl: string): HistoryEntry[] {
  const key = videoKey(youtubeUrl)
  return entries.map((e) => {
    if (videoKey(e.youtubeUrl) !== key) return e
    const { progressSeconds: _p, durationSeconds: _d, finished: _f, ...rest } = e
    return rest
  })
}

export function isUnfinished(entry: HistoryEntry): boolean {
  return (
    !entry.finished &&
    (entry.progressSeconds ?? 0) >= MIN_PROGRESS_SECONDS &&
    (entry.durationSeconds ?? 0) > 0
  )
}

/** Unfinished videos, most recently opened first (history order) */
export function unfinishedEntries(entries: HistoryEntry[]): HistoryEntry[] {
  return entries.filter(isUnfinished)
}

/** Where to start a video: its saved position minus a few seconds, or 0 */
export function resumeSecondsFor(entries: HistoryEntry[], youtubeUrl: string): number {
  const key = videoKey(youtubeUrl)
  const entry = entries.find((e) => videoKey(e.youtubeUrl) === key)
  if (!entry || !isUnfinished(entry)) return 0
  return Math.max(0, (entry.progressSeconds ?? 0) - RESUME_REWIND_SECONDS)
}

/** 750 -> "12:30", 3725 -> "1:02:05" */
export function formatClockTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, "0")
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`
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
