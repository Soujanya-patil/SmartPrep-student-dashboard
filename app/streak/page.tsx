"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowLeft, Award, CalendarCheck, Crown, Lock, RefreshCw, Target, Trophy, WifiOff } from "lucide-react"
import { Header } from "@/components/smartprep/header"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { API_BASE_URL } from "@/lib/api"
import { cn } from "@/lib/utils"

// ---------- API shapes ----------

/** A study_log row: a legacy daily log or a Pomodoro session. Only the fields used here. */
interface StudyLogRow {
  studyDate?: string | number[] | null
  hoursStudied?: number | null
  sessionType?: string | null
}

interface DashboardData {
  motivationMessage?: string | null
}

type Loadable<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T }

// ---------- constants ----------

const USER_ID = 1
const CALENDAR_DAYS = 30
const WEEKLY_GOAL_DAYS = 5
const WEEKDAY_LABELS = ["Mon", "", "Wed", "", "Fri", "", "Sun"] as const

const MILESTONES = [
  { days: 3, name: "Getting Started", icon: Award },
  { days: 7, name: "One Week!", icon: Trophy },
  { days: 14, name: "Two Weeks Strong!", icon: Target },
  { days: 30, name: "Monthly Master!", icon: Crown },
] as const

// ---------- date helpers (all local dates, keyed "yyyy-MM-dd") ----------

function dateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  copy.setDate(copy.getDate() + days)
  return copy
}

function startOfToday(): Date {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

// Monday = 0 ... Sunday = 6
function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

// Spring usually sends LocalDate as "yyyy-MM-dd", but can send [yyyy, M, d]
function toDateKey(value: StudyLogRow["studyDate"]): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  if (Array.isArray(value) && value.length >= 3) {
    return dateKey(new Date(value[0], value[1] - 1, value[2]))
  }
  return null
}

function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number)
  return new Date(y, m - 1, d)
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

// ---------- streak maths (same rule as the backend's /studylog/streak) ----------

interface StudyHistory {
  /** date -> hours studied that day */
  hoursByDay: Map<string, number>
  /** days that count toward a streak */
  studyDays: Set<string>
}

// A day counts when it has a legacy daily log (no sessionType) or a completed STUDY session; breaks don't
function buildHistory(rows: StudyLogRow[]): StudyHistory {
  const hoursByDay = new Map<string, number>()
  const studyDays = new Set<string>()
  for (const row of rows) {
    const key = toDateKey(row.studyDate)
    if (!key) continue
    const type = row.sessionType?.toUpperCase() ?? null
    if (type !== null && type !== "STUDY") continue
    studyDays.add(key)
    hoursByDay.set(key, (hoursByDay.get(key) ?? 0) + (row.hoursStudied ?? 0))
  }
  return { hoursByDay, studyDays }
}

// Counts back from today; if today isn't logged yet the streak is still alive from yesterday
function currentStreak(studyDays: Set<string>, today: Date): number {
  let cursor = studyDays.has(dateKey(today)) ? today : addDays(today, -1)
  let streak = 0
  while (studyDays.has(dateKey(cursor))) {
    streak++
    cursor = addDays(cursor, -1)
  }
  return streak
}

function bestStreak(studyDays: Set<string>): number {
  let best = 0
  let run = 0
  let previous: string | null = null
  for (const key of [...studyDays].sort()) {
    // "yyyy-MM-dd" sorts chronologically; a run continues only if this day follows the previous one
    run = previous !== null && dateKey(addDays(parseKey(previous), 1)) === key ? run + 1 : 1
    best = Math.max(best, run)
    previous = key
  }
  return best
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

// ---------- page ----------

export default function StreakPage() {
  const [logs, setLogs] = useState<Loadable<StudyLogRow[]>>({ status: "loading" })
  const [motivation, setMotivation] = useState<Loadable<string>>({ status: "loading" })

  const load = useCallback(() => {
    setLogs({ status: "loading" })
    setMotivation({ status: "loading" })

    getJson<StudyLogRow[]>(`/study/logs/${USER_ID}`)
      .then((data) => setLogs({ status: "ready", data: Array.isArray(data) ? data : [] }))
      .catch(() => setLogs({ status: "error" }))

    // The dashboard endpoint asks the AI for a fresh message, so it can be slower; load it separately
    getJson<DashboardData>(`/dashboard/${USER_ID}`)
      .then((data) => {
        const message = data.motivationMessage?.trim()
        setMotivation(message ? { status: "ready", data: message } : { status: "error" })
      })
      .catch(() => setMotivation({ status: "error" }))
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Backend down -> empty history, so every number falls back to 0 (per spec)
  const history = useMemo(() => buildHistory(logs.status === "ready" ? logs.data : []), [logs])
  const today = useMemo(() => startOfToday(), [])
  const streak = currentStreak(history.studyDays, today)
  const best = Math.max(bestStreak(history.studyDays), streak)
  const loading = logs.status === "loading"
  const offline = logs.status === "error"

  // Last 30 days laid out GitHub-style: one column per week, Monday at the top
  const calendar = useMemo(() => {
    const first = addDays(today, -(CALENDAR_DAYS - 1))
    const leadingBlanks = weekdayIndex(first)
    const cells: ({ key: string; date: Date; studied: boolean; hours: number; isToday: boolean } | null)[] =
      Array.from({ length: leadingBlanks }, () => null)
    for (let i = 0; i < CALENDAR_DAYS; i++) {
      const date = addDays(first, i)
      const key = dateKey(date)
      cells.push({
        key,
        date,
        studied: history.studyDays.has(key),
        hours: history.hoursByDay.get(key) ?? 0,
        isToday: i === CALENDAR_DAYS - 1,
      })
    }
    return cells
  }, [history, today])
  const activeDays = calendar.filter((c) => c?.studied).length

  // This week = Monday..today
  const monday = addDays(today, -weekdayIndex(today))
  let daysThisWeek = 0
  for (let d = monday; d <= today; d = addDays(d, 1)) {
    if (history.studyDays.has(dateKey(d))) daysThisWeek++
  }
  const weekGoalMet = daysThisWeek >= WEEKLY_GOAL_DAYS

  const nextMilestone = MILESTONES.find((m) => best < m.days)

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-4xl flex-1 space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {offline && (
          <div
            role="alert"
            className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground"
          >
            <WifiOff className="h-4 w-4 shrink-0 text-destructive" />
            Couldn&apos;t reach the SmartPrep server, so your streak shows 0 for now. Is the backend running on port 8081?
          </div>
        )}

        {/* 1. Big streak */}
        <section className="glassmorphism relative overflow-hidden rounded-2xl border border-primary/30 p-6 text-center shadow-2xl shadow-primary/10 animate-in fade-in slide-in-from-bottom-4 duration-500 sm:p-10">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-64 w-64 rounded-full bg-accent/20 blur-3xl" aria-hidden />
          <div className="relative">
            <div className="text-7xl motion-safe:animate-pulse sm:text-8xl" role="img" aria-label="Flame">
              🔥
            </div>
            {loading ? (
              <Skeleton className="mx-auto mt-4 h-20 w-32 bg-muted" />
            ) : (
              <p className="mt-2 bg-gradient-to-b from-foreground to-primary bg-clip-text text-8xl font-black leading-none text-transparent sm:text-9xl">
                {streak}
              </p>
            )}
            <p className="mt-2 text-xl font-semibold text-foreground">Day streak!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {loading
                ? "Loading your study history..."
                : streak === 0
                  ? "Study today to start a new streak."
                  : history.studyDays.has(dateKey(today))
                    ? "You've studied today. Keep it going tomorrow!"
                    : "Study today to keep your streak alive."}
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-4 py-1.5 text-sm text-amber-300">
              <Crown className="h-4 w-4" />
              Best streak: <span className="font-semibold">{loading ? "…" : `${best} ${best === 1 ? "day" : "days"}`}</span>
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          {/* 2. Activity calendar */}
          <section className="glassmorphism rounded-2xl border border-border p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:100ms] [animation-fill-mode:both]">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <CalendarCheck className="h-5 w-5 text-primary" />
                Last 30 days
              </h2>
              <p className="text-xs text-muted-foreground">
                {loading ? "" : `${activeDays} of ${CALENDAR_DAYS} days studied`}
              </p>
            </div>

            {loading ? (
              <Skeleton className="h-40 w-full bg-muted" />
            ) : (
              <TooltipProvider delayDuration={100}>
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {/* Weekday labels */}
                  <div className="grid grid-rows-7 gap-1.5 pr-1 text-[10px] text-muted-foreground" aria-hidden>
                    {WEEKDAY_LABELS.map((label, i) => (
                      <span key={i} className="flex h-6 items-center sm:h-7">
                        {label}
                      </span>
                    ))}
                  </div>
                  <div
                    className="grid grid-flow-col grid-rows-7 gap-1.5"
                    role="list"
                    aria-label="Study activity for the last 30 days"
                  >
                    {calendar.map((cell, i) =>
                      cell === null ? (
                        <span key={`blank-${i}`} className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden />
                      ) : (
                        <Tooltip key={cell.key}>
                          <TooltipTrigger asChild>
                            <span
                              role="listitem"
                              tabIndex={0}
                              aria-label={`${cell.date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}: ${
                                cell.studied ? `studied ${formatHours(cell.hours)}` : "no study"
                              }`}
                              className={cn(
                                "block h-6 w-6 rounded-md transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:outline-2 focus-visible:outline-primary sm:h-7 sm:w-7",
                                cell.studied ? "bg-success shadow-[0_0_8px_var(--success)]" : "bg-muted",
                                cell.isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card"
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-medium">
                              {cell.date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
                              {cell.isToday ? " (today)" : ""}
                            </p>
                            <p>{cell.studied ? `Studied ${formatHours(cell.hours)}` : "No study"}</p>
                          </TooltipContent>
                        </Tooltip>
                      )
                    )}
                  </div>
                </div>
              </TooltipProvider>
            )}

            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-muted" /> No study
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm bg-success" /> Studied
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-3 w-3 rounded-sm ring-2 ring-primary" /> Today
              </span>
            </div>
          </section>

          {/* 3. Weekly goal */}
          <section className="glassmorphism flex flex-col gap-6 rounded-2xl border border-border p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:200ms] [animation-fill-mode:both]">
            <div>
              <h2 className="flex items-center gap-2 font-semibold text-foreground">
                <Target className="h-5 w-5 text-primary" />
                Weekly goal
              </h2>
              <p className="text-xs text-muted-foreground">Study {WEEKLY_GOAL_DAYS} days a week (Mon–Sun)</p>
            </div>
            <div>
              <p className="mb-2 text-3xl font-bold text-foreground">
                {loading ? "…" : `${Math.min(daysThisWeek, 7)}/${WEEKLY_GOAL_DAYS}`}
                <span className="ml-2 text-sm font-normal text-muted-foreground">days this week</span>
              </p>
              <Progress
                value={loading ? 0 : Math.min(100, (daysThisWeek / WEEKLY_GOAL_DAYS) * 100)}
                aria-label="Weekly goal progress"
                className={cn("h-3 bg-muted", weekGoalMet && "[&_[data-slot=progress-indicator]]:bg-success")}
              />
              <p className="mt-2 text-xs text-muted-foreground">
                {weekGoalMet
                  ? "Goal reached this week! 🎉"
                  : `${WEEKLY_GOAL_DAYS - daysThisWeek} more ${WEEKLY_GOAL_DAYS - daysThisWeek === 1 ? "day" : "days"} to reach your goal`}
              </p>
            </div>
          </section>
        </div>

        {/* 4. Milestones */}
        <section className="glassmorphism rounded-2xl border border-border p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:300ms] [animation-fill-mode:both]">
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Trophy className="h-5 w-5 text-amber-400" />
              Streak milestones
            </h2>
            {!loading && (
              <p className="text-xs text-muted-foreground">
                {nextMilestone
                  ? `${nextMilestone.days - best} more ${nextMilestone.days - best === 1 ? "day" : "days"} to “${nextMilestone.name}”`
                  : "All milestones unlocked! 👑"}
              </p>
            )}
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {MILESTONES.map(({ days, name, icon: Icon }) => {
              const unlocked = !loading && best >= days
              return (
                <li
                  key={days}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border p-4 text-center transition-all duration-500",
                    unlocked
                      ? "border-amber-400/50 bg-gradient-to-b from-amber-400/20 to-amber-600/5 shadow-lg shadow-amber-400/10"
                      : "border-border bg-muted/20 opacity-70"
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-full",
                      unlocked ? "bg-gradient-to-br from-amber-300 to-amber-500 text-amber-950" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {unlocked ? <Icon className="h-6 w-6" /> : <Lock className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className={cn("text-sm font-semibold", unlocked ? "text-amber-300" : "text-muted-foreground")}>{name}</p>
                    <p className="text-xs text-muted-foreground">
                      {days}-day streak · {unlocked ? "Unlocked" : "Locked"}
                    </p>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>

        {/* 5. Motivation from Alex */}
        <section className="glassmorphism flex gap-4 rounded-2xl border border-primary/30 p-5 animate-in fade-in slide-in-from-bottom-4 duration-500 [animation-delay:400ms] [animation-fill-mode:both]">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-2xl shadow-lg shadow-primary/30"
            role="img"
            aria-label="Alex"
          >
            👨‍💼
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              Alex <span className="font-normal text-muted-foreground">· your study coach</span>
            </p>
            {motivation.status === "loading" ? (
              <div className="mt-2 space-y-2">
                <Skeleton className="h-4 w-full bg-muted" />
                <Skeleton className="h-4 w-2/3 bg-muted" />
              </div>
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                {motivation.status === "ready"
                  ? motivation.data
                  : "Every small study session adds up. Open a video or start a Pomodoro today, and your streak begins!"}
              </p>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
