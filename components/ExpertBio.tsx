"use client"

import { useState } from "react"

const BIO_PREVIEW_LENGTH = 220

export default function ExpertBio({ bio }: { bio: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = bio.length > BIO_PREVIEW_LENGTH
  const displayed = isLong && !expanded ? `${bio.slice(0, BIO_PREVIEW_LENGTH).trimEnd()}…` : bio

  return (
    <p className="mt-3 text-sm leading-relaxed text-ink">
      {displayed}{" "}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="font-medium text-postal-red hover:underline"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      )}
    </p>
  )
}
