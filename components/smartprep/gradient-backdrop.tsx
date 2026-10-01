import Link from "next/link"
import type { ReactNode } from "react"
import { GraduationCap, Sparkles } from "lucide-react"

// Animated aurora gradient (violet -> cyan -> magenta) with glow orbs behind the landing, login and register pages
export function GradientBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate min-h-screen overflow-hidden bg-background">
      <div
        aria-hidden
        className="bg-backdrop absolute inset-0 -z-20"
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary/35 blur-3xl sm:h-96 sm:w-96" />
        <div
          className="absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-info/20 blur-3xl sm:h-96 sm:w-96"
          style={{ animationDelay: "-6s" }}
        />
        <div
          className="absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-accent/25 blur-3xl sm:h-96 sm:w-96"
          style={{ animationDelay: "-12s" }}
        />
      </div>
      {children}
    </div>
  )
}

export function BrandLogo({ href = "/landing" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-3">
      <div className="relative">
        <div className="rounded-xl icon-gradient p-2.5">
          <GraduationCap className="h-6 w-6 text-white" />
        </div>
        <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-success">
          <Sparkles className="h-2.5 w-2.5 text-success-foreground" />
        </div>
      </div>
      <span className="text-gradient text-xl font-bold">
        SmartPrep
      </span>
    </Link>
  )
}

// Centered glass card shared by the login and register forms
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: ReactNode
  footer: ReactNode
}) {
  return (
    <GradientBackdrop>
      <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
        <div className="mb-8">
          <BrandLogo />
        </div>
        <div className="surface w-full max-w-md rounded-2xl border border-primary/25 p-6 shadow-raised sm:p-8">
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-6 text-center text-sm text-muted-foreground">{footer}</p>
      </main>
    </GradientBackdrop>
  )
}
