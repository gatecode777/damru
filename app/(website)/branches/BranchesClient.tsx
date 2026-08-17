"use client";

import Link from "next/link";
import Image from "next/image";
import { Clock3, MapPin, Phone } from "lucide-react";

export interface BranchListItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  contact?: string;
  timing?: string;
  address?: string;
  cardImage?: string;
  staticImg?: string;
}

export function BranchesClient({ items }: { items: BranchListItem[] }) {
  return (
    <div className="banquet__grid" aria-label="Damru and Namo branch locations">
      {items.map((b, i) => {
        const imgSrc = b.cardImage ? `/uploads/branches/${b.cardImage}` : (b.staticImg || `/assets/images/OB${(i % 3) + 1}.png`);
        const href = b.slug ? `/branches/${b.slug}` : "/contact-us";
        return <article key={b._id} className="banquet__card">
        <div className="banquet__card-img-wrap" style={{ position: "relative" }}>
          <Link href={href} style={{ display: "block", width: "100%", height: "100%", position: "relative" }}>
            <Image src={imgSrc} alt={b.name} fill sizes="(max-width: 680px) 100vw, (max-width: 1080px) 50vw, 33vw" style={{ objectFit: "cover" }} />
          </Link>
        </div>
        <div className="banquet__card-body">
          <h3 className="banquet__card-title">
            <Link href={href} style={{ textDecoration: "none", color: "inherit" }}>{b.name}</Link>
          </h3>
          <div className="banquet__card-divider">{Array.from({ length: 10 }).map((_, j) => <span key={j} />)}</div>
          <p className="banquet__card-desc">{b.description}</p>
          <div className="banquet__card-meta">
            {b.address && <span className="banquet__meta-row"><span className="banquet__meta-icon" aria-hidden="true"><MapPin size={13} /></span><span>{b.address}</span></span>}
            {b.contact && <span className="banquet__meta-row"><span className="banquet__meta-icon" aria-hidden="true"><Phone size={12} /></span><span>{b.contact}</span></span>}
            {b.timing && <span className="banquet__meta-row"><span className="banquet__meta-icon" aria-hidden="true"><Clock3 size={13} /></span><span>{b.timing}</span></span>}
          </div>
          <Link href={href} className="banquet__read-more">
            Read More
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
          </Link>
        </div>
      </article>;
      })}
    </div>
  );
}
