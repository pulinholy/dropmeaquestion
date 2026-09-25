import { NextResponse, type NextRequest } from "next/server"

// Pre-launch gate: shows /coming-soon to everyone except people who've
// visited the secret bypass link once (see MAINTENANCE_BYPASS_TOKEN).
// Flip MAINTENANCE_MODE to "false" in Vercel's env vars (and redeploy) to
// open the site to the public for real.
const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true"
const BYPASS_TOKEN = process.env.MAINTENANCE_BYPASS_TOKEN
const BYPASS_COOKIE = "dmq_bypass"
const BYPASS_PARAM = "dmq_preview"

export function middleware(request: NextRequest) {
  if (!MAINTENANCE_MODE) return NextResponse.next()

  const { pathname, searchParams } = request.nextUrl

  if (pathname === "/coming-soon") {
    return NextResponse.next()
  }

  // Visiting the secret link sets a long-lived cookie, then continues on
  // to the page that was actually requested (with the token stripped).
  const queryToken = searchParams.get(BYPASS_PARAM)
  if (BYPASS_TOKEN && queryToken === BYPASS_TOKEN) {
    const url = request.nextUrl.clone()
    url.searchParams.delete(BYPASS_PARAM)
    const response = NextResponse.redirect(url)
    response.cookies.set(BYPASS_COOKIE, BYPASS_TOKEN, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 90,
      path: "/",
    })
    return response
  }

  const cookieToken = request.cookies.get(BYPASS_COOKIE)?.value
  if (BYPASS_TOKEN && cookieToken === BYPASS_TOKEN) {
    return NextResponse.next()
  }

  const url = request.nextUrl.clone()
  url.pathname = "/coming-soon"
  url.search = ""
  return NextResponse.rewrite(url)
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"],
}
