/**
 * lib/mongodb.ts — Node.js runtime ONLY.
 * Never imported by middleware.ts or any Edge-runtime file.
 */
import mongoose from "mongoose";
import * as dns from "node:dns";

// Safely configure DNS fallback for MongoDB Atlas SRV lookup (using system default resolution first)
try {
  if (typeof dns.setDefaultResultOrder === "function") {
    dns.setDefaultResultOrder("ipv4first");
  }
  /*
  if (typeof dns.setServers === "function") {
    dns.setServers(["1.1.1.1", "8.8.8.8"]);
  }
  */
} catch {
  /* Ignore DNS override failures on restricted environments like Vercel */
}

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env.local");
}

declare global {
  var _mongooseCache: {
    conn: typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global._mongooseCache) {
  global._mongooseCache = { conn: null, promise: null };
}

const cache = global._mongooseCache;

// ── Eagerly start connecting as soon as this module is imported ──────────────
// Instead of waiting for the first connectDB() call from a page,
// kick off the connection promise immediately at module load time.
// connectDB() then just awaits the already-in-progress promise.
function startConnection(): Promise<typeof mongoose> {
  if (cache.promise) return cache.promise;

  console.log("🔄 MongoDB: starting connection...");
  cache.promise = mongoose
    .connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      tls: true,
      tlsAllowInvalidCertificates: false,
    })
    .then((m) => {
      cache.conn = m;
      console.log("✅ MongoDB connected");
      return m;
    })
    .catch((err) => {
      console.error("❌ MongoDB connection error:", err);
      cache.promise = null; // allow retry
      throw err;
    });

  return cache.promise;
}

// Do not leave a rejected eager promise unhandled. startConnection() clears
// the cached promise on failure so the next request can retry safely.
void startConnection().catch(() => undefined);

export async function connectDB() {
  // If already connected, return immediately — no await needed
  if (cache.conn) return cache.conn;
  // Otherwise await the already-in-progress promise
  // Recreate the promise after a transient eager-start failure.
  cache.conn = await startConnection();
  return cache.conn;
}
