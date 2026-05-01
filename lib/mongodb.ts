/**
 * lib/mongodb.ts — Node.js runtime ONLY.
 * Never imported by middleware.ts or any Edge-runtime file.
 * auth.config.ts (used by middleware) does NOT import this.
 */

// Set public DNS before ANYTHING else - this MUST be the first line
import dns from "dns";
// dns.setServers(["8.8.8.8","1.1.1.1"]);
dns.setServers(["8.8.8.8","1.1.1.1"]);

// Force Node.js to use these DNS servers for all lookups
// This is critical for mongodb+srv:// connections
import { setDefaultResultOrder } from "dns";
setDefaultResultOrder("ipv4first");

import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;

if (!MONGODB_URI) {
  throw new Error("Please define MONGODB_URI in .env.local");
}

declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: {
    conn:    typeof mongoose | null;
    promise: Promise<typeof mongoose> | null;
  };
}

if (!global._mongooseCache) {
  global._mongooseCache = { conn: null, promise: null };
}

const cache = global._mongooseCache;

export async function connectDB() {
  if (cache.conn) return cache.conn;

  if (!cache.promise) {
    // Log the connection attempt
    console.log("🔄 Connecting to MongoDB with URI:", MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//***:***@"));
    
    cache.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands:          false,
      serverSelectionTimeoutMS: 15000, // Increased timeout
      socketTimeoutMS:          45000,
      family:                   4,     // Force IPv4
      // Add these options for better SRV resolution
      tls: true,
      tlsAllowInvalidCertificates: false,
    });
  }

  try {
    cache.conn = await cache.promise;
    console.log("✅ MongoDB connected successfully");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    cache.promise = null; // Allow retry on next request
    throw err;
  }

  return cache.conn;
}