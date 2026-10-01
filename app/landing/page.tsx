import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { BrandLogo, GradientBackdrop } from "@/components/smartprep/gradient-backdrop"

export const metadata: Metadata = {
  title: "SmartPrep — AI-Powered NEET Study Platform",
  description: "Personalized quizzes, video recommendations, mock interviews and more",
}

// Each feature card owns one aurora accent: icon tile tint + hover border/glow (glow-* classes in globals.css)
const ACCENTS = {
  violet: { glow: "tint-primary", tile: "bg-primary/15 ring-primary/30 group-hover:bg-primary/25" },
  cyan: { glow: "tint-info", tile: "bg-info/15 ring-info/30 group-hover:bg-info/25" },
  magenta: { glow: "glow-magenta", tile: "bg-accent/15 ring-accent/30 group-hover:bg-accent/25" },
  mint: { glow: "tint-success", tile: "bg-success/15 ring-success/30 group-hover:bg-success/25" },
  amber: { glow: "tint-warning", tile: "bg-warning/15 ring-warning/30 group-hover:bg-warning/25" },
  coral: { glow: "glow-coral", tile: "bg-destructive/15 ring-destructive/30 group-hover:bg-destructive/25" },
} as const

interface Feature {
  emoji: string
  title: string
  description: string
  accent: keyof typeof ACCENTS
}

const FEATURES: ReadonlyArray<Feature> = [
  {
    emoji: "🎯",
    title: "AI Quiz Generator",
    description: "Chapter-wise NEET quizzes generated on demand, with instant scoring and explanations.",
    accent: "violet",
  },
  {
    emoji: "📹",
    title: "Video Recommendations",
    description: "The right lecture for the topic you're stuck on, picked for your weak areas.",
    accent: "cyan",
  },
  {
    emoji: "🎤",
    title: "Mock Interview with Alex",
    description: "Practice answering out loud with an AI interviewer that gives you feedback.",
    accent: "magenta",
  },
  {
    emoji: "🔥",
    title: "Study Streak Tracker",
    description: "Build a daily habit and keep your streak alive with focused Pomodoro sessions.",
    accent: "mint",
  },
  {
    emoji: "📊",
    title: "Performance Analytics",
    description: "See study time, quiz scores and subject trends in clear charts.",
    accent: "amber",
  },
  {
    emoji: "📧",
    title: "Daily Progress Reports",
    description: "Automatic progress summaries for you and your parents, every day.",
    accent: "coral",
  },
]

const PRIMARY_BUTTON =
  "btn-primary inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold"
const SECONDARY_BUTTON =
  "inline-flex items-center justify-center rounded-xl border border-info/40 bg-background/40 px-6 py-3 font-semibold text-foreground backdrop-blur transition-all hover:-translate-y-0.5 hover:border-info hover:bg-info/10 hover:shadow-raised active:translate-y-0 active:scale-[.98] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-info/50"

export default function LandingPage() {
  return (
    <GradientBackdrop>
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-5">
        <BrandLogo />
        <Link
          href="/login"
          className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
        >
          Login
        </Link>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-20">
        {/* Hero */}
        <section className="flex flex-col items-center pt-12 text-center sm:pt-20">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-info/30 bg-info/10 px-4 py-1.5 text-xs font-medium text-info sm:text-sm">
            <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
            Built for NEET aspirants
          </span>
          <h1 className="max-w-4xl text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            <span className="text-gradient">
              SmartPrep
            </span>{" "}
            — AI-Powered NEET Study Platform
          </h1>
          <p className="mt-6 max-w-2xl text-base text-muted-foreground sm:text-lg">
            Personalized quizzes, video recommendations, mock interviews and more
          </p>
          <div className="mt-10 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
            <Link href="/register" className={PRIMARY_BUTTON}>
              Get Started
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/login" className={SECONDARY_BUTTON}>
              Login
            </Link>
          </div>
        </section>

        {/* Features */}
        <section aria-labelledby="features-heading" className="mt-24 sm:mt-32">
          <div className="text-center">
            <h2 id="features-heading" className="text-2xl font-bold text-foreground sm:text-3xl">
              Everything you need to crack NEET
            </h2>
            <p className="mt-3 text-muted-foreground">One dashboard for learning, practice and progress.</p>
          </div>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {FEATURES.map((feature) => (
              <li
                key={feature.title}
                className={`surface card-interactive ${ACCENTS[feature.accent].glow} group rounded-2xl border border-border p-6 hover:-translate-y-1`}
              >
                <div
                  aria-hidden
                  className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ring-1 transition-all ${ACCENTS[feature.accent].tile}`}
                >
                  {feature.emoji}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
              </li>
            ))}
          </ul>
        </section>

        {/* Closing CTA */}
        <section className="surface card-interactive mt-24 rounded-2xl border border-primary/25 px-6 py-12 text-center">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Ready to study smarter?</h2>
          <p className="mt-3 text-muted-foreground">Create a free account and start your first quiz in minutes.</p>
          <Link href="/register" className={`${PRIMARY_BUTTON} mt-8`}>
            Get Started
            <ArrowRight className="h-4 w-4" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} SmartPrep. All rights reserved.
      </footer>
    </GradientBackdrop>
  )
}
