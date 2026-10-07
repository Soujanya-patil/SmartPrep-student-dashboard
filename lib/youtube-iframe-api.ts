// Minimal types for the YouTube IFrame Player API (https://developers.google.com/youtube/iframe_api_reference),
// loaded from YouTube's own script: no npm package.

export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
} as const

export interface YTPlayer {
  playVideo(): void
  pauseVideo(): void
  seekTo(seconds: number, allowSeekAhead: boolean): void
  mute(): void
  unMute(): void
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  destroy(): void
}

export interface YTPlayerOptions {
  videoId: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: { target: YTPlayer }) => void
    onStateChange?: (event: { data: number; target: YTPlayer }) => void
    /** 2 bad id, 5 HTML5 error, 100 not found / private, 101 and 150 embedding not allowed */
    onError?: (event: { data: number; target: YTPlayer }) => void
  }
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

const SCRIPT_SRC = "https://www.youtube.com/iframe_api"
let apiPromise: Promise<YTNamespace> | null = null

/** Loads YouTube's IFrame API once; every caller shares the same promise */
export function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    // YouTube calls this global when its script is ready; keep any handler that was already there
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      if (window.YT?.Player) resolve(window.YT)
      else reject(new Error("YouTube IFrame API loaded without a Player"))
    }

    if (!document.querySelector(`script[src="${SCRIPT_SRC}"]`)) {
      const script = document.createElement("script")
      script.src = SCRIPT_SRC
      script.async = true
      script.onerror = () => {
        apiPromise = null // allow a later retry
        script.remove()
        reject(new Error("Couldn't load the YouTube player"))
      }
      document.head.appendChild(script)
    }
  })
  return apiPromise
}
