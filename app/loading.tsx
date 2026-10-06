import { Spinner } from "@/components/ui/spinner"

// Shown while a page's code is loading during navigation, so the screen is never blank
export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center gap-3 bg-background text-muted-foreground">
      <Spinner className="size-5 text-primary-soft" />
      <span className="text-sm">Loading…</span>
    </div>
  )
}
