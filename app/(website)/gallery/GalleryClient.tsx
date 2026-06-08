"use client";

import { useState } from "react";
import Link from "next/link";

const PAGE_SIZE = 10;

interface GalleryItem {
  _id: string; image: string; alt: string; title: string;
  description: string; type: string; overlayClass: string; sortOrder: number;
}
interface GalleryTab {
  _id: string; tabKey: string; label: string;
  bannerImage: string; bannerAlt: string;
  isActive: boolean; sortOrder: number;
  items: GalleryItem[];
}

interface GalleryClientProps {
  initialTabs: GalleryTab[];
}

export default function GalleryClient({ initialTabs }: GalleryClientProps) {
  const [tabs] = useState<GalleryTab[]>(initialTabs);
  const [activeKey, setActiveKey] = useState(() => {
    return initialTabs.length ? initialTabs[0].tabKey : "all";
  });
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // Reset visible count whenever active tab changes
  function switchTab(key: string) {
    setActiveKey(key);
    setVisibleCount(PAGE_SIZE);
  }

  const activeTab = tabs.find(t => t.tabKey === activeKey);
  const sortedItems = activeTab ? [...activeTab.items].sort((a, b) => a.sortOrder - b.sortOrder) : [];
  const visibleItems = sortedItems.slice(0, visibleCount);
  const hasMore = sortedItems.length > visibleCount;

  return (
    <section className="gallery">
      {/* Hero banner — changes per active tab */}
      <div className="gallery-hero">
        {activeTab?.bannerImage ? (
          <img id="hero-main-img" src={`/uploads/gallery/${activeTab.bannerImage}`} alt={activeTab.bannerAlt || activeTab.label} />
        ) : (
          <img id="hero-main-img" src="/assets/images/gallery1.png" alt="Gallery Banner" />
        )}
      </div>

      <div className="gallery-container">
        {/* Tabs */}
        <div className="gallery-tabs">
          {tabs.map(tab => (
            <button
              key={tab.tabKey}
              className={`tab-link${activeKey === tab.tabKey ? " active" : ""}`}
              onClick={() => switchTab(tab.tabKey)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Gallery Grid */}
        <div className="gallery-grid">
          {visibleItems.length === 0 ? (
            <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 20px", color: "#aaa", fontFamily: "Poppins,sans-serif" }}>
              No images in this category yet.
            </div>
          ) : (
            visibleItems.map(item => (
              <div
                key={item._id}
                className={`gallery-item ${item.type === "wide" ? "item-wide" : "item-narrow"}`}
                data-category={activeKey}
              >
                <img src={`/uploads/gallery/${item.image}`} alt={item.alt || item.title} />
                <div className={`item-overlay${item.overlayClass ? ` ${item.overlayClass}` : ""}`}>
                  <div className="item-content">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  <Link href="/menu" className="arrow-icon">
                    →
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Load More — only shown when there are more items */}
        <div className="gallery-footer">
          {hasMore && (
            <button
              className="load-more-btn"
              onClick={() => setVisibleCount(v => v + PAGE_SIZE)}
            >
              Load More ({sortedItems.length - visibleCount} remaining)
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
