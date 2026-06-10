// Loads and validates environment configuration once at startup.
// Node 24 loads .env automatically via `node --env-file`, but we also read
// process.env defaults here so the server runs even without the flag.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// Minimal .env loader (no dependency) — only sets keys not already in env.
try {
  const env = readFileSync(resolve(ROOT, ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  /* no .env file — rely on real environment */
}

const isProd = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET;

if (isProd && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error(
    "JWT_SECRET must be set to a strong (32+ char) value in production."
  );
}

export const config = {
  isProd,
  port: Number(process.env.PORT) || 4000,
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  jwtSecret: JWT_SECRET || "dev-insecure-secret-do-not-use-in-prod",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017",
  dbName: process.env.MONGODB_DB || "healthos",
  // Google OAuth (optional — features gate off when unset).
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI ||
      `http://localhost:${Number(process.env.PORT) || 4000}/api/auth/google/callback`,
    get enabled() {
      return Boolean(this.clientId && this.clientSecret);
    },
  },
  // Where to bounce the browser back to after OAuth (first allowed origin).
  clientAppUrl: (process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",")[0].trim(),
  // OpenRouter AI (powers the Health Copilot chatbot). Disabled until a key is set.
  ai: {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    model: process.env.OPENROUTER_MODEL || "openai/gpt-oss-120b:free",
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    // Sent to OpenRouter for attribution/leaderboards (optional but recommended).
    appUrl: process.env.OPENROUTER_APP_URL || "http://localhost:3000",
    appTitle: process.env.OPENROUTER_APP_TITLE || "HealthOS",
    get enabled() {
      return Boolean(this.apiKey);
    },
  },
};
