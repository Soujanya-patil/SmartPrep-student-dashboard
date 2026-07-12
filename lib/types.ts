export interface VideoRecommendation {
  subject: string
  chapter: string
  videoTitle: string
  channel: string
  youtubeUrl: string
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
