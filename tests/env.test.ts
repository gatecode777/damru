import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";

/**
 * Regression coverage for the Phase 2 hardcoded-fallback-secret fix and the
 * Phase 9 production env validation list. `isProduction` in lib/env.ts is
 * captured once at module-load time, so each case runs in its own child
 * process with NODE_ENV set explicitly — that also makes these tests
 * correct regardless of what NODE_ENV happens to be in the ambient shell.
 */
const repoRoot = path.resolve(__dirname, "..");

function runFixture(fixture: string, nodeEnv: "development" | "production") {
  return execFileSync("npx", ["tsx", `tests/fixtures/${fixture}`], {
    cwd: repoRoot,
    env: { ...process.env, NODE_ENV: nodeEnv },
    stdio: "pipe",
    shell: true,
  }).toString();
}

test("development: missing secret returns a placeholder instead of throwing", () => {
  const value = runFixture("printDevSecretFallback.ts", "development");
  assert.match(value, /^dev-only-insecure-/);
});

test("validateProductionEnv is a no-op outside production", () => {
  const value = runFixture("printValidateProductionEnvOutsideProd.ts", "development");
  assert.deepEqual(JSON.parse(value), []);
});

test("production: a missing required secret throws instead of falling back", () => {
  try {
    execFileSync("npx", ["tsx", "tests/fixtures/throwOnMissingProdSecret.ts"], {
      cwd: repoRoot,
      env: { ...process.env, NODE_ENV: "production" },
      stdio: "pipe",
      shell: true,
    });
    assert.fail("expected getRequiredSecret to throw in production");
  } catch (err: any) {
    if (err.message === "expected getRequiredSecret to throw in production") throw err;
    assert.match(String(err.stderr), /Missing required environment variable: SOME_TEST_SECRET_NOT_SET_ANYWHERE/);
  }
});
