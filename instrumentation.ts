/**
 * instrumentation.ts — Next.js server startup hook.
 * Place this file at the project ROOT (same level as package.json).
 *
 * This runs before any request is handled, so MongoDB is already
 * connected by the time the first page renders.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Importing the module triggers the eager connection at the bottom of mongodb.ts
    await import("@/lib/mongodb");
    console.log("🚀 MongoDB module loaded at startup");
  }
}