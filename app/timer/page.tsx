"use client"

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Coffee,
  Flame,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Target,
} from "lucide-react"
import { toast } from "sonner"
import { Header } from "@/components/smartprep/header"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { useCurrentUserId } from "@/hooks/use-current-user"
import { API_BASE_URL, fetchTodayStudyStats, saveStudySession } from "@/lib/api"
import { cn } from "@/lib/utils"

type Mode = "study" | "break"

interface TimerState {
  mode: Mode
  running: boolean
  /** Epoch ms when the current countdown ends; set only while running */
  endsAt: number | null
  /** Time left; authoritative while stopped */
  remainingMs: number
}

interface Stats {
  sessionsToday: number | null
  hoursToday: number | null
  streak: number | null
}

const MINUTE_MS = 60_000
const DURATION_MS: Record<Mode, number> = { study: 25 * MINUTE_MS, break: 5 * MINUTE_MS }
const STUDY_MINUTES = 25
const DAILY_GOAL = 8
const TOAST_MS = 4000
// Separate from the dashboard widget's key so the two timers never overwrite each other
const STORAGE_KEY = "smartprep.timer-page.v1"

const MODE_LABEL: Record<Mode, string> = { study: "Study", break: "Break" }

// ---------- helpers ----------

function stoppedState(mode: Mode): TimerState {
  return { mode, running: false, endsAt: null, remainingMs: DURATION_MS[mode] }
}

function remainingAt(timer: TimerState, now: number): number {
  return timer.running && timer.endsAt !== null ? Math.max(0, timer.endsAt - now) : timer.remainingMs
}

function formatClock(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000)
  return `${String(Math.floor(totalSeconds / 60)).padStart(2, "0")}:${String(totalSeconds % 60).padStart(2, "0")}`
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return h > 0 ? `${h} h ${m} m` : `${m} m`
}

function isTimerState(value: unknown): value is TimerState {
  if (typeof value !== "object" || value === null) return false
  const v = value as Record<string, unknown>
  return (
    (v.mode === "study" || v.mode === "break") &&
    typeof v.running === "boolean" &&
    (v.endsAt === null || typeof v.endsAt === "number") &&
    typeof v.remainingMs === "number" &&
    !(v.running && v.endsAt === null)
  )
}

function loadTimer(): TimerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    return isTimerState(parsed) ? parsed : null
  } catch {
    return null
  }
}

function storeTimer(timer: TimerState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(timer))
  } catch {
    // Storage unavailable: the timer still works, it just won't survive a refresh
  }
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

function valueOrNull<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null
}

function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window
}

function sendBrowserNotification(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return
  try {
    new Notification(title, { body, icon: "/icon.svg", tag: "smartprep-timer" })
  } catch {
    // Some browsers (e.g. Android Chrome) only allow notifications from a service worker
  }
}

// ---------- presentational pieces ----------

function ProgressRing({ fraction, mode, children }: { fraction: number; mode: Mode; children: ReactNode }) {
  const radius = 90
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, fraction))
  const gradientId = `ring-${useId().replace(/:/g, "")}`
  // Study: violet -> cyan gradient ring; break: mint
  const stroke = mode === "study" ? `url(#${gradientId})` : "var(--success)"
  const glow =
    mode === "study"
      ? "drop-shadow(0 0 6px rgba(124, 92, 255, 0.8)) drop-shadow(0 0 14px rgba(34, 211, 238, 0.45))"
      : "drop-shadow(0 0 6px rgba(52, 211, 153, 0.8)) drop-shadow(0 0 14px rgba(52, 211, 153, 0.4))"

  return (
    <div className="relative h-60 w-60 sm:h-72 sm:w-72">
      <svg viewBox="0 0 200 200" className="h-full w-full -rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--primary)" />
            <stop offset="100%" stopColor="var(--info)" />
          </linearGradient>
        </defs>
        <circle cx="100" cy="100" r={radius} fill="none" strokeWidth="8" style={{ stroke: "var(--muted)" }} />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped)}
          style={{ stroke, filter: glow }}
          className="transition-[stroke-dashoffset] duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: ReactNode
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="surface card-interactive flex items-center gap-3 rounded-xl border border-border p-4">
      <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/15 p-2.5 text-primary-soft">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold text-foreground tabular-nums">{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

// ---------- page ----------

export default function TimerPage() {
  const userId = useCurrentUserId()
  const [timer, setTimer] = useState<TimerState>(() => stoppedState("study"))
  const [now, setNow] = useState(0)
  const [hydrated, setHydrated] = useState(false)
  const [stats, setStats] = useState<Stats>({ sessionsToday: null, hoursToday: null, streak: null })
  const [statsOffline, setStatsOffline] = useState(false)
  // Counts sessions finished on this page, so the dots still work if the backend is down
  const [localSessions, setLocalSessions] = useState(0)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const finishedEndsAtRef = useRef<number | null>(null)

  // ----- persistence -----
  useEffect(() => {
    const stored = loadTimer()
    if (stored) setTimer(stored)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) storeTimer(timer)
  }, [timer, hydrated])

  // ----- stats (each call may fail on its own; none of them should break the page) -----
  const loadStats = useCallback(async () => {
    if (userId === null) return
    const [today, hours, streak] = await Promise.allSettled([
      fetchTodayStudyStats(userId),
      getJson<{ totalHours: number }>(`/study/today/${userId}`),
      getJson<{ currentStreak: number }>(`/studylog/streak/${userId}`),
    ])
    setStats({
      sessionsToday: valueOrNull(today)?.sessionCount ?? null,
      hoursToday: valueOrNull(hours)?.totalHours ?? null,
      streak: valueOrNull(streak)?.currentStreak ?? null,
    })
    setStatsOffline([today, hours, streak].every((r) => r.status === "rejected"))
  }, [userId])

  useEffect(() => {
    void loadStats()
  }, [loadStats])

  // ----- saving -----
  const saveSession = useCallback(async (): Promise<void> => {
    if (userId === null) return
    try {
      await saveStudySession({
        userId,
        subject: "Pomodoro Session",
        chapter: "",
        durationMinutes: STUDY_MINUTES,
        sessionType: "STUDY",
      })
      void loadStats()
    } catch {
      toast.error("Couldn't save your study session.", {
        description: "Check that the backend is running, then retry.",
        duration: 10_000,
        action: { label: "Retry", onClick: () => void saveSession() },
      })
    }
  }, [userId, loadStats])

  // ----- completing a countdown -----
  const completeMode = (mode: Mode) => {
    if (mode === "study") {
      setLocalSessions((n) => n + 1)
      void saveSession()
      sendBrowserNotification("Study session complete! 🎉", "Time for a 5-minute break.")
      toast.success("Study session complete! Break started.", { duration: TOAST_MS })
      setTimer({ mode: "break", running: true, endsAt: Date.now() + DURATION_MS.break, remainingMs: DURATION_MS.break })
    } else {
      sendBrowserNotification("Break over", "Ready for your next study session?")
      toast("Break over. Ready for your next study session?", { duration: TOAST_MS })
      setTimer(stoppedState("study"))
    }
  }
  const completeModeRef = useRef(completeMode)
  useEffect(() => {
    completeModeRef.current = completeMode
  })

  // ----- the interval: only exists while running, always cleared via intervalRef -----
  useEffect(() => {
    if (!timer.running || timer.endsAt === null) return
    const endsAt = timer.endsAt
    const mode = timer.mode

    const tick = () => {
      const t = Date.now()
      setNow(t)
      // endsAt identifies this countdown, so it can only complete (and save) once
      if (t >= endsAt && finishedEndsAtRef.current !== endsAt) {
        finishedEndsAtRef.current = endsAt
        completeModeRef.current(mode)
      }
    }

    tick()
    intervalRef.current = setInterval(tick, 1000)
    return () => {
      if (intervalRef.current !== null) clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [timer.running, timer.endsAt, timer.mode])

  // ----- tab title shows the countdown while running -----
  const remaining = remainingAt(timer, now)
  const clock = formatClock(remaining)
  useEffect(() => {
    if (!timer.running) return
    const original = document.title
    return () => {
      document.title = original
    }
  }, [timer.running])
  useEffect(() => {
    if (timer.running) document.title = `${clock} · ${MODE_LABEL[timer.mode]} | SmartPrep`
  }, [clock, timer.running, timer.mode])

  // ----- controls -----
  const handleStartPause = () => {
    if (timer.running) {
      setTimer((t) => ({ ...t, running: false, endsAt: null, remainingMs: remainingAt(t, Date.now()) }))
      return
    }
    // Ask once, from a click, so the browser allows the permission prompt
    if (notificationsSupported() && Notification.permission === "default") {
      void Notification.requestPermission()
    }
    setNow(Date.now())
    setTimer((t) => ({ ...t, running: true, endsAt: Date.now() + t.remainingMs }))
  }

  const handleReset = () => {
    setTimer((t) => stoppedState(t.mode))
  }

  const switchMode = (mode: Mode) => {
    setTimer(stoppedState(mode))
    toast(mode === "study" ? "Switched to Study mode." : "Switched to Break mode.", {
      duration: TOAST_MS,
      icon: mode === "study" ? "📖" : "☕",
    })
  }

  // Skipping never saves: only a completed study countdown counts
  const handleSkip = () => {
    switchMode(timer.mode === "study" ? "break" : "study")
  }

  // ----- derived -----
  const fraction = remaining / DURATION_MS[timer.mode]
  const isStudy = timer.mode === "study"
  const sessionsDone = Math.max(stats.sessionsToday ?? 0, localSessions)
  const statusText = timer.running
    ? isStudy
      ? "Stay focused"
      : "Relax"
    : remaining === DURATION_MS[timer.mode]
      ? "Ready"
      : "Paused"

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-info"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        <section
          aria-label="Pomodoro timer"
          className="surface flex flex-col items-center gap-6 rounded-2xl border border-primary/30 p-5 shadow-raised sm:p-8"
        >
          {/* Mode tabs */}
          <div role="tablist" aria-label="Timer mode" className="flex w-full max-w-xs rounded-xl border border-border bg-background/40 p-1">
            {(["study", "break"] as const).map((mode) => {
              const selected = timer.mode === mode
              return (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => !selected && switchMode(mode)}
                  className={cn(
                    "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-all active:scale-[.97]",
                    selected
                      ? mode === "study"
                        ? "icon-gradient"
                        : "bg-success text-success-foreground"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  )}
                >
                  {mode === "study" ? <BookOpen className="h-4 w-4" /> : <Coffee className="h-4 w-4" />}
                  {MODE_LABEL[mode]}
                </button>
              )
            })}
          </div>

          <ProgressRing fraction={fraction} mode={timer.mode}>
            <span className={cn("text-xs font-medium uppercase tracking-widest", isStudy ? "text-info" : "text-success")}>
              {isStudy ? "Study" : "Break"}
            </span>
            <span className="font-mono text-5xl font-bold tabular-nums text-foreground sm:text-6xl">{clock}</span>
            <span className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {statusText}
            </span>
          </ProgressRing>

          {/* Session dots */}
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2" role="img" aria-label={`${sessionsDone} of ${DAILY_GOAL} pomodoros done today`}>
              {Array.from({ length: DAILY_GOAL }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-3 w-3 rounded-full border transition-colors",
                    i < sessionsDone ? "border-transparent bg-gradient-accent" : "border-muted-foreground/40 bg-transparent"
                  )}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {sessionsDone > DAILY_GOAL
                ? `Goal smashed: ${sessionsDone} pomodoros today!`
                : `${Math.min(sessionsDone, DAILY_GOAL)} / ${DAILY_GOAL} pomodoros today`}
            </p>
          </div>

          {/* Controls */}
          <div className="flex w-full flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              onClick={handleStartPause}
              className={cn(
                "min-w-36",
                !isStudy && "bg-none bg-success text-success-foreground"
              )}
            >
              {timer.running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              {timer.running ? "Pause" : remaining === DURATION_MS[timer.mode] ? "Start" : "Resume"}
            </Button>
            <Button size="lg" variant="outline" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
              Reset
            </Button>
            <Button size="lg" variant="outline" onClick={handleSkip}>
              <SkipForward className="h-4 w-4" />
              Skip
            </Button>
          </div>
        </section>

        {/* Stats */}
        <section aria-label="Today's study stats" className="space-y-2">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatCard
              icon={<Target className="h-5 w-5" />}
              label="Sessions today"
              value={stats.sessionsToday === null ? (localSessions > 0 ? String(localSessions) : "—") : String(sessionsDone)}
            />
            <StatCard
              icon={<Clock className="h-5 w-5" />}
              label="Studied today"
              value={stats.hoursToday === null ? "—" : formatHours(stats.hoursToday)}
            />
            <StatCard
              icon={<Flame className="h-5 w-5" />}
              label="Current streak"
              value={stats.streak === null ? "—" : `${stats.streak} ${stats.streak === 1 ? "day" : "days"}`}
            />
          </div>
          {statsOffline && (
            <p className="text-center text-xs text-muted-foreground">
              Stats unavailable. Is the backend running on port 8081? The timer still works.
            </p>
          )}
        </section>
      </main>

      <Toaster theme="dark" position="top-center" richColors closeButton duration={TOAST_MS} />
    </div>
  )
}
