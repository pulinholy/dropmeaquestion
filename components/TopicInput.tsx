"use client"

import { useState } from "react"

export const MAX_TOPICS = 5
export const MAX_TOPIC_LENGTH = 40

export default function TopicInput({
  topics,
  onChange,
}: {
  topics: string[]
  onChange: (topics: string[]) => void
}) {
  const [input, setInput] = useState("")

  function addTopic() {
    const trimmed = input.trim()
    if (!trimmed || topics.length >= MAX_TOPICS) {
      setInput("")
      return
    }
    if (topics.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setInput("")
      return
    }
    onChange([...topics, trimmed.slice(0, MAX_TOPIC_LENGTH)])
    setInput("")
  }

  function removeTopic(index: number) {
    onChange(topics.filter((_, i) => i !== index))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault()
      addTopic()
    } else if (e.key === "Backspace" && input === "" && topics.length > 0) {
      removeTopic(topics.length - 1)
    }
  }

  return (
    <div>
      {topics.length < MAX_TOPICS && (
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={MAX_TOPIC_LENGTH}
          placeholder="Add a topic and press Enter..."
          className="w-full rounded-sm border border-line px-3 py-2 text-ink placeholder:text-ink-soft/60"
        />
      )}

      <div className="mt-1 flex items-center justify-between text-xs text-ink-soft">
        <span>
          {topics.length >= MAX_TOPICS
            ? `Maximum of ${MAX_TOPICS} topics reached.`
            : "Examples: Email marketing, Home buying, Photography, College admissions"}
        </span>
        <span className="flex-shrink-0 pl-2">
          {topics.length}/{MAX_TOPICS}
        </span>
      </div>

      {topics.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {topics.map((topic, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 rounded-full border border-line bg-lavender/50 px-3 py-1 text-sm text-ink"
            >
              {topic}
              <button
                type="button"
                onClick={() => removeTopic(i)}
                aria-label={`Remove ${topic}`}
                className="text-ink-soft hover:text-postal-red"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
