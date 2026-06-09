/**
 * lib/mongodb.ts — Node.js runtime ONLY.
 * Never imported by middleware.ts or any Edge-runtime file.
 */
import { setServers } from "node:dns/promises";
import { setDefaultResultOrder } from "dns";
setDefaultResultOrder("ipv4first");
setServers(['1.1.1.1']);

import mongoose from "mongoose";

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
if (!cache.promise) {
  console.log("🔄 MongoDB: starting connection...");
  cache.promise = mongoose
    .connect(MONGODB_URI, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      family: 4,
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
}

export async function connectDB() {
  // If already connected, return immediately — no await needed
  if (cache.conn) return cache.conn;
  // Otherwise await the already-in-progress promise
  cache.conn = await cache.promise;
  return cache.conn;
}
