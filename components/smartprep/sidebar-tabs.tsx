"use client"

import { History, Sparkles, Trash2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { SidebarTab } from "./dashboard-store"

interface SidebarTabsProps {
  active: SidebarTab
  onChange: (tab: SidebarTab) => void
  historyCount: number
  onClearHistory: () => void
}

const TABS: ReadonlyArray<{ value: SidebarTab; label: string; icon: typeof History }> = [
  { value: "recommended", label: "Recommended", icon: Sparkles },
  { value: "history", label: "History", icon: History },
]

export function SidebarTabs({ active, onChange, historyCount, onClearHistory }: SidebarTabsProps) {
  return (
    <div className="flex items-center gap-2">
      <div role="tablist" aria-label="Video list" className="flex flex-1 gap-1 rounded-xl border border-border bg-background/40 p-1">
        {TABS.map(({ value, label, icon: Icon }) => {
          const selected = active === value
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(value)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
                selected ? "icon-gradient" : "text-muted-foreground hover:bg-primary/15 hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
              {value === "history" && historyCount > 0 && (
                <span className={cn("rounded-full px-1.5 text-[10px] tabular-nums", selected ? "bg-black/15" : "bg-muted")}>
                  {historyCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {active === "history" && historyCount > 0 && (
        <AlertDialog>
          <AlertDialogTrigger
            className="shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/15 hover:text-destructive"
            aria-label="Clear history"
            title="Clear history"
          >
            <Trash2 className="h-4 w-4" />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Clear your video history?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes all {historyCount} {historyCount === 1 ? "video" : "videos"} from your history on this
                device. It can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onClearHistory} className={buttonVariants({ variant: "destructive" })}>
                Clear history
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
