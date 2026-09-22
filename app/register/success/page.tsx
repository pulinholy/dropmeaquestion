import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

export default function SuccessPage() {
  return (
    <main className="flex min-h-screen flex-col">
      <SiteHeader />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="font-display text-3xl text-ink">You&apos;re all set!</h1>
        <p className="mt-3 text-ink-soft">
          Your page is live. You&apos;re ready to start sharing your link.
        </p>
      </div>

      <SiteFooter />
    </main>
  )
}
