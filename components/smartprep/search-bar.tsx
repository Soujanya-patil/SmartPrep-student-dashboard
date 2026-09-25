"use client"

import { useEffect, useRef, useState } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { SUBJECT_FILTERS, type SubjectFilter } from "@/lib/types"

interface SearchBarProps {
  onSearch: (query: string, subject: SubjectFilter) => void
  isSearching: boolean
  debounceMs?: number
}

function isSubjectFilter(value: string): value is SubjectFilter {
  return (SUBJECT_FILTERS as readonly string[]).includes(value)
}

export function SearchBar({ onSearch, isSearching, debounceMs = 400 }: SearchBarProps) {
  const [query, setQuery] = useState("")
  const [subject, setSubject] = useState<SubjectFilter>("All")

  // Keep the latest callback without restarting the debounce timer when it changes
  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  // Debounce: only search once typing pauses
  useEffect(() => {
    const timer = setTimeout(() => onSearchRef.current(query.trim(), subject), debounceMs)
    return () => clearTimeout(timer)
  }, [query, subject, debounceMs])

  const handleClear = () => {
    setQuery("")
    onSearchRef.current("", subject)
  }

  return (
    <div className="glassmorphism flex flex-col sm:flex-row gap-2 p-2 rounded-xl border border-primary/30 shadow-lg shadow-primary/10">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleClear()
          }}
          placeholder="Search any topic..."
          aria-label="Search any topic"
          className="pl-10 pr-10 h-10 bg-background/40 border-border focus-visible:border-primary focus-visible:ring-primary/30"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {isSearching ? (
            <Spinner className="h-4 w-4 text-primary" />
          ) : query ? (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <Select
        value={subject}
        onValueChange={(value) => {
          if (isSubjectFilter(value)) setSubject(value)
        }}
      >
        <SelectTrigger
          aria-label="Filter by subject"
          className="w-full sm:w-44 h-10 bg-background/40 border-border focus-visible:border-primary"
        >
          <SelectValue>{subject === "All" ? "All subjects" : subject}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SUBJECT_FILTERS.map((option) => (
            <SelectItem key={option} value={option}>
              {option === "All" ? "All subjects" : option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
