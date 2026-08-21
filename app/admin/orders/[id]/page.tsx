import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { getAdminPerms, serializePerms } from "@/lib/adminPermissions";
import { connectDB } from "@/lib/mongodb";
import Order from "@/models/Order";
import PaymentRefund from "@/models/PaymentRefund";
import OrderDetailClient from "./OrderDetailClient";

export const metadata = { title: "Order Detail" };

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) redirect("/admin/login");

  // Fetch this admin's permissions
  const perms = await getAdminPerms();
  if (!perms.can("orders", "view")) redirect("/admin/dashboard");

  const { id } = await params;
  let order: any = null;

  try {
    await connectDB();
    const [raw, latestRefund] = await Promise.all([
      Order.findById(id).lean(),
      PaymentRefund.findOne({ orderId: id }).sort({ createdAt: -1 }).lean(),
    ]);
    if (!raw) notFound();
    order = JSON.parse(JSON.stringify({ ...raw, latestRefund }));
  } catch {
    notFound();
  }

  const serializedPerms = serializePerms(perms);

  return (
    <>
      <AdminSidebar />
      <div className="page-layout">
        <AdminHeader title={`Order ${order.orderId}`} />
        <main className="page-main">
          <OrderDetailClient key={`${order.updatedAt}-${order.paymentStatus}-${order.refundedAmount}-${order.pendingRefundAmount}`} order={order} perms={serializedPerms} />
        </main>
      </div>
    </>
  );
}
