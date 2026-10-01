"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Brain, CheckCircle2, XCircle, Lightbulb, ArrowRight, Sparkles, AlertCircle } from "lucide-react"
import type { AttentionCheck } from "@/lib/types"

interface AttentionPopupProps {
  isOpen: boolean
  check: AttentionCheck | null
  isLoading: boolean
  error: string | null
  onAnswer: (answer: 'A' | 'B' | 'C' | 'D') => void
  onContinue: () => void
}

export function AttentionPopup({
  isOpen,
  check,
  isLoading,
  error,
  onAnswer,
  onContinue
}: AttentionPopupProps) {
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | 'C' | 'D' | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [showHint, setShowHint] = useState(false)

  if (!isOpen) return null

  const handleAnswer = (answer: 'A' | 'B' | 'C' | 'D') => {
    if (selectedAnswer) return // Already answered
    setSelectedAnswer(answer)
    const correct = check?.correctOption === answer
    setIsCorrect(correct)
    if (!correct) setShowHint(true)
    onAnswer(answer)
  }

  const handleContinue = () => {
    setSelectedAnswer(null)
    setIsCorrect(null)
    setShowHint(false)
    onContinue()
  }

  const options = check ? [
    { key: 'A' as const, text: check.optionA },
    { key: 'B' as const, text: check.optionB },
    { key: 'C' as const, text: check.optionC },
    { key: 'D' as const, text: check.optionD },
  ] : []

  return (
    <div 
      id="popup-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/95 backdrop-blur-sm"
    >
      <div className="w-full max-w-2xl rounded-2xl border-2 border-primary bg-card p-6 animate-in zoom-in-95 duration-300">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl icon-gradient animate-pulse">
            <Brain className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Attention Check!</h2>
            <p className="text-sm text-muted-foreground">Let&apos;s make sure you&apos;re staying focused</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Spinner className="h-10 w-10 text-primary-soft" />
            <p className="text-muted-foreground">Loading your question...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="p-4 rounded-full bg-destructive/10">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-muted-foreground text-center">{error}</p>
            <Button onClick={handleContinue} className="mt-4">
              Continue Watching
            </Button>
          </div>
        ) : check ? (
          <>
            {/* Question */}
            <div className="mb-6 p-4 rounded-xl bg-secondary/50 border border-border">
              <p className="text-lg font-medium text-foreground">{check.question}</p>
            </div>

            {/* Options */}
            <div className="grid gap-3 mb-6">
              {options.map(({ key, text }) => {
                const isSelected = selectedAnswer === key
                const isCorrectAnswer = check.correctOption === key
                const showResult = selectedAnswer !== null
                
                let buttonClass = "w-full p-4 rounded-xl border-2 text-left transition-all duration-300 flex items-center gap-3"
                
                if (showResult) {
                  if (isCorrectAnswer) {
                    buttonClass += " bg-success/20 border-success text-success answer-correct"
                  } else if (isSelected && !isCorrect) {
                    buttonClass += " bg-destructive/20 border-destructive text-destructive answer-wrong"
                  } else {
                    buttonClass += " bg-muted/50 border-border text-muted-foreground opacity-50"
                  }
                } else {
                  buttonClass += " bg-card border-border hover:-translate-y-0.5 hover:border-primary hover:bg-primary/10 hover:shadow-raised active:translate-y-0 active:scale-[.99] text-foreground"
                }

                return (
                  <button
                    key={key}
                    onClick={() => handleAnswer(key)}
                    disabled={selectedAnswer !== null}
                    className={buttonClass}
                  >
                    <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm
                      ${showResult && isCorrectAnswer ? 'bg-success text-success-foreground' : 
                        showResult && isSelected && !isCorrect ? 'bg-destructive text-destructive-foreground' :
                        'bg-muted text-muted-foreground'}`}>
                      {key}
                    </span>
                    <span className="flex-1">{text}</span>
                    {showResult && isCorrectAnswer && (
                      <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                    )}
                    {showResult && isSelected && !isCorrect && (
                      <XCircle className="h-5 w-5 text-destructive shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Result Feedback */}
            {selectedAnswer && (
              <div className="space-y-4">
                {isCorrect ? (
                  <div className="p-4 rounded-xl bg-success/10 border border-success/30 flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-success shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-success">Excellent work!</p>
                      <p className="text-sm text-success/80">{check.encouragement}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-accent/10 border border-accent/30 flex items-start gap-3">
                      <XCircle className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-accent">Not quite right</p>
                        <p className="text-sm text-accent/80">The correct answer was {check.correctOption}</p>
                      </div>
                    </div>
                    {showHint && (
                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/30 flex items-start gap-3">
                        <Lightbulb className="h-5 w-5 text-primary-soft shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-primary-soft">Hint for next time:</p>
                          <p className="text-sm text-primary-soft/80">{check.hint}</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <Button 
                  onClick={handleContinue}
                  className="w-full py-6 text-lg font-semibold rounded-xl"
                >
                  Continue Watching
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
