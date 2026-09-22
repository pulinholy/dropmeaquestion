import { supabaseAdmin } from "@/lib/supabase-admin"
import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import FeedbackForm from "./feedback-form"

export default async function FeedbackPage({
  params,
}: {
  params: Promise<{ questionId: string }>
}) {
  const { questionId } = await params

  const { data: question } = await supabaseAdmin
    .from("questions")
    .select("id, status, question_text, expert_id, feedback_submitted_at")
    .eq("id", questionId)
    .maybeSingle()

  let expertFirstName = "the expert"
  if (question) {
    const { data: expert } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", question.expert_id)
      .maybeSingle()

    if (expert?.full_name) {
      expertFirstName = expert.full_name.split(" ")[0] || expert.full_name
    }
  }

  const valid = Boolean(question && question.status === "answered")
  const alreadySubmitted = Boolean(question?.feedback_submitted_at)

  return (
    <main className="min-h-screen">
      <SiteHeader variant="asker" />

      <div className="mx-auto max-w-md px-6 py-16 text-center">
        {!valid ? (
          <>
            <h1 className="font-display text-3xl text-ink">
              This link isn&apos;t valid
            </h1>
            <p className="mt-3 text-ink-soft">
              We couldn&apos;t find a feedback request for this question.
            </p>
          </>
        ) : alreadySubmitted ? (
          <>
            <h1 className="font-display text-3xl text-ink">
              Thanks — already got it!
            </h1>
            <p className="mt-3 text-ink-soft">
              You&apos;ve already sent feedback for this question.
            </p>
          </>
        ) : (
          <FeedbackForm
            questionId={questionId}
            expertFirstName={expertFirstName}
            questionText={question!.question_text}
          />
        )}
      </div>

      <SiteFooter />
    </main>
  )
}
