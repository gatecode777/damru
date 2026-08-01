import dns from "node:dns/promises";

dns.setServers(['1.1.1.1']);
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder("ipv4first");
}

import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import Blog from "../models/Blog";
import BlogComment from "../models/BlogComment";

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

  const slug = "fruit-and-vegetables-and-protection-against-diseases";
  const blog = await Blog.findOne({ slug });
  if (!blog) {
    console.error("❌ Blog post not found! Cannot seed comments.");
    await mongoose.disconnect();
    process.exit(1);
  }

  // Clear existing comments for this blog
  await BlogComment.deleteMany({ blogSlug: slug });
  console.log("🧹 Cleared old comments");

  // Create Anjali's comment
  const commentAnjali = await BlogComment.create({
    blogId: blog._id,
    blogSlug: slug,
    name: "Anjali Verma",
    email: "anjali.verma@example.com",
    avatar: "anjali.jpg",
    comment: "Fruit and vegetables are very important in our daily life. It contains vitamins and minerals.",
    approved: true,
    parentId: null,
  });
  console.log("✅ Created comment: Anjali Verma");

  // Create Sonali's reply to Anjali
  const commentSonali = await BlogComment.create({
    blogId: blog._id,
    blogSlug: slug,
    name: "Sonali Mishra",
    email: "sonali.mishra@example.com",
    avatar: "sonali.jpg",
    comment: "I agree with you Anjali. Fruit and vegetables are very important in our daily life.",
    approved: true,
    parentId: commentAnjali._id,
  });
  console.log("✅ Created reply: Sonali Mishra");

  // Create David's comment
  const commentDavid = await BlogComment.create({
    blogId: blog._id,
    blogSlug: slug,
    name: "David Loha",
    email: "david.loha@example.com",
    avatar: "david.jpg",
    comment: "Great article. Very informative.",
    approved: true,
    parentId: null,
  });
  console.log("✅ Created comment: David Loha");

  // Create Satish's comment
  const commentSatish = await BlogComment.create({
    blogId: blog._id,
    blogSlug: slug,
    name: "Satish Singh Rajawat",
    email: "satish.rajawat@example.com",
    avatar: "satish.jpg",
    comment: "I really liked the article. It is very helpful.",
    approved: true,
    parentId: null,
  });
  console.log("✅ Created comment: Satish Singh Rajawat");

  await mongoose.disconnect();
  console.log("🎉 Seed comments complete!");
}

seed().catch((err) => {
  console.error("❌ Seed comments failed:", err.message);
  process.exit(1);
});
