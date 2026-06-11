// MongoDB persistence layer.
import { MongoClient, ObjectId } from "mongodb";
import { config } from "./config.js";

const client = new MongoClient(config.mongoUri, {
  serverSelectionTimeoutMS: 8000,
});

let database = null;

/** Connect once and ensure indexes. Call before the server starts listening. */
export async function connectDb() {
  if (database) return database;
  await client.connect();
  database = client.db(config.dbName);

  await Promise.all([
    database.collection("users").createIndex({ email: 1 }, { unique: true }),
    // Phone is optional but unique when present (sparse) — powers /api/users/by-phone.
    database.collection("users").createIndex({ phone: 1 }, { unique: true, sparse: true }),
    // Last known coordinates per user (GeoJSON Point) — powers $near "nearby
    // member" lookups for SOS email notices. Sparse: only set once a user shares
    // a location via SOS or volunteer presence.
    database.collection("users").createIndex({ lastLocation: "2dsphere" }, { sparse: true }),
    database.collection("documents").createIndex({ userId: 1, key: 1 }, { unique: true }),
    database.collection("donors").createIndex({ blood_group: 1 }),
    database.collection("donors").createIndex({ createdAt: -1 }),
    database.collection("herbs").createIndex({ createdAt: -1 }),
    database.collection("outbreaks").createIndex({ createdAt: -1 }),
    // Alerts auto-expire 24h after creation (TTL needs a real Date field).
    database.collection("alerts").createIndex({ createdAt: 1 }, { expireAfterSeconds: 86400 }),
    // Pending email-verification codes auto-expire 15 min after creation.
    database.collection("otps").createIndex({ createdAt: 1 }, { expireAfterSeconds: 900 }),
    database.collection("otps").createIndex({ email: 1 }),
    // One reputation tally per user; leaderboard sorts by points descending.
    database.collection("reputation").createIndex({ userId: 1 }, { unique: true }),
    database.collection("reputation").createIndex({ points: -1 }),
    // Web Push subscriptions — one per browser endpoint, looked up by user.
    database.collection("pushSubscriptions").createIndex({ endpoint: 1 }, { unique: true }),
    database.collection("pushSubscriptions").createIndex({ userId: 1 }),
  ]);

  // Self-heal: legacy accounts saved phone:"" which collides on the unique
  // sparse phone index and blocked all later sign-ups. Drop the empty value so
  // the index ignores those rows. Idempotent — safe to run on every boot.
  await database.collection("users").updateMany(
    { phone: "" },
    { $unset: { phone: "" } }
  );

  return database;
}

export async function closeDb() {
  await client.close();
  database = null;
}

/** Lazy collection accessors (valid only after connectDb). */
export const collections = {
  users: () => database.collection("users"),
  documents: () => database.collection("documents"),
  donors: () => database.collection("donors"),
  herbs: () => database.collection("herbs"),
  outbreaks: () => database.collection("outbreaks"),
  alerts: () => database.collection("alerts"),
  otps: () => database.collection("otps"),
  reputation: () => database.collection("reputation"),
  pushSubs: () => database.collection("pushSubscriptions"),
};

/** Shape a user document for API responses (never leak the password hash). */
export function publicUser(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    email: doc.email,
    name: doc.name || "",
    phone: doc.phone || "",
    verified: Boolean(doc.verified),
    authProvider: doc.authProvider || "password",
    created_at: doc.created_at,
  };
}

/** Safely build an ObjectId from a string id; returns null if malformed. */
export function toObjectId(id) {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}
