// Emails the askers chose to share with the signed-in expert, by question id.
// Empty on any failure: the dashboard works the same without them.
export async function fetchAskerContacts(accessToken: string): Promise<Record<string, string>> {
  try {
    const res = await fetch('/api/asker-contacts', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!res.ok) return {}
    const data = await res.json()
    return data?.contacts && typeof data.contacts === 'object' ? data.contacts : {}
  } catch {
    return {}
  }
}
