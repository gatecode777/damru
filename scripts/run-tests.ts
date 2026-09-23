/**
 * Test runner — starts a throwaway in-memory MongoDB and runs the node:test
 * suite against it. Tests must NEVER run against the MONGODB_URI in
 * .env.local (that is the live database). tests/setup.ts refuses to run
 * unless DAMRU_TEST_MONGODB_URI is set, which only this runner does.
 *
 * Usage:
 *   npm test                          → every tests/**\/*.test.ts file
 *   npm test -- tests/foo.test.ts     → specific files
 *
 * To use an existing disposable database instead of the in-memory one, set
 * MONGODB_URI_TEST before running (never point it at production).
 */
import { spawn } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";

async function main() {
  let server: MongoMemoryServer | null = null;
  let uri = process.env.MONGODB_URI_TEST;
  if (!uri) {
    server = await MongoMemoryServer.create();
    uri = server.getUri("damru_test");
  }

  const files = process.argv.slice(2);
  const args = ["--import", "tsx", "--test", "--test-concurrency=1", ...(files.length ? files : ["tests/**/*.test.ts"])];

  const code = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, args, {
      stdio: "inherit",
      env: { ...process.env, DAMRU_TEST_MONGODB_URI: uri },
    });
    child.on("exit", (exitCode) => resolve(exitCode ?? 1));
  });

  if (server) await server.stop();
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
