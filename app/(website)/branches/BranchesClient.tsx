"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef } from "react";

export function BranchesClient({ items }: { items: any[] }) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const cardsRef = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const cards = cardsRef.current.filter(card => card !== null);
    
    if (cards.length === 0) return;
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const card = entry.target as HTMLElement;
            const idx = cards.indexOf(card);
            setTimeout(() => {
              card.classList.add('visible');
            }, idx * 150);
            observerRef.current?.unobserve(card);
          }
        });
      },
      { threshold: 0.12 }
    );
    
    cards.forEach(card => {
      observerRef.current?.observe(card);
    });
    
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [items]);

  return (
    <div className="banquet__grid">
      {items.map((b: any, i: number) => {
        const imgSrc = b.cardImage
          ? `/uploads/branches/${b.cardImage}`
          : (b.staticImg || "/assets/images/OB1.png");
        const href = b.slug ? `/branches/${b.slug}` : "/contact-us";

        return (
          <article
            key={b._id}
            className="banquet__card"
            ref={(el) => { cardsRef.current[i] = el; }}
          >
            <div className="banquet__card-img-wrap" style={{ position: "relative" }}>
              <Link href={href} style={{ display: "block", width: "100%", height: "100%", position: "relative" }}>
                <Image
                  src={imgSrc}
                  alt={b.name}
                  fill
                  sizes="(max-width: 768px) 100vw, 33vw"
                  style={{ objectFit: "cover" }}
                />
              </Link>
            </div>
            <div className="banquet__card-body">
              <h3 className="banquet__card-title">
                <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>
                  {b.name}
                </Link>
              </h3>
              <div className="banquet__card-divider">
                {Array.from({ length: 10 }).map((_, j) => <span key={j} />)}
              </div>
              <p className="banquet__card-desc">{b.description}</p>
              <div className="banquet__card-meta">
                {b.contact && <span><strong>Contact Us:</strong> {b.contact}</span>}
                {b.timing && <span><strong>Timing:</strong> {b.timing}</span>}
              </div>
              <Link href={href} className="banquet__read-more">
                Read More
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </article>
        );
      })}
    </div>
  );
}