// Flat illustration for the dashboard's "Keep getting questions" tile:
// a person at a laptop with a question bubble above.
export default function GetMoreQuestionsIllustration({
  className,
}: {
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 220 220"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {/* sparkle strokes */}
      <g stroke="#e45b4f" strokeWidth="3" strokeLinecap="round">
        <path d="M30 78l6 9" />
        <path d="M46 64l3 11" />
        <path d="M60 58l-2 10" />
        <path d="M188 92l9 4" />
        <path d="M190 108l8 8" />
      </g>
      <g stroke="#f2b84b" strokeWidth="3" strokeLinecap="round">
        <path d="M196 20l-5 8" />
        <path d="M206 34l-9 3" />
      </g>

      {/* question bubble */}
      <path
        d="M126 14h58a14 14 0 0 1 14 14v34a14 14 0 0 1-14 14h-26l-14 16-3-16h-15a14 14 0 0 1-14-14V28a14 14 0 0 1 14-14z"
        fill="#8f9bef"
      />
      <text
        x="155"
        y="62"
        textAnchor="middle"
        fontSize="38"
        fontWeight="700"
        fill="#fff"
        fontFamily="Georgia, serif"
      >
        ?
      </text>

      {/* hair (back) */}
      <path
        d="M58 168c-14-44-2-86 40-90 44-4 62 34 46 90z"
        fill="#1e2a4a"
      />
      {/* body */}
      <path d="M34 214c0-34 20-58 58-58s52 24 52 58z" fill="#f08a76" />
      {/* neck */}
      <rect x="82" y="128" width="20" height="30" rx="9" fill="#f6c4ad" />
      {/* face */}
      <ellipse cx="94" cy="112" rx="24" ry="28" fill="#f6c4ad" />
      {/* hair (front) */}
      <path
        d="M68 108c-2-24 12-38 30-38 16 0 28 11 28 27-14-1-25-8-30-18-5 12-15 21-28 29z"
        fill="#1e2a4a"
      />
      {/* eyes + smile */}
      <circle cx="86" cy="116" r="2.2" fill="#1e2a4a" />
      <circle cx="104" cy="116" r="2.2" fill="#1e2a4a" />
      <path
        d="M88 126c3 3 9 3 12 0"
        stroke="#1e2a4a"
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* laptop */}
      <path d="M104 178l56-5 26 41H92z" fill="#aab1c8" />
      <path d="M92 214h94" stroke="#8a91ab" strokeWidth="4" strokeLinecap="round" />
      <circle cx="140" cy="196" r="3.5" fill="#fff" />

      {/* ground line */}
      <path
        d="M14 215h196"
        stroke="#1e2a4a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}
