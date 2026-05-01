import type { Metadata } from "next";
import { BranchesClient } from "./BranchesClient";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";

export const metadata: Metadata = {
  title: "Our Branches | Damru By Namo",
  description: "Explore all Damru By Namo restaurant and banquet hall locations across Jaipur.",
};

const STATIC_FALLBACK = [
  {
    _id: "f1", name: "Damru By Namo (Mansarovar, Jaipur)", slug: "",
    description: "Our Mansarovar branch offers a perfect blend of great food and a spacious banquet hall, ideal for birthdays, family gatherings, and small celebrations.",
    contact: "+91 XXXXX XXXXX", timing: "11:00 AM – 11:00 PM",
    cardImage: "", staticImg: "/assets/images/OB1.png",
  },
  {
    _id: "f2", name: "Damru By Namo (Gandhipath, Vaishali, Jaipur)", slug: "",
    description: "Located in Vaishali Nagar, this branch is perfect for weddings, corporate events, and grand celebrations with modern facilities and expert catering.",
    contact: "+91 XXXXX XXXXX", timing: "11:00 AM – 11:00 PM",
    cardImage: "", staticImg: "/assets/images/OB2.png",
  },
  {
    _id: "f3", name: "Damru By Namo (Coaching Hub, Pratap Nagar, Jaipur)", slug: "",
    description: "Our Pratap Nagar branch offers a lively dining experience along with banquet services, making it ideal for student parties, birthdays, and casual events.",
    contact: "+91 XXXXX XXXXX", timing: "11:00 AM – 11:00 PM",
    cardImage: "", staticImg: "/assets/images/OB3.png",
  },
];

export default async function BranchesListPage() {
  let branches: any[] = [];
  try {
    await connectDB();
    const raw = await Branch.find({ isActive: true }).sort({ sortOrder: 1 }).lean();
    branches = JSON.parse(JSON.stringify(raw));
  } catch { /* fallback */ }

  const items = branches.length > 0 ? branches : STATIC_FALLBACK;

  return (
    <section className="banquet" style={{ paddingTop: 120 }}>
      <div className="banquet__header">
        <h2 className="banquet__title">Our Branches</h2>
        <p className="banquet__subtitle">
          Serving delicious food and unforgettable moments at multiple locations
        </p>
      </div>
      <BranchesClient items={items} />
    </section>
  );
}