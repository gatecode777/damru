"use client";

import { useState } from "react";
import { useToast } from "@/components/website/Toast";
import { getUserErrorMessage, getUserResponseError } from "@/lib/getUserErrorMessage";

export default function BanquetForm() {
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    mobileNumber: "",
    email: ""
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const response = await fetch("/api/banquet-bookings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fullName: formData.fullName, phone: formData.mobileNumber.replace(/\D/g, "").slice(-10), email: formData.email }) });
      const data = await response.json();
      if (!response.ok || data.error) { toast.error("Request not submitted", getUserResponseError(response,data,"Unable to submit your request."), { id: "banquet-request" }); return; }
      toast.success("Request submitted", "Thank you! Our event manager will contact you shortly.", { id: "banquet-request" });
      setFormData({ fullName: "", mobileNumber: "", email: "" });
    } catch (error) { toast.error("Request not submitted", getUserErrorMessage(error), { id: "banquet-request" }); }
    finally { setSubmitting(false); }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="form-container">
        <input 
          type="text" 
          placeholder="Full Name" 
          value={formData.fullName}
          onChange={(e) => setFormData({...formData, fullName: e.target.value})}
          required
        />
        <input 
          type="text" 
          placeholder="+91- Mobile Number" 
          value={formData.mobileNumber}
          onChange={(e) => setFormData({...formData, mobileNumber: e.target.value})}
          required
        />
        <input 
          type="email" 
          placeholder="Email Address" 
          value={formData.email}
          onChange={(e) => setFormData({...formData, email: e.target.value})}
          required
        />
      </div>
      <button type="submit" className="final-book-btn" disabled={submitting}>{submitting ? "Submitting…" : "Book Now"}</button>
    </form>
  );
}
