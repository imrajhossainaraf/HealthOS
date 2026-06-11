import { z } from "zod";

// Phone: digits, spaces, +, -, parentheses; 6–20 chars. Optional at register.
const phoneField = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s().-]{5,19}$/u, "Enter a valid phone number")
  .optional()
  .default("");

export const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
  name: z.string().trim().max(80).optional().default(""),
  phone: phoneField,
});

export const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});

export const otpVerifySchema = z.object({
  email: z.string().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/u, "Enter the 6-digit code"),
});

export const otpResendSchema = z.object({
  email: z.string().email().max(254),
});

// Document store: arbitrary JSON value, capped to keep one user from blowing up storage.
export const docSchema = z.object({
  value: z.any().refine((v) => JSON.stringify(v ?? null).length <= 256 * 1024, {
    message: "Document too large (max 256KB)",
  }),
});

export const donorSchema = z.object({
  name: z.string().trim().min(1).max(80),
  blood_group: z.enum(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),
  area: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().default(""),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

// Community-contributed herbal remedy (shared across all users).
export const herbSchema = z.object({
  name: z.string().trim().min(1).max(80),
  use: z.string().trim().min(1).max(300),
  region: z.string().trim().max(80).optional().default(""),
  preparation: z.string().trim().max(300).optional().default(""),
  role: z.string().trim().max(40).optional().default("Community Member"),
  notes: z.string().trim().max(1000).optional().default(""),
});

// A logged contribution that earns reputation points (drives the leaderboard).
export const reputationAwardSchema = z.object({
  points: z.number().int().min(1).max(1000),
  reason: z.string().trim().max(120).optional().default("Contribution"),
});

// AI Health Copilot chat request. `messages` is the running conversation; the
// profile is optional context the client attaches for personalisation.
export const aiChatSchema = z.object({
  copilot: z.enum(["assistant", "emergency", "herbal", "fitness", "health"]).default("assistant"),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "bot", "assistant"]),
        text: z.string().trim().min(1).max(2000),
      })
    )
    .min(1)
    .max(24),
  profile: z.record(z.string(), z.any()).optional(),
});

// Emailing a prescription schedule to the user (or a chosen recipient).
export const prescriptionEmailSchema = z.object({
  to: z.string().email().max(254).optional(),
  prescription: z.object({
    title: z.string().trim().max(120).optional().default(""),
    date: z.string().trim().max(40).optional().default(""),
    notes: z.string().trim().max(2000).optional().default(""),
    medicines: z
      .array(
        z.object({
          name: z.string().trim().min(1).max(120),
          dose: z.string().trim().max(80).optional().default(""),
          when: z.string().trim().max(80).optional().default(""),
          meal: z.string().trim().max(40).optional().default(""),
          time: z.string().trim().max(20).optional().default(""),
        })
      )
      .max(50)
      .optional()
      .default([]),
  }),
});

// Community symptom / outbreak report (anonymous, shared).
export const outbreakSchema = z.object({
  symptom: z.string().trim().min(1).max(60),
  severity: z.enum(["Mild", "Moderate", "Severe"]),
  location: z.string().trim().min(1).max(80),
  onset: z.string().trim().max(40).optional().default(""),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

/** Express middleware factory: validates req.body against a schema. */
export function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        error: "Validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.valid = result.data;
    next();
  };
}
