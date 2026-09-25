import Link from "next/link"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

export default function SuccessPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">Your page is live!</h1>
        <p className="mt-3 text-ink-soft">
          One more step before you share your link — connect your bank
          account so you can actually get paid when you answer.
        </p>
        <Link
          href="/dashboard/payments"
          className="mt-6 inline-block rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
        >
          Connect your bank account →
        </Link>
      </div>

      <SiteFooter />
    </main>
  )
}
