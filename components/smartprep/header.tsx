"use client"

import { GraduationCap, Sparkles } from "lucide-react"

export function Header() {
  return (
    <header className="relative border-b border-border bg-gradient-to-r from-card via-primary/5 to-accent/5 overflow-hidden">
      {/* Glowing border effect */}
      <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse" />
      
      <div className="max-w-screen-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
              <Sparkles className="h-2.5 w-2.5 text-success-foreground" />
            </div>
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              SmartPrep
            </h1>
            <p className="text-xs text-muted-foreground">AI-Powered Study Dashboard</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm text-primary font-medium">Focus Mode</span>
          </div>
        </div>
      </div>
    </header>
  )
}
