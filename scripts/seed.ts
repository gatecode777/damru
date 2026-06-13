import dns from "node:dns/promises";

dns.setServers(['1.1.1.1']);
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import path from "path";

import Admin from "../models/Admin";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error("Missing MONGODB_URI in .env.local");

async function seed() {
  console.log("🔌 Connecting to MongoDB…");
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000,
    family: 4,
  });
  console.log("✅ Connected to MongoDB!");

  // Clear old data
  await Admin.deleteMany({});
  await mongoose.connection.collection("users").deleteMany({});
  console.log("🧹 Cleared old collections");

  // Hash passwords
  const adminHash = await bcrypt.hash("Admin@12345", 10);
  const userHash = await bcrypt.hash("user@123", 10);

  // Seed admin
  await Admin.create({
    name: "Admin",
    email: "admin@damrurestro.com",
    password: adminHash,
    role: "super_admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("✅ Admin seeded  →  admin@damru.com / admin@123");

  await mongoose.disconnect();
  console.log("🎉 Seed complete! Login: admin@damru.com / admin@123");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
