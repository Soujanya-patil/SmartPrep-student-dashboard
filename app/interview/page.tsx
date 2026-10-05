"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { API_BASE_URL } from "@/lib/api"

interface Question {
  questionNumber: number
  type: string
  question: string
  expectedAnswer: string
  tips: string
}

interface Feedback {
  score: number
  feedback: string
  improvement: string
  passed: boolean
}

export default function InterviewPage() {
  const [step, setStep] = useState<"setup" | "interview" | "report">("setup")
  const [role, setRole] = useState("Software Engineer")
  const [skills, setSkills] = useState("Java, Spring Boot, MySQL, REST APIs")
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answer, setAnswer] = useState("")
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [scores, setScores] = useState<number[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [report, setReport] = useState<any>(null)
  const [isListening, setIsListening] = useState(false)

  // Alex speaks the question aloud
  useEffect(() => {
    if (step === "interview" && questions.length > 0) {
      const current = questions[currentIndex]
      setTimeout(() => {
        alexSpeak(`Question ${current.questionNumber}. ${current.question}`)
      }, 500)
    }
  }, [currentIndex, step, questions])

  // Alex speaks the feedback aloud
  useEffect(() => {
    if (feedback) {
      alexSpeak(feedback.feedback)
    }
  }, [feedback])

  // Text to Speech — Alex speaks
  const alexSpeak = (text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 0.95
      utterance.pitch = 1.0
      utterance.volume = 1.0
      const voices = window.speechSynthesis.getVoices()
      const preferred = voices.find(v =>
        v.name.includes('Google') || v.name.includes('Male') || v.name.includes('David')
      )
      if (preferred) utterance.voice = preferred
      window.speechSynthesis.speak(utterance)
    }
  }

  // Speech to Text — Student speaks
  const startListening = () => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      alert("Your browser doesn't support speech recognition. Try Chrome!")
      return
    }
    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onerror = () => setIsListening(false)

    recognition.onresult = (event: any) => {
      let transcript = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript
      }
      setAnswer(transcript)
    }

    recognition.start()
    setTimeout(() => {
      recognition.stop()
      setIsListening(false)
    }, 10000)
  }

  const startInterview = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `${API_BASE_URL}/interview/start?role=${encodeURIComponent(role)}&skills=${encodeURIComponent(skills)}`
      )
      const data = await response.json()
      setQuestions(data)
      setStep("interview")
      setCurrentIndex(0)
      setScores([])
    } catch (error) {
      alert("Failed to start interview. Make sure Spring Boot is running!")
    } finally {
      setIsLoading(false)
    }
  }

  const submitAnswer = async () => {
    if (!answer.trim()) return
    setIsLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/interview/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: questions[currentIndex].question,
          answer: answer,
          type: questions[currentIndex].type
        })
      })
      const data = await response.json()
      setFeedback(data)
      setScores([...scores, data.score])
    } catch (error) {
      alert("Failed to evaluate answer!")
    } finally {
      setIsLoading(false)
    }
  }

  const nextQuestion = async () => {
    if (currentIndex + 1 >= questions.length) {
      setIsLoading(true)
      const totalScore = [...scores].reduce((a, b) => a + b, 0)
      try {
        const response = await fetch(`${API_BASE_URL}/interview/report`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalScore,
            maxScore: questions.length * 10,
            role
          })
        })
        const data = await response.json()
        setReport(data)
        setStep("report")
      } catch (error) {
        alert("Failed to generate report!")
      } finally {
        setIsLoading(false)
      }
    } else {
      setCurrentIndex(currentIndex + 1)
      setAnswer("")
      setFeedback(null)
    }
  }

  const getBadgeColor = (type: string) => {
    if (type === "TECHNICAL") return "bg-info/15 text-info border-info/30"
    if (type === "APTITUDE") return "bg-primary/20 text-primary-soft border-primary/30"
    return "bg-success/15 text-success border-success/30"
  }

  // SETUP SCREEN
  if (step === "setup") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <Link href="/" className="text-primary-soft text-sm hover:text-info mb-6 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="text-center mb-8">
            <div className="w-16 h-16 icon-gradient rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎤</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-2">Mock Interview</h1>
            <p className="text-muted-foreground">AI-powered placement interview practice with Alex</p>
          </div>

          <div className="surface card-interactive rounded-2xl border border-border p-6 space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Target Role</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                placeholder="e.g. Software Engineer"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-2 block">Your Skills</label>
              <textarea
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-secondary border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary resize-none"
                placeholder="e.g. Java, Spring Boot, MySQL, REST APIs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {["4 Technical", "3 Aptitude", "3 HR"].map((item) => (
                <div key={item} className="bg-secondary rounded-xl p-3 text-center border border-border">
                  <p className="text-foreground text-sm font-medium">{item}</p>
                  <p className="text-muted-foreground text-xs">questions</p>
                </div>
              ))}
            </div>

            <button
              onClick={startInterview}
              disabled={isLoading}
              className="w-full py-4 btn-primary rounded-xl font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Preparing your interview..." : "Start Interview 🚀"}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // INTERVIEW SCREEN
  if (step === "interview") {
    const current = questions[currentIndex]
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-3xl mx-auto">
          <Link href="/" className="text-primary-soft text-sm hover:text-info mb-6 inline-block">
            ← Back to Dashboard
          </Link>
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 icon-gradient rounded-xl flex items-center justify-center">
                <span>🎤</span>
              </div>
              <div>
                <h1 className="text-foreground font-bold">Mock Interview</h1>
                <p className="text-muted-foreground text-sm">with Alex • {role}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-foreground font-bold">{currentIndex + 1}/{questions.length}</p>
              <p className="text-muted-foreground text-sm">questions</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-muted rounded-full mb-6">
            <div
              className="h-full bg-gradient-accent rounded-full transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <div className="surface card-interactive rounded-2xl border border-border p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-3 py-1 rounded-full border font-medium ${getBadgeColor(current.type)}`}>
                {current.type}
              </span>
              <span className="text-muted-foreground text-xs">Question {current.questionNumber}</span>
            </div>

            {/* Alex avatar */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-warning to-accent rounded-full flex items-center justify-center shrink-0 text-lg">
                👨‍💼
              </div>
              <div className="bg-secondary rounded-2xl rounded-tl-none p-4 flex-1">
                <p className="text-foreground text-sm font-medium mb-1">Alex</p>
                <p className="text-foreground">{current.question}</p>
              </div>
            </div>

            {/* Tip + Replay button */}
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 border border-primary/25 rounded-xl p-3 flex-1">
                <p className="text-primary-soft text-xs">💡 Tip: {current.tips}</p>
              </div>
              <button
                onClick={() => alexSpeak(current.question)}
                className="px-3 py-3 bg-secondary border border-border rounded-xl text-muted-foreground hover:text-primary-soft hover:border-primary transition-colors text-sm"
              >
                🔊
              </button>
            </div>
          </div>

          {/* Answer section */}
          {!feedback ? (
            <div className="surface card-interactive rounded-2xl border border-border p-6">
              <label className="text-muted-foreground text-sm mb-2 block">Your Answer</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder={isListening ? "🎤 Listening... speak now!" : "Type your answer or use the mic button below..."}
                className={`w-full px-4 py-3 bg-secondary border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none resize-none mb-4 transition-all ${isListening ? 'border-destructive animate-pulse' : 'border-border focus:border-primary'}`}
              />
              <div className="flex gap-3">
                <button
                  onClick={startListening}
                  disabled={isListening}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${isListening ? 'bg-destructive text-destructive-foreground animate-pulse' : 'bg-secondary border border-border text-foreground/90 hover:border-primary hover:text-primary-soft'}`}
                >
                  {isListening ? "🎤 Listening..." : "🎤 Speak"}
                </button>
                <button
                  onClick={submitAnswer}
                  disabled={isLoading || !answer.trim()}
                  className="flex-1 py-3 btn-primary rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "Alex is evaluating..." : "Submit Answer ✓"}
                </button>
              </div>
            </div>
          ) : (
            <div className="surface card-interactive rounded-2xl border border-border p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-foreground font-semibold">Alex's Verdict</p>
                <div className={`text-2xl font-bold ${feedback.score >= 6 ? 'text-success' : 'text-destructive'}`}>
                  {feedback.score}/10
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${feedback.passed ? 'bg-success/10 border-success/30 answer-correct' : 'bg-destructive/10 border-destructive/30 answer-wrong'}`}>
                <p className={`text-sm ${feedback.passed ? 'text-success' : 'text-destructive'}`}>
                  {feedback.passed ? '✅' : '❌'} {feedback.feedback}
                </p>
              </div>

              <div className="bg-info/10 border border-info/25 rounded-xl p-4">
                <p className="text-info text-sm">💡 {feedback.improvement}</p>
              </div>

              <button
                onClick={nextQuestion}
                disabled={isLoading}
                className="w-full py-3 btn-primary rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? "Generating report..." : currentIndex + 1 >= questions.length ? "See Final Report 📊" : "Next Question →"}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // REPORT SCREEN
  if (step === "report" && report) {
    const percentage = report.percentage.toFixed(1)
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-2xl mx-auto">
          <Link href="/" className="text-primary-soft text-sm hover:text-info mb-6 inline-block">
            ← Back to Dashboard
          </Link>
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{report.hired ? "🎉" : "💪"}</div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              {report.hired ? "You're Hired!" : "Keep Grinding!"}
            </h1>
            <p className="text-muted-foreground">
              {report.totalScore}/{report.maxScore} points • {percentage}%
            </p>
          </div>

          <div className="surface card-interactive rounded-2xl border border-border p-6 mb-4">
            <div className="flex justify-between text-sm text-muted-foreground mb-2">
              <span>Score</span>
              <span>{percentage}%</span>
            </div>
            <div className="w-full h-4 bg-muted rounded-full">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${report.hired ? 'bg-gradient-to-r from-success to-info' : 'bg-gradient-to-r from-warning to-destructive'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="surface card-interactive rounded-2xl border border-border p-6 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-warning to-accent rounded-full flex items-center justify-center shrink-0 text-lg">
                👨‍💼
              </div>
              <div>
                <p className="text-foreground font-medium mb-1">Alex says:</p>
                <p className="text-foreground/90">{report.overallFeedback}</p>
              </div>
            </div>
          </div>

          <div className="surface card-interactive rounded-2xl border border-border p-6 mb-4">
            <h3 className="text-success font-semibold mb-3">✅ Strengths</h3>
            <ul className="space-y-2">
              {report.strengths.map((s: string, i: number) => (
                <li key={i} className="text-foreground/90 text-sm flex items-start gap-2">
                  <span className="text-success mt-0.5">•</span> {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="surface card-interactive rounded-2xl border border-border p-6 mb-6">
            <h3 className="text-warning font-semibold mb-3">🎯 Areas to Improve</h3>
            <ul className="space-y-2">
              {report.improvements.map((imp: string, i: number) => (
                <li key={i} className="text-foreground/90 text-sm flex items-start gap-2">
                  <span className="text-warning mt-0.5">•</span> {imp}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => { setStep("setup"); setQuestions([]); setScores([]); setReport(null); }}
            className="w-full py-4 btn-primary rounded-xl font-semibold text-lg"
          >
            Try Again 🔄
          </button>
        </div>
      </div>
    )
  }

  return null
}