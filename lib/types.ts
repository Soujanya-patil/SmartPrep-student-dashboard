export interface VideoRecommendation {
  subject: string
  chapter: string
  videoTitle: string
  channel: string
  youtubeUrl: string
  thumbnail?: string
}

export interface AttentionCheck {
  question: string
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctOption: 'A' | 'B' | 'C' | 'D'
  encouragement: string
  hint: string
}

export const SUBJECT_FILTERS = ['All', 'Physics', 'Chemistry', 'Maths', 'Biology'] as const

export type SubjectFilter = (typeof SUBJECT_FILTERS)[number]

export interface VideoSearchParams {
  query: string
  subject: SubjectFilter
}

// ---------- Pomodoro / study log ----------

export const STUDY_DURATIONS = [15, 25, 45] as const

export type StudyDuration = (typeof STUDY_DURATIONS)[number]

export type PomodoroPhase = 'study' | 'break'

export type PomodoroStatus = 'idle' | 'running' | 'paused'

export interface PomodoroState {
  phase: PomodoroPhase
  status: PomodoroStatus
  studyMinutes: StudyDuration
  /** Epoch ms when the current phase ends; set only while running */
  endsAt: number | null
  /** Time left in the current phase; authoritative while idle or paused */
  remainingMs: number
}

export type StudySessionType = 'STUDY' | 'BREAK'

export interface StudySessionPayload {
  userId: number
  subject: string
  chapter: string
  durationMinutes: number
  sessionType: StudySessionType
}

export interface TodayStudyStats {
  totalMinutes: number
  sessionCount: number
}

export interface DailyStudyMinutes {
  /** yyyy-MM-dd */
  date: string
  minutes: number
}
