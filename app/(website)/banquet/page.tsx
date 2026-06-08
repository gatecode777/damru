import type { Metadata } from "next";
import Link from "next/link";
import BanquetForm from "./BanquetForm";

export const metadata: Metadata = {
  title: "Banquet Hall | Damru By Namo",
  description: "Book our elegant banquet hall in Mansarovar, Jaipur for birthdays, weddings, anniversaries, and corporate events. Explore facilities, capacities, and event packages.",
  keywords: ["banquet hall jaipur", "party hall mansarovar", "wedding venue jaipur", "birthday party hall jaipur"],
};

export default function BanquetPage() {
  return (
    <div className="banquet">
      <section className="hero-section"></section>

      {/* SECTION 2: DESCRIPTION & EVENT TYPES */}
      <section className="intro-section">
        <p className="intro-text">
          Our elegant banquet hall is designed to host unforgettable events with
          premium decor, delicious food, and exceptional service.
        </p>
        <ul className="intro-bullets">
          <li>Capacity (50-300 guests)</li>
          <li>Indoor / Outdoor space</li>
          <li>AC / Decoration availability</li>
        </ul>

        <h2 className="section-title">Event Types We Host</h2>
        <div className="event-grid">
          <div className="event-card">
            <img src="/assets/images/a1.png" alt="Birthday" />
            <p>Birthday Parties</p>
          </div>
          <div className="event-card">
            <img src="/assets/images/a2.png" alt="Wedding" />
            <p>Wedding & Pre-Wedding Functions</p>
          </div>
          <div className="event-card">
            <img src="/assets/images/a3.png" alt="Corporate" />
            <p>Corporate Events</p>
          </div>
          <div className="event-card">
            <img src="/assets/images/a4.png" alt="Anniversary" />
            <p>Anniversary Celebrations</p>
          </div>
          <div className="event-card">
            <img src="/assets/images/a5.png" alt="Small Gatherings" />
            <p>Small Gatherings</p>
          </div>
        </div>
      </section>

      {/* SECTION 3: BANQUET FEATURES */}
      <section className="features-section">
        <h2 className="section-title">Banquet Features</h2>
        <div className="features-container">
          <div className="feature-item">
            <img src="/assets/images/b1.png" alt="Feature" />
            <p>Spacious Hall</p>
          </div>
          <div className="feature-item">
            <img src="/assets/images/b2.png" alt="Feature" />
            <p>Beautiful Decoration</p>
          </div>
          <div className="feature-item">
            <img src="/assets/images/b3.png" alt="Feature" />
            <p>Air Conditioning</p>
          </div>
          <div className="feature-item">
            <img src="/assets/images/b4.png" alt="Feature" />
            <p>Power Backup</p>
          </div>
          <div className="feature-item">
            <img src="/assets/images/b5.png" alt="Feature" />
            <p>Custom Theme Setup</p>
          </div>
          <div className="feature-item">
            <img src="/assets/images/b6.png" alt="Feature" />
            <p>Parking Facility</p>
          </div>
          <div className="feature-item">
            <img src="/assets/images/b7.png" alt="Feature" />
            <p>DJ & Music System</p>
          </div>
          <div className="feature-item">
            <img src="/assets/images/b8.png" alt="Feature" />
            <p>Catering Services</p>
          </div>
        </div>
      </section>

      {/* SECTION 4: OUR EVENT VENUES */}
      <section className="venues-section">
        <h2 className="section-title">Our Event Venues</h2>
        <div className="venues-grid">
          {/* Venue 1 */}
          <div className="venue-card">
            <img src="/assets/images/c1.png" alt="Venue" />
            <div className="venue-info">
              <p><span>Capacity:</span> Up to 200 Guests</p>
              <p><span>Size:</span> Spacious Indoor Hall</p>
              <p><span>Features:</span> AC | Decoration | DJ</p>
              <button className="book-btn">Book Now</button>
            </div>
          </div>
          {/* Venue 2 */}
          <div className="venue-card">
            <img src="/assets/images/c2.png" alt="Venue" />
            <div className="venue-info">
              <p><span>Capacity:</span> Up to 200 Guests</p>
              <p><span>Size:</span> Spacious Indoor Hall</p>
              <p><span>Features:</span> AC | Decoration | DJ</p>
              <button className="book-btn">Book Now</button>
            </div>
          </div>
          {/* Venue 3 */}
          <div className="venue-card">
            <img src="/assets/images/c3.png" alt="Venue" />
            <div className="venue-info">
              <p><span>Capacity:</span> Up to 200 Guests</p>
              <p><span>Size:</span> Spacious Indoor Hall</p>
              <p><span>Features:</span> AC | Decoration | DJ</p>
              <button className="book-btn">Book Now</button>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 5: EXTERIOR VIEW */}
      <section className="exterior-view">
        <img src="/assets/images/slide1.png" alt="Exterior View" />
      </section>

      {/* SECTION 6: BOOKING FORM */}
      <section className="booking-form-section">
        <h2 className="section-title">Plan Your Special Event</h2>
        <p>
          Fill in your details and let us make your celebration truly special.
        </p>
        <BanquetForm />
      </section>
    </div>
  );
}