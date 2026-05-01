import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms & Conditions | Damru By Namo",
  description:
    "Read the Terms & Conditions of Damru By Namo. Understand the rules for using our website, placing orders, making reservations, and availing banquet services.",
  keywords: ["terms and conditions", "terms of service", "Damru By Namo", "restaurant terms"],
  openGraph: {
    title: "Terms & Conditions | Damru By Namo",
    description: "Read the complete terms and conditions for using Damru By Namo services.",
    type: "website",
  },
};

export default function TermsAndConditionsPage() {
  return (
    <div className="terms">
      <section className="terms-hero"></section>

      <div className="terms-container">
        <header className="terms-header">
          <h1 className="policy-title">Terms &amp; Conditions</h1>
          <p className="effective-date">Effective Date: 01/04/2026</p>
          <p className="intro-text">
            Welcome to Damru By Namo. By accessing our website or using our
            services (restaurant dining, café, food delivery, and banquet
            bookings), you agree to comply with the following Terms &amp; Conditions.
          </p>
        </header>

        <section className="policy-section">
          <h2>Use of Website</h2>
          <ul>
            <li>The content on this website is for general information and service use only</li>
            <li>You agree not to misuse the website for fraudulent or unlawful activities</li>
            <li>We reserve the right to update or modify content at any time without prior notice</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Orders &amp; Food Delivery</h2>
          <ul>
            <li>All orders placed through our website are subject to acceptance and availability</li>
            <li>Prices and menu items may change without prior notice</li>
            <li>Once an order is confirmed and prepared, it cannot be canceled</li>
            <li>Delivery timelines are estimates and may vary due to external factors</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Table Reservations</h2>
          <ul>
            <li>Reservations are subject to availability</li>
            <li>We hold reserved tables for a limited time (15–20 minutes)</li>
            <li>Management reserves the right to cancel or modify reservations if required</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Banquet &amp; Event Bookings</h2>
          <ul>
            <li>Bookings are confirmed only after advance payment</li>
            <li>Customers must provide accurate event details</li>
            <li>Cancellation and refund policies will apply as per our Booking/Refund Policy</li>
            <li>Any damage to property during events will be chargeable</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Payments</h2>
          <ul>
            <li>We accept payments via online methods, UPI, debit/credit cards, and cash</li>
            <li>All payments must be completed before order processing or event execution</li>
            <li>In case of payment failure, the order or booking will not be confirmed</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Pricing &amp; Taxes</h2>
          <ul>
            <li>All prices listed are subject to applicable taxes (GST or other charges)</li>
            <li>Prices may vary for dine-in, takeaway, and delivery</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Cancellation &amp; Refunds</h2>
          <ul>
            <li>Orders and bookings are subject to our <strong>Return &amp; Refund Policy</strong></li>
            <li>Refund timelines and eligibility depend on the type of service</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>User Responsibilities</h2>
          <ul>
            <li>Provide accurate personal and contact details</li>
            <li>Follow restaurant rules and maintain proper conduct</li>
            <li>Any misuse of services may lead to denial of service</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Intellectual Property</h2>
          <ul>
            <li>All content (text, images, logo, design) on this website is the property of <strong>Damru By Namo</strong></li>
            <li>Unauthorized use or reproduction is strictly prohibited</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Limitation of Liability</h2>
          <ul>
            <li>We are not responsible for delays caused by factors beyond our control (traffic, weather, technical issues, etc.)</li>
            <li>We are not liable for any indirect or incidental damages arising from the use of our services</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Third-Party Services</h2>
          <ul>
            <li>We may use third-party services (payment gateways, delivery partners)</li>
            <li>We are not responsible for their actions, but we ensure they follow standard practices</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Privacy</h2>
          <ul>
            <li>Your personal data is handled as per our Privacy Policy</li>
            <li>By using our services, you agree to our data practices</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Changes to Terms</h2>
          <ul>
            <li>We reserve the right to update these Terms &amp; Conditions at any time</li>
            <li>Continued use of the website means you accept the updated terms</li>
          </ul>
        </section>

        <section className="policy-section contact-block">
          <h2>Contact Us</h2>
          <p>If you have any questions about these Terms &amp; Conditions, please contact us:</p>
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