import type { Metadata } from "next";
import ReservationForm from "../ReservationForm";

export const metadata: Metadata = {
  title: "Contact Us | Damru By Namo",
  description: "Get in touch with Damru By Namo. Find our location in Mansarovar, Jaipur, contact numbers, email, opening hours, or make a table reservation.",
  keywords: ["contact damru", "restaurant location jaipur", "table reservation jaipur", "damru by namo phone"],
};

export default function ContactUsPage() {
  return (
    <div className="contact">
      <section className="contact-hero">
        <div className="hero-overlay"></div>
        <div className="hero-container">
          <div className="hero-left">
            <h1>Get in Touch</h1>
            <p>The freshest ingredients for you every day</p>
          </div>
          <div className="hero-right">
            <div className="open-time-section">
              <div className="open-header">
                <h2>Open Time </h2>
                <span className="days"> Sunday - Saturday</span>
              </div>
              <div className="dotted-divider"></div>
              <div className="time-grid">
                <div className="time-item">
                  <label>Brunch</label>
                  <span className="time-val">11:00-13:00</span>
                </div>
                <div className="time-item">
                  <label>Lunch</label>
                  <span className="time-val">13:00-18:00</span>
                </div>
                <div className="time-item">
                  <label>Dinner</label>
                  <span className="time-val">18:00-20:00</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="info-section">
        <div className="info-container">
          <div className="info-row">
            <div className="info-img-col">
              <img src="/assets/images/contactflower.png" alt="" className="orange-art-deco" />
              <img src="/assets/images/contact1.png" alt="Contact" className="main-info-img" />
            </div>
            <div className="info-text-col">
              <p>
                We can be contacted via email{" "}
                <a href="mailto:thedamru72@gmail.com">thedamru72@gmail.com</a>,{" "}
                <a href="mailto:support@damrubynamo.com">support@damrubynamo.com</a> or
                telephone on <a href="tel:+918690987272">+91-8690987272</a>,{" "}
              </p>
            </div>
          </div>

          <div className="info-row reverse">
            <div className="info-img-col">
              <img src="/assets/images/contact2.png" alt="Location" className="main-info-img" />
            </div>
            <div className="info-text-col">
              <h3>We are located in Vinayak sarovar, Plot No. A-96, Patrakar Colony Rd, Sheer Sagar Patarkar Colony, Choraha, Mansarovar, Jaipur, Rajasthan 302020</h3>
              <a href="https://maps.app.goo.gl/tt59VvyxGfycJEMk8" target="_blank" rel="noopener noreferrer" className="map-btn">View in maps</a>
            </div>
          </div>
        </div>
      </section>

      <section className="reservation-section" id="reservation">
        <div className="res-container">
          <div className="res-header-content">
            <div className="res-main-title">
              <h2>Make a Reservation</h2>
            </div>
            <p className="res-sub-text">Get in touch with the restaurant</p>
          </div>
          <ReservationForm />
        </div>
      </section>
    </div>
  );
}