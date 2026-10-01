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
