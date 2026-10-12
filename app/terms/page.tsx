import type { Metadata } from "next"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Terms of Service — Drop Me A Question",
  description: "The terms that govern using Drop Me A Question, for both Experts and Askers.",
}

export default function TermsPage() {
  return (
    <main className="min-h-screen">
      <SiteHeader />

      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl text-ink">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-ink-soft">
          Last updated: {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>

        <div className="mt-10 space-y-10 text-ink-soft">
          <section>
            <p>
              Welcome to Drop Me A Question (&quot;DMQ,&quot; &quot;we,&quot;
              &quot;us&quot;). These Terms of Service (&quot;Terms&quot;)
              govern your use of dropmeaquestion.com and the services we
              provide (the &quot;Service&quot;). By creating an expert page,
              submitting a question, or otherwise using the Service, you
              agree to these Terms. If you don&apos;t agree, please
              don&apos;t use the Service.
            </p>
            <p className="mt-3">
              There are two kinds of people who use DMQ, and these Terms
              apply to both: <strong className="text-ink">Experts</strong>{" "}
              — people who create a page, set a price, and answer questions,
              and who can also offer paid follow-up conversations — and{" "}
              <strong className="text-ink">Askers</strong> — people who pay
              to ask an Expert a question, or to book a follow-up conversation. We refer to both together as
              &quot;users&quot; or &quot;you.&quot;
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Who can use DMQ</h2>
            <p className="mt-3">
              You must be at least 18 years old, or the age of legal majority
              where you live, and able to enter into a binding contract, to
              create an Expert account or pay to ask a question. If you
              create an Expert account, you&apos;re responsible for keeping
              your login credentials secure and for all activity under your
              account.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Expert accounts and pages
            </h2>
            <p className="mt-3">
              When you register as an Expert, you choose a username, set a
              price per question, and choose how long you&apos;ll take to
              respond (currently 24 or 48 hours). You&apos;re responsible for
              making sure the information on your page — your name,
              headline, bio, and photo — is accurate and belongs to you.
            </p>
            <p className="mt-3">
              You can pause your page at any time from your dashboard, which
              hides your question form from new Askers without deleting your
              account or past questions.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Asking a question
            </h2>
            <p className="mt-3">
              Askers don&apos;t need to create an account. You submit a
              question, an email address to receive the answer at, and
              payment. You&apos;re responsible for making sure the email
              address you provide is your own — DMQ sends the Expert&apos;s
              answer, and any refund notices, to whatever address is
              submitted with the question.
            </p>
            <p className="mt-3">
              You may optionally attach a single image or PDF file (up to
              4MB) to your question after payment, to give the Expert
              helpful context. Don&apos;t attach anything you don&apos;t
              have the right to share, or anything illegal, abusive, or
              infringing.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Payments, fees, and refunds
            </h2>
            <p className="mt-3">
              Payments are processed by Stripe. When you pay to ask a
              question, your card is authorized for the full amount but not
              charged yet. DMQ keeps a percentage of each payment as a
              platform fee; the remainder is paid out to the Expert through
              Stripe Connect.
            </p>
            <p className="mt-3">
              Your card is only actually charged if the Expert answers your
              question within the response window they&apos;ve set. If the
              Expert declines your question, or doesn&apos;t answer within
              that window, the authorization is released and you are not
              charged — DMQ does not retain any fee on questions that go
              unanswered or are declined.
            </p>
            <p className="mt-3">
              Because DMQ pays Experts directly through Stripe Connect rather
              than holding or transmitting funds itself, DMQ is not a party
              to the underlying transaction between an Asker and an Expert
              beyond facilitating payment and delivery of the answer. Any
              dispute about a specific answer&apos;s quality or content is
              between the Asker and the Expert.
            </p>
          </section>

          <section id="conversations">
            <h2 className="font-display text-xl text-ink">
              Follow-up conversations
            </h2>
            <p className="mt-3">
              An Expert can choose to offer Askers an optional, paid
              15-minute conversation after answering a question. Experts
              decide whether to offer it, can turn it off for any answer,
              and set the price. A conversation takes place on DMQ, as an
              audio call in the browser with an optional camera. It is
              not recorded.
            </p>
            <p className="mt-3">
              <strong className="text-ink">Booking.</strong> An Asker can
              request a conversation within 14 days of receiving the answer
              by proposing up to three start times, each at least 24 hours
              away. The Asker&apos;s card is authorized when the request is
              made. The Expert has 24 hours to confirm one of the times or
              decline. If the Expert declines or doesn&apos;t respond, the
              authorization is released and the Asker is not charged.
            </p>
            <p className="mt-3">
              <strong className="text-ink">Payment.</strong> The Asker&apos;s
              card is charged after the conversation takes place: when the
              Asker confirms that it did, or automatically about a day after
              it ends if no problem has been reported. DMQ keeps a platform
              fee from each conversation payment and the remainder is paid
              to the Expert through Stripe Connect.
            </p>
            <p className="mt-3">
              <strong className="text-ink">Cancellations and no-shows.</strong>{" "}
              An Asker can cancel for free until 24 hours before the start.
              Cancelling later, or not joining, is charged in full. If the
              Expert cancels or doesn&apos;t join, the Asker is not
              charged.
            </p>
            <p className="mt-3">
              <strong className="text-ink">Technical problems.</strong> If a
              technical problem prevents a conversation from taking place,
              either participant may request a new time at no additional
              charge, subject to the rules in our{" "}
              <Link
                href="/conversation-policy"
                className="text-postal-red underline decoration-line underline-offset-4 hover:text-ink"
              >
                Conversation &amp; Cancellation Policy
              </Link>
              . If a conversation has substantially taken place, the normal
              completion and payment rules apply.
            </p>
            <p className="mt-3">
              <strong className="text-ink">Disputes and records.</strong> If
              either participant reports a problem, DMQ holds the payment
              and reviews what happened. To decide, we may use the records
              we keep of the conversation, such as the booking details,
              when each participant joined and left, and any report or note
              they send us. We make these decisions in good faith, and
              we may release or capture the payment as a result.
              Disagreeing with the Expert&apos;s opinion or advice is not
              grounds for a refund. An Asker who believes a charge was made
              in error should contact us within 24 hours.
            </p>
            <p className="mt-3">
              <strong className="text-ink">Conduct.</strong> Don&apos;t record
              a conversation, or share a recording of one, without the
              consent of everyone in it. Everything in the Acceptable use
              section also applies to conversations. DMQ may end a
              conversation or restrict an account that breaks these
              rules. The Conversation &amp; Cancellation Policy forms part
              of these Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Answers are not professional advice
            </h2>
            <p className="mt-3">
              <strong className="text-ink">
                DMQ does not verify the identity, credentials, licensing, or
                qualifications of any Expert.
              </strong>{" "}
              Anyone can register as an Expert and describe their own
              background. Answers provided through the Service are the
              personal opinion of the individual Expert who wrote them, not
              DMQ, and do not constitute legal, financial, medical, tax, or
              any other kind of licensed professional advice — even if the
              Expert identifies as a lawyer, advisor, coach, or similar.
            </p>
            <p className="mt-3">
              If you&apos;re an Expert in a regulated profession (for
              example, law, financial advising, medicine, or accounting),
              you&apos;re solely responsible for making sure that answering
              paid questions through DMQ complies with the licensing,
              advertising, and confidentiality rules that apply to you. DMQ
              is not designed to handle privileged or confidential
              professional communications.
            </p>
            <p className="mt-3">
              If you&apos;re an Asker, you should not treat any answer as a
              substitute for advice from a licensed professional you&apos;ve
              actually retained, and you use any answer at your own risk.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Acceptable use
            </h2>
            <p className="mt-3">Please don&apos;t use DMQ to:</p>
            <ul className="mt-3 list-disc space-y-2 pl-5">
              <li>Break the law, or ask someone else to break the law.</li>
              <li>
                Post or submit anything threatening, harassing, defamatory,
                obscene, or that infringes someone else&apos;s rights.
              </li>
              <li>
                Impersonate another person, or misrepresent your identity,
                credentials, or affiliation.
              </li>
              <li>
                Attempt to bypass payment (for example, by submitting
                questions without paying, or by abusing the refund/expiry
                mechanism in bad faith).
              </li>
              <li>
                Upload malicious files, or anything containing a virus or
                harmful code, as a question attachment.
              </li>
              <li>
                Use the Service to send unsolicited advertising or spam to
                Experts or Askers.
              </li>
              <li>
                Record or share a conversation without the consent of
                everyone in it, or take a conversation or payment outside
                DMQ to avoid its fees.
              </li>
            </ul>
            <p className="mt-3">
              We may suspend or terminate accounts that violate these rules.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Content ownership
            </h2>
            <p className="mt-3">
              Experts retain ownership of their profile content and answers.
              Askers retain ownership of their questions and any attachments
              they submit. By submitting content through DMQ, you grant us a
              limited license to store, process, and transmit it as needed
              to operate the Service — for example, delivering your question
              to the Expert, or emailing an answer back to you.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Third-party services
            </h2>
            <p className="mt-3">
              DMQ relies on third-party providers to operate — including
              Stripe for payments, Supabase for account and data storage,
              Resend for email delivery, and Daily for audio conversations. Your use of DMQ is also subject
              to those providers&apos; own terms, and we aren&apos;t
              responsible for their performance or downtime.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Disclaimers and limitation of liability
            </h2>
            <p className="mt-3">
              The Service is provided &quot;as is,&quot; without warranties
              of any kind. We don&apos;t guarantee that answers will be
              accurate, complete, or fit for any particular purpose, or that
              the Service will be uninterrupted or error-free.
            </p>
            <p className="mt-3">
              To the fullest extent permitted by law, DMQ and its owner
              won&apos;t be liable for any indirect, incidental, or
              consequential damages arising from your use of the Service, or
              from any answer, question, or interaction between an Expert
              and an Asker. Our total liability for any claim relating to
              the Service is limited to the amount of fees DMQ actually
              collected in connection with the specific transaction giving
              rise to the claim.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">
              Changes to these Terms
            </h2>
            <p className="mt-3">
              We may update these Terms from time to time. If we make
              material changes, we&apos;ll update the date at the top of
              this page. Continuing to use DMQ after changes take effect
              means you accept the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="font-display text-xl text-ink">Contact</h2>
            <p className="mt-3">
              Questions about these Terms? Reach us at{" "}
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
