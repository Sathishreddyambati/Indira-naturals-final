import "server-only";

import { cert, getApp, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

/**
 * Server-side Firebase (Admin SDK). Used only inside API routes / server components.
 *
 * Credentials come from ONE of:
 *  1. FIREBASE_SERVICE_ACCOUNT_JSON  -> the whole service-account JSON (raw JSON or base64 of it)
 *  2. FIREBASE_PROJECT_ID + FIREBASE_CLIENT_EMAIL + FIREBASE_PRIVATE_KEY
 */
function loadCredentials() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (raw) {
    let text = raw;
    if (!text.startsWith("{")) {
      text = Buffer.from(text, "base64").toString("utf8");
    }
    let parsed: { project_id?: string; client_email?: string; private_key?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON");
    }
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id / client_email / private_key");
    }
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key.replace(/\\n/g, "\n"),
    };
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey: privateKey.replace(/\\n/g, "\n") };
  }

  throw new Error(
    "Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON in your environment variables.",
  );
}

function getAdminApp(): App {
  if (getApps().length > 0) return getApp();
  return initializeApp({ credential: cert(loadCredentials()) });
}

export function getAdminAuth() {
  return getAuth(getAdminApp());
}

const globalForDb = globalThis as typeof globalThis & { __indiraDbConfigured?: boolean };

export function getAdminDb() {
  const db = getFirestore(getAdminApp());
  if (!globalForDb.__indiraDbConfigured) {
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // settings() can only be called once per instance; ignore on hot reload
    }
    globalForDb.__indiraDbConfigured = true;
  }
  return db;
}
