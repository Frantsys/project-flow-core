import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXTAUTH_URL || "https://project-flow-core.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: ["/", "/terms", "/privacy"], disallow: ["/w/", "/api/", "/auth/"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
