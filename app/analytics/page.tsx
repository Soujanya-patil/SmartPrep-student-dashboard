"use client"

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  Flame,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts"
import { Header } from "@/components/smartprep/header"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-mobile"
import { API_BASE_URL } from "@/lib/api"

// ---------- API shapes (as returned by the Spring Boot backend) ----------

interface StudyDay {
  date: string // yyyy-MM-dd
  hoursStudied: number
  goalMet: boolean
}

interface QuizAttempt {
  id: number
  subject: string
  chapter: string
  score: number // correct answers, not a percentage
  totalQuestions: number
  attemptedAt: string // local ISO date-time
}

interface WeakTopic {
  subject: string
  chapter: string
  averageScore: number // percentage
}

interface Streak {
  currentStreak: number
  longestStreak: number
}

type Loadable<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T }

// ---------- chart constants ----------

const USER_ID = 1
const WEAK_THRESHOLD = 60

// Mirrors the theme tokens in globals.css (Recharts needs concrete colors for SVG attributes)
const COLORS = {
  barFrom: "#7c5cff", // --primary (bar base)
  barTo: "#22d3ee", // --info (bar top)
  line: "#22d3ee", // --info
  good: "#34d399", // --success: strong topics
  critical: "#fb7185", // --destructive: weak topics (status is also shown with icons, never color alone)
  grid: "#262f5c", // --border
  axisText: "#8f9bc7", // --muted-foreground
  text: "#f1f5ff", // --foreground
  surface: "#0f1530", // --card
  cursor: "rgba(124, 92, 255, 0.12)",
} as const

const BAR_GRADIENT_ID = "study-hours-gradient"

const AXIS_TICK = { fill: COLORS.axisText, fontSize: 12 }

// ---------- helpers ----------

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: { Accept: "application/json" } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return (await response.json()) as T
}

function settle<T>(result: PromiseSettledResult<T>): Loadable<T> {
  return result.status === "fulfilled" ? { status: "ready", data: result.value } : { status: "error" }
}

// "yyyy-MM-dd" as a local date (new Date("yyyy-MM-dd") would parse it as UTC)
function parseLocalDate(isoDate: string): Date {
  const [year, month, day] = isoDate.split("-").map(Number)
  return new Date(year, month - 1, day)
}

function percent(score: number, total: number): number {
  return total > 0 ? Math.round((score / total) * 1000) / 10 : 0
}

function formatHours(hours: number): string {
  const totalMinutes = Math.round(hours * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  if (h === 0) return `${m} m`
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

function topicLabel(chapter: string, subject: string): string {
  return chapter ? `${chapter} (${subject})` : subject
}

// Axis labels only; the tooltip and table always show the full name
function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

// ---------- shared UI ----------

function ChartTooltip({ active, payload }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as { tooltipTitle: string; tooltipLines: string[] }
  return (
    <div className="rounded-lg border border-primary/40 bg-popover/95 px-3 py-2 text-xs shadow-overlay backdrop-blur">
      <p className="mb-1 font-semibold text-foreground">{row.tooltipTitle}</p>
      {row.tooltipLines.map((line) => (
        <p key={line} className="text-muted-foreground">
          {line}
        </p>
      ))}
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  loading,
  error,
}: {
  icon: ReactNode
  label: string
  value: string
  loading: boolean
  error: boolean
}) {
  return (
    <div className="surface card-interactive flex items-center gap-3 rounded-xl border border-border p-4">
      <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/15 p-2.5 text-primary-soft">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? (
          <Skeleton className="mt-1 h-7 w-16 bg-muted" />
        ) : (
          <p className="whitespace-nowrap text-xl font-bold text-foreground sm:text-2xl" title={error ? "Couldn't load from the backend" : undefined}>
            {error ? "—" : value}
          </p>
        )}
      </div>
    </div>
  )
}

function ChartCard({
  title,
  description,
  icon,
  children,
}: {
  title: string
  description: string
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <section className="surface card-interactive rounded-2xl border border-border p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-2">
        <div className="mt-0.5 text-primary-soft">{icon}</div>
        <div>
          <h2 className="font-semibold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      {children}
    </section>
  )
}

function ChartSkeleton({ height }: { height: number }) {
  return (
    <div className="flex items-end gap-3 px-2" style={{ height }} aria-busy aria-label="Loading chart">
      {[45, 70, 30, 85, 55, 65, 40].map((h, i) => (
        <Skeleton key={i} className="flex-1 bg-muted" style={{ height: `${h}%` }} />
      ))}
    </div>
  )
}

function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="rounded-full border border-primary/30 bg-primary/10 p-3 text-primary-soft">{icon}</div>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {children && <div className="max-w-sm text-xs text-muted-foreground">{children}</div>}
    </div>
  )
}

function ErrorState({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertCircle className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm text-muted-foreground">Couldn&apos;t load {what}. Is the backend running on port 8081?</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="h-4 w-4" />
        Try again
      </Button>
    </div>
  )
}

// The WCAG-clean twin of each chart: every value is readable without hover or color
function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View as table</summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              {headers.map((h) => (
                <th key={h} scope="col" className="px-2 py-1.5 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-border/50 text-foreground">
                {row.map((cell, j) => (
                  <td key={j} className="px-2 py-1.5 tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  )
}

// ---------- page ----------

export default function AnalyticsPage() {
  const [week, setWeek] = useState<Loadable<StudyDay[]>>({ status: "loading" })
  const [history, setHistory] = useState<Loadable<QuizAttempt[]>>({ status: "loading" })
  const [weakTopics, setWeakTopics] = useState<Loadable<WeakTopic[]>>({ status: "loading" })
  const [streak, setStreak] = useState<Loadable<Streak>>({ status: "loading" })
  const isMobile = useIsMobile()

  // Each request settles independently, so one failing endpoint never blanks the whole page
  const loadAll = useCallback(async () => {
    setWeek({ status: "loading" })
    setHistory({ status: "loading" })
    setWeakTopics({ status: "loading" })
    setStreak({ status: "loading" })

    const [w, h, t, s] = await Promise.allSettled([
      getJson<StudyDay[]>(`/study/week/${USER_ID}`),
      getJson<QuizAttempt[]>(`/results/history/${USER_ID}`),
      getJson<WeakTopic[]>(`/results/weak-topics/${USER_ID}`),
      // /study/streak returns a sentence; /studylog/streak returns numbers
      getJson<Streak>(`/studylog/streak/${USER_ID}`),
    ])
    setWeek(settle(w))
    setHistory(settle(h))
    setWeakTopics(settle(t))
    setStreak(settle(s))
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // ----- derived chart data -----

  const weekData = useMemo(() => {
    if (week.status !== "ready") return []
    return week.data.map((d) => {
      const date = parseLocalDate(d.date)
      const fullLabel = date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "short" })
      return {
        day: date.toLocaleDateString(undefined, { weekday: "short" }),
        hours: Math.round(d.hoursStudied * 100) / 100,
        fullLabel,
        tooltipTitle: fullLabel,
        tooltipLines: [`Studied: ${formatHours(d.hoursStudied)}`, ...(d.goalMet ? ["Daily goal met ✓"] : [])],
      }
    })
  }, [week])

  const quizData = useMemo(() => {
    if (history.status !== "ready") return []
    return [...history.data]
      .sort((a, b) => new Date(a.attemptedAt).getTime() - new Date(b.attemptedAt).getTime())
      .map((q, index) => {
        const when = new Date(q.attemptedAt)
        const pct = percent(q.score, q.totalQuestions)
        return {
          attempt: index + 1,
          dateLabel: when.toLocaleDateString(undefined, { day: "numeric", month: "short" }),
          score: pct,
          topic: topicLabel(q.chapter, q.subject),
          when: when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
          tooltipTitle: topicLabel(q.chapter, q.subject),
          tooltipLines: [
            `Score: ${pct}% (${q.score}/${q.totalQuestions})`,
            when.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }),
          ],
        }
      })
  }, [history])

  // Per-topic averages from quiz history (same formula as the backend's weak-topic query), so topics
  // at or above 60% appear too. Falls back to the weak-topics endpoint if history is unavailable.
  const topicData = useMemo(() => {
    let rows: { subject: string; chapter: string; averageScore: number; attempts: number | null }[] = []
    if (history.status === "ready" && history.data.length > 0) {
      const groups = new Map<string, { subject: string; chapter: string; sum: number; count: number }>()
      for (const q of history.data) {
        const key = `${q.subject}|${q.chapter}`
        const g = groups.get(key) ?? { subject: q.subject, chapter: q.chapter, sum: 0, count: 0 }
        g.sum += q.totalQuestions > 0 ? (q.score * 100) / q.totalQuestions : 0
        g.count += 1
        groups.set(key, g)
      }
      rows = [...groups.values()].map((g) => ({
        subject: g.subject,
        chapter: g.chapter,
        averageScore: Math.round((g.sum / g.count) * 10) / 10,
        attempts: g.count,
      }))
    } else if (weakTopics.status === "ready") {
      rows = weakTopics.data.map((t) => ({ ...t, averageScore: Math.round(t.averageScore * 10) / 10, attempts: null }))
    }

    return rows
      .sort((a, b) => a.averageScore - b.averageScore) // weakest first
      .map((r) => {
        const weak = r.averageScore < WEAK_THRESHOLD
        const label = topicLabel(r.chapter, r.subject)
        return {
          label,
          score: r.averageScore,
          weak,
          tooltipTitle: label,
          tooltipLines: [
            `Average: ${r.averageScore}%`,
            weak ? "⚠ Needs work (below 60%)" : "✓ On track (60% or more)",
            ...(r.attempts !== null ? [`${r.attempts} ${r.attempts === 1 ? "attempt" : "attempts"}`] : []),
          ],
        }
      })
  }, [history, weakTopics])

  const topicsLoading =
    history.status === "loading" || (history.status !== "ready" && weakTopics.status === "loading")
  const topicsError = history.status === "error" && weakTopics.status === "error"

  // ----- summary numbers -----

  const weekTotal = week.status === "ready" ? week.data.reduce((sum, d) => sum + d.hoursStudied, 0) : 0
  const averageQuiz =
    history.status === "ready" && history.data.length > 0
      ? Math.round(
          (history.data.reduce((sum, q) => sum + (q.totalQuestions > 0 ? (q.score * 100) / q.totalQuestions : 0), 0) /
            history.data.length) *
            10
        ) / 10
      : null

  const weekHasData = weekData.some((d) => d.hours > 0)
  const maxHours = Math.max(1, ...weekData.map((d) => d.hours))

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-6xl flex-1 space-y-6 px-4 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-info"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-foreground">Your Progress</h1>
            <p className="text-sm text-muted-foreground">Study time, quiz scores and topics to focus on</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadAll()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Summary cards */}
        <section aria-label="Summary" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            icon={<Clock className="h-5 w-5" />}
            label="Study time this week"
            value={formatHours(weekTotal)}
            loading={week.status === "loading"}
            error={week.status === "error"}
          />
          <StatCard
            icon={<Target className="h-5 w-5" />}
            label="Average quiz score"
            value={averageQuiz === null ? "No quizzes" : `${averageQuiz}%`}
            loading={history.status === "loading"}
            error={history.status === "error"}
          />
          <StatCard
            icon={<Flame className="h-5 w-5" />}
            label="Current streak"
            value={
              streak.status === "ready"
                ? `${streak.data.currentStreak} ${streak.data.currentStreak === 1 ? "day" : "days"}`
                : ""
            }
            loading={streak.status === "loading"}
            error={streak.status === "error"}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5" />}
            label="Weak topics"
            value={weakTopics.status === "ready" ? String(weakTopics.data.length) : ""}
            loading={weakTopics.status === "loading"}
            error={weakTopics.status === "error"}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* 1. Study hours */}
          <ChartCard
            title="Study hours"
            description="Last 7 days"
            icon={<BarChart3 className="h-5 w-5" />}
          >
            {week.status === "loading" ? (
              <ChartSkeleton height={256} />
            ) : week.status === "error" ? (
              <ErrorState what="study hours" onRetry={() => void loadAll()} />
            ) : !weekHasData ? (
              <EmptyState icon={<Clock className="h-6 w-6" />} title="No study time logged this week">
                Finish a session on the{" "}
                <Link href="/timer" className="text-info underline-offset-4 hover:underline">
                  Pomodoro timer
                </Link>{" "}
                and it will show up here.
              </EmptyState>
            ) : (
              <>
                <div className="h-64 [&_.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weekData} margin={{ top: 20, right: 8, left: -8, bottom: 0 }}>
                      <defs>
                        <linearGradient id={BAR_GRADIENT_ID} x1="0" y1="1" x2="0" y2="0">
                          <stop offset="0%" stopColor={COLORS.barFrom} />
                          <stop offset="100%" stopColor={COLORS.barTo} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid vertical={false} stroke={COLORS.grid} />
                      <XAxis dataKey="day" tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: COLORS.grid }} />
                      <YAxis
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        allowDecimals
                        width={40}
                        tickFormatter={(v: number) => `${v}h`}
                        domain={[0, Math.ceil(maxHours)]}
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ fill: COLORS.cursor }} />
                      <Bar
                        dataKey="hours"
                        name="Hours"
                        fill={`url(#${BAR_GRADIENT_ID})`}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={36}
                        isAnimationActive={false}
                      >
                        {/* Direct-label only the best day */}
                        <LabelList
                          dataKey="hours"
                          position="top"
                          fill={COLORS.text}
                          fontSize={11}
                          formatter={(v: number) => (v === maxHours && v > 0 ? `${v}h` : "")}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <DataTable
                  headers={["Day", "Hours studied"]}
                  rows={weekData.map((d) => [d.fullLabel, formatHours(d.hours)])}
                />
              </>
            )}
          </ChartCard>

          {/* 2. Quiz performance */}
          <ChartCard
            title="Quiz performance"
            description="Score per attempt, oldest to newest · dashed line = 60% target"
            icon={<TrendingUp className="h-5 w-5" />}
          >
            {history.status === "loading" ? (
              <ChartSkeleton height={256} />
            ) : history.status === "error" ? (
              <ErrorState what="quiz history" onRetry={() => void loadAll()} />
            ) : quizData.length === 0 ? (
              <EmptyState icon={<TrendingUp className="h-6 w-6" />} title="No quizzes yet">
                Take a quiz and your scores will be charted here.
              </EmptyState>
            ) : (
              <>
                <div className="h-64 [&_.">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={quizData} margin={{ top: 12, right: 16, left: -8, bottom: 0 }}>
                      <CartesianGrid vertical={false} stroke={COLORS.grid} />
                      <XAxis
                        dataKey="attempt"
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={{ stroke: COLORS.grid }}
                        tickFormatter={(attempt: number) => quizData[attempt - 1]?.dateLabel ?? ""}
                        interval="preserveStartEnd"
                        minTickGap={16}
                        padding={{ left: 16, right: 16 }}
                      />
                      <YAxis
                        tick={AXIS_TICK}
                        tickLine={false}
                        axisLine={false}
                        width={44}
                        domain={[0, 100]}
                        ticks={[0, 20, 40, 60, 80, 100]}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <ReferenceLine
                        y={WEAK_THRESHOLD}
                        stroke={COLORS.axisText}
                        strokeDasharray="4 4"
                      />
                      <Tooltip content={<ChartTooltip />} cursor={{ stroke: COLORS.axisText, strokeWidth: 1 }} />
                      <Line
                        type="monotone"
                        dataKey="score"
                        name="Score"
                        stroke={COLORS.line}
                        strokeWidth={2.5}
                        dot={{ r: 4, fill: COLORS.line, stroke: COLORS.surface, strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: COLORS.line, stroke: COLORS.surface, strokeWidth: 2 }}
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                {quizData.length < 2 && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Take a few more quizzes to see your trend.
                  </p>
                )}
                <DataTable
                  headers={["#", "Taken", "Topic", "Score"]}
                  rows={quizData.map((q) => [String(q.attempt), q.when, q.topic, `${q.score}%`])}
                />
              </>
            )}
          </ChartCard>
        </div>

        {/* 3. Topic scores */}
        <ChartCard
          title="Topic scores"
          description="Average quiz score per chapter, weakest first · dashed line = 60%"
          icon={<Target className="h-5 w-5" />}
        >
          {topicsLoading ? (
            <ChartSkeleton height={200} />
          ) : topicsError ? (
            <ErrorState what="topic scores" onRetry={() => void loadAll()} />
          ) : topicData.length === 0 ? (
            <EmptyState icon={<CheckCircle2 className="h-6 w-6" />} title="No topic scores yet">
              Your per-chapter averages will appear after your first quiz.
            </EmptyState>
          ) : (
            <>
              {/* Legend: icon + label, so status never relies on color alone */}
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.critical }} />
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Needs work (below {WEAK_THRESHOLD}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS.good }} />
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  On track ({WEAK_THRESHOLD}% or more)
                </span>
              </div>
              <div style={{ height: topicData.length * 44 + 40 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={topicData}
                    layout="vertical"
                    margin={{ top: 4, right: isMobile ? 48 : 56, left: 0, bottom: 0 }}
                    barCategoryGap={8}
                  >
                    <CartesianGrid horizontal={false} stroke={COLORS.grid} />
                    <XAxis
                      type="number"
                      domain={[0, 100]}
                      ticks={[0, 20, 40, 60, 80, 100]}
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={{ stroke: COLORS.grid }}
                      tickFormatter={(v: number) => `${v}%`}
                    />
                    <YAxis
                      type="category"
                      dataKey="label"
                      tick={AXIS_TICK}
                      tickLine={false}
                      axisLine={false}
                      width={isMobile ? 96 : 150}
                      tickFormatter={(label: string) => truncate(label, isMobile ? 24 : 40)}
                    />
                    <ReferenceLine x={WEAK_THRESHOLD} stroke={COLORS.axisText} strokeDasharray="4 4" />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: COLORS.cursor }} />
                    <Bar dataKey="score" name="Average score" radius={[0, 4, 4, 0]} maxBarSize={28} isAnimationActive={false}>
                      {topicData.map((t) => (
                        <Cell key={t.label} fill={t.weak ? COLORS.critical : COLORS.good} />
                      ))}
                      <LabelList
                        dataKey="score"
                        position="right"
                        fill={COLORS.text}
                        fontSize={12}
                        formatter={(v: number) => `${v < WEAK_THRESHOLD ? "⚠" : "✓"} ${v}%`}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <DataTable
                headers={["Topic", "Average score", "Status"]}
                rows={topicData.map((t) => [t.label, `${t.score}%`, t.weak ? "Needs work" : "On track"])}
              />
            </>
          )}
        </ChartCard>
      </main>
    </div>
  )
}
