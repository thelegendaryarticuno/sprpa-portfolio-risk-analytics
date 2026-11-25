import fs from "node:fs";
import admin from "firebase-admin";
import { pool } from "./db.js";

const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || "/secrets/firebase.json";
if (!fs.existsSync(credPath)) {
  console.error(`Firebase service account not found at ${credPath}`);
  process.exit(1);
}
admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(credPath, "utf8"))) });

// Verifies the Firebase ID token and upserts the user row. Sets req.uid / req.user.
export async function requireAuth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Missing bearer token" } });
  try {
    const d = await admin.auth().verifyIdToken(token);
    req.uid = d.uid;
    req.user = { uid: d.uid, email: d.email, name: d.name || d.email?.split("@")[0], photo: d.picture };
    await pool.query(
      `INSERT INTO users(uid,email,name,photo) VALUES($1,$2,$3,$4)
       ON CONFLICT (uid) DO UPDATE SET email=EXCLUDED.email, name=EXCLUDED.name, photo=EXCLUDED.photo`,
      [req.user.uid, req.user.email, req.user.name, req.user.photo || null]
    );
    next();
  } catch {
    res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Invalid or expired token" } });
  }
}

export const audit = (req, action, resource) =>
  pool.query("INSERT INTO audit_log(uid,action,resource,ip) VALUES($1,$2,$3,$4)", [req.uid, action, resource, req.ip]).catch(() => {});
