import ReservationForm from "./ReservationForm";
import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import CategoryModel from "@/models/Category";
import MenuItemModel from "@/models/MenuItem";
import BlogModel from "@/models/Blog";
import { fmtDate } from "@/lib/formatDate";
import BranchModel from "@/models/Branch";

type SpecialFeatureIcon = "quality" | "seasonal" | "fruit";

function SpecialFeatureIllustration({ type }: { type: SpecialFeatureIcon }) {
  if (type === "quality") {
    return (
      <svg viewBox="0 0 112 112" aria-hidden="true" focusable="false">
        <path className="feature-art-leaf" d="M33 50C20 43 20 29 27 20c11 4 17 14 13 27M45 47c-7-16 1-29 13-35 9 11 7 26-6 36" />
        <path className="feature-art-line" d="M30 24c5 7 7 14 7 24M57 18c-5 8-7 17-7 28" />
        <path className="feature-art-warm" d="M64 48c4-10 12-17 23-17 1 11-5 20-17 23" />
        <path className="feature-art-line" d="M73 49c3-6 8-10 14-13M22 52h68l-5 25c-2 10-11 17-21 17H48c-10 0-19-7-21-17l-5-25Z" />
        <path className="feature-art-soft" d="M30 59h52l-4 17c-2 7-8 11-15 11H49c-7 0-13-4-15-11l-4-17Z" />
        <path className="feature-art-line" d="M37 64c7 5 13 5 19 0 7 5 13 5 19 0M43 94h26M40 52c3-11 13-18 24-16 10 2 16 10 16 16" />
        <circle className="feature-art-dot" cx="67" cy="43" r="3" />
      </svg>
    );
  }

  if (type === "seasonal") {
    return (
      <svg viewBox="0 0 112 112" aria-hidden="true" focusable="false">
        <path className="feature-art-leaf" d="M55 26C40 25 34 15 34 7c13-2 23 4 26 17M58 25C61 12 71 7 83 9c-1 12-9 20-23 20" />
        <path className="feature-art-line" d="M56 26 43 14M58 26 75 15M57 26v22" />
        <path className="feature-art-soft" d="m28 49 29-17 29 17v26H28V49Z" />
        <path className="feature-art-line" d="m21 52 36-21 36 21M29 49v27h56V49M46 76V58h20v18M35 62h6M73 62h6" />
        <path className="feature-art-line" d="M13 88c16-10 30-10 43 0 13-10 27-10 43 0M17 98c15-9 28-9 39 0 12-9 25-9 40 0" />
        <path className="feature-art-warm" d="M84 76c3-8 9-11 16-10 0 7-5 12-13 13" />
        <circle className="feature-art-dot" cx="57" cy="65" r="2.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 112 112" aria-hidden="true" focusable="false">
      <path className="feature-art-leaf" d="M50 26C37 24 31 15 32 6c12-1 21 5 24 18M56 27c4-13 13-18 25-16-2 12-10 19-24 19" />
      <path className="feature-art-line" d="M54 28 42 14M56 28 73 16M55 27v17" />
      <circle className="feature-art-warm" cx="43" cy="61" r="24" />
      <path className="feature-art-line" d="M43 37a24 24 0 1 0 0 48 24 24 0 0 0 0-48Zm-10 11 3 3m15-5-2 4M31 63h4m12 10 3 3" />
      <path className="feature-art-fruit" d="M63 84c9-23 23-34 42-34-2 21-15 34-42 34Z" />
      <path className="feature-art-line" d="M64 84c9-23 22-34 41-34M75 78l4-4m8-6 4-4m4-7 3-2" />
      <path className="feature-art-seed" d="m83 76 2-4m8-4 2-4m-4 13 2-3" />
      <circle className="feature-art-dot" cx="38" cy="58" r="2.3" />
      <circle className="feature-art-dot" cx="49" cy="67" r="2.3" />
    </svg>
  );
}

export const metadata: Metadata = {
  title: "Damru By Namo | Restaurant & Banquet Hall, Jaipur",
  description:
    "Experience delicious food and an elegant banquet venue at Damru By Namo. Serving authentic Indian cuisine across Mansarovar, Vaishali Nagar, and Pratap Nagar, Jaipur.",
};

// This page has no dynamic per-request input (no searchParams/cookies used), so Next
// prerenders it once at build time and serves it statically forever after. That means a
// newly published blog or a newly added branch would never appear without a full redeploy.
// A 5-minute ISR revalidation window keeps the same static-speed serving while letting
// content go stale for at most 5 minutes instead of indefinitely.
export const revalidate = 300;

export default async function HomePage() {
  // ── Fetch Shakes menu items ──────────────────────────────────
  let shakeItems: { _id: string; name: string; description: string; image: string; basePrice: number }[] = [];
  let branches: { _id: string; name: string; slug: string; description: string; cardImage: string; cardAlt: string; contact: string; timing: string }[] = [];
  let blogs: { _id: string; title: string; slug: string; excerpt: string; coverImage: string; author: { name: string; avatar: string }; readTime: number; publishedAt: string; createdAt: string; category?: string }[] = [];

  try {
    await connectDB();

    // The Shakes lookup is inherently two dependent steps (find the category, then its
    // items), but it doesn't depend on blogs/branches or vice versa — run all three
    // independent reads in parallel instead of one long sequential chain.
    const [rawShakeItems, rawBlogs, rawBranches] = await Promise.all([
      (async () => {
        const shakesCat = await CategoryModel.findOne({ name: /shakes?/i, isActive: true }).select("_id").lean() as any;
        if (!shakesCat) return [];
        return MenuItemModel.find({ category: shakesCat._id, isActive: true })
          .select("name description image basePrice sortOrder")
          .sort({ sortOrder: 1 })
          .limit(4)
          .lean() as Promise<any[]>;
      })(),
      BlogModel.find({ status: "published" })
        .sort({ publishedAt: -1, createdAt: -1 })
        .limit(3)
        .select("title slug excerpt coverImage author readTime publishedAt createdAt category")
        .populate("category", "name")
        .lean() as Promise<any[]>,
      BranchModel.find({ isActive: true })
        .select("name slug description cardImage cardAlt contact timing sortOrder")
        .sort({ sortOrder: 1 })
        .lean() as Promise<any[]>,
    ]);

    shakeItems = rawShakeItems.map(i => ({
      _id: String(i._id), name: i.name, description: i.description || "",
      image: i.image || "", basePrice: i.basePrice || 0,
    }));
    blogs = rawBlogs.map(b => ({
      _id: String(b._id), title: b.title, slug: b.slug, excerpt: b.excerpt || "",
      coverImage: b.coverImage || "",
      author: { name: b.author?.name || "Damru By Namo", avatar: b.author?.image || b.author?.avatar || "" },
      readTime: b.readTime || 1,
      publishedAt: b.publishedAt ? String(b.publishedAt) : String(b.createdAt),
      createdAt: String(b.createdAt),
      category: b.category?.name || "",
    }));
    branches = rawBranches.map(b => ({
      _id: String(b._id), name: b.name, slug: b.slug,
      description: b.description || "",
      cardImage: b.cardImage || "", cardAlt: b.cardAlt || "",
      contact: b.contact || "", timing: b.timing || "",
    }));

  } catch (e) { console.error("Home page DB error:", e); }

  return (
    <main>

      {/* ── Hero Section ── */}
      <section className="hero">
        <div className="orange-bg-shape" />
        <div className="hero-container">

          {/* Left */}
          <div className="hero-left">
            <h4 className="sub-heading">Banquet | Restaurant</h4>
            <h1 className="main-heading">
              Delicious Food &amp; <br />
              Perfect Venue for Every <br />
              Occasion
            </h1>

            <div className="thumbnails">
              {[1, 2, 3, 4].map((n) => (
                <div
                  key={n}
                  className={`thumb${n === 1 ? " active" : ""}`}

                >
                  <img src={`/assets/images/plate${n}.png`} alt={`Dish ${n}`} />
                </div>
              ))}
            </div>

            <div className="hero-actions">
              <a href="#reservation" className="btn-book">Book a Table</a>
              <a href="/menu" className="btn-menu">
                View Menu <i className="ri-arrow-right-line" />
              </a>
            </div>
          </div>

          {/* Right — rotating wheel */}
          <div className="hero-right">
            <div className="wheel-container">
              <div className="orange-circle" id="wheel">
                {[1, 2, 3, 4].map((n) => (
                  <div key={n} className={`plate-item p${n}${n === 1 ? " active" : ""}`}>
                    <img src={`/assets/images/plate${n}.png`} alt={`Plate ${n}`} />
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Diet Interactive Section ── */}
      <section className="diet-interactive-section">
        <div className="di-container">

          {/* Left — Soup */}
          <div className="di-col di-left">
            <div className="di-card-wrapper">
              <div className="di-image-card">
                <img src="/assets/images/dietplan1.jpg" alt="Soup" className="di-base-img" />
                <div className="di-overlay di-overlay-right">
                  <div className="di-overlay-content">
                    <div className="di-icon">
                      <img src="/assets/images/soup.png" alt="Soup icon" />
                    </div>
                    <h3 className="di-card-title">Sweet Corn Soup</h3>
                    <p className="di-card-tags">Fresh • Creamy • Healthy</p>
                    <a href="/menu" className="di-explore-btn">Tap to Explore &rarr;</a>
                  </div>
                  <img src="/assets/images/chef1.png" alt="Chef" className="di-chef di-chef-right" />
                </div>
              </div>
            </div>
            <div className="di-text-bottom">
              <h2 className="di-main-heading">
                Start to plan <br />
                your diet today
              </h2>
              <p className="di-subtext">
                Explore our delicious range of pure vegetarian dishes, crafted
                with fresh ingredients and authentic flavors for every taste.
              </p>
            </div>
          </div>

          {/* Right — Drink */}
          <div className="di-col di-right">
            <div className="di-text-top">
              <p className="di-description">
                Indulge in a variety of delicious dishes, refreshing mocktails,
                and signature drinks designed to make every meal special.
              </p>
            </div>
            <div className="di-card-wrapper">
              <div className="di-image-card">
                <img src="/assets/images/dietplan2.jpg" alt="Drink" className="di-base-img" />
                <div className="di-overlay di-overlay-left">
                  <div className="di-overlay-content">
                    <div className="di-icon">
                      <img src="/assets/images/drink.png" alt="Drink icon" />
                    </div>
                    <h3 className="di-card-title">Tropical Sunrise</h3>
                    <p className="di-card-tags">Fresh • Fruity • Refreshing</p>
                    <a href="/menu" className="di-explore-btn">Tap to Explore &rarr;</a>
                  </div>
                  <img src="/assets/images/chef2.png" alt="Chef" className="di-chef di-chef-left" />
                </div>
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ── Menu Showcase Section — Dynamic from DB ── */}
      <section className="menu-section">
        <img src="/assets/images/menuleaf.png" alt="leaf decoration" className="ms-leaf-img" />
        <div className="ms-container">
          <div className="ms-header">
            <h2 className="ms-title">Our Menu</h2>
            <p className="ms-subtitle">
              A curated selection of our most loved dishes — crafted fresh, served with love.
            </p>
          </div>

          <div className="ms-list">
            {shakeItems.length > 0
              ? shakeItems.map((item, i) => (
                <div key={item._id} className={`ms-item${i % 2 !== 0 ? " ms-reverse" : ""}`}>
                  <div className="ms-content">
                    <div className="ms-price-row">
                      <span className="ms-line" />
                      <span className="ms-price">₹{item.basePrice}</span>
                    </div>
                    <h3 className="ms-item-name">{item.name}</h3>
                    <p className="ms-item-desc">{item.description}</p>
                    <div className="ms-btn-group">
                      <Link href="/menu" className="ms-order-btn">Order Now</Link>
                    </div>
                  </div>
                  <div className="ms-image-box">
                    {item.image
                      ? <img src={`/uploads/menu-items/${item.image}`} alt={item.name} />
                      : <img src="/assets/images/menu1.png" alt={item.name} />
                    }
                  </div>
                </div>
              ))
              : /* Fallback to static if no DB items */
              [
                { img: "menu1", name: "Belgian Chocolate Shake", desc: "Rich, velvety shake made with indulgent Belgian chocolate", price: "₹229" },
                { img: "menu2", name: "Belgian Hot Chocolate Shake", desc: "Rich Belgian chocolate blended into a smooth, indulgent shake", price: "₹269" },
                { img: "menu3", name: "Biscoff Frappe Shake", desc: "Creamy frappe blended with rich Biscoff indulgence", price: "₹349" },
                { img: "menu4", name: "Blur Berry Cheese Cake Shake", desc: "Creamy cheesecake blended with luscious blueberry sweetness", price: "₹375" },
              ].map((item, i) => (
                <div key={item.name} className={`ms-item${i % 2 !== 0 ? " ms-reverse" : ""}`}>
                  <div className="ms-content">
                    <div className="ms-price-row">
                      <span className="ms-line" />
                      <span className="ms-price">{item.price}</span>
                    </div>
                    <h3 className="ms-item-name">{item.name}</h3>
                    <p className="ms-item-desc">{item.desc}</p>
                    <div className="ms-btn-group">
                      <Link href="/menu" className="ms-order-btn">Order Now</Link>
                    </div>
                  </div>
                  <div className="ms-image-box">
                    <img src={`/assets/images/${item.img}.png`} alt={item.name} />
                  </div>
                </div>
              ))
            }
          </div>

          <div className="ms-footer">
            <Link href="/menu" className="ms-see-more">
              <span>See More</span>
              <i className="ri-arrow-right-line" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Banquet Hero Slider ── */}
      <section className="damru-hero-slider">
        <div className="slider-bg">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className={`slide${n === 1 ? " active" : ""}`}
              style={{ backgroundImage: `url('/assets/images/slide${n}.png')` }}
            />
          ))}
        </div>
        <div className="hero-content-wrapper">
          <div className="hero-card">
            <h1>Elegant Banquet Hall for Your Special Events</h1>
            <a href="/branches" className="explore-btn">
              Explore Now <span className="arrow">→</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── Our Branches — Dynamic from DB ── */}
      <section className="branches-section-3d">
        <div className="container">
          <div className="section-header">
            <h2>Our Branches</h2>
            <div className="header-line" />
            <p>Serving delicious food and unforgettable moments at multiple locations</p>
          </div>

          <div className="branches-grid-3d">
            {(branches.length > 0 ? branches : [
              { _id: "f1", name: "Damru By Namo (Mansarovar, Jaipur)", slug: "", description: "Our Mansarovar branch offers a perfect blend of great food and a spacious banquet hall, ideal for birthdays, family gatherings, and small celebrations.", cardImage: "", cardAlt: "", contact: "+91 XXXXX XXXXX", timing: "11:00 AM – 11:00 PM" },
              { _id: "f2", name: "Damru By Namo (Gandhipath, Vaishali, Jaipur)", slug: "", description: "Located in Vaishali Nagar, this branch is perfect for weddings, corporate events, and grand celebrations with modern facilities and expert catering.", cardImage: "", cardAlt: "", contact: "+91 XXXXX XXXXX", timing: "11:00 AM – 11:00 PM" },
              { _id: "f3", name: "Damru By Namo (Coaching Hub, Pratap Nagar, Jaipur)", slug: "", description: "Our Pratap Nagar branch offers a lively dining experience along with banquet services, making it ideal for student parties, birthdays, and casual events.", cardImage: "", cardAlt: "", contact: "+91 XXXXX XXXXX", timing: "11:00 AM – 11:00 PM" },
            ]).map((b, i) => {
              const cls = ["reveal-3d-left", "reveal-3d-center", "reveal-3d-right"][i] ?? "reveal-3d-left";
              const staticImgs = ["/assets/images/OB1.png", "/assets/images/OB2.png", "/assets/images/OB3.png"];
              const imgSrc = b.cardImage ? `/uploads/branches/${b.cardImage}` : (staticImgs[i] ?? staticImgs[0]);
              return (
                <div key={b._id} className={`branch-card-3d ${cls}`}>
                  <div className="branch-img-wrapper">
                    <img src={imgSrc} alt={b.cardAlt || b.name} />
                  </div>
                  <div className="branch-info">
                    <h3>{b.name}</h3>
                    <div className="dotted-divider" />
                    <p className="description">{b.description}</p>
                    <div className="contact-details">
                      {b.contact && <p><strong>Contact Us:</strong> {b.contact}</p>}
                      {b.timing && <p><strong>Timing:</strong> {b.timing}</p>}
                    </div>
                    {b.slug
                      ? <a href={`/branches/${b.slug}`} className="read-more-btn">Read More <span>→</span></a>
                      : <a href="/contact-us" className="read-more-btn">Contact Us <span>→</span></a>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Indo Chinese Section ── */}
      <section className="menu-section">
        <div className="container">
          <h2 className="menu-title">Indo Chinese</h2>
          <div className="menu-grid">
            {[
              { img: "IC1", name: "Paneer in Hot Garlic Sauce" },
              { img: "IC2", name: "Honey Chilli Potato" },
              { img: "IC3", name: "EOK Tossed Waterchestnut" },
              { img: "IC4", name: "Mushroom Chilli Dry" },
              { img: "IC5", name: "Spring Roll" },
              { img: "IC6", name: "Paneer 65" },
              { img: "IC7", name: "Crispy Corn" },
              { img: "IC8", name: "Paneer Kung Pao" },
              { img: "IC9", name: "Schezwan Vegetables in Hot" },
            ].map((d) => (
              <div key={d.name} className="menu-card bounce-reveal">
                <div className="food-img-wrapper">
                  <img src={`/assets/images/${d.img}.png`} alt={d.name} />
                </div>
                <div className="card-content">
                  <div className="bottom-row">
                    <h3 className="dish-name">{d.name}</h3>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Special Features + Blog Cards ── */}
      <section className="special-feature-section">
        <div className="container">
          <div className="special-features-showcase">
            <header className="special-features-header">
              <p className="special-features-eyebrow">What Makes Us Special</p>
              <h2>Crafted with Care, Served with Love</h2>
              <span className="special-heading-ornament" aria-hidden="true"><i /></span>
            </header>

            <div className="special-features-grid">
              {([
                {
                  icon: "quality",
                  title: "Premium Quality",
                  desc: "We use only the finest ingredients to deliver rich taste and top-notch quality in every bite.",
                },
                {
                  icon: "seasonal",
                  title: "Seasonal Vegetables",
                  desc: "Fresh, locally sourced seasonal vegetables for natural taste and maximum nutrition.",
                },
                {
                  icon: "fruit",
                  title: "Fresh Fruit",
                  desc: "Handpicked fresh fruits to ensure purity, sweetness, and refreshing flavor every time.",
                },
              ] satisfies { icon: SpecialFeatureIcon; title: string; desc: string }[]).map((feature, index) => (
                <article key={feature.title} className="special-feature-item">
                  <div className="special-feature-icon-wrap">
                    <div className="special-feature-icon-arch">
                      <SpecialFeatureIllustration type={feature.icon} />
                      <span className="feature-sparkle feature-sparkle-one" aria-hidden="true">&#10022;</span>
                      <span className="feature-sparkle feature-sparkle-two" aria-hidden="true">&#10022;</span>
                    </div>
                    <span className="special-feature-number" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3>{feature.title}</h3>
                  <span className="special-feature-ornament" aria-hidden="true"><i /></span>
                  <p>{feature.desc}</p>
                </article>
              ))}
            </div>
          </div>

          <h2 className="menu-title">Our Blogs</h2>

          {/* Blog cards — dynamic from DB, fallback to static */}
          <div className="blog-grid-3d">
            {(blogs.length > 0 ? blogs : [
              { _id: "f1", slug: "", title: "Fruit and vegetables and protection against diseases", excerpt: "A healthy blend of fresh fruits and vegetables packed with nutrients that support immunity and overall well-being.", coverImage: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800", author: { name: "Damru By Namo", avatar: "https://i.pravatar.cc/150?img=32" }, readTime: 3, publishedAt: "", createdAt: "", category: "Healthy Food" },
              { _id: "f2", slug: "", title: "Asparagus Spring Salad with Rocket, Goat's Cheese", excerpt: "A refreshing spring salad combining crisp greens, creamy cheese, and vibrant flavors for a light yet satisfying dish.", coverImage: "https://images.unsplash.com/photo-1528735602780-2552fd46c7af?w=800", author: { name: "Damru By Namo", avatar: "https://i.pravatar.cc/150?img=44" }, readTime: 2, publishedAt: "", createdAt: "", category: "Special Dish" },
              { _id: "f3", slug: "", title: "Damru Special Mushroom Cheese Burger", excerpt: "A juicy mushroom patty layered with melted cheese and fresh toppings, delivering a rich and indulgent bite.", coverImage: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=800", author: { name: "Damru By Namo", avatar: "https://i.pravatar.cc/150?img=47" }, readTime: 4, publishedAt: "", createdAt: "", category: "Special Dish" },
            ]).map((b, i) => {
              const cls = ["reveal-3d-left", "reveal-3d-center", "reveal-3d-right"][i] ?? "reveal-3d-left";
              const imgSrc = b.coverImage.startsWith("http") ? b.coverImage : `/uploads/blogs/${b.coverImage}`;
              const avatarSrc = !b.author.avatar ? "https://i.pravatar.cc/150?img=32" : b.author.avatar.startsWith("http") ? b.author.avatar : `/uploads/authors/${b.author.avatar}`;
              const dateStr = fmtDate(b.publishedAt || b.createdAt);
              return (
                <div key={b._id} className={`blog-card ${cls}`}>
                  <div className="blog-img-wrapper">
                    <img src={imgSrc} alt={b.title} />
                    {b.category && <span className="special-tag">{b.category}</span>}
                  </div>
                  <div className="blog-info">
                    <div className="author-meta">
                      <img src={avatarSrc} alt={b.author.name} className="author-img" />
                      <span>{b.author.name}{dateStr ? ` • ${dateStr}` : ""} • {b.readTime} min read</span>
                    </div>
                    <h3>{b.title}</h3>
                    <div className="dotted-divider" />
                    <p className="blog-desc">{b.excerpt}</p>
                    <Link href={b.slug ? `/blogs/${b.slug}` : "/blogs"} className="read-more-link">Read More <span>→</span></Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Excellent Cook Section ── */}
      <section className="excellent-cook-section">
        <div className="leaf-container leaf-top">
          <img src="/assets/images/Leafa.png" alt="leaf" className="leaf-3d-ani" />
        </div>
        <div className="container cook-flex">
          <div className="chef-side">
            <img src="/assets/images/Excelentcook.png" alt="Excellent Cook" className="chef-static-img" />
          </div>
          <div className="cook-content">
            <span className="cook-eyebrow">Crafted with care</span>
            <h2 className="excellent-title">
              Excellence in <br />every plate
            </h2>
            <p className="excellent-desc">
              Our expert chefs bring passion and precision to every dish,
              carefully selecting the finest ingredients and crafting each
              recipe with dedication. From preparation to presentation, every
              step is handled with attention to detail to ensure rich flavors,
              perfect taste, and consistent quality. Their commitment to
              excellence transforms every meal into a delightful and memorable
              dining experience for every customer.
            </p>
            <Link href="/menu" className="cook-menu-link">
              Explore our menu <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
        <div className="leaf-container leaf-bottom">
          <img src="/assets/images/Leafb.png" alt="leaf" className="leaf-3d-ani" />
        </div>
      </section>

      {/* ── Reservation Section ── */}
      <section className="reservation-section" id="reservation">
        <div className="res-container">
          <div className="res-header-content">
            <h2 className="res-main-title">Make a Reservation</h2>
            <p className="res-sub-text">Get in touch with restaurant</p>
          </div>
          <ReservationForm />
        </div>
      </section>

      {/* ── Taste Through The Lens ── */}
      <section className="lens-section">
        <div className="lens-container">
          <div className="lens-header lens-reveal">
            <h2>Taste Through <br />The Lens</h2>
            <p>Explore the flavors, colors, and creativity behind every dish we serve.</p>
          </div>
          <div className="lens-grid">
            {[
              { img: "/assets/images/dietplan2.jpg", label: "Starters" },
              { img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800", label: "Mains" },
              { img: "https://images.unsplash.com/photo-1547592166-23ac45744acd?w=800", label: "Soups" },
            ].map((g) => (
              <div key={g.label} className="lens-card lens-reveal">
                <img src={g.img} alt={g.label} className="lens-img" />
                <div className="lens-vignette" />
                <div className="lens-content">
                  <h3 className="lens-title">{g.label}</h3>
                  {/* <span className="lens-arrow">→</span> */}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="testimonial-section">
        <h2 className="menu-title">What our client say's</h2>
        <div className="testi-container">
          <div className="testi-content-wrapper">
            <div className="testi-left">
              <p className="testi-text" id="testi-text">
                One of the best dining experiences I&apos;ve had recently. The food
                quality is top-notch, and the taste is consistent in every bite.
                The service is fast, and the team ensures you feel comfortable
                throughout your visit. I will definitely visit again!
              </p>
              <div className="testi-user">
                <div className="testi-avatar">
                  <img src="https://i.pravatar.cc/150?img=32" alt="Deepika Bhardwaj" id="testi-img" />
                </div>
                <div className="testi-details">
                  <h4 id="testi-name">Deepika Bhardwaj</h4>
                  <p id="testi-role">Lawyer</p>
                </div>
              </div>
            </div>
            <div className="testi-right">
              <div className="testi-quote-icons"><span>&ldquo;</span></div>
              <div className="testi-nav">
                <button className="testi-prev">←</button>
                <span className="testi-counter">
                  <span id="current-index">1</span> / <span id="total-slides">3</span>
                </span>
                <button className="testi-next">→</button>
              </div>
            </div>
          </div>
        </div>
      </section>

    </main>
  );
}
