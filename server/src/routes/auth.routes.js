import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { collections, publicUser } from "../db.js";
import { signToken, requireAuth } from "../auth.js";
import { config } from "../config.js";
import { sendOtpEmail, emailEnabled } from "../email.js";
import {
  validate,
  registerSchema,
  loginSchema,
  otpVerifySchema,
  otpResendSchema,
} from "../validation.js";

export const authRouter = Router();

// In local dev without SMTP, return the code so the flow is testable. Never in prod.
const devCodeOf = (code) => (!emailEnabled && !config.isProd ? code : undefined);

/** Generate a 6-digit code, store its hash for `email`, and email it. */
async function issueOtp(email, userId) {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = await bcrypt.hash(code, 10);
  // One pending code per email — replace any previous.
  await collections.otps().deleteMany({ email });
  await collections.otps().insertOne({ email, userId, codeHash, createdAt: new Date() });
  await sendOtpEmail(email, code);
  return code;
}

authRouter.post("/register", validate(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name, phone } = req.valid;
    const normalizedEmail = email.toLowerCase();

    const existing = await collections.users().findOne({ email: normalizedEmail });
    if (existing && existing.verified) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    // Reject a phone already tied to a different account.
    if (phone) {
      const phoneOwner = await collections.users().findOne({ phone });
      if (phoneOwner && phoneOwner.email !== normalizedEmail) {
        return res.status(409).json({ error: "That phone number is already registered" });
      }
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const fields = {
      email: normalizedEmail,
      passwordHash,
      name: name || "",
      verified: false,
      authProvider: "password",
    };
    // Only store phone when provided. An empty string would collide on the
    // unique *sparse* phone index (sparse skips absent fields, NOT "").
    if (phone) fields.phone = phone;

    if (existing) {
      // Unverified re-registration: refresh credentials and re-send a code.
      await collections.users().updateOne({ _id: existing._id }, { $set: fields });
    } else {
      await collections.users().insertOne({ ...fields, created_at: new Date().toISOString() });
    }

    const code = await issueOtp(normalizedEmail);
    res.status(201).json({
      pendingVerification: true,
      email: normalizedEmail,
      devCode: devCodeOf(code),
    });
  } catch (err) {
    if (err?.code === 11000) {
      return res.status(409).json({ error: "An account with this email or phone already exists" });
    }
    next(err);
  }
});

authRouter.post("/verify-otp", validate(otpVerifySchema), async (req, res, next) => {
  try {
    const { code } = req.valid;
    const email = req.valid.email.toLowerCase();

    const record = await collections.otps().findOne({ email }, { sort: { createdAt: -1 } });
    if (!record) return res.status(400).json({ error: "No pending verification — please register again" });

    const ok = await bcrypt.compare(code, record.codeHash);
    if (!ok) return res.status(400).json({ error: "Incorrect code" });

    const row = await collections.users().findOneAndUpdate(
      { email },
      { $set: { verified: true } },
      { returnDocument: "after" }
    );
    await collections.otps().deleteMany({ email });

    const doc = row?.value ?? row; // driver v4 returns {value}; v5+ returns the doc
    const user = publicUser(doc);
    if (!user) return res.status(400).json({ error: "Account not found" });
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/resend-otp", validate(otpResendSchema), async (req, res, next) => {
  try {
    const email = req.valid.email.toLowerCase();
    const user = await collections.users().findOne({ email });
    // Don't reveal whether the account exists; only act if it's unverified.
    if (user && !user.verified) {
      const code = await issueOtp(email);
      return res.json({ pendingVerification: true, email, devCode: devCodeOf(code) });
    }
    res.json({ pendingVerification: true, email });
  } catch (err) {
    next(err);
  }
});

authRouter.post("/login", validate(loginSchema), async (req, res, next) => {
  try {
    const { password } = req.valid;
    const email = req.valid.email.toLowerCase();
    const row = await collections.users().findOne({ email });
    const ok = row?.passwordHash ? await bcrypt.compare(password, row.passwordHash) : false;
    if (!ok) return res.status(401).json({ error: "Invalid email or password" });

    // Unverified accounts must confirm their email first — send a fresh code.
    if (!row.verified) {
      const code = await issueOtp(email);
      return res.status(403).json({
        error: "Please verify your email to continue",
        needsVerification: true,
        email,
        devCode: devCodeOf(code),
      });
    }

    const user = publicUser(row);
    res.json({ token: signToken(user), user });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});
