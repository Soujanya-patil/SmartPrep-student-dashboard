import { useMemo, useSyncExternalStore } from "react"
import { API_BASE_URL, ApiError } from "./api"

// localStorage-only auth: the browser keeps the logged-in user, the backend issues no session or token
export const AUTH_STORAGE_KEY = "smartprep_user"

// Pages reachable without logging in; everything else goes through <AuthGuard>
export const PUBLIC_PATHS: ReadonlyArray<string> = ["/landing", "/login", "/register"]

// Same-tab writes don't fire the "storage" event, so saveUser/clearUser announce themselves
const AUTH_CHANGE_EVENT = "smartprep:auth-change"

// Values must match the backend enum com.smartprep.model.User.Role (it also has SIBLING, not offered at sign-up)
export type UserRole = "NEET_STUDENT" | "PLACEMENT_STUDENT"

export const USER_ROLES: ReadonlyArray<{ value: UserRole; label: string }> = [
  { value: "NEET_STUDENT", label: "NEET" },
  { value: "PLACEMENT_STUDENT", label: "Placement" },
]

export interface StoredUser {
  // null when the backend's login reply carries no id (plain "Login successful! Welcome {name}" text)
  userId: number | null
  name: string
  email: string
}

export interface RegisterPayload {
  name: string
  email: string
  password: string
  role: UserRole
}

// ---------- storage (every access guarded: storage can be unavailable) ----------

function isStoredUser(v: unknown): v is StoredUser {
  if (typeof v !== "object" || v === null) return false
  const o = v as Record<string, unknown>
  return (
    (o.userId === null || typeof o.userId === "number") &&
    typeof o.name === "string" &&
    typeof o.email === "string"
  )
}

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(AUTH_STORAGE_KEY)
  } catch {
    return null
  }
}

function parseUser(raw: string | null): StoredUser | null {
  if (!raw) return null
  try {
    const parsed: unknown = JSON.parse(raw)
    return isStoredUser(parsed) ? parsed : null
  } catch {
    return null
  }
}

export function getStoredUser(): StoredUser | null {
  return parseUser(readRaw())
}

export function saveUser(user: StoredUser): void {
  try {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } catch {
    // Storage blocked (private mode etc.): the guard will send the user back to /landing
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

export function clearUser(): void {
  try {
    window.localStorage.removeItem(AUTH_STORAGE_KEY)
  } catch {
    // Nothing stored that we could remove
  }
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT))
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === AUTH_STORAGE_KEY) onChange()
  }
  window.addEventListener("storage", onStorage)
  window.addEventListener(AUTH_CHANGE_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onStorage)
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange)
  }
}

/**
 * The logged-in user, kept in sync across tabs.
 * `undefined` = not known yet (server render / hydration), `null` = logged out.
 */
export function useStoredUser(): StoredUser | null | undefined {
  // Snapshot is the raw string so React can compare it by value
  const raw = useSyncExternalStore<string | null | undefined>(subscribe, readRaw, () => undefined)
  return useMemo(() => (raw === undefined ? undefined : parseUser(raw)), [raw])
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(pathname)
}

// ---------- API ----------

async function postAuth(path: string, body: unknown): Promise<{ response: Response; data: unknown }> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: { Accept: "application/json, text/plain", "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  } catch {
    throw new ApiError("Cannot reach the SmartPrep server. Is the backend running on port 8081?")
  }

  // Login replies with plain text, register with JSON; errors may be either
  const text = await response.text().catch(() => "")
  let data: unknown = text
  try {
    data = JSON.parse(text)
  } catch {
    // Not JSON: keep the text
  }
  return { response, data }
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

// Pulls a readable message out of a text reply or a Spring error body ({ message, error })
function errorMessage(data: unknown, fallback: string): string {
  let message: unknown = data
  const record = asRecord(data)
  if (record) message = record.message || record.error
  if (typeof message !== "string") return fallback
  const trimmed = message.trim()
  // Ignore empty bodies and HTML error pages
  if (!trimmed || trimmed.startsWith("<")) return fallback
  return trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed
}

function toUserId(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v)
  return null
}

const LOGIN_SUCCESS = /^login successful!?\s*(?:welcome\s*)?(.*)$/i

export async function loginUser(email: string, password: string): Promise<StoredUser> {
  const { response, data } = await postAuth("/users/login", { email, password })
  const fallback = response.status === 401 ? "Invalid email or password." : `Login failed (HTTP ${response.status}).`
  if (!response.ok) throw new ApiError(errorMessage(data, fallback), response.status)

  // Current backend: "Login successful! Welcome {name}"; anything else in a 200 is its error text
  if (typeof data === "string") {
    const match = LOGIN_SUCCESS.exec(data.trim())
    if (!match) throw new ApiError(errorMessage(data, "Invalid email or password."), response.status)
    return { userId: null, name: match[1].trim() || email, email }
  }

  // Forward-compatible: a backend that returns the user object
  const record = asRecord(data)
  if (record) {
    const user = asRecord(record.user) ?? record
    const name = typeof user.name === "string" && user.name.trim() ? user.name.trim() : email
    const userEmail = typeof user.email === "string" && user.email ? user.email : email
    return { userId: toUserId(user.userId ?? user.id), name, email: userEmail }
  }

  throw new ApiError("Unexpected response from the server.", response.status)
}

export async function registerUser(payload: RegisterPayload): Promise<void> {
  const { response, data } = await postAuth("/users/register", payload)
  if (!response.ok) {
    const fallback =
      response.status === 409 ? "An account with this email already exists." : `Registration failed (HTTP ${response.status}).`
    throw new ApiError(errorMessage(data, fallback), response.status)
  }
}
