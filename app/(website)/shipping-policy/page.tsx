import type { Metadata } from "next";
import "@/styles/website/shippingpolicy.css";

export const metadata: Metadata = {
  title: "Shipping Policy | Damru By Namo",
  description:
    "Read the Shipping & Delivery Policy of Damru By Namo. Learn about delivery areas, timelines, charges, and order tracking for food delivery in Jaipur.",
  keywords: ["shipping policy", "delivery policy", "food delivery Jaipur", "Damru By Namo delivery"],
  openGraph: {
    title: "Shipping Policy | Damru By Namo",
    description: "Learn about Damru By Namo's food delivery areas, timelines, and charges.",
    type: "website",
  },
};

export default function ShippingPolicyPage() {
  return (
    <div className="shipping">
      <section className="shipping-hero"></section>

      <div className="shipping-container">
        <header className="shipping-header">
          <h1 className="policy-title">Shipping Policy</h1>
          <p className="effective-date">Effective Date: 01/04/2026</p>
          <p className="intro-text">
            At Damru By Namo, we are committed to delivering fresh, delicious
            food quickly and safely to your doorstep. This policy outlines our
            delivery process, timelines, and terms.
          </p>
        </header>

        <section className="policy-section">
          <h2>Delivery Areas</h2>
          <ul>
            <li>We currently offer food delivery within selected locations and nearby areas</li>
            <li>Delivery availability may vary based on distance and serviceability</li>
            <li>You can check delivery availability at checkout or by contacting us</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Delivery Time</h2>
          <ul>
            <li>Estimated delivery time: 30-60 minutes (may vary based on location and order volume)</li>
            <li>During peak hours, weekends, or special occasions, delivery times may be slightly longer</li>
            <li>We always aim to deliver your order as quickly as possible</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Delivery Charges</h2>
          <ul>
            <li>Delivery charges may apply based on distance and order value</li>
            <li>Any applicable delivery fee will be shown at checkout before payment</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Order Processing</h2>
          <ul>
            <li>Orders are prepared fresh after confirmation</li>
            <li>Once the order is prepared and dispatched, it cannot be canceled</li>
            <li>You will receive updates regarding your order status</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Order Tracking</h2>
          <ul>
            <li>Customers may receive real-time updates via SMS, call, or website notifications</li>
            <li>For any delay or issue, you can contact our support team</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Delivery Conditions</h2>
          <ul>
            <li>Please ensure accurate delivery address and contact details</li>
            <li>Our delivery partner may contact you for directions</li>
            <li>If the customer is unavailable at the time of delivery, the order may be canceled without refund</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Delays in Delivery</h2>
          <p>Delivery may be delayed due to:</p>
          <ul>
            <li>Traffic or weather conditions</li>
            <li>High order volume</li>
            <li>Unforeseen circumstances</li>
          </ul>
          <p>We appreciate your patience in such situations.</p>
        </section>

        <section className="policy-section">
          <h2>Damaged or Incorrect Orders</h2>
          <p>If you receive:</p>
          <ul>
            <li>Incorrect items</li>
            <li>Missing items</li>
            <li>Damaged packaging</li>
          </ul>
          <p>Please report the issue within <strong>30 minutes of delivery</strong> with proof (photo/video). We will arrange a replacement or refund as per our policy.</p>
        </section>

        <section className="policy-section contact-block">
          <h2>Contact Us</h2>
          <p>If you have any questions about our Shipping Policy, please contact us:</p>
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