"use client"

import { Progress } from "@/components/ui/progress"
import { Clock, Brain, Zap } from "lucide-react"

interface CountdownTimerProps {
  timeRemaining: number // in seconds
  totalTime: number // in seconds
  isActive: boolean
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export function CountdownTimer({ timeRemaining, totalTime, isActive }: CountdownTimerProps) {
  const progress = totalTime > 0 ? ((totalTime - timeRemaining) / totalTime) * 100 : 0
  const isLow = timeRemaining <= 60 // Last minute warning

  return (
    <div className="fixed bottom-0 left-0 right-0 border-t border-border bg-card/95 backdrop-blur-lg z-40">
      <div className="max-w-screen-2xl mx-auto px-4 py-3">
        <div className="flex items-center gap-4">
          {/* Status Icon */}
          <div className={`p-2 rounded-lg ${isActive ? (isLow ? 'bg-accent/20' : 'bg-primary/20') : 'bg-muted'}`}>
            {isActive ? (
              isLow ? (
                <Brain className="h-5 w-5 text-accent animate-pulse" />
              ) : (
                <Zap className="h-5 w-5 text-primary" />
              )
            ) : (
              <Clock className="h-5 w-5 text-muted-foreground" />
            )}
          </div>

          {/* Timer Info */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-foreground">
                {isActive ? 'Next check in:' : 'Select a video to start'}
              </span>
              {isActive && (
                <span className={`text-lg font-mono font-bold ${isLow ? 'text-accent animate-pulse' : 'text-primary'}`}>
                  {formatTime(timeRemaining)}
                </span>
              )}
            </div>
            <Progress 
              value={isActive ? progress : 0} 
              className={`h-2 ${isLow ? '[&>div]:bg-accent' : '[&>div]:bg-primary'}`}
            />
          </div>

          {/* Study Stats */}
          {isActive && (
            <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span>Focus mode active</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
