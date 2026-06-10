import http from "node:http";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import { rateLimit } from "express-rate-limit";

import { config } from "./config.js";
import { connectDb, closeDb } from "./db.js";
import { authRouter } from "./routes/auth.routes.js";
import { oauthRouter } from "./routes/oauth.routes.js";
import { usersRouter } from "./routes/users.routes.js";
import { storeRouter } from "./routes/store.routes.js";
import { donorsRouter } from "./routes/donors.routes.js";
import { herbsRouter } from "./routes/herbs.routes.js";
import { outbreaksRouter } from "./routes/outbreaks.routes.js";
import { alertsRouter } from "./routes/alerts.routes.js";
import { reputationRouter } from "./routes/reputation.routes.js";
import { aiRouter } from "./routes/ai.routes.js";
import { initRealtime } from "./realtime.js";

const app = express();

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet());
app.use(
  cors({
    origin(origin, cb) {
      // Allow same-origin/tools (no Origin header) and whitelisted clients.
      if (!origin || config.clientOrigins.includes(origin)) return cb(null, true);
      cb(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: "512kb" }));

// Rate limiting: a general cap, plus a stricter one on auth endpoints.
const generalLimiter = rateLimit({ windowMs: 60_000, max: 120, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
app.use("/api", generalLimiter);

app.get("/api/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));

app.use("/api/auth", authLimiter, authRouter);
app.use("/api/auth", oauthRouter); // OAuth redirects (no JSON rate-limit needed)
app.use("/api/users", usersRouter);
app.use("/api/store", storeRouter);
app.use("/api/donors", donorsRouter);
app.use("/api/herbs", herbsRouter);
app.use("/api/outbreaks", outbreaksRouter);
app.use("/api/alerts", alertsRouter);
app.use("/api/reputation", reputationRouter);
app.use("/api/ai", aiRouter);

// 404 for unknown API routes.
app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// Centralized error handler — never leak stack traces to clients.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err?.message === "Not allowed by CORS") {
    return res.status(403).json({ error: "Origin not allowed" });
  }
  console.error("[error]", err);
  res.status(err.status || 500).json({ error: config.isProd ? "Internal server error" : String(err?.message || err) });
});

const server = http.createServer(app);
initRealtime(server);

// Connect to MongoDB before accepting traffic.
try {
  await connectDb();
  console.log(`Connected to MongoDB (${config.dbName})`);
} catch (err) {
  console.error("Failed to connect to MongoDB:", err?.message || err);
  process.exit(1);
}

server.listen(config.port, () => {
  console.log(`HealthOS API listening on http://localhost:${config.port}`);
  console.log(`Allowed client origins: ${config.clientOrigins.join(", ")}`);
});

// Graceful shutdown.
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, async () => {
    console.log(`\n${sig} received — shutting down.`);
    server.close(async () => {
      await closeDb().catch(() => {});
      process.exit(0);
    });
  });
}
