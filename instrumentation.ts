/**
 * instrumentation.ts — Next.js server startup hook.
 * Place this file at the project ROOT (same level as package.json).
 *
 * This runs before any request is handled, so MongoDB is already
 * connected by the time the first page renders.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { validateProductionEnv } = await import("@/lib/env");
    const missing = validateProductionEnv();
    if (missing.length > 0) {
      // Names only — never values. Fail loudly rather than serving requests
      // with an incomplete production configuration.
      throw new Error(`Missing required production environment variables: ${missing.join(", ")}`);
    }

    try {
      const { connectDB } = await import("@/lib/mongodb");
      await connectDB();
      console.log("🚀 MongoDB module loaded at startup");
    } catch (err) {
      console.error("⚠️ Failed to load MongoDB module at startup (will retry on demand):", err);
    }
  }
}
