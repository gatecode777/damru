import Link from "next/link";
import NewsletterForm from "./NewsletterForm";

const QUICK_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about-us" },
  { label: "Menu", href: "/menu" },
  { label: "Banquet / Events", href: "/branches" },
  { label: "Gallery", href: "/gallery" },
  { label: "Contact Us", href: "/contact-us" },
  { label: "Offers", href: "/offers" },
];

const SERVICE_LINKS = [
  { label: "Online Order", href: "/menu" },
  { label: "Birthday Parties", href: "/branches" },
  { label: "Wedding Functions", href: "/branches" },
  { label: "Corporate Events", href: "/branches" },
  { label: "Catering Services", href: "/contact-us" },
  { label: "Dine-In", href: "/menu" },
  { label: "Blogs", href: "/blogs" },
];

const POLICY_LINKS = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Refund Policy", href: "/refund-policy" },
  { label: "Booking Policy", href: "/booking-policy" },
  { label: "Shipping Policy", href: "/shipping-policy" },
  { label: "Terms & Conditions", href: "/terms-and-conditions" },
];

export default function SiteFooter() {

  return (
    <>
      <footer className="main-footer">
        <div className="footer-container">

          {/* Col 1 — About & socials */}
          <div className="footer-col footer-about">
            <p>
              We serve delicious food with a perfect ambiance and offer premium
              banquet services for weddings, birthdays, and special occasions.
            </p>
            <div className="social-icons">
              <a href="https://instagram.com" target="_blank" rel="noreferrer" aria-label="Instagram">
                <i className="fab fa-instagram" />
              </a>
              <a href="https://twitter.com" target="_blank" rel="noreferrer" aria-label="Twitter">
                <i className="fab fa-twitter" />
              </a>
              <a href="https://facebook.com" target="_blank" rel="noreferrer" aria-label="Facebook">
                <i className="fab fa-facebook-f" />
              </a>
              <a href="https://youtube.com" target="_blank" rel="noreferrer" aria-label="YouTube">
                <i className="fab fa-youtube" />
              </a>
            </div>
          </div>

          {/* Col 2 — Quick links */}
          <div className="footer-col">
            <ul className="footer-links">
              {QUICK_LINKS.map(l => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3 — Services */}
          <div className="footer-col">
            <ul className="footer-links">
              {SERVICE_LINKS.map(l => (
                <li key={l.label}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4 — Policies */}
          <div className="footer-col">
            <ul className="footer-links">
              {POLICY_LINKS.map(l => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 5 — Newsletter */}
          <div className="footer-col footer-newsletter">
            <NewsletterForm />
            <p className="newsletter-note">
              Join our subscribers and get the best recipes and offers delivered each week!
            </p>
          </div>

        </div>

        {/* Disclaimer bar */}
        <div className="footer-disclaimer">
          <div className="disclaimer-container">
            All information on this website is for general purposes only. Prices,
            menu, and services may change without notice. We are not liable for any
            inaccuracies or unforeseen issues. Please contact us for the latest details.
          </div>
        </div>

        {/* Copyright bar */}
        <div className="footer-copyright">
          <p>
            &copy; {new Date().getFullYear()} <Link href="/" className="footer-copyright-link">damru</Link>. All rights reserved.
          </p>
        </div>
      </footer>

    </>
  );
}