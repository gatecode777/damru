"use client";

import { useEffect } from "react";

export default function BranchDetailAnimate() {
  useEffect(() => {
    const sel = ['.reveal', '.reveal-left', '.reveal-right', '.banqplace__event-card', '.banqplace__img-overlap'];
    const all = document.querySelectorAll(sel.join(','));
    
    document.querySelectorAll('.banqplace__event-card').forEach((c, i) => {
      (c as HTMLElement).setAttribute('data-delay', String(i * 120));
    });
    
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const d = parseInt(el.getAttribute('data-delay') || '0');
            setTimeout(() => { el.classList.add('visible'); }, d);
            io.unobserve(el);
          }
        });
      },
      { threshold: 0.1 }
    );
    
    all.forEach((el) => { io.observe(el); });
    return () => { io.disconnect(); };
  }, []);

  return null;
}
