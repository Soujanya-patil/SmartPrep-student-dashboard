"use client"

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Brain,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trophy,
  XCircle,
} from "lucide-react"
import { Header } from "@/components/smartprep/header"
import { TopicSuggestions, suggestionOptionId } from "@/components/smartprep/topic-suggestions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { API_BASE_URL, suggestTopics } from "@/lib/api"
import { cn } from "@/lib/utils"

// ---------- types ----------

const SUBJECTS = ["Biology", "Physics", "Chemistry", "Maths"] as const
type Subject = (typeof SUBJECTS)[number]

type Stage = "setup" | "loading" | "quiz" | "results"

/** A question as the backend sends it (a saved QuizQuestion row); every field is checked before use */
interface RawQuestion {
  id?: unknown
  questionText?: unknown
  options?: unknown
  correctAnswer?: unknown
  explanation?: unknown
}

interface Question {
  key: string
  text: string
  options: string[]
  correctIndex: number
  explanation: string
}

interface AnswerRecord {
  selectedIndex: number | null // null = time ran out
  correct: boolean
}

type SubmitStatus = "idle" | "saving" | "saved" | "error"

// ---------- constants ----------

const USER_ID = 1
const QUIZ_LENGTH = 5
const SECONDS_PER_QUESTION = 30
const PASS_PERCENT = 60
const CONFETTI_PERCENT = 80
const GENERATE_TIMEOUT_MS = 90_000
const MIN_SUGGEST_LENGTH = 2
const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const

// ---------- parsing helpers ----------

function isSubject(value: string): value is Subject {
  return (SUBJECTS as readonly string[]).includes(value)
}

// "A) Mitosis", "(b) Meiosis", "C. Both" -> the text without its letter label
function stripOptionLabel(text: string): string {
  return text.replace(/^\s*\(?[A-Fa-f]\s*[).:\-]\s+/, "").trim()
}

function normalize(text: string): string {
  return stripOptionLabel(text).toLowerCase().replace(/\s+/g, " ").replace(/[.\s]+$/, "")
}

// The backend stores options as a JSON string, but AI output varies: accept an array, a JSON string,
// a single-quoted pseudo-JSON string, or newline/pipe-separated text
function parseOptions(value: unknown): string[] {
  let items: unknown[] = []
  if (Array.isArray(value)) {
    items = value
  } else if (typeof value === "string") {
    const raw = value.trim()
    const attempts = [raw, raw.replace(/'/g, '"')]
    for (const attempt of attempts) {
      try {
        const parsed: unknown = JSON.parse(attempt)
        if (Array.isArray(parsed)) {
          items = parsed
          break
        }
        if (typeof parsed === "string") {
          const inner: unknown = JSON.parse(parsed) // double-encoded
          if (Array.isArray(inner)) {
            items = inner
            break
          }
        }
      } catch {
        // try the next format
      }
    }
    if (items.length === 0 && /[\n|]/.test(raw)) items = raw.split(/\n|\|/)
  }
  return items
    .map((item) => (typeof item === "string" || typeof item === "number" ? stripOptionLabel(String(item)) : ""))
    .filter((item) => item.length > 0)
}

// correctAnswer should be the option text, but may come back as a letter ("B") or with a label ("B) ...")
function findCorrectIndex(correctAnswer: string, options: string[]): number {
  const target = normalize(correctAnswer)
  const exact = options.findIndex((o) => normalize(o) === target)
  if (exact !== -1) return exact

  const letter = correctAnswer.trim().match(/^\(?([A-Fa-f])\)?[.)]?$/)
  if (letter) {
    const index = letter[1].toUpperCase().charCodeAt(0) - 65
    if (index < options.length) return index
  }

  const partial = options.findIndex((o) => {
    const n = normalize(o)
    return target.length > 2 && (n.includes(target) || target.includes(n))
  })
  return partial
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

function toQuestion(raw: RawQuestion, index: number): Question | null {
  const text = typeof raw.questionText === "string" ? raw.questionText.trim() : ""
  const correctAnswer = typeof raw.correctAnswer === "string" ? raw.correctAnswer : String(raw.correctAnswer ?? "")
  const options = parseOptions(raw.options).slice(0, OPTION_LETTERS.length)
  if (!text || options.length < 2) return null

  const correctIndex = findCorrectIndex(correctAnswer, options)
  if (correctIndex === -1) return null

  // Shuffle options so a retake isn't just memorising positions; track where the answer went
  const order = shuffle(options.map((_, i) => i))
  return {
    key: `${String(raw.id ?? index)}-${index}`,
    text,
    options: order.map((i) => options[i]),
    correctIndex: order.indexOf(correctIndex),
    explanation: typeof raw.explanation === "string" ? raw.explanation.trim() : "",
  }
}

class QuizLoadError extends Error {
  detail?: string
  constructor(message: string, detail?: string) {
    super(message)
    this.name = "QuizLoadError"
    this.detail = detail
  }
}

async function fetchQuiz(subject: Subject, chapter: string, signal: AbortSignal): Promise<Question[]> {
  const params = new URLSearchParams({ subject, chapter })
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/quiz/generate?${params}`, { signal })
  } catch (err) {
    if (signal.aborted) throw err
    throw new QuizLoadError("Can't reach the SmartPrep server. Is the backend running on port 8081?")
  }
  if (!response.ok) throw new QuizLoadError(`The server returned an error (HTTP ${response.status}).`)

  // The endpoint returns a String, so read text and parse it ourselves
  const body = await response.text()
  let data: unknown
  try {
    data = JSON.parse(body)
  } catch {
    throw new QuizLoadError("The server sent back something that isn't a quiz.", body.slice(0, 300))
  }

  // Failures come back as HTTP 200 with { "error": "..." }
  if (typeof data === "object" && data !== null && !Array.isArray(data) && "error" in data) {
    const detail = String((data as { error: unknown }).error)
    throw new QuizLoadError("The AI couldn't generate questions right now. Please try again in a moment.", detail)
  }
  if (!Array.isArray(data)) throw new QuizLoadError("The server sent back something that isn't a quiz.")

  const questions = (data as RawQuestion[])
    .map((raw, i) => toQuestion(raw, i))
    .filter((q): q is Question => q !== null)
  if (questions.length === 0) {
    throw new QuizLoadError("The AI's questions couldn't be read. Try again, or try a different chapter.")
  }
  return shuffle(questions).slice(0, QUIZ_LENGTH)
}

async function submitResult(subject: Subject, chapter: string, score: number, total: number): Promise<void> {
  const params = new URLSearchParams({
    userId: String(USER_ID),
    subject,
    chapter,
    score: String(score),
    totalQuestions: String(total),
  })
  const response = await fetch(`${API_BASE_URL}/results/submit?${params}`, { method: "POST" })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
}

// ---------- confetti (canvas, no dependency) ----------

function Confetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    const colors = ["#6c63ff", "#ff6584", "#00d4aa", "#fab219", "#ffffff"]
    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener("resize", resize)

    const pieces = Array.from({ length: 160 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 120,
      y: canvas.height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: -Math.random() * 14 - 4,
      size: Math.random() * 6 + 4,
      rotation: Math.random() * Math.PI,
      spin: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
    }))

    const start = performance.now()
    const duration = 3500
    let frame = 0
    const draw = (t: number) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = Math.max(0, 1 - elapsed / duration)
      for (const p of pieces) {
        p.vy += 0.35 // gravity
        p.vx *= 0.99
        p.x += p.vx
        p.y += p.vy
        p.rotation += p.spin
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rotation)
        ctx.fillStyle = p.color
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      if (elapsed < duration) frame = requestAnimationFrame(draw)
      else ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    frame = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("resize", resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" aria-hidden />
}

// ---------- page ----------

export default function QuizPage() {
  const [stage, setStage] = useState<Stage>("setup")

  // Setup
  const [subject, setSubject] = useState<Subject>("Biology")
  const [chapter, setChapter] = useState("")
  const [loadError, setLoadError] = useState<QuizLoadError | null>(null)
  const generateAbortRef = useRef<AbortController | null>(null)

  // Chapter autocomplete
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const [activeSuggestion, setActiveSuggestion] = useState(-1)
  const skipNextSuggestRef = useRef(false)
  const chapterBoxRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  // Quiz
  const [quizSubject, setQuizSubject] = useState<Subject>("Biology")
  const [quizChapter, setQuizChapter] = useState("")
  const [questions, setQuestions] = useState<Question[]>([])
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<AnswerRecord[]>([])
  const [secondsLeft, setSecondsLeft] = useState(SECONDS_PER_QUESTION)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Results
  const [submitStatus, setSubmitStatus] = useState<SubmitStatus>("idle")
  const submittedAttemptRef = useRef<number | null>(null)
  const [attempt, setAttempt] = useState(0)

  const question = questions[current]
  const answered = answers[current] !== undefined
  const score = answers.filter((a) => a.correct).length
  const total = questions.length
  const percentScore = total > 0 ? Math.round((score / total) * 100) : 0
  const passed = percentScore >= PASS_PERCENT

  // ----- chapter autocomplete (debounced, previous request aborted) -----
  useEffect(() => {
    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false
      return
    }
    const q = chapter.trim()
    if (q.length < MIN_SUGGEST_LENGTH) {
      setSuggestions([])
      setIsSuggestOpen(false)
      setIsSuggesting(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsSuggesting(true)
      setIsSuggestOpen(true)
      try {
        setSuggestions(await suggestTopics(q, subject, controller.signal))
        setActiveSuggestion(-1)
      } catch {
        if (controller.signal.aborted) return
        setSuggestions([])
        setIsSuggestOpen(false) // autocomplete is optional: fail silently
      } finally {
        if (!controller.signal.aborted) setIsSuggesting(false)
      }
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [chapter, subject])

  useEffect(() => {
    if (!isSuggestOpen) return
    const onPointerDown = (e: MouseEvent) => {
      if (chapterBoxRef.current && !chapterBoxRef.current.contains(e.target as Node)) setIsSuggestOpen(false)
    }
    document.addEventListener("mousedown", onPointerDown)
    return () => document.removeEventListener("mousedown", onPointerDown)
  }, [isSuggestOpen])

  const pickSuggestion = (topic: string) => {
    if (topic !== chapter) skipNextSuggestRef.current = true
    setChapter(topic)
    setIsSuggestOpen(false)
    setActiveSuggestion(-1)
  }

  // ----- generate -----
  const startQuiz = useCallback(async (quizSubjectValue: Subject, chapterValue: string) => {
    generateAbortRef.current?.abort()
    const controller = new AbortController()
    generateAbortRef.current = controller
    const timeout = setTimeout(() => controller.abort(), GENERATE_TIMEOUT_MS)

    setLoadError(null)
    setStage("loading")
    try {
      const qs = await fetchQuiz(quizSubjectValue, chapterValue, controller.signal)
      setQuizSubject(quizSubjectValue)
      setQuizChapter(chapterValue)
      setQuestions(qs)
      setAnswers([])
      setCurrent(0)
      setSubmitStatus("idle")
      setAttempt((n) => n + 1)
      setStage("quiz")
    } catch (err) {
      if (generateAbortRef.current !== controller) return // superseded by a newer request
      setLoadError(
        err instanceof QuizLoadError
          ? err
          : controller.signal.aborted
            ? new QuizLoadError("Generating the quiz took too long. Please try again.")
            : new QuizLoadError("Something went wrong while loading the quiz.")
      )
      setStage("setup")
    } finally {
      clearTimeout(timeout)
    }
  }, [])

  const handleGenerate = () => {
    const typed = chapter.trim()
    if (!typed) return
    // Reuse the catalog's spelling so "cell division" hits the same cached quiz as "Cell Division"
    const canonical = suggestions.find((s) => s.toLowerCase() === typed.toLowerCase()) ?? typed
    setChapter(canonical)
    setIsSuggestOpen(false)
    void startQuiz(subject, canonical)
  }

  const cancelGenerate = () => {
    const controller = generateAbortRef.current
    generateAbortRef.current = null
    controller?.abort()
    setStage("setup")
  }

  useEffect(() => () => generateAbortRef.current?.abort(), [])

  // ----- answering -----
  const answer = useCallback(
    (selectedIndex: number | null) => {
      if (!question || answers[current] !== undefined) return
      setAnswers((prev) => {
        if (prev[current] !== undefined) return prev // a click and the timeout can race; first one wins
        const next = [...prev]
        next[current] = { selectedIndex, correct: selectedIndex === question.correctIndex }
        return next
      })
    },
    [question, answers, current]
  )

  const answerRef = useRef(answer)
  useEffect(() => {
    answerRef.current = answer
  })

  // 30-second countdown per question; the interval lives in a ref and stops once answered
  useEffect(() => {
    if (stage !== "quiz" || answered) return
    const endsAt = Date.now() + SECONDS_PER_QUESTION * 1000
    setSecondsLeft(SECONDS_PER_QUESTION)
    timerRef.current = setInterval(() => {
      const left = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
      setSecondsLeft(left)
      if (left === 0) answerRef.current(null)
    }, 250)
    return () => {
      if (timerRef.current !== null) clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [stage, current, answered])

  const goNext = useCallback(() => {
    if (!answered) return
    if (current + 1 < questions.length) setCurrent((c) => c + 1)
    else setStage("results")
  }, [answered, current, questions.length])

  // Keyboard: A-D / 1-4 to answer, Enter or → for next
  useEffect(() => {
    if (stage !== "quiz") return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return
      const key = e.key.toUpperCase()
      const letterIndex = OPTION_LETTERS.indexOf(key as (typeof OPTION_LETTERS)[number])
      const numberIndex = /^[1-6]$/.test(key) ? Number(key) - 1 : -1
      const index = letterIndex !== -1 ? letterIndex : numberIndex
      if (!answered && question && index !== -1 && index < question.options.length) {
        e.preventDefault()
        answer(index)
      } else if (answered && (e.key === "Enter" || e.key === "ArrowRight")) {
        e.preventDefault()
        goNext()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [stage, answered, question, answer, goNext])

  // ----- auto-submit once per attempt -----
  const submit = useCallback(async () => {
    setSubmitStatus("saving")
    try {
      await submitResult(quizSubject, quizChapter, score, total)
      setSubmitStatus("saved")
    } catch {
      setSubmitStatus("error")
    }
  }, [quizSubject, quizChapter, score, total])

  useEffect(() => {
    if (stage !== "results" || submittedAttemptRef.current === attempt) return
    submittedAttemptRef.current = attempt
    void submit()
  }, [stage, attempt, submit])

  // ----- setup keyboard for the chapter combobox -----
  const onChapterKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const open = isSuggestOpen && suggestions.length > 0
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      e.preventDefault()
      setIsSuggestOpen(true)
      setActiveSuggestion((i) => (i + 1) % suggestions.length)
    } else if (e.key === "ArrowUp" && suggestions.length > 0) {
      e.preventDefault()
      setIsSuggestOpen(true)
      setActiveSuggestion((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (open && activeSuggestion >= 0) pickSuggestion(suggestions[activeSuggestion])
      else handleGenerate()
    } else if (e.key === "Escape") {
      setIsSuggestOpen(false)
    }
  }

  const showSuggestions = isSuggestOpen && chapter.trim().length >= MIN_SUGGEST_LENGTH
  const timerLow = secondsLeft <= 10

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Header />

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>

        {/* ---------- SETUP ---------- */}
        {stage === "setup" && (
          <section className="glassmorphism space-y-5 rounded-2xl border border-primary/30 p-5 shadow-2xl shadow-primary/10 sm:p-8">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-gradient-to-br from-primary to-accent p-3 shadow-lg shadow-primary/30">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground sm:text-2xl">AI Quiz</h1>
                <p className="text-sm text-muted-foreground">
                  {QUIZ_LENGTH} questions · {SECONDS_PER_QUESTION} seconds each
                </p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="quiz-subject">
                  Subject
                </label>
                <Select value={subject} onValueChange={(v) => isSubject(v) && setSubject(v)}>
                  <SelectTrigger id="quiz-subject" className="h-11 w-full bg-background/40">
                    <SelectValue>{subject}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SUBJECTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground" htmlFor="quiz-chapter">
                  Chapter
                </label>
                <div ref={chapterBoxRef} className="relative z-30">
                  <Input
                    id="quiz-chapter"
                    value={chapter}
                    onChange={(e) => setChapter(e.target.value)}
                    onKeyDown={onChapterKeyDown}
                    onFocus={() => suggestions.length > 0 && setIsSuggestOpen(true)}
                    placeholder="e.g. Cell Division"
                    autoComplete="off"
                    role="combobox"
                    aria-autocomplete="list"
                    aria-expanded={showSuggestions}
                    aria-controls={listId}
                    aria-activedescendant={
                      showSuggestions && activeSuggestion >= 0 ? suggestionOptionId(listId, activeSuggestion) : undefined
                    }
                    className="h-11 bg-background/40"
                  />
                  {showSuggestions && (
                    <TopicSuggestions
                      id={listId}
                      query={chapter.trim()}
                      suggestions={suggestions}
                      activeIndex={activeSuggestion}
                      isLoading={isSuggesting}
                      onSelect={pickSuggestion}
                      onHighlight={setActiveSuggestion}
                    />
                  )}
                </div>
              </div>
            </div>

            {loadError && (
              <div role="alert" className="flex gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                <div className="min-w-0 space-y-1">
                  <p className="text-foreground">{loadError.message}</p>
                  {loadError.detail && (
                    <details className="text-xs text-muted-foreground">
                      <summary className="cursor-pointer">Technical details</summary>
                      <p className="mt-1 break-words">{loadError.detail}</p>
                    </details>
                  )}
                </div>
              </div>
            )}

            <Button
              size="lg"
              onClick={handleGenerate}
              disabled={!chapter.trim()}
              className="w-full shadow-lg shadow-primary/30 sm:w-auto"
            >
              <Sparkles className="h-5 w-5" />
              Generate Quiz
            </Button>
          </section>
        )}

        {/* ---------- LOADING ---------- */}
        {stage === "loading" && (
          <section
            aria-busy
            className="glassmorphism space-y-5 rounded-2xl border border-primary/30 p-5 sm:p-8"
          >
            <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
              Generating your {subject} quiz on “{chapter.trim()}”. New chapters can take up to 30 seconds...
            </div>
            <Skeleton className="h-2 w-full bg-muted" />
            <div className="space-y-2">
              <Skeleton className="h-5 w-11/12 bg-muted" />
              <Skeleton className="h-5 w-3/4 bg-muted" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-14 w-full rounded-xl bg-muted" />
              ))}
            </div>
            <Button variant="outline" onClick={cancelGenerate}>
              Cancel
            </Button>
          </section>
        )}

        {/* ---------- QUIZ ---------- */}
        {stage === "quiz" && question && (
          <section className="glassmorphism space-y-5 rounded-2xl border border-primary/30 p-5 shadow-2xl shadow-primary/10 sm:p-8">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium text-foreground">
                  Question {current + 1} of {total}
                </span>
                <span
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono tabular-nums",
                    answered
                      ? "border-border text-muted-foreground"
                      : timerLow
                        ? "animate-pulse border-destructive/50 text-destructive"
                        : "border-primary/40 text-primary"
                  )}
                  aria-label={`${secondsLeft} seconds left`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  {answered ? "Done" : `0:${String(secondsLeft).padStart(2, "0")}`}
                </span>
              </div>
              <Progress
                value={((current + (answered ? 1 : 0)) / total) * 100}
                aria-label="Quiz progress"
                className="h-2 bg-muted"
              />
              <p className="text-xs text-muted-foreground">
                {quizSubject} · {quizChapter}
              </p>
            </div>

            <h2 className="text-lg font-semibold leading-relaxed text-foreground sm:text-xl">{question.text}</h2>

            <div className="grid gap-3 sm:grid-cols-2">
              {question.options.map((option, i) => {
                const record = answers[current]
                const isCorrect = i === question.correctIndex
                const isPicked = record?.selectedIndex === i
                return (
                  <button
                    key={`${question.key}-${i}`}
                    type="button"
                    disabled={answered}
                    onClick={() => answer(i)}
                    className={cn(
                      "flex min-h-14 items-center gap-3 rounded-xl border p-3 text-left text-sm transition-all",
                      !answered && "border-border bg-card/80 hover:-translate-y-0.5 hover:border-primary/60 hover:bg-primary/10",
                      answered && isCorrect && "border-success bg-success/15 text-foreground",
                      answered && isPicked && !isCorrect && "border-destructive bg-destructive/15 text-foreground",
                      answered && !isCorrect && !isPicked && "border-border bg-card/40 opacity-60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
                        answered && isCorrect
                          ? "bg-success text-success-foreground"
                          : answered && isPicked
                            ? "bg-destructive text-white"
                            : "bg-muted text-foreground"
                      )}
                    >
                      {OPTION_LETTERS[i]}
                    </span>
                    <span className="flex-1">{option}</span>
                    {answered && isCorrect && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" aria-label="Correct answer" />}
                    {answered && isPicked && !isCorrect && (
                      <XCircle className="h-5 w-5 shrink-0 text-destructive" aria-label="Your answer" />
                    )}
                  </button>
                )
              })}
            </div>

            {answered && (
              <div aria-live="polite" className="space-y-4">
                <div
                  className={cn(
                    "rounded-xl border p-4 text-sm",
                    answers[current].correct ? "border-success/40 bg-success/10" : "border-destructive/40 bg-destructive/10"
                  )}
                >
                  <p className="mb-1 flex items-center gap-2 font-semibold text-foreground">
                    {answers[current].correct ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-success" /> Correct!
                      </>
                    ) : answers[current].selectedIndex === null ? (
                      <>
                        <Clock className="h-4 w-4 text-destructive" /> Time&apos;s up
                      </>
                    ) : (
                      <>
                        <XCircle className="h-4 w-4 text-destructive" /> Not quite
                      </>
                    )}
                  </p>
                  <p className="text-muted-foreground">
                    {question.explanation || `The correct answer is ${OPTION_LETTERS[question.correctIndex]}.`}
                  </p>
                </div>
                <div className="flex justify-end">
                  <Button size="lg" onClick={goNext}>
                    {current + 1 < total ? "Next Question" : "See Results"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {!answered && (
              <p className="hidden text-center text-xs text-muted-foreground sm:block">
                Tip: press A–D (or 1–4) to answer, Enter for the next question
              </p>
            )}
          </section>
        )}

        {/* ---------- RESULTS ---------- */}
        {stage === "results" && (
          <>
            {percentScore >= CONFETTI_PERCENT && <Confetti key={attempt} />}

            <section className="glassmorphism space-y-5 rounded-2xl border border-primary/30 p-5 text-center shadow-2xl shadow-primary/10 sm:p-8">
              <div
                className={cn(
                  "mx-auto flex h-16 w-16 items-center justify-center rounded-full",
                  passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                )}
              >
                {passed ? <Trophy className="h-8 w-8" /> : <Brain className="h-8 w-8" />}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {quizSubject} · {quizChapter}
                </p>
                <p className="mt-1 text-5xl font-bold text-foreground">
                  {score}/{total}
                </p>
                <p className={cn("mt-1 text-2xl font-semibold", passed ? "text-success" : "text-destructive")}>
                  {percentScore}%
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {percentScore >= CONFETTI_PERCENT
                    ? "Outstanding work! 🎉"
                    : passed
                      ? "Nice job, you passed!"
                      : "Keep practising, you'll get there."}
                </p>
              </div>

              {!passed && (
                <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-destructive/40 bg-destructive/10 px-4 py-1.5 text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  Weak topic detected!
                </div>
              )}

              <div className="text-xs text-muted-foreground" aria-live="polite">
                {submitStatus === "saving" && (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving your result...
                  </span>
                )}
                {submitStatus === "saved" && (
                  <span className="inline-flex items-center gap-1.5 text-success">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Result saved to your progress
                  </span>
                )}
                {submitStatus === "error" && (
                  <span className="inline-flex flex-wrap items-center justify-center gap-2 text-destructive">
                    <AlertCircle className="h-3.5 w-3.5" /> Couldn&apos;t save your result.
                    <Button variant="outline" size="sm" onClick={() => void submit()}>
                      <RefreshCw className="h-3.5 w-3.5" /> Retry
                    </Button>
                  </span>
                )}
              </div>

              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button size="lg" onClick={() => void startQuiz(quizSubject, quizChapter)}>
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
                <Button size="lg" variant="outline" onClick={() => setStage("setup")}>
                  <Sparkles className="h-4 w-4" />
                  New Quiz
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/analytics">
                    <BarChart3 className="h-4 w-4" />
                    View Progress
                  </Link>
                </Button>
                <Button size="lg" variant="ghost" asChild>
                  <Link href="/">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </Link>
                </Button>
              </div>
            </section>

            <section className="space-y-3">
              <h2 className="font-semibold text-foreground">Review</h2>
              {questions.map((q, i) => {
                const record = answers[i]
                const correct = record?.correct ?? false
                const picked = record?.selectedIndex ?? null
                return (
                  <article
                    key={q.key}
                    className={cn(
                      "glassmorphism rounded-xl border p-4 text-sm",
                      correct ? "border-success/40" : "border-destructive/40"
                    )}
                  >
                    <p className="mb-2 flex items-start gap-2 font-medium text-foreground">
                      {correct ? (
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-label="Correct" />
                      ) : (
                        <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-label="Wrong" />
                      )}
                      <span>
                        {i + 1}. {q.text}
                      </span>
                    </p>
                    <div className="space-y-1 pl-6">
                      {!correct && (
                        <p className="text-destructive">
                          Your answer:{" "}
                          {picked === null ? "No answer (time ran out)" : `${OPTION_LETTERS[picked]}. ${q.options[picked]}`}
                        </p>
                      )}
                      <p className="text-success">
                        Correct answer: {OPTION_LETTERS[q.correctIndex]}. {q.options[q.correctIndex]}
                      </p>
                      {q.explanation && <p className="text-muted-foreground">{q.explanation}</p>}
                    </div>
                  </article>
                )
              })}
            </section>
          </>
        )}
      </main>
    </div>
  )
}
