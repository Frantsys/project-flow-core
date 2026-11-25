import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXTAUTH_URL || "https://project-flow-core.vercel.app";

/** Só as páginas públicas: o resto exige login. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: SITE_URL, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/terms`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
