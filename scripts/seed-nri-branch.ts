import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const SLUG = "namo-tandoori-chai-nri-pratap-nagar";

async function main() {
  const [{ connectDB }, { default: Branch }] = await Promise.all([
    import("../lib/mongodb"),
    import("../models/Branch"),
  ]);
  await connectDB();

  const existing = await Branch.findOne({ slug: SLUG }).select("_id name").lean();
  if (existing) {
    console.log(`Branch already exists: ${existing.name} (${SLUG})`);
    return;
  }

  const [template, lastBranch] = await Promise.all([
    Branch.findOne({ isActive: true }).sort({ sortOrder: 1 }).lean(),
    Branch.findOne().sort({ sortOrder: -1 }).select("sortOrder").lean(),
  ]);

  const branch = await Branch.create({
    name: "Namo Tandoori Chai - NRI (Pratap Nagar, Jaipur)",
    slug: SLUG,
    description:
      "A pure-vegetarian Namo cafe and kitchen near NRI Road, serving tandoori chai, snacks, beverages, Chinese favourites, and casual meals.",
    contact: "",
    timing: "Contact outlet for current timings",
    address:
      "S 6/17, S 2/20, S 1/11/1, S 7/25/1, JDA Employee Colony, Block C-2, Teelawala, Sanganer, Jaipur, Rajasthan 302033",
    latitude: 26.8156078,
    longitude: 75.8437711,
    geocodedAddress:
      "JDA Employee Colony, Block C-2, Teelawala, Sanganer, Jaipur, Rajasthan 302033",
    geocodedAt: new Date(),
    bannerImage: template?.bannerImage || "",
    bannerAlt: "Namo Tandoori Chai NRI outlet in Pratap Nagar, Jaipur",
    cardImage: template?.cardImage || "",
    cardAlt: "Namo Tandoori Chai NRI Pratap Nagar branch",
    offerItems: [
      "Pure vegetarian cafe and kitchen",
      "Tandoori chai, beverages, snacks and casual dining",
      "Dine-in, takeaway and delivery",
    ],
    whyChoose:
      "A convenient vegetarian cafe near NRI Road for chai, quick bites, Chinese favourites, and relaxed casual meals.",
    eventTypes: template?.eventTypes || [],
    hallCards: template?.hallCards || [],
    ctaTitle: "Plan Your Visit",
    ctaSubtitle: "Contact the NRI outlet for dining, takeaway, delivery, and group enquiries.",
    isActive: true,
    sortOrder: (lastBranch?.sortOrder ?? 0) + 1,
  });

  console.log(`Seeded branch: ${branch.name} (${branch.slug})`);
}

main()
  .catch((error) => {
    console.error("Failed to seed NRI branch:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    const mongoose = await import("mongoose");
    await mongoose.default.disconnect();
  });
