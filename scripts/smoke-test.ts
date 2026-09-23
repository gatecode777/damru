import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, options: RequestInit = {}, maxAttempts = 20): Promise<Response> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch {
      await wait(500);
    }
  }
  throw new Error(`Failed to connect to ${url} after ${maxAttempts} attempts`);
}

async function runSmokeTests() {
  console.log("Starting MongoMemoryServer for smoke tests...");
  const mongo = await MongoMemoryServer.create();
  const mongoUri = mongo.getUri("damru_smoke");
  console.log(`In-memory MongoDB ready: ${mongoUri}`);

  const port = "3088";
  const baseUrl = `http://127.0.0.1:${port}`;

  console.log(`Starting Next.js production server on ${baseUrl}...`);
  const server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "-p", port, "-H", "127.0.0.1"],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        PORT: port,
        MONGODB_URI: mongoUri,
        AUTH_SECRET: "smoke-test-secret-at-least-32-chars-long-12345",
        NEXTAUTH_URL: baseUrl,
        CRON_SECRET: "smoke-test-cron-secret",
        NODE_ENV: "production",
      },
    }
  );

  server.stdout?.on("data", (data) => {
    const text = data.toString().trim();
    if (text) console.log(`[Next.js stdout] ${text}`);
  });

  server.stderr?.on("data", (data) => {
    const text = data.toString().trim();
    if (text) console.error(`[Next.js stderr] ${text}`);
  });

  try {
    console.log("Waiting for Next.js server to be ready...");
    const healthRes = await fetchWithRetry(`${baseUrl}/api/health`, {}, 30);
    console.log(`✓ GET /api/health returned ${healthRes.status}`);
    const healthJson = await healthRes.json();
    console.log(`  Health response:`, healthJson);
    if (healthRes.status !== 200 || healthJson.status !== "ok") {
      throw new Error(`Health check failed: status=${healthRes.status}`);
    }

    console.log("Testing GET /api/menu...");
    const menuRes = await fetch(`${baseUrl}/api/menu`);
    console.log(`✓ GET /api/menu returned ${menuRes.status}`);
    const menuJson = await menuRes.json();
    console.log(`  Menu response success:`, menuJson.success !== undefined ? menuJson.success : "ok");

    console.log("Testing POST /api/checkout/quote...");
    const quoteRes = await fetch(`${baseUrl}/api/checkout/quote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: [],
        branchId: "507f1f77bcf86cd799439011",
        orderType: "DELIVERY",
      }),
    });
    console.log(`✓ POST /api/checkout/quote returned ${quoteRes.status}`);

    console.log("Testing unauthenticated GET /api/rewards/dashboard...");
    const dashRes = await fetch(`${baseUrl}/api/rewards/dashboard`);
    console.log(`✓ GET /api/rewards/dashboard returned ${dashRes.status} (expected 401 unauthenticated)`);

    console.log("Testing unauthenticated GET /api/admin/rewards/config...");
    const configRes = await fetch(`${baseUrl}/api/admin/rewards/config`);
    console.log(`✓ GET /api/admin/rewards/config returned ${configRes.status} (expected 401 or redirect)`);

    console.log("Testing GET /menu page render...");
    const menuPageRes = await fetch(`${baseUrl}/menu`);
    console.log(`✓ GET /menu returned ${menuPageRes.status}`);

    console.log("Testing GET /cart page render...");
    const cartPageRes = await fetch(`${baseUrl}/cart`);
    console.log(`✓ GET /cart returned ${cartPageRes.status}`);

    console.log("Testing GET /checkout page render...");
    const checkoutPageRes = await fetch(`${baseUrl}/checkout`);
    console.log(`✓ GET /checkout returned ${checkoutPageRes.status}`);

    console.log("\n All HTTP smoke tests passed successfully!");
  } finally {
    console.log("Cleaning up server and mongo...");
    server.kill();
    await mongo.stop();
  }
}

runSmokeTests().catch((err) => {
  console.error("Smoke test failed:", err);
  process.exit(1);
});
