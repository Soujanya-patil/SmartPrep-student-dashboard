"use client"

import { Loader2, Search } from "lucide-react"
import { cn } from "@/lib/utils"

interface TopicSuggestionsProps {
  id: string
  query: string
  suggestions: string[]
  activeIndex: number
  isLoading: boolean
  onSelect: (topic: string) => void
  onHighlight: (index: number) => void
}

export function suggestionOptionId(listId: string, index: number): string {
  return `${listId}-option-${index}`
}

// Bold the first case-insensitive occurrence of the query inside the topic
function HighlightedMatch({ text, query }: { text: string; query: string }) {
  const start = query ? text.toLowerCase().indexOf(query.toLowerCase()) : -1
  if (start === -1) return <span className="text-muted-foreground">{text}</span>

  const end = start + query.length
  return (
    <span className="text-muted-foreground">
      {text.slice(0, start)}
      <strong className="font-semibold text-foreground">{text.slice(start, end)}</strong>
      {text.slice(end)}
    </span>
  )
}

export function TopicSuggestions({
  id,
  query,
  suggestions,
  activeIndex,
  isLoading,
  onSelect,
  onHighlight,
}: TopicSuggestionsProps) {
  return (
    <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-xl border border-primary/30 bg-card/95 backdrop-blur-xl shadow-2xl shadow-primary/20">
      {isLoading && suggestions.length === 0 ? (
        <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          Finding topics...
        </div>
      ) : suggestions.length === 0 ? (
        <div className="px-4 py-3 text-sm text-muted-foreground" role="status">
          No suggestions found
        </div>
      ) : (
        <ul id={id} role="listbox" aria-label="Topic suggestions" className="py-1 max-h-72 overflow-y-auto">
          {suggestions.map((topic, index) => {
            const isActive = index === activeIndex
            return (
              <li
                key={topic}
                id={suggestionOptionId(id, index)}
                role="option"
                aria-selected={isActive}
                // mousedown + preventDefault keeps focus in the input so the click isn't lost to blur
                onMouseDown={(e) => {
                  e.preventDefault()
                  onSelect(topic)
                }}
                onMouseMove={() => {
                  if (!isActive) onHighlight(index)
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors",
                  isActive ? "bg-primary/20" : "hover:bg-primary/10"
                )}
              >
                <Search className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <HighlightedMatch text={topic} query={query} />
              </li>
            )
          })}
          {isLoading && (
            <li className="flex items-center gap-2 px-4 py-2 text-xs text-muted-foreground" aria-hidden>
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
              Updating...
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
