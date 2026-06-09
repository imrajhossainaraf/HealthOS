// Google OAuth 2.0 (authorization-code flow). Entirely optional: every route
// returns 404 until GOOGLE_CLIENT_ID/SECRET are configured, so the app runs
// fine without it. No extra dependency — token exchange uses global fetch.
import { Router } from "express";
import { randomBytes } from "node:crypto";
import { collections, publicUser } from "../db.js";
import { signToken } from "../auth.js";
import { config } from "../config.js";

export const oauthRouter = Router();

oauthRouter.get("/google/status", (req, res) => {
  res.json({ enabled: config.google.enabled });
});

// Step 1: send the user to Google's consent screen.
oauthRouter.get("/google", (req, res) => {
  if (!config.google.enabled) return res.status(404).json({ error: "Google sign-in not configured" });
  const state = randomBytes(16).toString("hex");
  const params = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: config.google.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    include_granted_scopes: "true",
    state,
    prompt: "select_account",
  });
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

// Step 2: Google redirects back with a code; exchange it, upsert the user,
// then bounce to the client with a short-lived token in the URL fragment-ish query.
oauthRouter.get("/google/callback", async (req, res, next) => {
  if (!config.google.enabled) return res.status(404).json({ error: "Google sign-in not configured" });
  const { code, error } = req.query;
  const fail = (msg) => res.redirect(`${config.clientAppUrl}/login?oauth_error=${encodeURIComponent(msg)}`);
  if (error || !code) return fail(String(error || "Sign-in cancelled"));

  try {
    // Exchange the authorization code for tokens.
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code: String(code),
        client_id: config.google.clientId,
        client_secret: config.google.clientSecret,
        redirect_uri: config.google.redirectUri,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return fail("Token exchange failed");
    const { access_token } = await tokenRes.json();

    // Fetch the verified profile.
    const profRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!profRes.ok) return fail("Could not read Google profile");
    const profile = await profRes.json();
    const email = (profile.email || "").toLowerCase();
    if (!email) return fail("Google account has no email");

    // Upsert: link to an existing account by email, or create a verified one.
    const existing = await collections.users().findOne({ email });
    let userDoc;
    if (existing) {
      await collections.users().updateOne(
        { _id: existing._id },
        { $set: { verified: true, name: existing.name || profile.name || "", authProvider: existing.authProvider || "google" } }
      );
      userDoc = { ...existing, verified: true, name: existing.name || profile.name || "" };
    } else {
      const doc = {
        email,
        passwordHash: null,
        name: profile.name || "",
        phone: "",
        verified: true,
        authProvider: "google",
        created_at: new Date().toISOString(),
      };
      const result = await collections.users().insertOne(doc);
      userDoc = { ...doc, _id: result.insertedId };
    }

    const user = publicUser(userDoc);
    const token = signToken(user);
    res.redirect(`${config.clientAppUrl}/login?token=${encodeURIComponent(token)}`);
  } catch (err) {
    next(err);
  }
});
