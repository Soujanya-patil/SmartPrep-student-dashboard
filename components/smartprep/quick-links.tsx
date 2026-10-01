"use client"

import { useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { ChevronRight, Mail, Timer } from "lucide-react"
import { cn } from "@/lib/utils"

// Written by the /timer page (app/timer/page.tsx)
const TIMER_STORAGE_KEY = "smartprep.timer-page.v1"

interface StoredTimer {
  mode: "study" | "break"
  running: boolean
  endsAt: number | null
}

function readRunningTimer(): StoredTimer | null {
  try {
    const raw = window.localStorage.getItem(TIMER_STORAGE_KEY)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== "object" || parsed === null) return null
    const t = parsed as Record<string, unknown>
    if (t.running !== true || typeof t.endsAt !== "number" || t.endsAt <= Date.now()) return null
    return { mode: t.mode === "break" ? "break" : "study", running: true, endsAt: t.endsAt }
  } catch {
    return null
  }
}

function QuickLink({
  href,
  icon,
  title,
  description,
  highlight,
}: {
  href: string
  icon: ReactNode
  title: string
  description: string
  highlight?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "surface card-interactive group flex items-center gap-3 rounded-xl border p-4 transition-all hover:-translate-y-0.5 active:translate-y-0",
        highlight ? "tint-success border-success/50" : "border-border"
      )}
    >
      <div className="shrink-0 rounded-lg border border-primary/30 bg-primary/15 p-2.5 text-primary-soft">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <p className={cn("truncate text-xs", highlight ? "text-success" : "text-muted-foreground")}>{description}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary-soft" />
    </Link>
  )
}

export function QuickLinks({ className }: { className?: string }) {
  // Read after mount so the server HTML and the first client render match
  const [timer, setTimer] = useState<StoredTimer | null>(null)
  useEffect(() => {
    setTimer(readRunningTimer())
  }, [])

  const timerDescription = timer?.endsAt
    ? `${timer.mode === "study" ? "Study" : "Break"} running · ends at ${new Date(timer.endsAt).toLocaleTimeString(undefined, {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "25-min focus sessions, saved to your streak"

  return (
    <div className={cn("grid gap-3 sm:grid-cols-2", className)}>
      <QuickLink
        href="/timer"
        icon={<Timer className="h-5 w-5" />}
        title="Pomodoro timer"
        description={timerDescription}
        highlight={timer !== null}
      />
      <QuickLink
        href="/parent"
        icon={<Mail className="h-5 w-5" />}
        title="Parent report"
        description="Email your progress to your parent"
      />
    </div>
  )
}
