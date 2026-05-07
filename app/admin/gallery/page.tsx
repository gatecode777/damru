import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import GalleryTab from "@/models/GalleryTab";
import GalleryClient from "./GalleryClient";

export const metadata = { title: "Gallery Manager" };

export default async function AdminGalleryPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("gallery", "view")) redirect("/admin/dashboard");

  let tabs: {
    _id: string; tabKey: string; label: string;
    bannerImage: string; bannerAlt: string;
    isActive: boolean; sortOrder: number;
    items: {
      _id: string; image: string; alt: string; title: string;
      description: string; type: string; overlayClass: string; sortOrder: number;
    }[];
  }[] = [];

  try {
    await connectDB();
    const raw = await GalleryTab.find().sort({ sortOrder: 1 });
    tabs = JSON.parse(JSON.stringify(raw));
  } catch { /* show empty */ }

  const totalItems = tabs.reduce((sum, t) => sum + t.items.length, 0);
  const serializedPerms = serializePerms(perms);

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Gallery Manager" />
        <main className="page-main">

          <div className="page-header">
            <div>
              <h2 className="page-title">Gallery Manager</h2>
              <p className="page-sub">{tabs.length} tabs · {totalItems} total images</p>
            </div>
          </div>

          {/* Stats */}
          <div className="cat-stats">
            {[
              { label: "Tabs",       value: tabs.length,                            color: "#f97316" },
              { label: "Active",     value: tabs.filter(t => t.isActive).length,    color: "#16a34a" },
              { label: "Images",     value: totalItems,                             color: "#7c3aed" },
              { label: "With Banner",value: tabs.filter(t => t.bannerImage).length, color: "#06b6d4" },
            ].map(s => (
              <div key={s.label} className="cat-stat">
                <span className="ms-value" style={{ color: s.color }}>{s.value}</span>
                <span className="ms-label">{s.label}</span>
              </div>
            ))}
          </div>

          <GalleryClient tabs={tabs} perms={serializedPerms} />

        </main>
      </div>
    </>
  );
}