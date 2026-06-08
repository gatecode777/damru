"use client";

import { useState } from "react";

export default function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  function handleSubscribe(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    // TODO: wire to API
    setSubscribed(true);
    setEmail("");
    setTimeout(() => setSubscribed(false), 4000);
  }

  return (
    <form className="newsletter-form" onSubmit={handleSubscribe}>
      <input
        type="email"
        placeholder="Your email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
      />
      <button type="submit">
        {subscribed ? "✓ Subscribed!" : "Subscribe"}
      </button>
    </form>
  );
}
