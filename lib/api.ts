import type {
  AttentionCheck,
  StudySessionPayload,
  SubjectFilter,
  TodayStudyStats,
  VideoRecommendation,
  VideoSearchParams,
} from "./types"

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8081/api"

// Controller prefix on the Spring Boot side (@RequestMapping("/api/video"))
const VIDEO_PATH = "/video"
// Pomodoro study sessions (StudyLogController, "/api/studylog/...")
const STUDYLOG_PATH = "/studylog"

export class ApiError extends Error {
  status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = "ApiError"
    this.status = status
  }
}

// Video payload as the backend may send it (supports videoTitle/youtubeUrl and title/videoUrl)
type RawVideo = Partial<
  Record<
    "subject" | "chapter" | "videoTitle" | "title" | "channel" | "youtubeUrl" | "videoUrl" | "thumbnail",
    string | null
  >
>

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(path, { signal, headers: { Accept: "application/json" } })
}

async function postJson<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  return requestJson<T>(path, {
    method: "POST",
    signal,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const signal = init.signal
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, init)
  } catch (err) {
    // Let aborts propagate untouched so callers can ignore them
    if (signal?.aborted) throw err
    throw new ApiError("Cannot reach the SmartPrep server. Is the backend running on port 8081?")
  }

  if (!response.ok) {
    throw new ApiError(`Request failed (HTTP ${response.status})`, response.status)
  }
  return (await response.json()) as T
}

function normalizeVideo(raw: RawVideo, fallbackSubject = "General"): VideoRecommendation {
  return {
    subject: raw.subject || fallbackSubject,
    chapter: raw.chapter ?? "",
    videoTitle: raw.videoTitle ?? raw.title ?? "",
    channel: raw.channel ?? "",
    youtubeUrl: raw.youtubeUrl ?? raw.videoUrl ?? "",
    thumbnail: raw.thumbnail ?? undefined,
  }
}

function normalizeList(data: RawVideo[], fallbackSubject?: string): VideoRecommendation[] {
  return data
    .map((raw) => normalizeVideo(raw, fallbackSubject))
    .filter((video) => video.youtubeUrl !== "")
}

export async function fetchRecommendations(
  userId: number,
  signal?: AbortSignal
): Promise<VideoRecommendation[]> {
  const data = await getJson<RawVideo[]>(`${VIDEO_PATH}/recommend/${userId}`, signal)
  return normalizeList(data)
}

export async function searchVideos(
  { query, subject }: VideoSearchParams,
  signal?: AbortSignal
): Promise<VideoRecommendation[]> {
  const params = new URLSearchParams({
    subject: subject === "All" ? "" : subject,
    chapter: query,
  })
  const data = await getJson<RawVideo[]>(`${VIDEO_PATH}/search?${params}`, signal)
  return normalizeList(data, subject === "All" ? "General" : subject)
}

export async function fetchAttentionCheck(
  subject: string,
  chapter: string,
  signal?: AbortSignal
): Promise<AttentionCheck> {
  const params = new URLSearchParams({ subject, chapter })
  return getJson<AttentionCheck>(`${VIDEO_PATH}/attention-check?${params}`, signal)
}

export async function suggestTopics(
  query: string,
  subject: SubjectFilter,
  signal?: AbortSignal
): Promise<string[]> {
  const params = new URLSearchParams({
    q: query,
    subject: subject === "All" ? "" : subject,
  })
  return getJson<string[]>(`${VIDEO_PATH}/suggest?${params}`, signal)
}

export async function saveStudySession(payload: StudySessionPayload, signal?: AbortSignal): Promise<void> {
  await postJson<unknown>(`${STUDYLOG_PATH}/save`, payload, signal)
}

export async function fetchTodayStudyStats(userId: number, signal?: AbortSignal): Promise<TodayStudyStats> {
  return getJson<TodayStudyStats>(`${STUDYLOG_PATH}/today/${userId}`, signal)
}
