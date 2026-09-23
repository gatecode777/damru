import dotenv from "dotenv";
import path from "path";
import { after } from "node:test";
import mongoose from "mongoose";

// Tests write users, ledger rows and config — they must only ever touch the
// disposable database started by scripts/run-tests.ts, never the MONGODB_URI
// in .env.local. Set before dotenv so .env.local can never override it.
const testUri = process.env.DAMRU_TEST_MONGODB_URI;
if (!testUri) {
  throw new Error("Refusing to run tests without an isolated database. Run them with `npm test` (scripts/run-tests.ts).");
}
process.env.MONGODB_URI = testUri;

dotenv.config({ path: path.resolve(process.cwd(), ".env.local"), quiet: true });
Reflect.set(process.env, "NODE_ENV", "test");

// lib/mongodb.ts opens a connection as a side effect of being imported
// (directly or transitively, e.g. via auth.ts) — close it so `node --test`
// can exit instead of hanging on the open socket.
after(async () => {
  await mongoose.connection.close();
});
