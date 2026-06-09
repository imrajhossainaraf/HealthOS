const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const ROUTES = [
  "",
  "/dashboard",
  "/emergency",
  "/emergency-history",
  "/profile",
  "/family",
  "/community",
  "/disease-watch",
  "/herbal",
  "/knowledge",
  "/fitness",
  "/mental-wellness",
  "/ai-assistant",
];

export default function sitemap() {
  const now = new Date();
  return ROUTES.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7,
  }));
}
