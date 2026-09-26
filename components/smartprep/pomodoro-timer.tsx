"use client"

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import { BookOpen, Coffee, Pause, Play, RotateCcw, Square } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { fetchTodayStudyStats, fetchWeekStudyMinutes, saveStudySession } from "@/lib/api"
import { cn } from "@/lib/utils"
import {
  STUDY_DURATIONS,
  type DailyStudyMinutes,
  type PomodoroState,
  type StudyDuration,
  type StudySessionPayload,
  type TodayStudyStats,
} from "@/lib/types"

const BREAK_MINUTES = 5
const DEFAULT_STUDY_MINUTES: StudyDuration = 25
const MINUTE_MS = 60_000
const STORAGE_KEY = "smartprep.pomodoro.v1"

interface PomodoroTimerProps {
  userId: number
  /** Subject/chapter of the video being watched, saved with the session */
  subject?: string
  chapter?: string
  className?: string
}

interface StopPrompt {
  minutes: number
  wasRunning: boolean
}

// ---------- pure helpers ----------

function idleState(studyMinutes: StudyDuration): PomodoroState {
  return { phase: "study", status: "idle", studyMinutes, endsAt: null, remainingMs: studyMinutes * MINUTE_MS }
}

function phaseTotalMs(state: PomodoroState): number {
  return (state.phase === "study" ? state.studyMinutes : BREAK_MINUTES) * MINUTE_MS
}

function remainingMsAt(state: PomodoroState, now: number): number {
  if (state.status === "running" && state.endsAt !== null) return Math.max(0, state.endsAt - now)
  return state.remainingMs
}

function isStudyDuration(value: number): value is StudyDuration {
  return (STUDY_DURATIONS as readonly number[]).includes(value)
}

function isPomodoroState(value: unknown): value is PomodoroState {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.phase === "study" || v.phase === "break") &&
    (v.status === "idle" || v.status === "running" || v.status === "paused") &&
    typeof v.studyMinutes === "number" &&
    isStudyDuration(v.studyMinutes) &&
    (v.endsAt === null || typeof v.endsAt === "number") &&
    typeof v.remainingMs === "number" &&
    !(v.status === "running" && v.endsAt === null)
  )
}

function loadStoredState(): PomodoroState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isPomodoroState(parsed) ? parsed : null
  } catch {
    return null
  }
}

function storeState(state: PomodoroState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Storage can be unavailable (private mode, blocked); the timer still works for this tab
  }
}

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

function formatStudyTime(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return hours > 0 ? `${hours} h ${minutes} m` : `${minutes} m`
}

// "yyyy-MM-dd" as a local date (new Date("yyyy-MM-dd") would parse it as UTC)
function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, month - 1, day)
}

// ---------- bell (Web Audio, no network needed) ----------

type AudioContextCtor = typeof AudioContext

function createAudioContext(): AudioContext | null {
  const w = window as Window & { webkitAudioContext?: AudioContextCtor }
  const Ctor = window.AudioContext ?? w.webkitAudioContext
  return Ctor ? new Ctor() : null
}

// A struck-bell sound: a few inharmonic sine partials with exponential decay
function playBell(ctx: AudioContext): void {
  const t0 = ctx.currentTime
  const master = ctx.createGain()
  master.gain.value = 0.3
  master.connect(ctx.destination)

  const partials: ReadonlyArray<readonly [ratio: number, gain: number, decay: number]> = [
    [1, 1, 2.6],
    [2.76, 0.45, 1.6],
    [5.4, 0.22, 0.9],
    [8.93, 0.1, 0.5],
  ]
  for (const [ratio, gain, decay] of partials) {
    const osc = ctx.createOscillator()
    const env = ctx.createGain()
    osc.type = "sine"
    osc.frequency.value = 660 * ratio
    env.gain.setValueAtTime(0.0001, t0)
    env.gain.exponentialRampToValueAtTime(gain, t0 + 0.01)
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + decay)
    osc.connect(env).connect(master)
    osc.start(t0)
    osc.stop(t0 + decay + 0.05)
  }
}

// ---------- presentational pieces ----------

function ProgressRing({
  fraction,
  phase,
  children,
}: {
  fraction: number
  phase: PomodoroState["phase"]
  children: ReactNode
}) {
  const gradientId = `pomodoro-ring-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`
  const radius = 88
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, fraction))

  return (
    <div className="relative h-44 w-44 shrink-0">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" style={{ stopColor: phase === "study" ? "var(--primary)" : "var(--success)" }} />
            <stop offset="100%" style={{ stopColor: phase === "study" ? "var(--accent)" : "var(--primary)" }} />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="10" style={{ stroke: "var(--muted)" }} />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          strokeWidth="10"
          strokeLinecap="round"
          stroke={`url(#${gradientId})`}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

function WeekChart({ days }: { days: DailyStudyMinutes[] }) {
  const max = Math.max(1, ...days.map((d) => d.minutes))
  const lastIndex = days.length - 1

  return (
    <div>
      <p className="mb-1.5 text-xs text-muted-foreground">Last 7 days</p>
      <ul className="flex h-16 items-end gap-1.5" aria-label="Minutes studied over the last 7 days">
        {days.map((day, index) => {
          const date = parseLocalDate(day.date)
          const label = date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })
          const isToday = index === lastIndex
          const heightPct = day.minutes > 0 ? Math.max(8, (day.minutes / max) * 100) : 0
          return (
            <li
              key={day.date}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${label}: ${formatStudyTime(day.minutes)}`}
            >
              <span className="sr-only">{`${label}: ${formatStudyTime(day.minutes)}`}</span>
              <div className="flex w-full flex-1 items-end rounded-md bg-muted/40" aria-hidden>
                <div
                  className={cn(
                    "w-full rounded-md transition-[height] duration-500",
                    isToday ? "bg-gradient-to-t from-primary to-accent" : "bg-primary/60"
                  )}
                  style={{ height: `${heightPct}%` }}
                />
              </div>
              <span
                className={cn("text-[10px] leading-none", isToday ? "font-semibold text-foreground" : "text-muted-foreground")}
                aria-hidden
              >
                {date.toLocaleDateString(undefined, { weekday: "narrow" })}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- main component ----------

export function PomodoroTimer({ userId, subject, chapter, className }: PomodoroTimerProps) {
  const [state, setState] = useState<PomodoroState>(() => idleState(DEFAULT_STUDY_MINUTES))
  const [now, setNow] = useState(0)
  const [stopPrompt, setStopPrompt] = useState<StopPrompt | null>(null)
  // False until localStorage has been read, so the default state never overwrites a saved timer
  const [hydrated, setHydrated] = useState(false)

  const [today, setToday] = useState<TodayStudyStats | null>(null)
  const [week, setWeek] = useState<DailyStudyMinutes[]>([])
  const [statsUnavailable, setStatsUnavailable] = useState(false)

  const audioRef = useRef<AudioContext | null>(null)
  const finishedEndsAtRef = useRef<number | null>(null)
  const latest = useRef({ state, subject, chapter })

  useEffect(() => {
    latest.current = { state, subject, chapter }
  })

  // ----- persistence: restore once on mount, then save every state change -----
  useEffect(() => {
    const stored = loadStoredState()
    if (stored) setState(stored)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) storeState(state)
  }, [state, hydrated])

  // ----- stats -----
  const loadStats = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const [todayStats, weekStats] = await Promise.all([
          fetchTodayStudyStats(userId, signal),
          fetchWeekStudyMinutes(userId, signal),
        ])
        setToday(todayStats)
        setWeek(weekStats)
        setStatsUnavailable(false)
      } catch {
        if (signal?.aborted) return
        setStatsUnavailable(true)
      }
    },
    [userId]
  )

  useEffect(() => {
    const controller = new AbortController()
    void loadStats(controller.signal)
    return () => controller.abort()
  }, [loadStats])

  // ----- audio -----
  // Browsers only allow audio after a user gesture, so the context is created/resumed on button clicks
  const unlockAudio = () => {
    try {
      audioRef.current ??= createAudioContext()
      void audioRef.current?.resume()
    } catch {
      // No audio support; the toast still tells the user
    }
  }

  const ringBell = () => {
    try {
      audioRef.current ??= createAudioContext()
      const ctx = audioRef.current
      if (!ctx) return
      void ctx.resume().then(() => playBell(ctx))
    } catch {
      // Ignore: the bell is a nice-to-have
    }
  }

  useEffect(() => () => void audioRef.current?.close(), [])

  // ----- saving -----
  const submitSession = async (payload: StudySessionPayload): Promise<void> => {
    try {
      await saveStudySession(payload)
      void loadStats()
    } catch {
      toast.error("Couldn't save your study session.", {
        description: "Check that the backend is running, then retry.",
        action: { label: "Retry", onClick: () => void submitSession(payload) },
      })
    }
  }

  const saveStudyMinutes = (minutes: number) => {
    const { subject: s, chapter: c } = latest.current
    void submitSession({
      userId,
      subject: s || "General",
      chapter: c || "",
      durationMinutes: minutes,
      sessionType: "STUDY",
    })
  }

  // ----- phase transitions -----
  const finishPhase = (ended: PomodoroState) => {
    ringBell()
    if (ended.phase === "study") {
      toast.success("Study session complete! Time for a 5-min break.", { icon: "🔔" })
      saveStudyMinutes(ended.studyMinutes)
      const breakMs = BREAK_MINUTES * MINUTE_MS
      setState({
        phase: "break",
        status: "running",
        studyMinutes: ended.studyMinutes,
        endsAt: Date.now() + breakMs,
        remainingMs: breakMs,
      })
    } else {
      toast("Break over. Ready for next session?", { icon: "🔔" })
      setState(idleState(ended.studyMinutes))
    }
  }
  const finishPhaseRef = useRef(finishPhase)
  useEffect(() => {
    finishPhaseRef.current = finishPhase
  })

  // ----- the one ticking interval: only while running -----
  useEffect(() => {
    if (state.status !== "running" || state.endsAt === null) return
    const endsAt = state.endsAt

    const tick = () => {
      const t = Date.now()
      setNow(t)
      // endsAt identifies the phase, so a phase can only finish (and save) once
      if (t >= endsAt && finishedEndsAtRef.current !== endsAt) {
        finishedEndsAtRef.current = endsAt
        finishPhaseRef.current(latest.current.state)
      }
    }

    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [state.status, state.endsAt])

  // ----- controls -----
  const handleStart = () => {
    unlockAudio()
    setNow(Date.now())
    setState((s) => ({ ...s, status: "running", endsAt: Date.now() + s.remainingMs }))
  }

  const handlePause = () => {
    setState((s) => ({ ...s, status: "paused", remainingMs: remainingMsAt(s, Date.now()), endsAt: null }))
  }

  const handleResume = () => {
    unlockAudio()
    setNow(Date.now())
    setState((s) => ({ ...s, status: "running", endsAt: Date.now() + s.remainingMs }))
  }

  const handleReset = () => {
    setState((s) => idleState(s.studyMinutes))
  }

  const handleStop = () => {
    if (state.phase === "break") {
      setState(idleState(state.studyMinutes))
      return
    }
    const remaining = remainingMsAt(state, Date.now())
    const studiedMinutes = Math.floor((phaseTotalMs(state) - remaining) / MINUTE_MS)
    if (studiedMinutes < 1) {
      setState(idleState(state.studyMinutes))
      return
    }
    // Freeze the clock while asking
    setState({ ...state, status: "paused", remainingMs: remaining, endsAt: null })
    setStopPrompt({ minutes: studiedMinutes, wasRunning: state.status === "running" })
  }

  const handleSavePartial = () => {
    if (!stopPrompt) return
    saveStudyMinutes(stopPrompt.minutes)
    toast.success(`Saved ${stopPrompt.minutes} min of study.`)
    setStopPrompt(null)
    setState((s) => idleState(s.studyMinutes))
  }

  const handleDiscardPartial = () => {
    setStopPrompt(null)
    setState((s) => idleState(s.studyMinutes))
  }

  // Esc, overlay click or "Keep going": carry on where we were
  const handleKeepGoing = () => {
    const resume = stopPrompt?.wasRunning ?? false
    setStopPrompt(null)
    if (resume) handleResume()
  }

  const handleDurationChange = (value: string) => {
    const minutes = Number(value)
    if (isStudyDuration(minutes)) setState(idleState(minutes))
  }

  // ----- derived view state -----
  const remaining = remainingMsAt(state, now)
  const fraction = remaining / phaseTotalMs(state)
  const isStudy = state.phase === "study"
  const canChangeDuration = state.status === "idle" && isStudy
  const statusText =
    state.status === "paused" ? "Paused" : state.status === "running" ? (isStudy ? "Focus time" : "On a break") : "Ready"

  return (
    <div
      className={cn(
        "glassmorphism rounded-2xl border border-primary/30 p-4 shadow-lg shadow-primary/10 sm:p-5",
        className
      )}
    >
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-stretch">
        <ProgressRing fraction={fraction} phase={state.phase}>
          <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {isStudy ? <BookOpen className="h-3.5 w-3.5" /> : <Coffee className="h-3.5 w-3.5 text-success" />}
            {isStudy ? "Study" : "Break"}
          </span>
          <span className="font-mono text-4xl font-bold tabular-nums text-foreground">{formatClock(remaining)}</span>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {statusText}
          </span>
        </ProgressRing>

        <div className="flex w-full min-w-0 flex-1 flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-foreground">Pomodoro</h2>
              <p className="text-xs text-muted-foreground">
                {isStudy ? `${state.studyMinutes} min study, then a ${BREAK_MINUTES}-min break` : "Stretch, drink water, rest your eyes"}
              </p>
            </div>
            <Select value={String(state.studyMinutes)} onValueChange={handleDurationChange} disabled={!canChangeDuration}>
              <SelectTrigger aria-label="Study duration" className="h-9 w-28 bg-background/40">
                <SelectValue>{`${state.studyMinutes} min`}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STUDY_DURATIONS.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes} min
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-wrap gap-2">
            {state.status === "idle" && (
              <Button onClick={handleStart} className="shadow-lg shadow-primary/30">
                <Play className="h-4 w-4" />
                Start Pomodoro
              </Button>
            )}
            {state.status === "running" && (
              <Button onClick={handlePause}>
                <Pause className="h-4 w-4" />
                Pause
              </Button>
            )}
            {state.status === "paused" && (
              <Button onClick={handleResume}>
                <Play className="h-4 w-4" />
                Resume
              </Button>
            )}
            {state.status !== "idle" && (
              <Button variant="outline" onClick={handleStop}>
                <Square className="h-4 w-4" />
                {isStudy ? "Stop" : "Skip break"}
              </Button>
            )}
            {state.status === "paused" && isStudy && (
              <Button variant="ghost" onClick={handleReset} title="Restart this session from the beginning (not saved)">
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
            )}
          </div>

          <div className="mt-auto space-y-3 border-t border-border pt-3">
            {statsUnavailable && !today ? (
              <p className="text-xs text-muted-foreground">Study stats unavailable. Is the backend running?</p>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                <span className="text-muted-foreground">
                  Today: <span className="font-semibold text-foreground">{formatStudyTime(today?.totalMinutes ?? 0)}</span> studied
                </span>
                <span className="text-muted-foreground">
                  Sessions today: <span className="font-semibold text-foreground">{today?.sessionCount ?? 0}</span>
                </span>
              </div>
            )}
            {week.length > 0 && <WeekChart days={week} />}
          </div>
        </div>
      </div>

      <AlertDialog open={stopPrompt !== null} onOpenChange={(open) => !open && handleKeepGoing()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save partial session?</AlertDialogTitle>
            <AlertDialogDescription>
              You studied for {stopPrompt?.minutes ?? 0} min of this {state.studyMinutes}-min session. Save it to your
              study log, or discard it?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep going</AlertDialogCancel>
            <Button variant="outline" onClick={handleDiscardPartial}>
              Discard
            </Button>
            <Button onClick={handleSavePartial}>Save {stopPrompt?.minutes ?? 0} min</Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
