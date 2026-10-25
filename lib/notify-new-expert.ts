import { supabase } from "@/lib/supabase"

// Tells the server a new expert page was just created, so it can email the
// admins. Best effort: the registration never waits on it or fails because of it.
export async function notifyNewExpert() {
  try {
    const { data } = await supabase.auth.getSession()
    if (!data.session) return
    await fetch("/api/notify-new-expert", {
      method: "POST",
      headers: { Authorization: `Bearer ${data.session.access_token}` },
      keepalive: true,
    })
  } catch {
    // The alert is a convenience only.
  }
}
