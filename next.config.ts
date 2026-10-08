import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Only our own Supabase project may be contacted from the browser (auth,
// database, storage) or serve images (expert avatars). Derived from the same
// env var the app already uses, so Production and Preview each allow exactly
// the project they actually talk to.
function supabaseOrigin(): string {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").origin;
  } catch {
    return "https://*.supabase.co";
  }
}
const supabase = supabaseOrigin();

// Header-based CSP (no nonces), so pages stay statically rendered. Next.js
// writes its start-up scripts inline, hence 'unsafe-inline' for scripts and
// styles; the rest of the policy still blocks foreign scripts, framing, plugin
// content and requests to any server other than ours and Supabase.
// 'unsafe-eval' and the websocket are for dev-mode hot reload only.
// `extra` adds directives for the few pages that need them (see the video
// proof of concept below).
function buildCsp(extra: string[] = []): string {
  return [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  // Any Supabase project, not just ours: stored avatar links can point at a
  // sibling project (the dev database's demo avatar lives in prod storage).
  // Images carry little risk; network requests below stay exact.
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  `connect-src 'self' ${supabase}${isDev ? " ws://localhost:*" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...extra,
  ].join("; ");
}
const csp = buildCsp();

// Proof of concept only: the admin video test page may embed the provider's
// room and hand it the camera and microphone. Every other page stays locked.
const dailyFrames = "https://*.daily.co https://*.dailywebrtc.com https://*.dailywebrtc.net";

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  // Question and feedback links carry ids in the URL; never send the full URL
  // to other sites.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Later entries override earlier ones for the same header.
      {
        source: "/admin/video-poc",
        headers: [
          {
            key: "Content-Security-Policy",
            value: buildCsp([`frame-src ${dailyFrames}`]),
          },
          {
            key: "Permissions-Policy",
            value: `camera=(self "https://*.daily.co"), microphone=(self "https://*.daily.co"), display-capture=(self "https://*.daily.co"), geolocation=(), payment=(), usb=()`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
