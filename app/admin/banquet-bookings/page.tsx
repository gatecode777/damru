import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import BanquetBooking from "@/models/BanquetBooking";
import BookingsClient from "./BookingsClient";

export const metadata = { title: "Banquet Bookings" };

export default async function BanquetBookingsPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("banquetBookings", "view")) redirect("/admin/dashboard");

  let bookings: any[] = [];
  try {
    await connectDB();
    const raw = await BanquetBooking.find().sort({ createdAt: -1 }).lean();
    bookings = JSON.parse(JSON.stringify(raw));
  } catch { /* empty */ }

  const serializedPerms = serializePerms(perms);

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title="Banquet Bookings" />
        <main className="page-main">
          <div className="page-header">
            <div>
              <h2 className="page-title">Banquet Bookings</h2>
              <p className="page-sub">{bookings.length} total enquiries from branch pages</p>
            </div>
          </div>
          <BookingsClient initialBookings={bookings} perms={serializedPerms} />
        </main>
      </div>
    </>
  );
}