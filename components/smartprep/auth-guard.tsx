"use client"

import { useEffect, type ReactNode } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Spinner } from "@/components/ui/spinner"
import { isPublicPath, useStoredUser } from "@/lib/auth"

// Client-side route protection: a server proxy/middleware can't read localStorage
export function AuthGuard({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useStoredUser()
  const isPublic = isPublicPath(pathname)
  const mustLeave = !isPublic && user === null

  useEffect(() => {
    if (mustLeave) router.replace("/landing")
  }, [mustLeave, router])

  if (isPublic) return <>{children}</>

  // Hold protected content until storage has been checked, so it never flashes for logged-out visitors
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-3 text-muted-foreground">
        <Spinner className="size-5 text-primary-soft" />
        <span className="text-sm">{user === null ? "Redirecting…" : "Loading…"}</span>
      </div>
    )
  }

  return <>{children}</>
}
