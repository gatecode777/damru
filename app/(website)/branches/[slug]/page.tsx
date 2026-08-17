import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import Branch from "@/models/Branch";
import BanquetBookingForm from "./BanquetBookingForm";
import BranchDetailAnimate from "@/components/website/BranchDetailAnimate";
import "@/styles/website/banquetdetail.css";
import "@/styles/website/branch-detail-page.css";

interface BranchEventType { label: string; image?: string }
interface BranchHallCard {
  title: string;
  subtitle?: string;
  description?: string;
  features?: string[];
  perfectFor?: string[];
  images?: string[];
  sortOrder: number;
}
interface BranchPageData {
  name: string;
  slug: string;
  description?: string;
  contact?: string;
  timing?: string;
  address?: string;
  bannerImage?: string;
  bannerAlt?: string;
  cardImage?: string;
  cardAlt?: string;
  offerItems?: string[];
  whyChoose?: string;
  eventTypes?: BranchEventType[];
  hallCards?: BranchHallCard[];
  ctaTitle?: string;
  ctaSubtitle?: string;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    await connectDB();
    const b = await Branch.findOne({ slug, isActive: true }).select("name description").lean() as unknown as Pick<BranchPageData, "name" | "description"> | null;
    if (!b) return { title: "Branch Not Found" };
    return { title: `${b.name} | Damru By Namo`, description: b.description };
  } catch { return { title: "Branch | Damru By Namo" }; }
}

export async function generateStaticParams() {
  try {
    await connectDB();
    const branches = await Branch.find({ isActive: true }).select("slug").lean();
    return (branches as unknown as Array<Pick<BranchPageData, "slug">>).map((b) => ({ slug: b.slug }));
  } catch { return []; }
}

export default async function BranchDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let b: BranchPageData | null = null;
  try {
    await connectDB();
    b = JSON.parse(JSON.stringify(await Branch.findOne({ slug, isActive: true }).lean())) as BranchPageData | null;
  } catch { notFound(); }
  if (!b) notFound();

  const hallCards = [...(b.hallCards || [])].sort((a, x) => a.sortOrder - x.sortOrder);
  const hasBranchImage = Boolean(b.cardImage);

  return (
    <div className="branch-detail-page">
      {/* SECTION 1 — HERO BANNER */}
      <section className="banqplace__hero">
        <Image
          className="banqplace__hero-img"
          src="/assets/images/banquethero.jpg"
          alt="Damru restaurant dining table and chairs"
          fill
          priority
          sizes="100vw"
        />
        <div className="banqplace__hero-overlay" />
      </section>

      {/* SECTION 2 — BRANCH INTRO */}
      <section className="banqplace__intro">
        <div className={`banqplace__intro-grid${hasBranchImage ? "" : " banqplace__intro-grid--text-only"}`}>
          <div className="banqplace__intro-left">
            <h1 className="banqplace__branch-title reveal">{b.name}</h1>
            <div className="banqplace__divider" />
            {b.description && <p className="banqplace__branch-desc reveal">{b.description}</p>}
            {(b.contact || b.timing) && (
              <div className="banqplace__meta reveal">
                {b.contact && (
                  <div className="banqplace__meta-row">
                    <strong>Contact Us:</strong>
                    <span>{b.contact}</span>
                  </div>
                )}
                {b.timing && (
                  <div className="banqplace__meta-row">
                    <strong>Timing:</strong>
                    <span>{b.timing}</span>
                  </div>
                )}
                {b.address && (
                  <div className="banqplace__meta-row banqplace__meta-row--address">
                    <strong>Address:</strong>
                    <span>{b.address}</span>
                  </div>
                )}
              </div>
            )}
            {b.offerItems?.length > 0 && (
              <>
                <h2 className="banqplace__offer-heading reveal">What We Offer</h2>
                <ul className="banqplace__offer-list reveal">
                  {b.offerItems.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {b.cardImage && (
            <div className="banqplace__intro-img reveal-right" style={{ position: "relative" }}>
              <Image
                src={`/uploads/branches/${b.cardImage}`}
                alt={b.cardAlt || b.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                style={{ objectFit: "cover" }}
              />
            </div>
          )}
        </div>
        {b.whyChoose && (
          <div className="banqplace__why reveal">
            <h2 className="banqplace__why-heading">Why Choose Damru?</h2>
            <p>{b.whyChoose}</p>
          </div>
        )}
      </section>

      {/* SECTION 3 — EVENT TYPES */}
      {b.eventTypes?.length > 0 && (
        <section className="banqplace__events">
          <div className="banqplace__events-inner">
            <h2 className="banqplace__section-heading reveal">Event Types We Host</h2>
            <div className="banqplace__events-grid">
              {b.eventTypes.map((ev, i) => (
                <div key={i} className="banqplace__event-card" data-delay={String(i * 120)}>
                  <div className="banqplace__event-img-wrap">
                    {ev.image ? (
                      <img src={`/uploads/branches/${ev.image}`} alt={ev.label} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", background: "#e5e7eb" }} />
                    )}
                  </div>
                  <span className="banqplace__event-label">{ev.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* SECTIONS 4+ — HALL CARDS (alternating bg) */}
      {hallCards.map((hall, i) => {
        const isAlt = i % 2 !== 0;
        const SectionClass = isAlt ? "banqplace__multi" : "banqplace__bday";
        const GridClass = isAlt ? "banqplace__multi-grid" : "banqplace__bday-grid";
        return (
          <section key={i} className={SectionClass}>
            <div className={isAlt ? "banqplace__multi-inner" : ""}>
              <div className={GridClass}>
                <div>
                  <h2 className="banqplace__content-title reveal">{hall.title}</h2>
                  {hall.subtitle && <p className="banqplace__content-subtitle">{hall.subtitle}</p>}
                  {hall.description && <p className="banqplace__content-body reveal">{hall.description}</p>}
                  {hall.features?.length > 0 && (
                    <>
                      <p className="banqplace__features-title">Features &amp; Facilities</p>
                      <ul className="banqplace__bullet-list reveal">
                        {hall.features.map((f: string, j: number) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </>
                  )}
                  {hall.perfectFor?.length > 0 && (
                    <>
                      <p className="banqplace__features-title" style={{ marginTop: "1.25rem" }}>
                        Perfect For
                      </p>
                      <ul className="banqplace__bullet-list reveal">
                        {hall.perfectFor.map((f: string, j: number) => (
                          <li key={j}>{f}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {hall.images?.length > 0 && (
                  <div className="banqplace__img-overlap reveal-right">
                    <img
                      className="img-back"
                      src={`/uploads/branches/${hall.images[0]}`}
                      alt={`${hall.title} – view 1`}
                    />
                    {hall.images[1] && (
                      <img
                        className="img-front"
                        src={`/uploads/branches/${hall.images[1]}`}
                        alt={`${hall.title} – view 2`}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </section>
        );
      })}

      {/* BOOKING / CTA */}
      <BanquetBookingForm
        branchSlug={b.slug}
        branchName={b.name}
        ctaTitle={b.ctaTitle}
        ctaSubtitle={b.ctaSubtitle}
      />
      <BranchDetailAnimate />
    </div>
  );
}
