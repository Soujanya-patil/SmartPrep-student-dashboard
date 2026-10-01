"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, Brain, GraduationCap, LayoutDashboard, Mic, Sparkles, Timer, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const NAV_ITEMS: ReadonlyArray<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quiz", label: "Quiz", icon: Brain },
  { href: "/timer", label: "Timer", icon: Timer },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/interview", label: "Interview", icon: Mic },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="relative border-b border-border bg-gradient-to-r from-card via-primary/10 to-info/5 overflow-hidden">
      {/* Glowing border effect */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-accent opacity-80 animate-pulse" />

      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2.5 rounded-xl icon-gradient">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
              <Sparkles className="h-2.5 w-2.5 text-success-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gradient">
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
                    "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-medium transition-all sm:flex-none sm:flex-row sm:gap-1.5 sm:px-3 sm:text-sm",
                    active
                      ? "icon-gradient"
                      : "text-muted-foreground hover:bg-primary/15 hover:text-foreground  active:scale-95"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              )
            })}
          </nav>

          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-info/10 border border-info/25">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-info font-medium">Focus Mode</span>
          </div>
        </div>
      </div>
    </header>
  )
}
