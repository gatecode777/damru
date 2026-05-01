// Must be the very first thing — set DNS before any mongoose import resolves
import dns from "dns";
dns.setServers(["8.8.8.8", "1.1.1.1"]);

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
  const adminHash = await bcrypt.hash("admin@123", 10);
  const userHash = await bcrypt.hash("user@123", 10);

  // Seed admin
  await Admin.create({
    name: "Admin",
    email: "admin@damru.com",
    password: adminHash,
    role: "super_admin",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log("✅ Admin seeded  →  admin@damru.com / admin@123");

  // Seed users
  const users = [
    { name: "Arjun Sharma", email: "arjun@example.com", phone: "+91 98765 43210", status: "active", totalSpend: 14997 },
    { name: "Priya Patel", email: "priya@example.com", phone: "+91 87654 32109", status: "active", totalSpend: 2997 },
    { name: "Rahul Verma", email: "rahul@example.com", phone: "+91 76543 21098", status: "active", totalSpend: 49995 },
    { name: "Sneha Gupta", email: "sneha@example.com", phone: "+91 65432 10987", status: "inactive", totalSpend: 5997 },
    { name: "Vikram Singh", email: "vikram@example.com", phone: "+91 54321 09876", status: "active", totalSpend: 999 },
    { name: "Ananya Nair", email: "ananya@example.com", phone: "+91 43210 98765", status: "active", totalSpend: 8994 },
    { name: "Rohan Mehta", email: "rohan@example.com", phone: "+91 32109 87654", status: "suspended", totalSpend: 29997 },
    { name: "Kavya Reddy", email: "kavya@example.com", phone: "+91 21098 76543", status: "active", totalSpend: 1998 },
  ].map(u => ({
    ...u,
    password: userHash,
    createdAt: new Date(Date.now() - Math.random() * 1e10),
    updatedAt: new Date(),
  }));

  await mongoose.connection.collection("users").insertMany(users);
  console.log("✅ 8 users seeded");

  await mongoose.disconnect();
  console.log("🎉 Seed complete! Login: admin@damru.com / admin@123");
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err.message);
  process.exit(1);
});
