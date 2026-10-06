"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  History,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Header } from "@/components/smartprep/header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Toaster } from "@/components/ui/sonner"
import { Switch } from "@/components/ui/switch"
import { useCurrentUserId } from "@/hooks/use-current-user"
import { API_BASE_URL } from "@/lib/api"
import { cn } from "@/lib/utils"

// ---------- config ----------

const RECIPIENTS = [
  { role: "Parent", email: "dwd.shekhar@gmail.com" },
  { role: "Student", email: "soujanya.patil2003@gmail.com" },
] as const
const HISTORY_LIMIT = 5
const PREF_KEY = "smartprep.parent-report.auto.v1"
const HISTORY_KEY = "smartprep.parent-report.history.v1"

// ---------- types ----------

interface WeakTopic {
  subject: string
  chapter: string
  averageScore: number
}

interface DashboardData {
  name: string
  currentStreak: number
  totalQuizzesTaken?: number
  averageScore: number
  weakTopics: WeakTopic[]
  motivationMessage: string
}

interface AutoSendPref {
  enabled: boolean
  /** When the toggle was switched on (ISO); only Mondays after this are due */
  enabledAt: string | null
}

interface SendRecord {
  at: string // ISO timestamp
  ok: boolean
  trigger: "manual" | "auto"
  detail?: string
}

type Loadable<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T }

// ---------- storage (every access guarded: storage can be unavailable) ----------

function readJson<T>(key: string, fallback: T, guard: (v: unknown) => v is T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    const parsed: unknown = JSON.parse(raw)
    return guard(parsed) ? parsed : fallback
  } catch {
    return fallback
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Not fatal: the preference just won't persist
  }
}

function isPref(v: unknown): v is AutoSendPref {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.enabled === "boolean" && (o.enabledAt === null || typeof o.enabledAt === "string")
}

function isHistory(v: unknown): v is SendRecord[] {
  return (
    Array.isArray(v) &&
    v.every((r) => {
      if (typeof r !== "object" || r === null) return false
      const o = r as Record<string, unknown>
      return typeof o.at === "string" && typeof o.ok === "boolean" && (o.trigger === "manual" || o.trigger === "auto")
    })
  )
}

// ---------- schedule helpers ----------

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

/** The most recent Monday at 00:00, today included */
function latestMonday(now: Date): Date {
  const d = startOfDay(now)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}

function nextMondayAfter(date: Date): Date {
  const d = latestMonday(date)
  d.setDate(d.getDate() + 7)
  return d
}

function lastSuccess(history: SendRecord[]): Date | null {
  const ok = history.find((r) => r.ok)
  return ok ? new Date(ok.at) : null
}

/**
 * A weekly report is due once a Monday arrives after the day the toggle was switched on
 * (so switching it on never sends straight away) and nothing has been sent since that Monday
 */
function isAutoSendDue(pref: AutoSendPref, history: SendRecord[], now: Date): boolean {
  if (!pref.enabled || !pref.enabledAt) return false
  const monday = latestMonday(now)
  const enabledDay = startOfDay(new Date(pref.enabledAt))
  if (monday <= enabledDay) return false
  const sent = lastSuccess(history)
  return sent === null || sent < monday
}

function nextScheduled(pref: AutoSendPref, history: SendRecord[], now: Date): Date {
  return isAutoSendDue(pref, history, now) ? startOfDay(now) : nextMondayAfter(now)
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

// ---------- API ----------

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

const REPORT_UNAVAILABLE = "The report couldn't be sent right now. Please try again later."
const SERVER_ERROR_STATUSES: ReadonlyArray<number> = [500, 502, 503, 504]

async function sendReport(userId: number): Promise<string> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/report/send/${userId}`, {
      method: "POST",
      headers: { Accept: "application/json" },
    })
  } catch {
    throw new Error(REPORT_UNAVAILABLE)
  }
  // The backend answers 404 when the user doesn't exist (e.g. a deleted account), not when the route is missing
  if (response.status === 404) throw new Error("We couldn't find your account. Please log out and log in again.")
  if (SERVER_ERROR_STATUSES.includes(response.status)) throw new Error(REPORT_UNAVAILABLE)
  if (!response.ok) throw new Error(`Something went wrong (HTTP ${response.status}).`)
  try {
    const body = (await response.json()) as { message?: unknown }
    return typeof body.message === "string" ? body.message : "Report sent successfully!"
  } catch {
    return "Report sent successfully!"
  }
}

// ---------- page ----------

export default function ParentReportPage() {
  const userId = useCurrentUserId()
  const [dashboard, setDashboard] = useState<Loadable<DashboardData>>({ status: "loading" })
  // Same streak the Streak page shows (/api/dashboard's own count ignores yesterday's grace day)
  const [streak, setStreak] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [pref, setPref] = useState<AutoSendPref>({ enabled: false, enabledAt: null })
  const [history, setHistory] = useState<SendRecord[]>([])
  const autoAttemptedRef = useRef(false)

  // ----- data -----
  const loadPreview = useCallback(() => {
    if (userId === null) return
    setDashboard({ status: "loading" })
    getJson<DashboardData>(`/dashboard/${userId}`)
      .then((data) => setDashboard({ status: "ready", data }))
      .catch(() => setDashboard({ status: "error" }))
    getJson<{ currentStreak: number }>(`/studylog/streak/${userId}`)
      .then((data) => setStreak(data.currentStreak))
      .catch(() => setStreak(null))
  }, [userId])

  useEffect(() => {
    loadPreview()
  }, [loadPreview])

  // ----- localStorage -----
  useEffect(() => {
    setPref(readJson(PREF_KEY, { enabled: false, enabledAt: null }, isPref))
    setHistory(readJson(HISTORY_KEY, [], isHistory))
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) writeJson(PREF_KEY, pref)
  }, [pref, hydrated])

  useEffect(() => {
    if (hydrated) writeJson(HISTORY_KEY, history)
  }, [history, hydrated])

  // ----- sending -----
  const send = useCallback(async (trigger: SendRecord["trigger"]) => {
    if (userId === null) return
    setSending(true)
    try {
      await sendReport(userId)
      setHistory((h) => [{ at: new Date().toISOString(), ok: true, trigger }, ...h].slice(0, HISTORY_LIMIT))
      toast.success(trigger === "auto" ? "✅ Weekly report sent to both emails!" : "✅ Report sent to both emails!")
    } catch (err) {
      const detail = err instanceof Error ? err.message : "Unknown error"
      setHistory((h) => [{ at: new Date().toISOString(), ok: false, trigger, detail }, ...h].slice(0, HISTORY_LIMIT))
      toast.error("Couldn't send the report.", {
        description: detail,
        action: { label: "Retry", onClick: () => void send("manual") },
      })
    } finally {
      setSending(false)
    }
  }, [userId])

  // Weekly auto-send: runs once per page load, only when a Monday has passed since the last send
  useEffect(() => {
    if (!hydrated || userId === null || autoAttemptedRef.current) return
    autoAttemptedRef.current = true
    if (isAutoSendDue(pref, history, new Date())) void send("auto")
  }, [hydrated, userId, pref, history, send])

  const toggleAuto = (enabled: boolean) => {
    setPref({ enabled, enabledAt: enabled ? new Date().toISOString() : null })
    toast(enabled ? "Weekly Monday report turned on." : "Weekly report turned off.")
  }

  const now = new Date()
  const upcoming = pref.enabled ? nextScheduled(pref, history, now) : null
  const preview = dashboard.status === "ready" ? dashboard.data : null
  const shownStreak = streak ?? preview?.currentStreak ?? 0

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

        {/* 1. Recipients */}
        <section className="surface rounded-2xl border border-primary/30 p-5 shadow-raised sm:p-6">
          <h1 className="flex items-center gap-2 text-xl font-bold text-foreground sm:text-2xl">
            <span aria-hidden>👨‍👧</span> Parent Report
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Report goes to:</p>
          <ul className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {RECIPIENTS.map(({ role, email }) => (
              <li
                key={email}
                className="flex min-w-0 items-center gap-2 rounded-full border border-success/40 bg-success/10 py-1.5 pl-2 pr-3 text-sm"
              >
                <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-label="Recipient" />
                <span className="text-xs text-muted-foreground">{role}</span>
                <span className="min-w-0 truncate font-medium text-foreground">{email}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* 2. Preview */}
        <section className="surface card-interactive rounded-2xl border border-border p-5 sm:p-6" aria-label="Report preview">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <Mail className="h-5 w-5 text-primary-soft" />
              What they&apos;ll receive
            </h2>
            <Button variant="ghost" size="sm" onClick={loadPreview} disabled={dashboard.status === "loading"}>
              <RefreshCw className={cn("h-4 w-4", dashboard.status === "loading" && "animate-spin")} />
              Refresh
            </Button>
          </div>

          {dashboard.status === "loading" ? (
            <div className="space-y-3" aria-busy>
              <Skeleton className="h-6 w-40 bg-muted" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-20 bg-muted" />
                <Skeleton className="h-20 bg-muted" />
              </div>
              <Skeleton className="h-16 bg-muted" />
              <Skeleton className="h-16 bg-muted" />
            </div>
          ) : dashboard.status === "error" || !preview ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <XCircle className="h-8 w-8 text-destructive" />
              <p className="text-sm text-muted-foreground">
                Couldn&apos;t load the report preview. Is the backend running on port 8081?
              </p>
              <Button variant="outline" size="sm" onClick={loadPreview}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </div>
          ) : (
            <div className="space-y-4 rounded-xl border border-border bg-background/40 p-4">
              <p className="text-sm text-muted-foreground">
                Weekly progress report for <span className="font-semibold text-foreground">{preview.name}</span>
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">🔥 Current streak</p>
                  <p className="text-2xl font-bold text-foreground">
                    {shownStreak} {shownStreak === 1 ? "day" : "days"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-card/60 p-3">
                  <p className="text-xs text-muted-foreground">📊 Average quiz score</p>
                  <p
                    className={cn(
                      "text-2xl font-bold",
                      (preview.totalQuizzesTaken ?? 1) === 0
                        ? "text-foreground"
                        : preview.averageScore >= 60
                          ? "text-success"
                          : "text-destructive"
                    )}
                  >
                    {(preview.totalQuizzesTaken ?? 1) === 0 ? "No quizzes" : `${Math.round(preview.averageScore * 10) / 10}%`}
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs text-muted-foreground">⚠️ Weak topics</p>
                {preview.weakTopics.length === 0 ? (
                  <p className="flex items-center gap-2 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" /> No weak topics, great work!
                  </p>
                ) : (
                  <ul className="space-y-1.5">
                    {preview.weakTopics.map((t) => (
                      <li
                        key={`${t.subject}-${t.chapter}`}
                        className="flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                          <span className="truncate text-foreground">
                            {t.chapter} <span className="text-muted-foreground">({t.subject})</span>
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold text-destructive">{Math.round(t.averageScore)}%</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
                <p className="mb-1 text-xs text-muted-foreground">💬 Message from Alex</p>
                <p className="text-sm leading-relaxed text-foreground">{preview.motivationMessage}</p>
              </div>
            </div>
          )}
        </section>

        {/* 3. Send now */}
        <Button
          size="lg"
          onClick={() => void send("manual")}
          disabled={sending}
          className="h-14 w-full text-base"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          {sending ? "Sending..." : "Send Report Now"}
        </Button>

        <div className="grid gap-6 md:grid-cols-2">
          {/* 4. Auto-send */}
          <section className="surface card-interactive space-y-3 rounded-2xl border border-border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 font-semibold text-foreground">
                  <CalendarClock className="h-5 w-5 text-primary-soft" />
                  Weekly report
                </h2>
                <label htmlFor="auto-send" className="text-sm text-muted-foreground">
                  Send weekly report every Monday
                </label>
              </div>
              <Switch id="auto-send" checked={pref.enabled} onCheckedChange={toggleAuto} disabled={!hydrated} />
            </div>
            {pref.enabled && upcoming ? (
              <p className="rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-foreground">
                Next report:{" "}
                <span className="font-semibold">
                  {startOfDay(upcoming).getTime() === startOfDay(now).getTime() ? "Today" : formatDate(upcoming)}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Off. Reports are only sent when you press the button.</p>
            )}
            <p className="text-xs text-muted-foreground">
              Browsers can&apos;t send email while closed, so the weekly report goes out the first time this page is opened
              on or after Monday.
            </p>
          </section>

          {/* 5. History */}
          <section className="surface card-interactive space-y-3 rounded-2xl border border-border p-5">
            <h2 className="flex items-center gap-2 font-semibold text-foreground">
              <History className="h-5 w-5 text-primary-soft" />
              Recent sends
            </h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reports sent from this browser yet.</p>
            ) : (
              <ul className="space-y-2">
                {history.map((r) => (
                  <li key={r.at} className="flex items-start gap-2 text-sm">
                    {r.ok ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Sent" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="Failed" />
                    )}
                    <div className="min-w-0">
                      <p className="text-foreground">
                        {formatTimestamp(r.at)}
                        <span className="ml-2 text-xs text-muted-foreground">
                          {r.trigger === "auto" ? "Weekly" : "Manual"} · {r.ok ? "Sent" : "Failed"}
                        </span>
                      </p>
                      {!r.ok && r.detail && <p className="text-xs text-muted-foreground">{r.detail}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>

      <Toaster theme="dark" position="top-center" richColors closeButton />
    </div>
  )
}
