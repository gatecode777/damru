"use client";

import { useState } from "react";

const INDO_CHINESE_ITEMS = [
  { img: "IC1", name: "Paneer in Hot Garlic Sauce" },
  { img: "IC2", name: "Honey Chilli Potato" },
  { img: "IC3", name: "EOK Tossed Waterchestnut" },
  { img: "IC4", name: "Mushroom Chilli Dry" },
  { img: "IC5", name: "Spring Roll" },
  { img: "IC6", name: "Paneer 65" },
  { img: "IC7", name: "Crispy Corn" },
  { img: "IC8", name: "Paneer Kung Pao" },
  { img: "IC9", name: "Schezwan Vegetables in Hot" },
];

export default function IndoChineseWebSection() {
  const [showAll, setShowAll] = useState(false);

  const itemsToDisplay = showAll ? INDO_CHINESE_ITEMS : INDO_CHINESE_ITEMS.slice(0, 2);

  return (
    <section className="menu-section">
      <div className="container">
        <h2 className="menu-title">Indo Chinese</h2>
        <div className="menu-grid">
          {itemsToDisplay.map((d) => (
            <div key={d.name} className="menu-card bounce-reveal active">
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
        <div style={{ textAlign: "center", marginTop: "35px" }}>
          <button
            onClick={() => setShowAll(prev => !prev)}
            style={{
              background: "linear-gradient(135deg, #e67e22, #d35400)",
              color: "#fff",
              border: "none",
              padding: "12px 32px",
              borderRadius: "30px",
              fontSize: "1rem",
              fontFamily: "Poppins, sans-serif",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 15px rgba(230, 126, 34, 0.3)",
              transition: "transform 0.2s ease, background 0.2s ease",
            }}
            onMouseOver={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
            onMouseOut={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >
            {showAll ? "View Less" : "View All"}
          </button>
        </div>
      </div>
    </section>
  );
}
