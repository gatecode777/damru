import type { Metadata } from "next";
import "@/styles/website/privacypolicy.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Damru By Namo",
  description:
    "Read the Privacy Policy of Damru By Namo. Learn how we collect, use, and protect your personal information when you use our restaurant, delivery, and banquet services.",
  keywords: ["privacy policy", "Damru By Namo", "data protection", "personal information"],
  openGraph: {
    title: "Privacy Policy | Damru By Namo",
    description: "Learn how Damru By Namo protects your personal information.",
    type: "website",
  },
};

export default function PrivacyPolicyPage() {
  return (
    <div className="privacypolicy">
      <section className="privacy-hero">
        <div className="privacy-hero-overlay"></div>
      </section>

      <div className="privacy-main-container">
        <header className="privacy-content-header">
          <h2 className="main-orange-title">Privacy Policy</h2>
          <p className="effective-date">Effective Date: 01/04/2026</p>
          <p className="intro-text">
            Welcome to Damru By Namo. Your privacy is important to us, and we
            are committed to protecting your personal information while
            providing you with the best dining, banquet, and food delivery
            services.
          </p>
        </header>

        <section className="privacy-section">
          <h3>Information We Collect</h3>
          <p>We may collect the following types of information when you use our website or services:</p>
          <ul>
            <li>Personal Information: Name, phone number, email address, and delivery address</li>
            <li>Booking Details: Banquet hall reservations, event details, special requests</li>
            <li>Order Information: Food orders, preferences, and payment details</li>
            <li>Technical Data: IP address, browser type, device information, and website usage data</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h3>How We Use Your Information</h3>
          <p>We use your information to:</p>
          <ul>
            <li>Process food orders and provide home delivery services</li>
            <li>Manage banquet hall bookings and event reservations</li>
            <li>Improve our restaurant, café, and dining experience</li>
            <li>Communicate updates, offers, and customer support</li>
            <li>Ensure website functionality and security</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h3>Sharing of Information</h3>
          <p>We do not sell or rent your personal data. However, we may share your information with:</p>
          <ul>
            <li>Delivery partners for order fulfillment</li>
            <li>Payment gateways for secure transactions</li>
            <li>Service providers who help operate our website and services</li>
          </ul>
          <p>All third parties are required to keep your information secure.</p>
        </section>

        <section className="privacy-section">
          <h3>Data Security</h3>
          <p>
            We take appropriate security measures to protect your personal data
            from unauthorized access, misuse, or disclosure. Your information is
            stored securely and accessed only when necessary.
          </p>
        </section>

        <section className="privacy-section">
          <h3>Cookies &amp; Tracking Technologies</h3>
          <p>Our website may use cookies to:</p>
          <ul>
            <li>Enhance your browsing experience</li>
            <li>Analyze website traffic and performance</li>
            <li>Provide personalized content and offers</li>
          </ul>
          <p>You can disable cookies through your browser settings.</p>
        </section>

        <section className="privacy-section">
          <h3>Your Rights</h3>
          <p>You have the right to:</p>
          <ul>
            <li>Access or update your personal information</li>
            <li>Request deletion of your data</li>
            <li>Opt-out of marketing communications</li>
          </ul>
          <p>To make a request, please contact us using the details below.</p>
        </section>

        <section className="privacy-section">
          <h3>Third-Party Links</h3>
          <p>
            Our website may contain links to third-party websites. We are not
            responsible for their privacy practices, so we encourage you to
            review their policies.
          </p>
        </section>

        <section className="privacy-section">
          <h3>Updates to This Policy</h3>
          <p>
            We may update this Privacy Policy from time to time. Changes will be
            posted on this page with a revised effective date. We encourage you
            to review this policy periodically.
          </p>
        </section>

        <section className="privacy-section contact-info">
          <h3>Contact Us</h3>
          <p>If you have any questions about this Privacy Policy, please contact us:</p>
          <div className="contact-details">
            <p><strong>Damru By Namo</strong></p>
            <p>Address: E-96, Lal Bahadur Nagar, Jai Jawan Colony, Aadinath Nagar, JLN Marg, Malviya Nagar, Jaipur, Rajasthan.</p>
            <p>Phone: +91-1234567893</p>
            <p>Email: info@damrubynamo.com</p>
          </div>
        </section>
      </div>
    </div>
  );
}