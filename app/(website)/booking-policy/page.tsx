import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Booking Policy | Damru By Namo",
  description:
    "Read the Booking Policy of Damru By Namo. Understand our terms for table reservations, banquet hall bookings, payment, and cancellation conditions.",
  keywords: ["booking policy", "banquet booking", "table reservation", "Damru By Namo", "event booking Jaipur"],
  openGraph: {
    title: "Booking Policy | Damru By Namo",
    description: "Learn the terms for table reservations and banquet bookings at Damru By Namo.",
    type: "website",
  },
};

export default function BookingPolicyPage() {
  return (
    <div className="booking">
      <section className="booking-hero"></section>

      <div className="booking-container">
        <header className="booking-header">
          <h1 className="policy-title">Booking Policy</h1>
          <p className="effective-date">Effective Date: 01/04/2026</p>
          <p className="intro-text">
            Welcome to Damru By Namo. This Booking Policy outlines the terms and
            conditions for reserving our banquet hall, dining tables, and event
            services. By making a booking, you agree to the following terms.
          </p>
        </header>

        <section className="policy-section">
          <h2>Table Reservations</h2>
          <ul>
            <li>Guests are encouraged to book tables in advance to ensure availability</li>
            <li>Walk-ins are accepted based on availability</li>
            <li>Reserved tables will be held for 15-20 minutes after the scheduled time</li>
            <li>Late arrivals may result in cancellation or reassignment</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Banquet Hall Bookings</h2>
          <p>Our banquet hall is available for events such as birthdays, weddings, corporate gatherings, and special occasions.</p>
          <div className="sub-block">
            <p><strong>Booking Confirmation:</strong></p>
            <ul>
              <li>A partial advance payment is required to confirm your booking</li>
              <li>Booking is confirmed only after payment and official confirmation</li>
            </ul>
          </div>
          <div className="sub-block">
            <p><strong>Event Details:</strong></p>
            <ul>
              <li>Customers must provide event details (date, time, number of guests, special requirements)</li>
              <li>Any changes should be informed at least 48 hours in advance</li>
            </ul>
          </div>
        </section>

        <section className="policy-section">
          <h2>Payment Terms</h2>
          <ul>
            <li>Advance payment is required for banquet bookings</li>
            <li>Remaining balance must be cleared before or on the event day</li>
            <li>We accept payments via online methods, UPI, cards, or cash</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Cancellation &amp; Rescheduling</h2>
          <ul>
            <li>Bookings can be canceled or rescheduled as per our Return &amp; Refund Policy</li>
            <li>Rescheduling is subject to availability</li>
            <li>Last-minute cancellations may incur charges</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Guest Responsibility</h2>
          <ul>
            <li>Customers must ensure accurate booking details</li>
            <li>Any damage to property during events may result in additional charges</li>
            <li>Guests are expected to follow restaurant rules and maintain decorum</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Food &amp; Service Policy</h2>
          <ul>
            <li>Outside food or beverages may not be allowed (unless approved)</li>
            <li>Menu selection for events must be finalized in advance</li>
            <li>Special dietary requirements should be informed prior to the event</li>
          </ul>
        </section>

        <section className="policy-section">
          <h2>Force Majeure</h2>
          <p>We are not liable for cancellations or delays caused by circumstances beyond our control (natural disasters, government restrictions, etc.).</p>
        </section>

        <section className="policy-section">
          <h2>Third-Party Links</h2>
          <p>Our website may contain links to third-party websites. We are not responsible for their privacy practices, so we encourage you to review their policies.</p>
        </section>

        <section className="policy-section contact-block">
          <h2>Contact Us</h2>
          <p>If you have any questions about our Booking Policy, please contact us:</p>
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