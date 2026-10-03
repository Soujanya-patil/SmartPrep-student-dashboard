"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Brain, Flame, GraduationCap, LayoutDashboard, Mic, Sparkles, Timer, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quiz", label: "Quiz", icon: Brain },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/streak", label: "Streak", icon: Flame },
  { href: "/interview", label: "Interview", icon: Mic },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="relative border-b border-border bg-gradient-to-r from-card via-primary/5 to-accent/5 overflow-hidden">
      {/* Glowing border effect */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />

      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
              <Sparkles className="h-2.5 w-2.5 text-success-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              SmartPrep
            </h1>
            <p className="text-xs text-muted-foreground">AI-Powered Study Dashboard</p>
          </div>
        </Link>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* Phones: full-width tab row under the logo (icon above label); from sm up: inline pills */}
          <nav aria-label="Main" className="flex flex-1 gap-1 rounded-xl border border-border bg-background/40 p-1 sm:flex-none">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const active = pathname === href
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-colors sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm",
                    active
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/30"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-primary font-medium">Focus Mode</span>
          </div>
        </div>
      </div>
    </header>
  )
}
