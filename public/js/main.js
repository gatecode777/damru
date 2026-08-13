// ═══════════════════════════════════════════════════════════
// main.js — Damru By Namo
// Works in Next.js: no DOMContentLoaded wrapper needed
// (Script strategy="afterInteractive" guarantees DOM is ready)
// ═══════════════════════════════════════════════════════════

(function () {

  // ── 1. HERO WHEEL ANIMATION ─────────────────────────────
  function initHeroAnimation() {
    const wheel = document.getElementById("wheel");
    const plates = document.querySelectorAll(".plate-item");
    const thumbs = document.querySelectorAll(".thumb");
    if (!wheel || thumbs.length === 0) return;

    let currentIndex = 0;
    
    // Clear previous interval if running
    if (window._damruHeroInterval) {
      clearInterval(window._damruHeroInterval);
    }

    function rotateTo(index) {
      currentIndex = index;
      const angle = index * 90;
      wheel.style.transform = `rotate(-${angle}deg)`;
      plates.forEach((plate, i) => {
        plate.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
        plate.classList.toggle("active", i === index);
      });
      thumbs.forEach((t, i) => t.classList.toggle("active", i === index));
    }

    thumbs.forEach((thumb, index) => {
      thumb.addEventListener("click", () => { rotateTo(index); resetTimer(); });
    });

    function startTimer() {
      window._damruHeroInterval = setInterval(() => {
        currentIndex = (currentIndex + 1) % thumbs.length;
        rotateTo(currentIndex);
      }, 5000);
    }
    function resetTimer() { clearInterval(window._damruHeroInterval); startTimer(); }

    rotateTo(0);
    startTimer();
  }

  // ── 2. HERO BANNER SLIDER ───────────────────────────────
  function initBannerSlider() {
    const slides = document.querySelectorAll(".damru-hero-slider .slide");
    if (slides.length === 0) return;
    
    if (window._damruBannerInterval) {
      clearInterval(window._damruBannerInterval);
    }

    let current = 0;
    window._damruBannerInterval = setInterval(() => {
      slides[current].classList.remove("active");
      current = (current + 1) % slides.length;
      slides[current].classList.add("active");
    }, 3000);
  }

  // ── 3. SCROLL REVEAL ANIMATIONS ─────────────────────────
  function initScrollReveals() {
    function reveal(selector, threshold = 150) {
      document.querySelectorAll(selector).forEach((el, i) => {
        if (el.getBoundingClientRect().top < window.innerHeight - threshold) {
          el.classList.add("active");
        }
      });
    }
    function revealStagger(selector, threshold = 80, stagger = 150) {
      document.querySelectorAll(selector).forEach((el, i) => {
        if (el.getBoundingClientRect().top < window.innerHeight - threshold) {
          setTimeout(() => el.classList.add("active"), (i % 3) * stagger);
        }
      });
    }

    function runAll() {
      reveal(".reveal-3d-left, .reveal-3d-center, .reveal-3d-right");
      reveal(".reveal-left, .reveal-right", 100);
      revealStagger(".bounce-reveal");
      revealStagger(".lens-reveal", 150, 200);
    }

    if (window._damruScrollRevealListener) {
      window.removeEventListener("scroll", window._damruScrollRevealListener);
    }
    window._damruScrollRevealListener = runAll;
    window.addEventListener("scroll", runAll, { passive: true });
    runAll(); // run once immediately for above-fold elements
  }

  // ── 4. TESTIMONIAL SLIDER ───────────────────────────────
  function initTestimonials() {
    const testimonials = [
      { text: "One of the best dining experiences I've had recently. The food quality is top-notch, and the taste is consistent in every bite. The service is fast, and the team ensures you feel comfortable throughout your visit. I will definitely visit again!", name: "Deepika Bhardwaj", role: "Lawyer", img: "https://i.pravatar.cc/150?img=32" },
      { text: "Damru Restaurant has truly raised the bar for dining in Jaipur. The ambiance is warm, the staff is welcoming, and every dish we ordered was absolutely delicious. A must-visit for food lovers!", name: "Priya Sharma", role: "Food Blogger", img: "https://i.pravatar.cc/150?img=47" },
      { text: "We booked the banquet hall for our family function and it was a fantastic experience. The team was professional, the food was outstanding, and our guests couldn't stop complimenting the arrangements!", name: "Rahul Mehta", role: "Business Owner", img: "https://i.pravatar.cc/150?img=11" },
    ];

    let idx = 0;
    
    if (window._damruTestiInterval) {
      clearInterval(window._damruTestiInterval);
    }

    function goTo(newIdx) {
      idx = (newIdx + testimonials.length) % testimonials.length;
      const t = testimonials[idx];
      const els = {
        text: document.getElementById("testi-text"),
        name: document.getElementById("testi-name"),
        role: document.getElementById("testi-role"),
        img: document.getElementById("testi-img"),
        curr: document.getElementById("current-index"),
        tot: document.getElementById("total-slides"),
      };
      if (!els.text) return;

      // Fade out
      ["text", "name", "role", "img"].forEach(k => { if (els[k]) els[k].style.opacity = "0"; });

      setTimeout(() => {
        if (els.text) els.text.textContent = t.text;
        if (els.name) els.name.textContent = t.name;
        if (els.role) els.role.textContent = t.role;
        if (els.img) { els.img.src = t.img; els.img.alt = t.name; }
        if (els.curr) els.curr.textContent = idx + 1;
        if (els.tot) els.tot.textContent = testimonials.length;
        ["text", "name", "role", "img"].forEach(k => {
          if (els[k]) { els[k].style.transition = "opacity 0.4s"; els[k].style.opacity = "1"; }
        });
      }, 300);
    }

    function startAutoScroll() {
      clearInterval(window._damruTestiInterval);
      window._damruTestiInterval = setInterval(() => {
        const textEl = document.getElementById("testi-text");
        if (!textEl) {
          clearInterval(window._damruTestiInterval);
          return;
        }
        goTo(idx + 1);
      }, 5000);
    }

    function resetAutoScroll() {
      clearInterval(window._damruTestiInterval);
      startAutoScroll();
    }

    // Start auto scroll if testimonial elements are present on current page
    if (document.getElementById("testi-text")) {
      startAutoScroll();
    }

    if (window._damruTestiClickListener) {
      document.removeEventListener("click", window._damruTestiClickListener);
    }
    const clickHandler = e => {
      const nextBtn = e.target.closest(".testi-next");
      const prevBtn = e.target.closest(".testi-prev");
      if (nextBtn) {
        goTo(idx + 1);
        resetAutoScroll();
      }
      if (prevBtn) {
        goTo(idx - 1);
        resetAutoScroll();
      }
    };
    window._damruTestiClickListener = clickHandler;
    document.addEventListener("click", clickHandler);
  }

  // ── 5. HEADER SCROLL EFFECT ─────────────────────────────
  function initHeaderScroll() {
    if (window._damruHeaderScrollListener) {
      window.removeEventListener("scroll", window._damruHeaderScrollListener);
    }
    const handler = () => {
      const header = document.querySelector("header.main-header");
      if (header) {
        header.classList.toggle("header-scrolled", window.scrollY > 80);
      }
    };
    window._damruHeaderScrollListener = handler;
    window.addEventListener("scroll", handler, { passive: true });
  }

  // ── 6. QUANTITY SELECTOR (menu page) ────────────────────
  function initQtySelectors() {
    document.querySelectorAll(".ms-qty").forEach(group => {
      const spans = group.querySelectorAll("span");
      if (spans.length < 3) return;
      const [minus, qty, plus] = spans;
      plus.addEventListener("click", () => { qty.textContent = (parseInt(qty.textContent) || 0) + 1; });
      minus.addEventListener("click", () => { const v = parseInt(qty.textContent) || 0; if (v > 0) qty.textContent = v - 1; });
    });
  }

  // ── RUN ALL ─────────────────────────────────────────────
  function initAll() {
    initHeroAnimation();
    initBannerSlider();
    initScrollReveals();
    initTestimonials();
    initHeaderScroll();
    initQtySelectors();
  }

  initAll();

  // Re-run on Next.js client-side navigation via history API patch
  let lastPath = location.pathname;
  function checkRouteChange() {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      setTimeout(initAll, 150);
    }
  }
  // Patch history.pushState to detect Next.js soft navigation
  const _origPush = history.pushState.bind(history);
  history.pushState = function (...args) {
    _origPush(...args);
    checkRouteChange();
  };
  window.addEventListener("popstate", checkRouteChange);

})();