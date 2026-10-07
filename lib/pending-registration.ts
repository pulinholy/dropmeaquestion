import { supabase } from "@/lib/supabase"

// When the project requires email confirmation, signup returns no session, so
// the page can't be created yet. The form details (never the password) are
// kept in this browser and the page is created on the first login after
// confirming.
const KEY = "dmq_pending_registration"

export type PendingRegistration = {
  email: string
  fullName: string
  username: string
  headline: string
  bio: string
  priceCents: number
  responseWindowHours: number
  topics: { name: string; slug: string }[]
}

export function savePendingRegistration(pending: PendingRegistration) {
  try {
    localStorage.setItem(KEY, JSON.stringify(pending))
  } catch {
    // Storage blocked: the user can register again after confirming.
  }
}

function loadPendingRegistration(): PendingRegistration | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as PendingRegistration) : null
  } catch {
    return null
  }
}

function clearPendingRegistration() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}

// Creates the page from saved details if this signed-in user has none yet.
// Returns true when a page was created.
export async function completePendingRegistration(
  userEmail: string | undefined
): Promise<boolean> {
  const pending = loadPendingRegistration()
  if (!pending || !userEmail || pending.email !== userEmail.toLowerCase()) {
    return false
  }

  const { error } = await supabase.rpc("create_expert_page", {
    p_full_name: pending.fullName,
    p_username: pending.username,
    p_headline: pending.headline,
    p_bio: pending.bio,
    p_price_cents: pending.priceCents,
    p_response_window_hours: pending.responseWindowHours,
    p_topics: pending.topics,
  })

  // "already_registered" means the page exists, so the saved copy is stale.
  if (!error || error.message === "already_registered") {
    clearPendingRegistration()
  }
  return !error
}
