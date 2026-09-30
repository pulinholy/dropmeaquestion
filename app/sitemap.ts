import type { MetadataRoute } from "next"
import { supabaseAdmin } from "@/lib/supabase-admin"
import { PUBLIC_SITE_URL } from "@/lib/site"

// The fictional showcase profile -- deliberately excluded so it never shows
// up as a real search result (see the "Example profile" work elsewhere).
const EXCLUDED_USERNAMES = new Set(["maya"])

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPages: MetadataRoute.Sitemap = [
    { url: PUBLIC_SITE_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${PUBLIC_SITE_URL}/register`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${PUBLIC_SITE_URL}/login`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${PUBLIC_SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${PUBLIC_SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.2 },
  ]

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, username")
    .not("username", "is", null)

  const { data: experts } = await supabaseAdmin
    .from("experts")
    .select("id, deactivated_at")
  const deactivatedIds = new Set(
    (experts ?? []).filter((e) => e.deactivated_at).map((e) => e.id)
  )

  const expertPages: MetadataRoute.Sitemap = (profiles ?? [])
    .filter(
      (p) =>
        p.username &&
        !EXCLUDED_USERNAMES.has(p.username) &&
        !deactivatedIds.has(p.id)
    )
    .map((p) => ({
      url: `${PUBLIC_SITE_URL}/${p.username}`,
      changeFrequency: "weekly",
      priority: 0.6,
    }))

  return [...staticPages, ...expertPages]
}
