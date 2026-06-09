import jwt from "jsonwebtoken";
import { config } from "./config.js";
import { collections, publicUser, toObjectId } from "./db.js";

export function signToken(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwtSecret);
}

async function findUserById(id) {
  const _id = toObjectId(id);
  if (!_id) return null;
  return collections.users().findOne({ _id });
}

/** Express middleware: require a valid Bearer token; attaches req.user. */
export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Authentication required" });

  try {
    const payload = verifyToken(token);
    const user = await findUserById(payload.sub);
    if (!user) return res.status(401).json({ error: "Invalid session" });
    req.user = publicUser(user);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

/** Socket.io handshake auth — same token, returns the public user or null. */
export async function authenticateSocket(token) {
  try {
    const payload = verifyToken(token);
    return publicUser(await findUserById(payload.sub));
  } catch {
    return null;
  }
}
