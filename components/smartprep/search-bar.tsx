"use client"

import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react"
import { Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { suggestTopics } from "@/lib/api"
import type { SubjectFilter } from "@/lib/types"
import { TopicSuggestions, suggestionOptionId } from "./topic-suggestions"

interface SearchBarProps {
  onSearch: (query: string, subject: SubjectFilter) => void
  isSearching: boolean
  suggestDebounceMs?: number
}

const MIN_SUGGEST_LENGTH = 2

// There is no subject picker: every search covers all subjects
const subject: SubjectFilter = "All"

export function SearchBar({
  onSearch,
  isSearching,
  suggestDebounceMs = 300,
}: SearchBarProps) {
  const [query, setQuery] = useState("")

  // Autocomplete state
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggesting, setIsSuggesting] = useState(false)
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const skipNextSuggestRef = useRef(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()

  // Keep the latest callback so runSearch can stay stable
  const onSearchRef = useRef(onSearch)
  useEffect(() => {
    onSearchRef.current = onSearch
  }, [onSearch])

  // Skip repeat searches for the same query + subject (each one costs YouTube quota)
  const lastSearchRef = useRef<string | null>(null)
  const runSearch = useCallback((q: string, s: SubjectFilter, force = false) => {
    const key = `${q}|${s}`
    if (!force && key === lastSearchRef.current) return
    lastSearchRef.current = key
    onSearchRef.current(q, s)
  }, [])

  // Typing only fetches suggestions; YouTube is searched on Enter or when a suggestion is picked.
  // Emptying the box goes straight back to recommendations (no API call).
  useEffect(() => {
    if (query.trim() === "") runSearch("", subject)
  }, [query, runSearch])

  // Debounced suggestions; each new keystroke aborts the previous request
  useEffect(() => {
    if (skipNextSuggestRef.current) {
      skipNextSuggestRef.current = false
      return
    }

    const q = query.trim()
    if (q.length < MIN_SUGGEST_LENGTH) {
      setSuggestions([])
      setIsSuggesting(false)
      setIsSuggestOpen(false)
      setActiveIndex(-1)
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setIsSuggesting(true)
      setIsSuggestOpen(true)
      try {
        const results = await suggestTopics(q, subject, controller.signal)
        setSuggestions(results)
        setActiveIndex(-1)
      } catch {
        // Silent on purpose: autocomplete is optional, so just hide the dropdown
        if (controller.signal.aborted) return
        setSuggestions([])
        setIsSuggestOpen(false)
      } finally {
        if (!controller.signal.aborted) setIsSuggesting(false)
      }
    }, suggestDebounceMs)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, suggestDebounceMs])

  // Close the dropdown on any click outside the search bar
  useEffect(() => {
    if (!isSuggestOpen) return
    const handlePointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsSuggestOpen(false)
      }
    }
    document.addEventListener("mousedown", handlePointerDown)
    return () => document.removeEventListener("mousedown", handlePointerDown)
  }, [isSuggestOpen])

  const closeSuggestions = () => {
    setIsSuggestOpen(false)
    setActiveIndex(-1)
  }

  const selectSuggestion = (topic: string) => {
    // Don't re-open suggestions for the text we just filled in (only matters if the text changes)
    if (topic !== query) skipNextSuggestRef.current = true
    setQuery(topic)
    closeSuggestions()
    runSearch(topic, subject)
  }

  const handleClear = () => {
    setQuery("")
    setSuggestions([])
    closeSuggestions()
    runSearch("", subject)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    const hasSuggestions = suggestions.length > 0

    switch (e.key) {
      case "ArrowDown":
        if (!hasSuggestions) return
        e.preventDefault()
        setIsSuggestOpen(true)
        setActiveIndex((i) => (i + 1) % suggestions.length)
        break
      case "ArrowUp":
        if (!hasSuggestions) return
        e.preventDefault()
        setIsSuggestOpen(true)
        setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1))
        break
      case "Enter":
        e.preventDefault()
        if (isSuggestOpen && activeIndex >= 0 && activeIndex < suggestions.length) {
          selectSuggestion(suggestions[activeIndex])
        } else {
          closeSuggestions()
          runSearch(query.trim(), subject, true)
        }
        break
      case "Escape":
        if (isSuggestOpen) closeSuggestions()
        else handleClear()
        break
      case "Tab":
        closeSuggestions()
        break
    }
  }

  const showDropdown = isSuggestOpen && query.trim().length >= MIN_SUGGEST_LENGTH
  const activeOptionId =
    showDropdown && activeIndex >= 0 ? suggestionOptionId(listId, activeIndex) : undefined

  return (
    <div
      ref={containerRef}
      // z-30 lifts the dropdown above the player/sidebar (timer bar is z-40, popup z-50)
      className="surface relative z-30 flex p-2 rounded-xl border border-primary/30 shadow-card transition-[border-color,box-shadow] focus-within:border-info/50"
    >
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-soft pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0 && query.trim().length >= MIN_SUGGEST_LENGTH) setIsSuggestOpen(true)
          }}
          placeholder="Search any topic, then press Enter"
          aria-label="Search any topic"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={showDropdown}
          aria-controls={listId}
          aria-activedescendant={activeOptionId}
          autoComplete="off"
          className="pl-10 pr-10 h-10 bg-background/40 border-border focus-visible:border-primary focus-visible:ring-primary/30"
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
          {isSearching ? (
            <Spinner className="h-4 w-4 text-primary-soft" />
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

        {showDropdown && (
          <TopicSuggestions
            id={listId}
            query={query.trim()}
            suggestions={suggestions}
            activeIndex={activeIndex}
            isLoading={isSuggesting}
            onSelect={selectSuggestion}
            onHighlight={setActiveIndex}
          />
        )}
      </div>
    </div>
  )
}
