import type { Metadata } from "next";
import "@/styles/website/aboutus.css";
import Link from "next/link";
import ReservationForm from "../ReservationForm";

export const metadata: Metadata = {
  title: "About Us | Damru By Namo",
  description: "Learn about the story of Damru By Namo, founded by Raja Choudhary, with Sandeep Rana as our Executive Chef. Explore our sophisticated food preparation process in Jaipur.",
  keywords: ["about damru", "raja choudhary damru", "Sandeep rana chef", "restaurant history jaipur"],
};

export default function AboutUsPage() {
  return (
    <div className="aboutus">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-overlay"></div>
        <div className="hero-container">
          <div className="who-we-are-card">
            <h1>Who We Are</h1>
            <p>The most important thing for us is to give you the comfortable dining experience</p>
          </div>
        </div>
      </section>

      {/* Our story section */}
      <section className="story-section">
        <div className="story-container">
          <div className="story-content">
            <h2>About Us</h2>
            <p>
              Welcome to डमरू (Damru) — where pure vegetarian food meets warmth, quality, and timeless hospitality.<br />
              At Damru, our vision is simple: to serve fresh, pure, and delicious vegetarian cuisine at affordable prices without compromising on quality or experience. We believe that great food should be accessible to everyone, served in an elegant and welcoming environment that makes every visit memorable.<br />
              Every dish is prepared using carefully selected ingredients, authentic recipes, and uncompromising hygiene standards. Whether you're joining us for a family dinner, a casual outing with friends, or a special celebration, we strive to create an experience that combines exceptional taste, heartfelt service, and a premium ambience.<br />
              At Damru, we don't just serve meals—we create moments where every guest enjoys purity, quality, comfort, and value, all under one roof.
              Pure Taste. Premium Experience. Honest Value
            </p>
          </div>

          <div className="story-image">
            <img src="/assets/images/ourstory.png" alt="Our Story Chef" />
          </div>
        </div>
      </section>

      {/* Team section */}
      <section className="team-section">
        <div className="team-container">
          <div className="member-row">
            <div className="member-image-col">
              <div className="member-title-box">
                <h2>Founder</h2>
                <p className="name">Raja Choudhary</p>
              </div>
              <div className="image-relative">
                <img src="/assets/images/abtusflower.png" alt="" className="deco-art art-founder" />
                <img src="/assets/images/raja.png" alt="Founder" className="main-photo" />
              </div>
            </div>
            <div className="member-text-col">
              <p>
                Raja Chaudhary is the heart and vision behind our restaurant—a passionate entrepreneur who
                believes that food is more than just a meal; it is an experience that connects people,
                emotions, and memories. His journey began with a simple yet powerful idea: to create a space
                where guests can enjoy not only great food but also warmth, comfort, and a sense of
                belonging.
              </p>
              <p>
                With a keen eye for detail and an uncompromising commitment to quality, Raj has carefully
                shaped every element of the restaurant—from the thoughtfully curated menu to the inviting
                ambiance and personalized service. His philosophy is rooted in authenticity, ensuring that
                every dish reflects genuine flavors while embracing modern culinary trends.
              </p>
              <p>
                Through dedication, innovation, and a deep understanding of customer expectations, he has
                built a brand that stands for trust, taste, and excellence. His continuous pursuit of
                perfection inspires the entire team to deliver exceptional dining experiences, making every
                visit memorable and worth returning for.
              </p>
            </div>
          </div>

          <div className="member-row reverse">
            <div className="member-image-col">
              <div className="member-title-box text-right">
                <h2>Executive Chef</h2>
                <p className="name">Sandeep Rana</p>
              </div>
              <div className="image-relative">
                <img src="/assets/images/abtusflower.png" alt="" className="deco-art art-chef" />
                <img src="/assets/images/sandeep.png" alt="Executive Chef" className="main-photo" />
              </div>
            </div>
            <div className="member-text-col">
              <p>
                Chef Sandeep Rana is the creative soul of our kitchen, bringing passion, artistry, and years
                of culinary expertise to every dish he creates. For him, cooking is not just a profession—it
                is a form of expression where flavors, textures, and presentation come together to tell a
                story on every plate.
              </p>
              <p>
                With a strong foundation in traditional techniques and a flair for innovation, Chef Sandeep
                masterfully blends classic recipes with contemporary influences. He believes in respecting
                ingredients, using only the freshest produce, and enhancing their natural flavors through
                carefully balanced spices and cooking methods.
              </p>
              <p>
                His dedication to excellence is reflected in every detail—from the aroma of freshly prepared
                dishes to the visual appeal of each presentation. Constantly experimenting and evolving, he
                ensures the menu remains exciting, refined, and satisfying for every guest. Under his
                guidance, the kitchen operates with precision, consistency, and a shared passion for
                delivering unforgettable culinary experiences.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="delicious-section">
        <video
          className="delicious-video-bg"
          autoPlay
          loop
          muted
          playsInline
        >
          <source src="/assets/videos/Cinematic Food Video.mp4" type="video/mp4" />
          Your browser does not support the video tag.
        </video>
        <div className="delicious-content">
          <h2 className="delicious-title">It looks delicious</h2>
          <p className="delicious-subtitle">Experience flavors that look as good as they taste.</p>
        </div>
      </section>

      <section className="process-section">
        <img src="/assets/images/rosemary.png" alt="" className="process-leaf leaf-top-right" />
        <img src="/assets/images/rosemary (1).png" alt="" className="process-leaf leaf-bottom-left" />

        <div className="process-container">
          <h2 className="section-main-title">Sophisticated Process</h2>

          <div className="process-row">
            <div className="process-img">
              <img src="/assets/images/slice.png" alt="Slice" />
            </div>
            <div className="process-text">
              <h3>01.Slice</h3>
              <p>
                Fresh vegetables are carefully selected and precisely sliced to maintain their natural
                texture, color, and nutrients. Every cut is done with care to ensure consistency and enhance
                the overall presentation of the dish.
              </p>
            </div>
          </div>

          <div className="process-row reverse">
            <div className="process-img">
              <img src="/assets/images/marinated.png" alt="Marinated" />
            </div>
            <div className="process-text">
              <h3>02.Marinated</h3>
              <p>
                The vegetables are gently marinated with a blend of aromatic herbs, spices, and house-made
                sauces. This step allows flavors to infuse deeply, creating a rich and balanced taste in
                every bite.
              </p>
            </div>
          </div>

          <div className="process-row">
            <div className="process-img">
              <img src="/assets/images/bake.png" alt="Bake" />
            </div>
            <div className="process-text">
              <h3>03.Bake</h3>
              <p>
                Marinated ingredients are slow-cooked or baked to perfection, bringing out their natural
                sweetness and smoky flavors while maintaining a soft and delicious texture.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Make a Reservation Section */}
      <section className="reservation-section" id="reservation">
        <div className="res-container">
          <div className="res-header-content">
            <h2 className="res-main-title">Make a Reservation</h2>
            <p className="res-sub-text">Get in touch with restaurant</p>
          </div>

          <ReservationForm />
        </div>
      </section>
    </div>
  );
}