"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { supabase } from "@/lib/supabase"
import ActiveStatusBanner from "../active-status-banner"

export default function SettingsPage() {
  const [loading, setLoading] = useState(true)
  const [username, setUsername] = useState("")
  const [copied, setCopied] = useState(false)
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null)
  const [generatingQr, setGeneratingQr] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) return

    const userId = sessionData.session.user.id

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .single()

    if (profile) setUsername(profile.username)
    setLoading(false)
  }

  async function copyLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/${username}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function toggleQrCode() {
    if (qrCodeUrl) {
      setQrCodeUrl(null)
      return
    }

    setGeneratingQr(true)
    const dataUrl = await QRCode.toDataURL(`${window.location.origin}/${username}`, {
      width: 320,
      margin: 2,
      color: { dark: "#17243a", light: "#f8f6f1" },
    })
    setQrCodeUrl(dataUrl)
    setGeneratingQr(false)
  }

  if (loading) {
    return <p className="text-ink-soft">Loading...</p>
  }

  return (
    <div className="max-w-md space-y-6">
      <div>
        <label className="block text-sm font-medium text-ink">
          Your page link
        </label>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <p className="text-sm text-ink-soft">
            dropmeaquestion.com/{username}
          </p>
          <button
            onClick={copyLink}
            className="rounded-sm border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-line"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={toggleQrCode}
            disabled={generatingQr}
            className="rounded-sm border border-line px-3 py-1 text-xs font-medium text-ink hover:bg-line disabled:opacity-50"
          >
            {generatingQr
              ? "Generating..."
              : qrCodeUrl
                ? "Hide QR code"
                : "Get QR code"}
          </button>
        </div>

        {qrCodeUrl && (
          <div className="mt-3 inline-block rounded-sm border border-line p-4 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrCodeUrl} alt="QR code for your page link" className="h-40 w-40" />
            <a
              href={qrCodeUrl}
              download={`${username}-qr-code.png`}
              className="mt-2 block text-xs text-postal-blue underline decoration-line underline-offset-4 hover:text-ink"
            >
              Download
            </a>
          </div>
        )}
      </div>

      <ActiveStatusBanner />
    </div>
  )
}
