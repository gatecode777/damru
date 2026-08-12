import dotenv from "dotenv";
import path from "path";
import { after } from "node:test";
import mongoose from "mongoose";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
Reflect.set(process.env, "NODE_ENV", "test");

// lib/mongodb.ts opens a connection as a side effect of being imported
// (directly or transitively, e.g. via auth.ts) — close it so `node --test`
// can exit instead of hanging on the open socket.
after(async () => {
  await mongoose.connection.close();
});
