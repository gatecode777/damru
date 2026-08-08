import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { logAdminAction } from "@/lib/auditLog";
import AdminUser from "@/models/Admin";

async function isSuperAdmin() {
  const session = await auth();
  if (!session) return false;
  await connectDB();
  const admin = await AdminUser.findOne({ email: (session.user as any).email }).select("role").lean() as any;
  return admin?.role === "super_admin";
}

// GET — list all admins (super_admin only)
export async function GET(req: NextRequest) {
  if (!await isSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await connectDB();
    const search = req.nextUrl.searchParams.get("search") || "";
    const filter = search
      ? { $or: [{ name: { $regex: search, $options: "i" } }, { email: { $regex: search, $options: "i" } }] }
      : {};
    const admins = await AdminUser.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ admins: JSON.parse(JSON.stringify(admins)) });
  } catch { return NextResponse.json({ admins: [] }); }
}

// POST — create admin
export async function POST(req: NextRequest) {
  if (!await isSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await connectDB();
    const { name, email, password, role, permissions, isActive, isSuperAdmin: grantSuperAdmin } = await req.json();
    if (!name?.trim() || !email?.trim() || !password)
      return NextResponse.json({ error: "Name, email and password are required." }, { status: 400 });
    if (password.length < 8)
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    const exists = await AdminUser.findOne({ email: email.toLowerCase() });
    if (exists) return NextResponse.json({ error: "Email already in use." }, { status: 409 });

    const hashed = await bcrypt.hash(password, 12);
    const admin = await AdminUser.create({
      name: name.trim(), email: email.trim().toLowerCase(),
      password: hashed, role: role || "admin",
      isSuperAdmin: (role || "admin") === "admin" ? Boolean(grantSuperAdmin) : false,
      permissions, isActive: isActive ?? true,
    });
    const { password: _, ...safe } = admin.toObject();
    await logAdminAction("admin_account_create", {
      targetType: "Admin",
      targetId: String(admin._id),
      details: { role: admin.role, isSuperAdmin: admin.isSuperAdmin, isActive: admin.isActive },
    });
    return NextResponse.json({ admin: JSON.parse(JSON.stringify(safe)) });
  } catch (e) {
    console.error("POST admin/managers error:", e);
    return NextResponse.json({ error: "Failed to create admin." }, { status: 500 });
  }
}

// PATCH — update admin
export async function PATCH(req: NextRequest) {
  if (!await isSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await connectDB();
    const { id, name, email, password, role, permissions, isActive, isSuperAdmin: grantSuperAdmin } = await req.json();
    const updates: any = {};
    if (name)        updates.name       = name.trim();
    if (email)       updates.email      = email.trim().toLowerCase();
    if (role)        updates.role       = role;
    if (permissions) updates.permissions = permissions;
    if (isActive !== undefined) updates.isActive = isActive;
    if (grantSuperAdmin !== undefined) updates.isSuperAdmin = (role || "admin") === "admin" ? Boolean(grantSuperAdmin) : false;
    if (password) {
      if (password.length < 8) return NextResponse.json({ error: "Password min 8 characters." }, { status: 400 });
      updates.password = await bcrypt.hash(password, 12);
    }
    const admin = await AdminUser.findByIdAndUpdate(id, updates, { new: true }).lean() as any;
    if (!admin) return NextResponse.json({ error: "Not found." }, { status: 404 });
    const { password: _pw, ...safeUpdates } = updates;
    await logAdminAction("admin_account_update", { targetType: "Admin", targetId: id, details: safeUpdates });
    const { password: _, ...safe } = admin;
    return NextResponse.json({ admin: JSON.parse(JSON.stringify(safe)) });
  } catch (e) {
    console.error("PATCH admin/managers error:", e);
    return NextResponse.json({ error: "Failed to update admin." }, { status: 500 });
  }
}

// DELETE — delete admin
export async function DELETE(req: NextRequest) {
  if (!await isSuperAdmin()) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    await connectDB();
    const { id } = await req.json();
    const admin = await AdminUser.findById(id).lean() as any;
    if (admin?.role === "super_admin") return NextResponse.json({ error: "Cannot delete super admin." }, { status: 400 });
    await AdminUser.findByIdAndDelete(id);
    await logAdminAction("admin_account_delete", { targetType: "Admin", targetId: id });
    return NextResponse.json({ success: true });
  } catch { return NextResponse.json({ error: "Failed" }, { status: 500 }); }
}