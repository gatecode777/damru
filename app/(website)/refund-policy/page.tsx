import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Refund Policy | Damru By Namo",
  description:
    "Read the Refund Policy of Damru By Namo. Understand our guidelines for food order refunds, banquet cancellations, and return procedures.",
  keywords: ["refund policy", "cancellation policy", "Damru By Namo", "food order refund"],
  openGraph: {
    title: "Refund Policy | Damru By Namo",
    description: "Understand our refund and cancellation guidelines at Damru By Namo.",
    type: "website",
  },
};

export default function RefundPolicyPage() {
  return (
    <div className="refund">
      <section className="refund-hero"></section>

      <div className="refund-container">
        <header className="refund-header">
          <h1 className="policy-title">Refund Policy</h1>
          <p className="effective-date">Effective Date: 01/04/2026</p>
          <p className="intro-text">
            At Damru By Namo, we strive to provide the best quality food, dining experience,
            and banquet services. However, if you are not fully satisfied, please review our
            return and refund guidelines below.
          </p>
        </header>

        <section className="policy-section">
          <h2>Food Orders (Delivery &amp; Takeaway)</h2>
          <p>Due to the perishable nature of food items, we generally do not accept returns. However, refunds or replacements may be provided in the following cases:</p>
          <ul>
            <li>Incorrect items delivered</li>
            <li>Missing items in your order</li>
            <li>Food quality issues (spoiled, damaged, or not as described)</li>
          </ul>
          <p className="note"><strong>Note:</strong> Customers must report the issue within 30 minutes of delivery with proof (photo/video).</p>
        </section>

        <section className="policy-section">
          <h2>Refund Process for Orders</h2>
          <ul>
            <li>Approved refunds will be processed within 5-7 business days</li>
            <li>Refunds will be credited to the original payment method</li>
            <li>In some cases, we may offer replacement or store credit instead of a refund</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Dine-In (Restaurant / Café)</h2>
          <ul>
            <li>Once the order is served and consumed, refunds are generally not applicable</li>
            <li>If there is a genuine issue with food quality or service, please inform our staff immediately for resolution</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Banquet Hall Bookings</h2>
          <div className="sub-policy">
            <p><strong>Cancellation Policy:</strong></p>
            <ul>
              <li><strong>7+ days before event:</strong> Full refund (excluding booking charges, if any)</li>
              <li><strong>3-7 days before event:</strong> 50% refund</li>
              <li><strong>Less than 3 days:</strong> No refund</li>
            </ul>
          </div>
          <div className="sub-policy">
            <p><strong>Refund Timeline:</strong></p>
            <ul>
              <li>Banquet refunds will be processed within 7-10 business days</li>
            </ul>
          </div>
        </section>

        <section className="policy-section">
          <h2>Order Cancellation</h2>
          <ul>
            <li>Orders can be canceled before preparation begins</li>
            <li>Once the order is prepared or dispatched, cancellation may not be possible</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Non-Refundable Situations</h2>
          <p>Refunds will not be applicable in the following cases:</p>
          <ul>
            <li>Delay due to unavoidable circumstances (traffic, weather, etc.)</li>
            <li>Incorrect address provided by the customer</li>
            <li>Change of mind after order confirmation</li>
          </ul>
        </section>

        <section className="policy-section contact-block">
          <h2>Contact for Support</h2>
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