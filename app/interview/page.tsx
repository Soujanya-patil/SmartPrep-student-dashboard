"use client"

import { useState, useEffect } from "react"

const API_BASE_URL = "http://localhost:8081/api"

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
    if (type === "TECHNICAL") return "bg-blue-500/20 text-blue-400 border-blue-500/30"
    if (type === "APTITUDE") return "bg-purple-500/20 text-purple-400 border-purple-500/30"
    return "bg-green-500/20 text-green-400 border-green-500/30"
  }

  // SETUP SCREEN
  if (step === "setup") {
    return (
      <div className="min-h-screen bg-[#0f0f1a] flex items-center justify-center p-6">
        <div className="w-full max-w-lg">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">🎤</span>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Mock Interview</h1>
            <p className="text-gray-400">AI-powered placement interview practice with Alex</p>
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6 space-y-4">
            <div>
              <label className="text-sm text-gray-400 mb-2 block">Target Role</label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-3 bg-[#16213e] border border-[#2a2a4a] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500"
                placeholder="e.g. Software Engineer"
              />
            </div>

            <div>
              <label className="text-sm text-gray-400 mb-2 block">Your Skills</label>
              <textarea
                value={skills}
                onChange={(e) => setSkills(e.target.value)}
                rows={3}
                className="w-full px-4 py-3 bg-[#16213e] border border-[#2a2a4a] rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                placeholder="e.g. Java, Spring Boot, MySQL, REST APIs"
              />
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              {["4 Technical", "3 Aptitude", "3 HR"].map((item) => (
                <div key={item} className="bg-[#16213e] rounded-xl p-3 text-center border border-[#2a2a4a]">
                  <p className="text-white text-sm font-medium">{item}</p>
                  <p className="text-gray-500 text-xs">questions</p>
                </div>
              ))}
            </div>

            <button
              onClick={startInterview}
              disabled={isLoading}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
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
      <div className="min-h-screen bg-[#0f0f1a] p-6">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center">
                <span>🎤</span>
              </div>
              <div>
                <h1 className="text-white font-bold">Mock Interview</h1>
                <p className="text-gray-400 text-sm">with Alex • {role}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-white font-bold">{currentIndex + 1}/{questions.length}</p>
              <p className="text-gray-400 text-sm">questions</p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-[#2a2a4a] rounded-full mb-6">
            <div
              className="h-full bg-gradient-to-r from-purple-600 to-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
            />
          </div>

          {/* Question card */}
          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6 mb-4">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs px-3 py-1 rounded-full border font-medium ${getBadgeColor(current.type)}`}>
                {current.type}
              </span>
              <span className="text-gray-500 text-xs">Question {current.questionNumber}</span>
            </div>

            {/* Alex avatar */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center shrink-0 text-lg">
                👨‍💼
              </div>
              <div className="bg-[#16213e] rounded-2xl rounded-tl-none p-4 flex-1">
                <p className="text-white text-sm font-medium mb-1">Alex</p>
                <p className="text-gray-200">{current.question}</p>
              </div>
            </div>

            {/* Tip + Replay button */}
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-xl p-3 flex-1">
                <p className="text-purple-400 text-xs">💡 Tip: {current.tips}</p>
              </div>
              <button
                onClick={() => alexSpeak(current.question)}
                className="px-3 py-3 bg-[#16213e] border border-[#2a2a4a] rounded-xl text-gray-400 hover:text-purple-400 hover:border-purple-500 transition-colors text-sm"
              >
                🔊
              </button>
            </div>
          </div>

          {/* Answer section */}
          {!feedback ? (
            <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6">
              <label className="text-gray-400 text-sm mb-2 block">Your Answer</label>
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                placeholder={isListening ? "🎤 Listening... speak now!" : "Type your answer or use the mic button below..."}
                className={`w-full px-4 py-3 bg-[#16213e] border rounded-xl text-white placeholder:text-gray-500 focus:outline-none resize-none mb-4 transition-all ${isListening ? 'border-red-500 animate-pulse' : 'border-[#2a2a4a] focus:border-purple-500'}`}
              />
              <div className="flex gap-3">
                <button
                  onClick={startListening}
                  disabled={isListening}
                  className={`px-6 py-3 rounded-xl font-semibold transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-[#16213e] border border-[#2a2a4a] text-gray-300 hover:border-purple-500 hover:text-purple-400'}`}
                >
                  {isListening ? "🎤 Listening..." : "🎤 Speak"}
                </button>
                <button
                  onClick={submitAnswer}
                  disabled={isLoading || !answer.trim()}
                  className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {isLoading ? "Alex is evaluating..." : "Submit Answer ✓"}
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6 space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-white font-semibold">Alex's Verdict</p>
                <div className={`text-2xl font-bold ${feedback.score >= 6 ? 'text-green-400' : 'text-red-400'}`}>
                  {feedback.score}/10
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${feedback.passed ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                <p className={`text-sm ${feedback.passed ? 'text-green-400' : 'text-red-400'}`}>
                  {feedback.passed ? '✅' : '❌'} {feedback.feedback}
                </p>
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
                <p className="text-blue-400 text-sm">💡 {feedback.improvement}</p>
              </div>

              <button
                onClick={nextQuestion}
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
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
      <div className="min-h-screen bg-[#0f0f1a] p-6">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <div className="text-6xl mb-4">{report.hired ? "🎉" : "💪"}</div>
            <h1 className="text-3xl font-bold text-white mb-2">
              {report.hired ? "You're Hired!" : "Keep Grinding!"}
            </h1>
            <p className="text-gray-400">
              {report.totalScore}/{report.maxScore} points • {percentage}%
            </p>
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6 mb-4">
            <div className="flex justify-between text-sm text-gray-400 mb-2">
              <span>Score</span>
              <span>{percentage}%</span>
            </div>
            <div className="w-full h-4 bg-[#2a2a4a] rounded-full">
              <div
                className={`h-full rounded-full transition-all duration-1000 ${report.hired ? 'bg-gradient-to-r from-green-500 to-emerald-400' : 'bg-gradient-to-r from-orange-500 to-red-400'}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6 mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-pink-500 rounded-full flex items-center justify-center shrink-0 text-lg">
                👨‍💼
              </div>
              <div>
                <p className="text-white font-medium mb-1">Alex says:</p>
                <p className="text-gray-300">{report.overallFeedback}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6 mb-4">
            <h3 className="text-green-400 font-semibold mb-3">✅ Strengths</h3>
            <ul className="space-y-2">
              {report.strengths.map((s: string, i: number) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-green-400 mt-0.5">•</span> {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-[#1a1a2e] rounded-2xl border border-[#2a2a4a] p-6 mb-6">
            <h3 className="text-orange-400 font-semibold mb-3">🎯 Areas to Improve</h3>
            <ul className="space-y-2">
              {report.improvements.map((imp: string, i: number) => (
                <li key={i} className="text-gray-300 text-sm flex items-start gap-2">
                  <span className="text-orange-400 mt-0.5">•</span> {imp}
                </li>
              ))}
            </ul>
          </div>

          <button
            onClick={() => { setStep("setup"); setQuestions([]); setScores([]); setReport(null); }}
            className="w-full py-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold text-lg hover:opacity-90 transition-opacity"
          >
            Try Again 🔄
          </button>
        </div>
      </div>
    )
  }

  return null
}