import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Coming soon — Drop Me A Question",
  description: "Drop Me A Question is almost ready. Check back soon.",
  robots: { index: false, follow: false },
}

export default function ComingSoonPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <img
        src="/brand/logo-lockup.png"
        alt="Drop Me A Question"
        className="h-8 w-auto sm:h-9"
      />
      <h1 className="mt-8 font-display text-3xl text-ink sm:text-4xl">
        We&apos;re almost ready.
      </h1>
      <p className="mx-auto mt-3 max-w-sm text-ink-soft">
        Drop Me A Question is putting the finishing touches on things.
        Check back soon.
      </p>
    </main>
  )
}
