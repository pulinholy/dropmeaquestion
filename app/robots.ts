import type { MetadataRoute } from "next"
import { PUBLIC_SITE_URL } from "@/lib/site"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated/private areas -- no SEO value, and an admin or
        // dashboard URL showing up in search results looks bad even if the
        // real content behind it requires login.
        disallow: ["/dashboard", "/admin", "/api"],
      },
      { userAgent: "Googlebot", allow: "/" },
      { userAgent: "Googlebot-Image", allow: "/" },
    ],
    sitemap: `${PUBLIC_SITE_URL}/sitemap.xml`,
  }
}
