"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCart } from "@/lib/CartContext";
import { useRewards } from "@/lib/rewards/RewardsProvider";

type AuthScreen = "login" | "register" | "forgot" | "otp" | "reset";
interface UserInfo { id: string; name: string; email: string; avatar?: string }

async function apiPost(path: string, body: object) {
  const r = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}


// ── Isolated OTP input — own state so parent re-renders don't affect it ────────
import { forwardRef, useImperativeHandle } from "react";

const OtpBoxes = forwardRef<{ getCode: () => string }, object>(function OtpBoxes(_, ref) {
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  useImperativeHandle(ref, () => ({
    getCode: () => digits.join(""),
  }));

  function handleChange(index: number, value: string) {
    // Handle paste
    if (value.length > 1) {
      const nums = value.replace(/\D/g, "").slice(0, 6).split("");
      const next = ["", "", "", "", "", ""];
      nums.forEach((d, i) => { next[i] = d; });
      setDigits(next);
      inputs.current[Math.min(nums.length, 5)]?.focus();
      return;
    }
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 5) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const next = [...digits]; next[index] = ""; setDigits(next);
      } else if (index > 0) {
        inputs.current[index - 1]?.focus();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = ["", "", "", "", "", ""];
    pasted.split("").forEach((d, i) => { next[i] = d; });
    setDigits(next);
    inputs.current[Math.min(pasted.length, 5)]?.focus();
  }

  const [focused, setFocused] = useState(-1);

  return (
    <div style={{ display: "flex", gap: 10, justifyContent: "center", margin: "20px 0 10px" }}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={el => { inputs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={e => handleChange(index, e.target.value)}
          onKeyDown={e => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={() => setFocused(index)}
          onBlur={() => setFocused(-1)}
          style={{
            width: 50, height: 56, border: `1.5px solid ${focused === index ? "#e67e22" : "#e0e0e0"}`,
            borderRadius: 10, textAlign: "center", fontSize: "1.4rem", fontWeight: 600,
            color: "#111", outline: "none", background: focused === index ? "#fff" : "#fafafa",
            transition: "border-color 0.2s", fontFamily: "Poppins,sans-serif",
            boxSizing: "border-box",
          }}
        />
      ))}
    </div>
  );
});

export default function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems } = useCart();
  const { dashboard: rewardsDashboard } = useRewards();
  const otpRef = useRef<{ getCode: () => string } | null>(null);

  // ── UI state (your original) ──────────────────────────────────
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [activeScreen, setActiveScreen] = useState<AuthScreen>("login");
  const [showPassword, setShowPassword] = useState({ login: false, register: false, confirm: false });
  const [countdown, setCountdown] = useState(60);
  const [isOtpSent, setIsOtpSent] = useState(false);

  // ── Search state ──────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ _id: string; name: string; desc: string; image: string; price: number; hasVariants: boolean; category: string; catSlug: string }[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Added: user session + form fields + feedback ──────────────
  const [user, setUser] = useState<UserInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");

  // form fields
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPw, setLoginPw] = useState("");
  const [regName, setRegName] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPw, setRegPw] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regReferralCode, setRegReferralCode] = useState("");
  const [showReferralField, setShowReferralField] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpToken, setOtpToken] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPw, setNewPw] = useState("");
  const [newPwConf, setNewPwConf] = useState("");
  const [showNewPw, setShowNewPw] = useState(false);
  const [showNewConf, setShowNewConf] = useState(false);
  const [hasTableSession, setHasTableSession] = useState(false);

  // Detect mobile view
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 767);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── Your original useEffects ──────────────────────────────────
  useEffect(() => {
    setIsMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isOtpSent) return;
    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsOtpSent(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isOtpSent]);

  // ── Added: fetch session on mount + listen for updates ────────
  useEffect(() => {
    fetch("/api/user/me")
      .then(r => r.json())
      .then(d => {
        setUser(d.user || null);
        if (!d.user) {
          const ref = new URLSearchParams(window.location.search).get("ref");
          if (ref) {
            setRegReferralCode(ref.toUpperCase());
            setShowReferralField(true);
            setActiveScreen("register");
            setIsAuthOpen(true);
          }
        }
      })
      .catch(() => setUser(null))
      .finally(() => setUserLoading(false));

    // Check table session in sessionStorage
    const checkTableSession = () => {
      const tbl = sessionStorage.getItem("dinein_table");
      setHasTableSession(!!tbl);
    };
    checkTableSession();

    window.addEventListener("storage", checkTableSession);
    window.addEventListener("dinein-session-updated", checkTableSession);

    const handleProfileUpdate = (e: Event) => {
      const customEvent = e as CustomEvent<any>;
      if (customEvent.detail) {
        setUser(customEvent.detail);
      }
    };

    const handleOpenAuthModal = () => {
      setActiveScreen("login");
      setIsAuthOpen(true);
    };

    window.addEventListener("user-profile-updated", handleProfileUpdate);
    window.addEventListener("open-auth-modal", handleOpenAuthModal);

    return () => {
      window.removeEventListener("storage", checkTableSession);
      window.removeEventListener("dinein-session-updated", checkTableSession);
      window.removeEventListener("user-profile-updated", handleProfileUpdate);
      window.removeEventListener("open-auth-modal", handleOpenAuthModal);
    };
  }, []);

  // ── Search debounce ──────────────────────────────────────────
  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    searchTimer.current = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [searchQuery, handleSearch]);

  // Close search dropdown on outside click (desktop only)
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!isMobile && searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
        setSearchQuery("");
        setSearchResults([]);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [isMobile]);

  // ── Your original handlers ────────────────────────────────────
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  const toggleAuth = () => {
    setIsAuthOpen(!isAuthOpen);
    setErr(""); setOkMsg("");
  };

  const handleSearchOpen = () => {
    if (isMobile) {
      setIsMobileSearchOpen(true);
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 100);
    } else {
      setIsSearchOpen(!isSearchOpen);
      if (!isSearchOpen) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 80);
      } else {
        setSearchQuery("");
        setSearchResults([]);
      }
    }
  };

  const handleMobileSearchClose = () => {
    setIsMobileSearchOpen(false);
    setSearchQuery("");
    setSearchResults([]);
  };

  // ── Added: API actions ────────────────────────────────────────
  async function handleLogin() {
    if (!loginEmail || !loginPw) { setErr("Please fill all fields."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(loginEmail.trim())) { setErr("Please enter a valid email address."); return; }
    setBusy(true); setErr("");
    const d = await apiPost("/api/user/login", { email: loginEmail, password: loginPw });
    setBusy(false);
    if (d.error) { setErr(d.error); return; }
    setUser(d.user);
    setIsAuthOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth-state-changed", { detail: d.user }));
    }
    router.refresh();
  }

  async function handleRegister() {
    if (!regName || !regEmail || !regPw) { setErr("Fill all required fields."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) { setErr("Please enter a valid email address."); return; }
    if (regPhone && !/^[6-9]\d{9}$/.test(regPhone.trim())) { setErr("Please enter a valid 10-digit phone number."); return; }
    if (regPw !== regConfirm) { setErr("Passwords don't match."); return; }
    if (regPw.length < 6) { setErr("Password min 6 characters."); return; }
    setBusy(true); setErr("");
    const d = await apiPost("/api/user/register", { name: regName, email: regEmail, phone: regPhone, password: regPw, referralCode: regReferralCode.trim() || undefined });
    setBusy(false);
    if (d.error) { setErr(d.error); return; }
    setUser(d.user);
    setIsAuthOpen(false);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("auth-state-changed", { detail: d.user }));
    }
    router.refresh();
  }

  async function handleSendOtp() {
    if (!forgotEmail) { setErr("Enter your email address."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmail.trim())) { setErr("Please enter a valid email address."); return; }
    setBusy(true); setErr("");
    setActiveScreen("otp");
    const d = await apiPost("/api/user/send-otp", { email: forgotEmail });
    setBusy(false);
    if (d.error) { setErr(d.error); setActiveScreen("forgot"); return; }
    setOtpToken(d.otpToken);
    setOkMsg("OTP sent! Check your inbox.");
    setIsOtpSent(true);
  }

  async function handleVerifyOtp() {
    const code = otpRef.current?.getCode() ?? "";
    if (code.length < 6 || code.replace(/\d/g, "").length > 0) { setErr("Enter all 6 digits."); return; }
    setBusy(true); setErr("");
    const d = await apiPost("/api/user/verify-otp", { otpToken, otp: code });
    setBusy(false);
    if (d.error) { setErr(d.error); return; }
    setResetToken(d.resetToken);
    setOkMsg("OTP verified! Set your new password.");
    setActiveScreen("reset");
  }

  async function handleResetPassword() {
    if (!newPw) { setErr("Enter new password."); return; }
    if (newPw.length < 6) { setErr("Min 6 characters."); return; }
    if (newPw !== newPwConf) { setErr("Passwords don't match."); return; }
    setBusy(true); setErr("");
    const d = await apiPost("/api/user/reset-password", { resetToken, password: newPw });
    setBusy(false);
    if (d.error) { setErr(d.error); return; }
    setOkMsg("Password reset successfully! You can now log in.");
    setTimeout(() => { setActiveScreen("login"); setErr(""); setOkMsg(""); }, 2000);
  }

  async function handleLogout() {
    await fetch("/api/user/logout", { method: "POST" });
    window.location.href = "/";
  }

  // Search results component (used in both desktop and mobile)
  const SearchResultsDropdown = ({ onItemClick, isMobileView = false }: { onItemClick: () => void; isMobileView?: boolean }) => {
    if (searchQuery.length < 2) return null;

    return (
      <div style={{
        position: isMobileView ? "relative" : "fixed",
        marginTop: isMobileView ? "12px" : "0",
        width: isMobileView ? "100%" : 380,
        background: "#fff",
        borderRadius: 14,
        boxShadow: isMobileView ? "none" : "0 12px 40px rgba(0,0,0,0.18)",
        border: isMobileView ? "1px solid #e0e0e0" : "1px solid #f0f0f0",
        overflow: "hidden",
        maxHeight: isMobileView ? "calc(100vh - 200px)" : "70vh",
        overflowY: "auto",
      }}>
        {searchLoading ? (
          <div style={{ padding: "20px", fontFamily: "Poppins,sans-serif", fontSize: "0.85rem", color: "#aaa", textAlign: "center" }}>
            🔍 Searching…
          </div>
        ) : searchResults.length === 0 ? (
          <div style={{ padding: "20px", fontFamily: "Poppins,sans-serif", fontSize: "0.85rem", color: "#aaa", textAlign: "center" }}>
            No results for &ldquo;{searchQuery}&rdquo;
          </div>
        ) : (
          <>
            <div style={{ padding: "10px 16px 8px", fontFamily: "Poppins,sans-serif", fontSize: "0.7rem", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "0.08em", borderBottom: "1px solid #f5f5f5" }}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} · &ldquo;{searchQuery}&rdquo;
            </div>
            {searchResults.map(item => {
              const href = item.catSlug ? `/menu?category=${encodeURIComponent(item.catSlug)}` : "/menu";
              return (
                <a key={item._id} href={href}
                  onClick={() => { onItemClick(); }}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", textDecoration: "none", borderBottom: "1px solid #fafafa" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fff7ed")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <div style={{ width: 46, height: 46, borderRadius: 10, overflow: "hidden", flexShrink: 0, background: "#f5f5f5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {item.image
                      ? <img src={`/uploads/menu-items/${item.image}`} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <span style={{ fontSize: 22 }}>🍽️</span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: "Poppins,sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "#111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</div>
                    {item.category && <div style={{ fontFamily: "Poppins,sans-serif", fontSize: "0.72rem", color: "#e67e22", fontWeight: 600 }}>{item.category}</div>}
                    {item.desc && <div style={{ fontFamily: "Poppins,sans-serif", fontSize: "0.75rem", color: "#999", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.desc}</div>}
                  </div>
                  <div style={{ fontFamily: "Poppins,sans-serif", fontWeight: 700, fontSize: "0.9rem", color: "#e67e22", flexShrink: 0, textAlign: "right" }}>
                    {item.hasVariants && <div style={{ fontSize: "0.65rem", fontWeight: 400, color: "#aaa" }}>from</div>}
                    ₹{item.price}
                  </div>
                </a>
              );
            })}
            <a href="/menu" onClick={() => { onItemClick(); }}
              style={{ display: "block", padding: "12px 16px", textAlign: "center", fontFamily: "Poppins,sans-serif", fontSize: "0.84rem", fontWeight: 600, color: "#e67e22", textDecoration: "none", borderTop: "1px solid #f5f5f5", background: "#fffbf5" }}>
              View All Menu Items →
            </a>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <header className="main-header">
        <div className="header-container">
          <div className="logo">
            <Link href="/">
              <img src="/assets/images/damru.png" alt="Damru Logo" />
            </Link>
          </div>

          <nav className="desktop-nav">
            <div className="menu-toggle" id="openMenu" onClick={toggleMenu}>
              <i className="ri-menu-line"></i>
            </div>

            <ul className="nav-links" style={{ display: isMenuOpen ? "flex" : undefined }}>
              <li><Link href="/" className={pathname === "/" ? "active" : ""}>Home</Link></li>
              <li><Link href="/menu" className={pathname === "/menu" ? "active" : ""}>Menu</Link></li>
              <li><Link href="/about-us" className={pathname === "/about-us" ? "active" : ""}>About Us</Link></li>
              <li><Link href="/contact-us" className={pathname === "/contact-us" ? "active" : ""}>Contact Us</Link></li>
            </ul>
          </nav>

          <div className="header-icons">
            {/* Search Button */}
            <div ref={searchRef} style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <button
                onClick={handleSearchOpen}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#333", display: "flex", alignItems: "center", padding: "4px 6px" }}
              >
                <i className="ri-search-line"></i>
              </button>

              {/* Desktop Search Bar */}
              {!isMobile && isSearchOpen && (
                <div style={{ display: "flex", alignItems: "center", background: "#f5f5f5", borderRadius: 24, padding: "0 12px", gap: 6, minWidth: 220, border: "1.5px solid #e0e0e0", transition: "all 0.2s" }}>
                  <i className="ri-search-line" style={{ color: "#aaa", fontSize: 14 }}></i>
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search menu items..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Escape") {
                        setIsSearchOpen(false);
                        setSearchQuery("");
                        setSearchResults([]);
                      }
                    }}
                    autoComplete="off"
                    style={{ border: "none", background: "transparent", outline: "none", padding: "8px 0", fontSize: "0.88rem", fontFamily: "Poppins,sans-serif", color: "#111", width: "100%", minWidth: 0 }}
                  />
                  {searchQuery && (
                    <button onClick={() => { setSearchQuery(""); setSearchResults([]); searchInputRef.current?.focus(); }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#aaa", fontSize: 14, display: "flex", alignItems: "center", padding: 0, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              )}

              {/* Desktop Search Dropdown */}
              {!isMobile && isSearchOpen && searchQuery.length >= 2 && (
                <div style={{
                  position: "fixed",
                  top: searchRef.current ? searchRef.current.getBoundingClientRect().bottom + 8 : 80,
                  left: searchRef.current ? Math.max(8, searchRef.current.getBoundingClientRect().right - 380) : 8,
                  width: 380,
                  background: "#fff",
                  borderRadius: 14,
                  boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
                  border: "1px solid #f0f0f0",
                  zIndex: 999999,
                  overflow: "hidden",
                  maxHeight: "70vh",
                  overflowY: "auto",
                }}>
                  <SearchResultsDropdown onItemClick={() => {
                    setIsSearchOpen(false);
                    setSearchQuery("");
                    setSearchResults([]);
                  }} />
                </div>
              )}
            </div>

            {/* Cart — only when logged in */}
            {!userLoading && user && (
              <Link href="/cart" className="icon-link" aria-label="Cart" style={{ position: "relative" }}>
                <i className="ri-shopping-cart-2-line"></i>
                {totalItems > 0 && (
                  <span style={{ position: "absolute", top: "-6px", right: "-6px", background: "#e67e22", color: "#fff", borderRadius: "50%", width: "18px", height: "18px", fontSize: "0.65rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Poppins,sans-serif" }}>{totalItems > 99 ? "99+" : totalItems}</span>
                )}
              </Link>
            )}

            {/* Damru balance pill — desktop/tablet only; shown in the profile menu on small screens */}
            {!isMobile && !userLoading && user && rewardsDashboard && (
              <Link href="/my-profile?tab=rewards" className="rewards__nav-pill" title="My Damru Rewards">
                🪙 {rewardsDashboard.damruBalance}
              </Link>
            )}

            {/* Profile icon — login modal if not logged in, profile link if logged in */}
            {userLoading ? (
              <span className="icon-link" style={{ opacity: 0.4, cursor: "default" }}>
                <i className="ri-user-3-line"></i>
              </span>
            ) : user ? (
              <Link href="/my-profile" className="icon-link" title={`Hi, ${user.name}`} style={{ position: "relative" }}>
                {user.avatar ? (
                  <img
                    src={`/uploads/avatars/${user.avatar}`}
                    alt={user.name}
                    style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "2px solid #e67e22" }}
                  />
                ) : (
                  <span style={{
                    width: 28, height: 28, borderRadius: "50%",
                    background: "#e67e22", color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: "0.7rem", fontWeight: 700, fontFamily: "Poppins, sans-serif"
                  }}>
                    {user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </Link>
            ) : (
              <button className="icon-link" id="profileIconBtn" onClick={toggleAuth}>
                <i className="ri-user-3-line"></i>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Search Modal */}
      {isMobile && isMobileSearchOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "#fff",
          zIndex: 10000,
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.3s ease-out",
        }}>
          {/* Modal Header */}
          <div style={{
            padding: "16px",
            borderBottom: "1px solid #e0e0e0",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            background: "#fff",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}>
            <button
              onClick={handleMobileSearchClose}
              style={{
                background: "none",
                border: "none",
                fontSize: "24px",
                cursor: "pointer",
                color: "#333",
                padding: "4px 8px",
                display: "flex",
                alignItems: "center",
              }}
            >
              <i className="ri-arrow-left-line"></i>
            </button>
            <div style={{
              flex: 1,
              display: "flex",
              width: "120px",
              alignItems: "center",
              background: "#f5f5f5",
              borderRadius: "24px",
              padding: "0 16px",
              gap: "8px",
              border: "1.5px solid #e0e0e0",
            }}>
              <i className="ri-search-line" style={{ color: "#aaa", fontSize: "18px" }}></i>
              <input
                ref={mobileSearchInputRef}
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                autoComplete="off"
                style={{
                  flex: 1,
                  border: "none",
                  background: "transparent",
                  outline: "none",
                  padding: "12px 0",
                  fontSize: "16px",
                  fontFamily: "Poppins, sans-serif",
                  color: "#111",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setSearchResults([]);
                    mobileSearchInputRef.current?.focus();
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#aaa",
                    fontSize: "18px",
                    display: "flex",
                    alignItems: "center",
                    padding: 0,
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Search Results */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px" }}>
            {searchQuery.length >= 2 && (
              <SearchResultsDropdown
                isMobileView={true}
                onItemClick={handleMobileSearchClose}
              />
            )}
            {searchQuery.length > 0 && searchQuery.length < 2 && (
              <div style={{ padding: "20px", textAlign: "center", color: "#999", fontFamily: "Poppins, sans-serif" }}>
                Type at least 2 characters to search...
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full menu overlay — your original structure */}
      <div className={`full-menu-overlay ${isMenuOpen ? "active" : ""}`} id="fullMenu" style={{ display: isMenuOpen ? "block" : "none" }}>
        <div className="close-menu" id="closeMenu" onClick={toggleMenu}>
          <i className="ri-close-line"></i>
        </div>

        <div className="overlay-content overlay-content--v2">
          <div className="overlay-nav overlay-nav--v2">

            {!userLoading && (
              user ? (
                <div className="overlay-account-card">
                  <Link href="/my-profile" onClick={toggleMenu} className="overlay-account-card__identity">
                    {user.avatar ? (
                      <img src={`/uploads/avatars/${user.avatar}`} alt={user.name} className="overlay-account-card__avatar" />
                    ) : (
                      <span className="overlay-account-card__avatar overlay-account-card__avatar--initials">
                        {user.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()}
                      </span>
                    )}
                    <span className="overlay-account-card__info">
                      <span className="overlay-account-card__name">{user.name}</span>
                      <span className="overlay-account-card__view">View Profile <i className="ri-arrow-right-s-line"></i></span>
                    </span>
                  </Link>
                  {rewardsDashboard && (
                    <Link href="/my-profile?tab=rewards" onClick={toggleMenu} className="overlay-account-card__damru" title="My Damru Rewards">
                      <span>🪙 {rewardsDashboard.damruBalance}</span>
                      <span className="overlay-account-card__damru-label">Damru</span>
                    </Link>
                  )}
                </div>
              ) : (
                <button className="overlay-account-cta" onClick={() => { setIsMenuOpen(false); setIsAuthOpen(true); }}>
                  <span><i className="ri-user-3-line"></i> Login / Sign Up</span>
                  <i className="ri-arrow-right-s-line"></i>
                </button>
              )
            )}

            <span className="overlay-nav__eyebrow">Explore</span>
            <ul className="overlay-nav__list">
              <li className="overlay-nav__item">
                <Link href="/" onClick={toggleMenu} className={`overlay-nav__link ${pathname === "/" ? "is-active" : ""}`}>
                  <i className="ri-home-5-line"></i> <span>Home</span>
                </Link>
              </li>
              <li className="overlay-nav__item">
                <Link href="/menu" onClick={toggleMenu} className={`overlay-nav__link ${pathname === "/menu" ? "is-active" : ""}`}>
                  <i className="ri-restaurant-2-line"></i> <span>Menu</span>
                </Link>
              </li>
              <li className="overlay-nav__item">
                <Link href="/about-us" onClick={toggleMenu} className={`overlay-nav__link ${pathname === "/about-us" ? "is-active" : ""}`}>
                  <i className="ri-information-line"></i> <span>About Us</span>
                </Link>
              </li>
              <li className="overlay-nav__item">
                <Link href="/contact-us" onClick={toggleMenu} className={`overlay-nav__link ${pathname === "/contact-us" ? "is-active" : ""}`}>
                  <i className="ri-phone-line"></i> <span>Contact Us</span>
                </Link>
              </li>
              <li className="overlay-nav__item">
                <Link href="/gallery" onClick={toggleMenu} className={`overlay-nav__link ${pathname === "/gallery" ? "is-active" : ""}`}>
                  <i className="ri-image-line"></i> <span>Gallery</span>
                </Link>
              </li>
              <li className="overlay-nav__item">
                <Link href="/blogs" onClick={toggleMenu} className={`overlay-nav__link ${pathname.startsWith("/blogs") ? "is-active" : ""}`}>
                  <i className="ri-article-line"></i> <span>Blogs</span>
                </Link>
              </li>
              <li className="overlay-nav__item">
                <Link href="/offers" onClick={toggleMenu} className={`overlay-nav__link ${pathname === "/offers" ? "is-active" : ""}`}>
                  <i className="ri-price-tag-3-line"></i> <span>Offers</span>
                </Link>
              </li>
              <li className="overlay-nav__item">
                <Link href="/branches" onClick={toggleMenu} className={`overlay-nav__link ${pathname.startsWith("/branches") ? "is-active" : ""}`}>
                  <i className="ri-calendar-event-line"></i> <span>Banquet / Event</span>
                </Link>
              </li>
            </ul>

            {user && (
              <button className="overlay-logout-btn" onClick={() => { setIsMenuOpen(false); handleLogout(); }}>
                <i className="ri-logout-box-r-line"></i> Logout
              </button>
            )}
          </div>

          <div className="overlay-contact overlay-contact--v2">
            <h3>Get in Touch</h3>
            <div className="overlay-contact__list">
              <a href="tel:+918690987272" className="overlay-contact__row">
                <i className="ri-phone-fill"></i> <span>+91 8690987272</span>
              </a>
              <a href="mailto:info@damrubynamo.com" className="overlay-contact__row">
                <i className="ri-mail-fill"></i> <span>info@damrubynamo.com</span>
              </a>
              <div className="overlay-contact__row overlay-contact__row--static">
                <i className="ri-map-pin-fill"></i> <span>35 A Mansarover, Jaipur (Rajasthan), 302020</span>
              </div>
            </div>
            <div className="overlay-socials overlay-socials--v2">
              <Link href="#" aria-label="Instagram"><i className="ri-instagram-line"></i></Link>
              <Link href="#" aria-label="Twitter"><i className="ri-twitter-line"></i></Link>
              <Link href="#" aria-label="Facebook"><i className="ri-facebook-fill"></i></Link>
              <Link href="#" aria-label="YouTube"><i className="ri-youtube-line"></i></Link>
            </div>
          </div>
        </div>
      </div>

      {/* Auth modal — your original structure, with working handlers */}
      <div className={`auth-overlay ${isAuthOpen ? "active" : ""}`} id="authOverlay">
        <div className="auth-modal" id="authModal">
          <button className="auth-close" id="authClose" onClick={toggleAuth}>✕</button>

          {err && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: "0.85rem", fontFamily: "Poppins, sans-serif" }}>⚠ {err}</div>}
          {okMsg && <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#16a34a", padding: "10px 14px", borderRadius: 8, marginBottom: 14, fontSize: "0.85rem", fontFamily: "Poppins, sans-serif" }}>✓ {okMsg}</div>}

          {/* LOGIN */}
          <div className={`auth-screen ${activeScreen === "login" ? "active" : ""}`} id="screen-login">
            <h2 className="auth-title">Log In !</h2>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-mail-line"></i></span>
              <input type="email" placeholder="Email Address" id="login-email"
                value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
            </div>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-shield-keyhole-line"></i></span>
              <input type={showPassword.login ? "text" : "password"} placeholder="Password" id="login-password"
                value={loginPw} onChange={e => setLoginPw(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleLogin()} />
              <button className="toggle-pass" onClick={() => setShowPassword({ ...showPassword, login: !showPassword.login })}>
                <i className={showPassword.login ? "ri-eye-line" : "ri-eye-off-line"}></i>
              </button>
            </div>
            <div className="auth-forgot-wrap">
              <button className="auth-link" id="goForgot" onClick={() => { setErr(""); setOkMsg(""); setActiveScreen("forgot"); }}>Forget Password ?</button>
            </div>
            <button className="auth-btn" id="loginBtn" onClick={handleLogin} disabled={busy}>
              {busy ? "Logging in…" : "Log in"}
            </button>
            <p className="auth-switch">Don&apos;t have an account ?{" "}
              <button className="auth-link orange" id="goRegister" onClick={() => { setErr(""); setOkMsg(""); setActiveScreen("register"); }}>Sign Up</button>
            </p>
          </div>

          {/* REGISTER */}
          <div className={`auth-screen ${activeScreen === "register" ? "active" : ""}`} id="screen-register">
            <h2 className="auth-title">Registration !</h2>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-user-3-line"></i></span>
              <input type="text" placeholder="Full Name" value={regName} onChange={e => setRegName(e.target.value)} />
            </div>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-phone-line"></i></span>
              <input type="tel" placeholder="Contact Number (10 digits)" value={regPhone}
                maxLength={10}
                onChange={e => setRegPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} />
            </div>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-mail-line"></i></span>
              <input type="email" placeholder="Email Address" value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            </div>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-shield-keyhole-line"></i></span>
              <input type={showPassword.register ? "text" : "password"} placeholder="Password" id="reg-password"
                value={regPw} onChange={e => setRegPw(e.target.value)} />
              <button className="toggle-pass" onClick={() => setShowPassword({ ...showPassword, register: !showPassword.register })}>
                <i className={showPassword.register ? "ri-eye-line" : "ri-eye-off-line"}></i>
              </button>
            </div>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-shield-keyhole-line"></i></span>
              <input type={showPassword.confirm ? "text" : "password"} placeholder="Confirm Password" id="reg-confirm"
                value={regConfirm} onChange={e => setRegConfirm(e.target.value)} />
              <button className="toggle-pass" onClick={() => setShowPassword({ ...showPassword, confirm: !showPassword.confirm })}>
                <i className={showPassword.confirm ? "ri-eye-line" : "ri-eye-off-line"}></i>
              </button>
            </div>

            {showReferralField ? (
              <div className="auth-field">
                <span className="auth-field-icon"><i className="ri-gift-line"></i></span>
                <input type="text" placeholder="Referral Code (optional)" value={regReferralCode}
                  onChange={e => setRegReferralCode(e.target.value.toUpperCase())} />
              </div>
            ) : (
              <button type="button" className="auth-link orange" style={{ marginBottom: 14, display: "inline-block" }}
                onClick={() => setShowReferralField(true)}>
                Have a referral code?
              </button>
            )}

            <p className="auth-terms">By signing below, you agree to the <Link href="#">terms of use</Link> and <Link href="#">privacy notice</Link></p>
            <button className="auth-btn" onClick={handleRegister} disabled={busy}>
              {busy ? "Registering…" : "Register"}
            </button>
            <p className="auth-switch">
              <button className="auth-link orange" id="goLogin" onClick={() => { setErr(""); setOkMsg(""); setActiveScreen("login"); }}>← Back to Login Page</button>
            </p>
          </div>

          {/* FORGOT PASSWORD */}
          <div className={`auth-screen ${activeScreen === "forgot" ? "active" : ""}`} id="screen-forgot">
            <h2 className="auth-title">Forgot Password !</h2>
            <p className="auth-desc">Please enter your email address below you will receive OTP on your email address.</p>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-mail-line"></i></span>
              <input type="email" placeholder="Email Address" id="forgot-email"
                value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSendOtp()} />
            </div>
            <button className="auth-btn" id="forgotBtn" onClick={handleSendOtp} disabled={busy}>
              {busy ? "Sending OTP…" : "Continue"}
            </button>
          </div>

          {/* OTP */}
          <div className={`auth-screen ${activeScreen === "otp" ? "active" : ""}`} id="screen-otp">
            <h2 className="auth-title">Verify OTP</h2>
            <p className="auth-desc">Please enter OTP sent to <strong>{forgotEmail}</strong></p>
            <OtpBoxes ref={otpRef} />
            <p className="otp-timer">
              {busy
                ? <>Sending OTP to your email…</>
                : isOtpSent
                  ? <><span id="otp-countdown">{countdown}</span> Seconds</>
                  : <button className="auth-link orange" onClick={handleSendOtp}>Resend OTP</button>
              }
            </p>
            <button className="auth-btn" id="otpBtn" onClick={handleVerifyOtp} disabled={busy}>
              {busy ? "Verifying…" : "Continue"}
            </button>
          </div>

          {/* RESET PASSWORD — new screen after OTP verified */}
          <div className={`auth-screen ${activeScreen === "reset" ? "active" : ""}`} id="screen-reset">
            <h2 className="auth-title">New Password</h2>
            <p className="auth-desc">Enter your new password below.</p>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-shield-keyhole-line"></i></span>
              <input type={showNewPw ? "text" : "password"} placeholder="New Password"
                value={newPw} onChange={e => setNewPw(e.target.value)} />
              <button className="toggle-pass" onClick={() => setShowNewPw(v => !v)}>
                <i className={showNewPw ? "ri-eye-line" : "ri-eye-off-line"}></i>
              </button>
            </div>
            <div className="auth-field">
              <span className="auth-field-icon"><i className="ri-shield-keyhole-line"></i></span>
              <input type={showNewConf ? "text" : "password"} placeholder="Confirm New Password"
                value={newPwConf} onChange={e => setNewPwConf(e.target.value)} />
              <button className="toggle-pass" onClick={() => setShowNewConf(v => !v)}>
                <i className={showNewConf ? "ri-eye-line" : "ri-eye-off-line"}></i>
              </button>
            </div>
            <button className="auth-btn" onClick={handleResetPassword} disabled={busy}>
              {busy ? "Saving…" : "Reset Password"}
            </button>
          </div>

        </div>
      </div>

      <style jsx>{`
        @keyframes slideUp {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
      `}</style>
    </>
  );
}