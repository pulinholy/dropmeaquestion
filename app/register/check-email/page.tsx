import Link from "next/link"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

export default function CheckEmailPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Check your email</h1>
        <p className="mt-3 text-ink-soft">
          We sent you a link to confirm your email address. Click it, then log
          in and your page will be set up automatically.
        </p>
        <Link
          href="/login"
          className="mt-6 inline-block rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
        >
          Go to log in →
        </Link>
      </div>

      <SiteFooter />
    </main>
  )
}
