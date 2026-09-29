import SiteHeader from "@/components/SiteHeader"
import SiteFooter from "@/components/SiteFooter"
import { supabase } from "@/lib/supabase"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { formatPrice, formatResponseWindow } from "@/lib/format"
import {
  TagIcon,
  LinkIcon,
  ClockIcon,
  ChatIcon,
  LockIcon,
  RobotIcon,
  PersonIcon,
  SparkleAccentIcon,
  ShieldCheckIcon,
  BriefcaseIcon,
  PaletteIcon,
  RocketIcon,
  DocumentIcon,
  CodeIcon,
  MegaphoneIcon,
  UsersIcon,
  BarChartIcon,
  StarIcon,
} from "@/components/icons"

const howItWorks = [
  {
    icon: TagIcon,
    title: "Set your price",
    body: "Choose your price and response time. Your page is ready in minutes.",
    numberBg: "bg-postal-red/15",
    numberText: "text-postal-red",
    iconBg: "bg-postal-red/10",
    iconText: "text-postal-red",
  },
  {
    icon: LinkIcon,
    title: "Share your link",
    body: "Add your link to your bio, DMs, newsletter, or anywhere you share.",
    numberBg: "bg-lavender",
    numberText: "text-ink",
    iconBg: "bg-lavender/70",
    iconText: "text-ink",
  },
  {
    icon: ShieldCheckIcon,
    title: "Payment is secured",
    body: "Their card is authorized when they ask. No answer, no charge.",
    numberBg: "bg-line",
    numberText: "text-ink",
    iconBg: "bg-line/50",
    iconText: "text-ink",
  },
  {
    icon: ChatIcon,
    title: "Answer & get paid",
    body: "Reply in your own words. Answer on time, and you get paid.",
    numberBg: "bg-green-500/15",
    numberText: "text-green-700",
    iconBg: "bg-green-500/10",
    iconText: "text-green-700",
  },
]

const whoThisIsFor = [
  { label: "Consultants", icon: BriefcaseIcon },
  { label: "Creators", icon: DocumentIcon },
  { label: "Coaches", icon: UsersIcon },
  { label: "Designers", icon: PaletteIcon },
  { label: "Developers", icon: CodeIcon },
  { label: "Advisors", icon: BarChartIcon },
  { label: "Founders", icon: RocketIcon },
  { label: "Marketers", icon: MegaphoneIcon },
  { label: "Experts", icon: StarIcon },
]

// Fallback content for the hero preview card, used only if the live demo
// account below is ever renamed or removed.
const FALLBACK_HERO = {
  name: "Jordan Blake",
  headline: "Career & Interview Coach",
  topics: ["Career Strategy", "Resume Review", "Interview Prep", "Product Management"],
  price: "10",
  responseWindow: "24 hours",
}
const HERO_TOPIC_STYLES = ["bg-lavender/60", "bg-postal-blue/10", "bg-line/50"]

// The hero preview card mirrors a real, live demo profile instead of a
// hardcoded persona, so it's an actual example visitors can click through to
// rather than a picture that can drift out of sync with the real product.
const DEMO_USERNAME = "maya"

export default async function Home() {
  const { data: demoProfile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("username", DEMO_USERNAME)
    .maybeSingle()

  let demoHeadline: string | null = null
  let demoPrice: string | null = null
  let demoResponseWindow: string | null = null
  let demoTopics: string[] = []

  if (demoProfile) {
    const { data: expert } = await supabaseAdmin
      .from("experts")
      .select("headline, price_cents, response_window_hours")
      .eq("id", demoProfile.id)
      .maybeSingle()

    if (expert) {
      demoHeadline = expert.headline
      demoPrice = formatPrice(expert.price_cents)
      demoResponseWindow = formatResponseWindow(expert.response_window_hours)
    }

    const { data: topicsData } = await supabaseAdmin
      .from("expert_topics")
      .select("name")
      .eq("expert_id", demoProfile.id)
      .order("sort_order", { ascending: true })

    demoTopics = topicsData?.map((t) => t.name) ?? []
  }

  const hero = {
    name: demoProfile?.full_name ?? FALLBACK_HERO.name,
    headline: demoHeadline ?? FALLBACK_HERO.headline,
    topics: demoTopics.length > 0 ? demoTopics : FALLBACK_HERO.topics,
    price: demoPrice ?? FALLBACK_HERO.price,
    responseWindow: demoResponseWindow ?? FALLBACK_HERO.responseWindow,
    avatarUrl: demoProfile?.avatar_url ?? null,
    href: demoProfile ? `/${DEMO_USERNAME}` : "/register",
  }

  return (
    <main className="min-h-screen">
      <SiteHeader />

      {/* Hero — written for the expert */}
      <section className="mx-auto max-w-5xl px-6 pt-16 pb-20">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <h1 className="font-display text-4xl leading-tight text-ink sm:text-5xl">
              People have questions.
              <br />
              You have answers.
            </h1>
            <p className="mt-3 font-display text-2xl font-medium text-postal-red sm:text-3xl">
              Now you can get paid for them.
            </p>
            <p className="mx-auto mt-6 max-w-xl text-lg text-ink-soft lg:mx-0">
              Set your price. Share one link. Answer within the time you set.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <a
                href="/register"
                className="rounded-full bg-ink px-7 py-3.5 text-sm font-medium text-paper transition-colors hover:bg-postal-blue"
              >
                Create your page →
              </a>
            </div>
            <p className="mt-4 text-sm text-ink-soft">
              No website. No invoices. Just your expertise.
            </p>
          </div>

          <div className="mx-auto w-full max-w-sm">
            <p className="mb-5 text-center text-sm font-medium text-ink-soft lg:text-left">
              What your page could look like
            </p>

            <div className="relative">
              <SparkleAccentIcon className="absolute -left-5 -top-5 h-7 w-7 text-postal-red" />
              <SparkleAccentIcon className="absolute -bottom-5 -right-5 h-7 w-7 rotate-180 text-lavender" />

              <span className="absolute -top-3 right-4 z-10 rounded-full border border-line bg-white px-2.5 py-1 text-[11px] font-medium text-ink-soft shadow-sm">
                Example profile
              </span>

              <a
                href={hero.href}
                className="block rounded-lg border border-line bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-center gap-3">
                  {hero.avatarUrl ? (
                    <img
                      src={hero.avatarUrl}
                      alt={hero.name}
                      className="h-14 w-14 flex-shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-lavender/60 text-lg font-medium text-ink">
                      {hero.name
                        .split(" ")
                        .map((n: string) => n.charAt(0))
                        .join("")
                        .toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="font-display text-lg text-ink">{hero.name}</p>
                    <p className="text-sm text-ink-soft">{hero.headline}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {hero.topics.map((topic, i) => (
                    <span
                      key={topic}
                      className={`rounded-full px-3 py-1 text-xs font-medium text-ink ${HERO_TOPIC_STYLES[i % HERO_TOPIC_STYLES.length]}`}
                    >
                      {topic}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center gap-3 border-t border-line pt-4 text-sm text-ink-soft">
                  <span className="flex items-center gap-1.5">
                    <TagIcon className="h-4 w-4 text-postal-red" />${hero.price} per
                    question
                  </span>
                  <span className="h-4 w-px bg-line" />
                  <span className="flex items-center gap-1.5">
                    <ClockIcon className="h-4 w-4 text-postal-red" />
                    Replies within {hero.responseWindow}
                  </span>
                </div>

                <span className="mt-5 flex w-full items-center justify-center rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper">
                  Ask a question — ${hero.price}
                </span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* How it works — from the expert's side */}
      <section id="how" className="border-t border-line">
        <div className="mx-auto max-w-6xl px-6 py-16">
          <h2 className="font-display text-3xl text-ink">How it works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {howItWorks.map(
              (
                { icon: Icon, title, body, numberBg, numberText, iconBg, iconText },
                i,
              ) => (
                <li
                  key={title}
                  className="rounded-xl border border-line bg-white p-6"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full font-display text-base font-semibold ${numberBg} ${numberText}`}
                    >
                      {i + 1}
                    </span>
                    <span
                      className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${iconBg} ${iconText}`}
                    >
                      <Icon className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="mt-6">
                    <p className="font-display text-xl font-semibold text-ink">
                      {title}
                    </p>
                    <p className="mt-2 text-ink-soft">{body}</p>
                  </div>
                </li>
              ),
            )}
          </ol>

          <div className="mx-auto mt-6 flex max-w-xl items-start gap-3 rounded-lg border border-line bg-white px-5 py-4 text-left">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-green-500/10 text-green-700">
              <LockIcon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                Your email stays private
              </p>
              <p className="mt-0.5 text-sm text-ink-soft">
                Askers never see your email address. Questions and answers
                are handled through Drop Me A Question.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Why this beats free DMs / beats AI — reframed for the expert's pitch to their audience */}
      <section className="border-t border-line bg-ink text-paper">
        <div className="mx-auto grid max-w-5xl items-center gap-10 px-6 py-16 lg:grid-cols-2">
          <div>
            <h2 className="font-display text-2xl">
              AI has answers. You have experience.
            </h2>
            <p className="mt-4 max-w-xl text-paper/80">
              Your audience can already ask AI anything for free. What they
              can&apos;t get from AI is you — your judgment, your experience,
              your name behind the answer. Drop Me A Question turns that into
              something you can actually charge for, without building a
              website or chasing invoices.
            </p>
          </div>

          <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <div className="flex items-start gap-2.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-paper text-ink">
                <RobotIcon className="h-5 w-5" />
              </span>
              <div className="rounded-lg rounded-tl-none bg-paper/10 p-3 text-sm text-paper/80">
                <p className="font-medium text-paper">AI can give information.</p>
                <p className="mt-1">
                  Here are 10 general tips about marketing strategies&hellip;
                </p>
              </div>
            </div>
            <div className="flex items-start justify-end gap-2.5">
              <div className="rounded-lg rounded-tr-none bg-postal-red/90 p-3 text-sm text-paper">
                <p className="font-medium">You give real answers.</p>
                <p className="mt-1 text-paper/90">
                  Based on my experience with 20+ companies, here&apos;s what
                  actually works&hellip;
                </p>
              </div>
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-postal-red text-paper">
                <PersonIcon className="h-5 w-5" />
              </span>
            </div>
            <p className="mt-1 text-center text-sm font-medium text-paper/60">
              That&apos;s what people will pay for.
            </p>
          </div>
        </div>
      </section>

      {/* Who this is for */}
      <section className="border-t border-line">
        <div className="mx-auto max-w-3xl px-6 py-16">
          <h2 className="font-display text-2xl text-ink">Who is this for?</h2>
          <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {whoThisIsFor.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex items-center gap-3 rounded-sm bg-line/30 px-4 py-3"
              >
                <Icon className="h-5 w-5 flex-shrink-0 text-postal-blue" />
                <p className="text-ink">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Start CTA */}
      <section id="start" className="border-t border-line bg-postal-red/10">
        <div className="mx-auto max-w-3xl px-6 py-16 text-center">
          <h2 className="font-display text-2xl text-ink">
            Your knowledge shouldn&apos;t have to live in your DMs.
          </h2>
          <a
            href="/register"
            className="mt-6 inline-block rounded-full bg-postal-red px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-ink"
          >
            Create your page →
          </a>
        </div>
      </section>

      {/* Explanation for the asker who lands here directly, not via an
          expert's link -- reachable via "Here to ask?" in the nav */}
      <section id="ask-instead" className="border-t border-line">
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <h2 className="font-display text-xl text-ink">
            Here to ask a question?
          </h2>
          <div className="mt-3 space-y-3 text-center text-sm text-ink-soft">
            <p>
              Have a Drop Me A Question link from an expert?
              <br />
              Open their link to ask them directly.
            </p>
            <p>
              Don&apos;t have one?
              <br />
              Ask the expert to share their page with you.
            </p>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
