"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { clearUser, useSession, type StoredUser } from "@/lib/auth"

export interface CurrentUser {
  /** The logged-in user, or null while loading, logged out, or redirecting */
  user: StoredUser | null
  /** The logged-in user's id; null until it's known. Don't call user-specific APIs until it isn't null. */
  userId: number | null
  /** True until localStorage has been read on the client */
  loading: boolean
}

/**
 * The logged-in user. A stored session without a numeric userId (old sessions saved `userId: null`)
 * counts as logged out: storage is cleared and the browser goes to /login.
 */
export function useCurrentUser(): CurrentUser {
  const session = useSession()
  const router = useRouter()
  const stale = session.status === "stale"

  useEffect(() => {
    if (!stale) return
    clearUser()
    router.replace("/login")
  }, [stale, router])

  const user = session.status === "valid" ? session.user : null
  return { user, userId: user?.userId ?? null, loading: session.status === "loading" }
}

/** Shortcut for pages that only need the id */
export function useCurrentUserId(): number | null {
  return useCurrentUser().userId
}
