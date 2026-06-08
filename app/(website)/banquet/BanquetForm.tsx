"use client";

import { useState } from "react";

export default function BanquetForm() {
  const [formData, setFormData] = useState({
    fullName: "",
    mobileNumber: "",
    email: ""
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you! Our event manager will contact you shortly.");
    setFormData({ fullName: "", mobileNumber: "", email: "" });
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
      <button type="submit" className="final-book-btn">Book Now</button>
    </form>
  );
}
