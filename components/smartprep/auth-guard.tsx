"use client"

import { useEffect, useRef, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { useCurrentUser } from "@/hooks/use-current-user"
import { isPublicPath, useSession } from "@/lib/auth"

// Client-side route protection: a server proxy/middleware can't read localStorage
export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const isPublic = isPublicPath(pathname)
  const session = useSession()
  // Clears a stale session (no numeric userId) and sends the browser to /login
  const { user } = useCurrentUser()

  // Once a stale session has been cleared, storage reads "none": keep heading to /login, not /landing
  const wasStaleRef = useRef(false)
  useEffect(() => {
    if (session.status === "stale") wasStaleRef.current = true
  }, [session.status])
  const mustLeave = !isPublic && session.status === "none"

  useEffect(() => {
    if (mustLeave) router.replace(wasStaleRef.current ? "/login" : "/landing")
  }, [mustLeave, router])

  if (isPublic) return <>{children}</>

  // Hold protected content until storage has been checked, so it never flashes for logged-out visitors
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
        <Spinner className="size-5 text-primary-soft" />
        <span className="text-sm">{session.status === "loading" ? "Loading…" : "Redirecting…"}</span>
      </div>
    )
  }

  return <>{children}</>
}
