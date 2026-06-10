// AI Health Copilot endpoints. /chat is authenticated (one real LLM call per
// request) and rate-limited; /status lets the client know whether the feature
// is configured so it can show live answers vs. the rule-based fallback.
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { requireAuth } from "../auth.js";
import { validate, aiChatSchema } from "../validation.js";
import { chatComplete, aiEnabled } from "../ai.js";
import { config } from "../config.js";

export const aiRouter = Router();

// Tighter cap than the global limiter — LLM calls are costly.
const aiLimiter = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });

aiRouter.get("/status", (req, res) => {
  res.json({ enabled: aiEnabled(), model: aiEnabled() ? config.ai.model : null });
});

aiRouter.post("/chat", aiLimiter, requireAuth, validate(aiChatSchema), async (req, res) => {
  const { copilot, messages, profile } = req.valid;
  // Map the client's {role:"user"|"bot"} log to OpenAI roles.
  const history = messages.map((m) => ({
    role: m.role === "user" ? "user" : "assistant",
    content: m.text,
  }));

  try {
    const reply = await chatComplete({ copilot, messages: history, profile });
    res.json({ reply });
  } catch (err) {
    if (err.code === "AI_DISABLED") {
      return res.status(503).json({ error: "AI assistant is not configured on the server." });
    }
    console.error("[ai] chat failed:", err?.message || err);
    res.status(502).json({ error: "AI service is temporarily unavailable. Please try again." });
  }
});
