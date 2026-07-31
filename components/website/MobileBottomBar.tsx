"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/CartContext";

export default function MobileBottomBar() {
  const pathname = usePathname();
  const { totalItems } = useCart();

  const NAV_ITEMS = [
    { href: "/",           label: "Home",     icon: "ri-home-5-line",     activeIcon: "ri-home-5-fill" },
    { href: "/menu",       label: "Menu",     icon: "ri-restaurant-line", activeIcon: "ri-restaurant-fill" },
    { href: "/branches",   label: "Branches", icon: "ri-building-2-line", activeIcon: "ri-building-2-fill" },
    { href: "/cart",       label: "Cart",     icon: "ri-shopping-cart-2-line", activeIcon: "ri-shopping-cart-2-fill", badge: totalItems },
    { href: "/my-profile", label: "Profile",  icon: "ri-user-3-line",     activeIcon: "ri-user-3-fill" },
  ];

  return (
    <nav className="damru-mobile-bottom-bar" aria-label="Mobile Navigation">
      {NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/"
            ? pathname === "/"
            : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            className={`bottom-bar-item${isActive ? " active" : ""}`}
          >
            <div className="icon-wrapper">
              <i className={isActive ? item.activeIcon : item.icon} />
              {item.badge && item.badge > 0 ? (
                <span className="cart-badge-count">{item.badge}</span>
              ) : null}
            </div>
            <span className="item-label">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
