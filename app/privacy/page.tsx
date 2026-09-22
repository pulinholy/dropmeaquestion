import type { Metadata } from "next"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"

export const metadata: Metadata = {
  title: "Privacy Policy — Drop Me A Question",
  description: "What Drop Me A Question collects, how it's used, and who it's shared with.",
}

export default function PrivacyPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl text-ink">
          Privacy Policy
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="mt-10 space-y-10 text-ink-soft">
          <section>
            <p>
              This policy explains what information Drop Me A Question
              (&quot;DMQ,&quot; &quot;we,&quot; &quot;us&quot;) collects when
              you use dropmeaquestion.com, why we collect it, and who we
              share it with. It covers both{" "}
              <strong className="text-ink">Experts</strong> (people who
              create a page and answer questions) and{" "}
              <strong className="text-ink">Askers</strong> (people who pay
              to ask a question, without needing an account).
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Information we collect
            </h2>
            <p className="mt-3 font-medium text-ink">If you&apos;re an Expert</p>
            <p className="mt-2">
              Your email and password (used to create your account), your
              full name, username, profile photo, headline, and bio, and the
              price and response time you set. If you connect payouts, Stripe
              collects and verifies your identity, bank account, and tax
              information directly — DMQ only stores your Stripe account ID,
              not your bank details.
            </p>
            <p className="mt-3 font-medium text-ink">If you&apos;re an Asker</p>
            <p className="mt-2">
              The email address you provide (so we can send you the answer),
              the text of your question, and, if you choose to add one, a
              single image or PDF attachment. Your payment is handled
              entirely by Stripe — DMQ never receives or stores your card
              number.
            </p>
            <p className="mt-3 font-medium text-ink">Automatically</p>
            <p className="mt-2">
              Standard technical information our hosting and payment
              providers collect to operate the Service, like IP address and
              browser type. If you&apos;re an Expert, we use your browser&apos;s
              local storage (not third-party advertising cookies) to keep you
              signed in. DMQ does not currently use analytics or advertising
              trackers of its own.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              How we use your information
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>To operate the core service — matching questions to Experts, processing payment, and delivering answers by email.</li>
              <li>To run the payment and payout flow through Stripe, including authorizing, capturing, or releasing a charge depending on whether a question is answered, declined, or expires.</li>
              <li>To send you service emails — an answer to your question, a notice that your payment was released because a question expired, or account-related messages if you&apos;re an Expert.</li>
              <li>To keep the Service secure and prevent abuse.</li>
            </ul>
            <p className="mt-3">
              We don&apos;t sell your personal information, and we don&apos;t
              use your questions, answers, or profile information for
              advertising.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Who we share it with
            </h2>
            <p className="mt-3">
              We share information with the third-party providers we rely on
              to run DMQ, and only as needed for them to provide their
              service to us:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li><strong className="text-ink">Stripe</strong> — payment processing and Expert payouts.</li>
              <li><strong className="text-ink">Supabase</strong> — our database, authentication, and file storage (profile photos and question attachments).</li>
              <li><strong className="text-ink">Resend</strong> — delivering answer and notification emails.</li>
              <li><strong className="text-ink">Vercel</strong> — hosting the website.</li>
            </ul>
            <p className="mt-3">
              An Expert&apos;s public page (name, headline, bio, photo, price)
              is, by design, visible to anyone who visits it. An Asker&apos;s
              email address and question are only visible to the Expert
              they&apos;re addressed to, and to DMQ as needed to operate the
              Service.
            </p>
            <p className="mt-3">
              We don&apos;t share your information with anyone else unless
              we&apos;re required to by law, or to protect the rights,
              safety, or property of DMQ or our users.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              How long we keep it
            </h2>
            <p className="mt-3">
              We keep Expert account information for as long as the account
              is active, and question/answer records as part of that
              account&apos;s history. If you&apos;d like your Expert account
              or personal information deleted, contact us at the address
              below and we&apos;ll do so, except where we&apos;re required to
              retain records (for example, payment records) for legal or
              accounting purposes.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Your choices</h2>
            <p className="mt-3">
              If you&apos;re an Expert, you can update your profile
              information, price, and response window at any time from your
              dashboard, and pause your page to stop receiving new
              questions. You can request a copy of your data, or ask us to
              correct or delete it, by emailing us.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Children&apos;s privacy
            </h2>
            <p className="mt-3">
              DMQ isn&apos;t intended for anyone under 18. We don&apos;t
              knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Security</h2>
            <p className="mt-3">
              We rely on our providers&apos; security practices (including
              Stripe&apos;s PCI-compliant payment handling and
              Supabase&apos;s access controls) and our own access
              restrictions to protect your information. No method of storing
              or transmitting data online is perfectly secure, so we
              can&apos;t guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Changes to this policy
            </h2>
            <p className="mt-3">
              We may update this policy from time to time. If we make
              material changes, we&apos;ll update the date at the top of
              this page.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Contact</h2>
            <p className="mt-3">
              Questions about this policy, or want to access, correct, or
              delete your information? Reach us at{" "}
              <a
                href="mailto:hello@dropmeaquestion.com"
                className="text-postal-red underline decoration-line underline-offset-4 hover:text-ink"
              >
                hello@dropmeaquestion.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
