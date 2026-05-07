"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/auth";
import {
  LayoutDashboard, Users, Tag, UtensilsCrossed,
  BarChart3, Settings, Bell, HelpCircle,
  LogOut, ChevronLeft, ChevronRight, FileText, BookOpen, Images, Ticket,
  ShoppingBag,
  CalendarDays,
  MessageSquareWarning, MapPin, CalendarCheck, UserCog,
} from "lucide-react";

interface Perms {
  role: string;
  isSuperAdmin: boolean;
  permissions: {
    users?: { view?: boolean };
    orders?: { view?: boolean };
    reservations?: { view?: boolean };
    complaints?: { view?: boolean };
    categories?: { view?: boolean };
    menu?: { view?: boolean };
    gallery?: { view?: boolean };
    branches?: { view?: boolean };
    banquetBookings?: { view?: boolean };
    banquet?: { view?: boolean };
    coupons?: { view?: boolean };
    blogCategories?: { view?: boolean };
    blogs?: { view?: boolean };
    analytics?: { view?: boolean };
    settings?: { view?: boolean };
    managers?: { view?: boolean };
    [key: string]: any;
  };
}

const navGroups = [
  {
    label: "Main",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",    href: "/admin/dashboard",   permission: "dashboard" },
      { icon: Users,           label: "Users",         href: "/admin/users",       permission: "users" },
      { icon: ShoppingBag,     label: "Orders",        href: "/admin/orders",      permission: "orders" },
      { icon: CalendarDays,    label: "Reservations",  href: "/admin/reservations", permission: "reservations" },
      { icon: MessageSquareWarning, label: "Complaints",   href: "/admin/complaints", permission: "complaints" },
    ],
  },
  {
    label: "Restaurant",
    items: [
      { icon: Tag,             label: "Categories",   href: "/admin/categories",  permission: "categories" },
      { icon: UtensilsCrossed, label: "Menu Items",   href: "/admin/menu",        permission: "menu" },
      { icon: Images,          label: "Gallery",      href: "/admin/gallery",     permission: "gallery" },
      { icon: MapPin,          label: "Branches",     href: "/admin/branches",    permission: "branches" },
      { icon: CalendarCheck,   label: "Banquet Bookings", href: "/admin/banquet-bookings", permission: "banquetBookings" },
      { icon: Ticket,          label: "Coupons",      href: "/admin/coupons",     permission: "coupons" },
    ],
  },
  {
    label: "Blogs",
    items: [
      { icon: BookOpen,        label: "Blog Categories", href: "/admin/blog-categories", permission: "blog_categories" },
      { icon: FileText,        label: "Blogs",        href: "/admin/blogs",        permission: "blogs" },
    ],
  },
  {
    label: "Insights",
    items: [
      { icon: BarChart3,       label: "Analytics",    href: "/admin/analytics",   permission: "analytics" },
      { icon: Settings,        label: "Settings",     href: "/admin/settings",    permission: "settings" },
      { icon: UserCog,         label: "Admin Managers", href: "/admin/managers",   permission: "managers" },
    ],
  },
];

export default function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [perms, setPerms] = useState<Perms | null>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Fetch user permissions from API
    fetch("/api/admin/permissions")
      .then(res => res.json())
      .then(data => {
        setPerms(data);
        // console.log("Fetched permissions:", data);
        setLoading(false);
      })
      .catch(() => {
        setPerms(null);
        setLoading(false);
      });
  }, []);

  // Helper function to check if user has view permission for a module
  const hasPermission = (permission: string): boolean => {
    if (!perms) return false;
    if (perms.isSuperAdmin) return true;
    
    // Dashboard is always visible (or handle differently)
    if (permission === "dashboard") return true;
    
    // Check if the module exists in permissions and has view access
    const modulePerms = perms.permissions[permission];
    return modulePerms?.view === true;
  };

  // If still loading, show minimal sidebar or skeleton
  if (loading) {
    return (
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        <div className="brand">
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <ellipse cx="16" cy="9"  rx="6" ry="8" stroke="#f97316" strokeWidth="2.2"/>
              <ellipse cx="16" cy="23" rx="6" ry="8" stroke="#f97316" strokeWidth="2.2"/>
              <line x1="10" y1="16" x2="22" y2="16" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="16" cy="16" r="2.5" fill="#f97316"/>
            </svg>
          </div>
          {!collapsed && <span className="brand-name">DAMRU</span>}
        </div>
        <style>{`
          .sidebar { position: fixed; left:0; top:0; bottom:0; width: 220px; background: #fff; border-right: 1px solid #e5e7eb; display: flex; flex-direction: column; z-index: 40; transition: width 0.22s cubic-bezier(.4,0,.2,1); box-shadow: 2px 0 8px rgba(0,0,0,0.04); }
          .sidebar.collapsed { width: 64px; }
          .brand { display: flex; align-items: center; gap: 10px; padding: 0 16px; height: 60px; border-bottom: 1px solid #f3f4f6; overflow: hidden; flex-shrink: 0; }
          .brand-icon { width: 36px; height: 36px; border-radius: 10px; background: #fff7ed; border: 1.5px solid #fed7aa; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
          .brand-name { font-family: 'DM Sans', sans-serif; font-size: 1.1rem; font-weight: 800; letter-spacing: 0.14em; color: #111827; white-space: nowrap; }
        `}</style>
      </aside>
    );
  }

  // Filter nav groups based on permissions
  const filteredNavGroups = navGroups
    .map(group => ({
      ...group,
      items: group.items.filter(item => hasPermission(item.permission))
    }))
    .filter(group => group.items.length > 0);

  return (
    <>
      <aside className={`sidebar${collapsed ? " collapsed" : ""}`}>
        {/* Brand */}
        <div className="brand">
          <div className="brand-icon">
            <svg width="20" height="20" viewBox="0 0 32 32" fill="none">
              <ellipse cx="16" cy="9"  rx="6" ry="8" stroke="#f97316" strokeWidth="2.2"/>
              <ellipse cx="16" cy="23" rx="6" ry="8" stroke="#f97316" strokeWidth="2.2"/>
              <line x1="10" y1="16" x2="22" y2="16" stroke="#f97316" strokeWidth="2.5" strokeLinecap="round"/>
              <circle cx="16" cy="16" r="2.5" fill="#f97316"/>
            </svg>
          </div>
          {!collapsed && <span className="brand-name">DAMRU</span>}
        </div>

        {/* Nav */}
        <nav className="nav">
          {filteredNavGroups.map((group) => (
            <div key={group.label} className="nav-group">
              {!collapsed && <p className="nav-group-label">{group.label}</p>}
              {group.items.map(({ icon: Icon, label, href }) => {
                const active = pathname === href || pathname.startsWith(href + "/");
                return (
                  <Link key={href} href={href} className={`nav-item${active ? " active" : ""}`} title={collapsed ? label : undefined}>
                    <span className={`nav-icon-wrap${active ? " active" : ""}`}>
                      <Icon size={17} />
                    </span>
                    {!collapsed && <span className="nav-label">{label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div className="sidebar-bottom">
          <div className="divider" />
          <form action={logoutAction}>
            <button type="submit" className="nav-item logout-btn" title={collapsed ? "Logout" : undefined}>
              <span className="nav-icon-wrap logout-icon"><LogOut size={17} /></span>
              {!collapsed && <span className="nav-label">Logout</span>}
            </button>
          </form>
        </div>
      </aside>

      <style>{`
        .sidebar {
          position: fixed; left:0; top:0; bottom:0;
          width: 220px; background: #fff;
          border-right: 1px solid #e5e7eb;
          display: flex; flex-direction: column;
          z-index: 40; transition: width 0.22s cubic-bezier(.4,0,.2,1);
          box-shadow: 2px 0 8px rgba(0,0,0,0.04);
        }
        .sidebar.collapsed { width: 64px; }

        .brand {
          display: flex; align-items: center; gap: 10px;
          padding: 0 16px; height: 60px;
          border-bottom: 1px solid #f3f4f6; overflow: hidden; flex-shrink: 0;
        }
        .brand-icon {
          width: 36px; height: 36px; border-radius: 10px;
          background: #fff7ed; border: 1.5px solid #fed7aa;
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .brand-name {
          font-family: 'DM Sans', sans-serif; font-size: 1.1rem; font-weight: 800;
          letter-spacing: 0.14em; color: #111827; white-space: nowrap;
        }
        .nav {
          flex: 1; overflow-y: auto; overflow-x: hidden;
          padding: 12px 8px 8px; display: flex; flex-direction: column; gap: 4px;
        }
        .nav::-webkit-scrollbar { width: 0; }
        .nav-group { display: flex; flex-direction: column; gap: 1px; margin-bottom: 4px; }
        .nav-group-label {
          font-size: 0.62rem; font-weight: 600; letter-spacing: 0.1em;
          text-transform: uppercase; color: #9ca3af;
          padding: 0 8px; margin: 4px 0 4px;
        }
        .nav-item {
          display: flex; align-items: center; gap: 9px;
          padding: 7px 9px; border-radius: 9px;
          color: #6b7280; text-decoration: none;
          font-family: 'DM Sans', sans-serif; font-size: 0.865rem; font-weight: 400;
          cursor: pointer; border: none; background: none;
          width: 100%; text-align: left;
          transition: background 0.13s, color 0.13s;
          white-space: nowrap; overflow: hidden;
        }
        .nav-item:hover { background: #f9fafb; color: #111827; }
        .nav-item.active { background: #fff7ed; color: #ea580c; font-weight: 500; }
        .nav-icon-wrap {
          width: 30px; height: 30px; border-radius: 7px;
          display: flex; align-items: center; justify-content: center;
          flex-shrink: 0; color: inherit; transition: background 0.13s;
        }
        .nav-icon-wrap.active { background: #fed7aa; color: #f97316; }
        .nav-label { flex: 1; }
        .sidebar-bottom { padding: 0 8px 14px; }
        .divider { height: 1px; background: #f3f4f6; margin: 6px 0 8px; }
        .logout-btn { color: #9ca3af; }
        .logout-btn:hover { background: #fef2f2; color: #ef4444; }
        .logout-icon { color: inherit; }
      `}</style>
    </>
  );
}