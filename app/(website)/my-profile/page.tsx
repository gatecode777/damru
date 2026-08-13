"use client";

import "@/styles/website/myprofile.css";
import "@/styles/website/rewards.css";
import { fmtDate, fmtDateFull, fmtDateTime, todayISO } from "@/lib/formatDate";
import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useRewards } from "@/lib/rewards/RewardsProvider";
import * as rewardApi from "@/lib/rewards/rewardApi";
import { trackRewardEvent } from "@/lib/rewards/rewardAnalytics";
import type { RewardTransaction, RewardCoupon, RewardsUpcoming, AchievementsResponse, MissionsResponse, ReferralsResponse } from "@/lib/rewards/rewardTypes";
import ActiveCampaignOffers from "@/components/rewards/ActiveCampaignOffers";
import { useToast } from "@/components/website/Toast";
import { getSafeUserMessage, getUserErrorMessage, getUserResponseError } from "@/lib/getUserErrorMessage";

interface UserInfo { id?: string; name: string; email: string; phone: string; city: string; avatar: string; createdAt?: string }
interface Address { _id: string; label: string; fullName: string; phone: string; house: string; area: string; city: string; state: string; pincode: string; isDefault: boolean }
interface OrderItem { name: string; custom: string; price: number; qty: number; image?: string }
interface Order { _id: string; orderId: string; status: string; paymentMethod: string; paymentStatus?: string; paymentAmount?: number; refundedAmount?: number; total: number; subtotal: number; discount: number; couponCode: string; tax: number; shipping: number; items: OrderItem[]; deliveryAddress: { fullName: string; phone: string; house: string; area: string; city: string; state: string; pincode: string }; createdAt: string; tableNumber?: string; tableName?: string; cancellationReason?: string; cancelledBy?: "customer"|"admin"|"system"; cancelledAt?: string }

// Backend-confirmed states only — never inferred from order.status. See
// docs/PAYMENT_RELIABILITY_REFUNDS.md's Payment State Machine.
const PAYMENT_STATUS_DISPLAY: Record<string, { label: string; color: string; bg: string }> = {
  pending:            { label: "Payment Pending",     color: "#b45309", bg: "#fffbeb" },
  paid:               { label: "Paid",                color: "#16a34a", bg: "#f0fdf4" },
  failed:             { label: "Payment Failed",      color: "#dc2626", bg: "#fef2f2" },
  refund_pending:     { label: "Refund Processing",   color: "#b45309", bg: "#fffbeb" },
  partially_refunded: { label: "Partially Refunded",  color: "#0e7490", bg: "#ecfeff" },
  refunded:           { label: "Refunded",            color: "#6d28d9", bg: "#f5f3ff" },
};
interface Coupon { _id: string; code: string; description: string; type: string; value: number; maxDiscount: number | null; minOrderValue: number; expiryDate: string | null; usageLimit: number | null; usedCount: number }
type Section = "overview" | "rewards" | "notifications" | "address" | "orders" | "payment" | "coupons" | "settings" | "help";

const STATUS_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  pending:          { bg:"#fffbeb", color:"#b45309", icon:"fa-regular fa-clock" },
  confirmed:        { bg:"#eff6ff", color:"#1d4ed8", icon:"fa-regular fa-circle-check" },
  preparing:        { bg:"#f5f3ff", color:"#6d28d9", icon:"fa-solid fa-utensils" },
  out_for_delivery: { bg:"#ecfeff", color:"#0e7490", icon:"fa-solid fa-truck" },
  delivered:        { bg:"#f0fdf4", color:"#15803d", icon:"fa-regular fa-circle-check" },
  cancelled:        { bg:"#fef2f2", color:"#b91c1c", icon:"fa-solid fa-ban" },
};

// fmtDate imported from @/lib/formatDate


// ── Help & Support section — Tabs: Complaint Form | My Complaints | My Reservations ──
interface ComplaintRecord { _id: string; issueType: string; subject: string; description: string; status: string; attachment?: string; adminNote?: string; createdAt: string }
interface ReservationRecord { _id: string; date: string; time: string; persons: string; notes?: string; status: string; declineReason?: string; createdAt: string }

const COMPLAINT_STATUS: Record<string, { bg: string; color: string }> = {
  open:        { bg:"#fef2f2", color:"#b91c1c" },
  in_progress: { bg:"#eff6ff", color:"#1d4ed8" },
  resolved:    { bg:"#f0fdf4", color:"#15803d" },
  closed:      { bg:"#f9fafb", color:"#6b7280" },
};
const RESERVATION_STATUS: Record<string, { bg: string; color: string }> = {
  pending:   { bg:"#fffbeb", color:"#b45309" },
  confirmed: { bg:"#f0fdf4", color:"#15803d" },
  cancelled: { bg:"#fef2f2", color:"#b91c1c" },
};

function HelpSection({ showToast }: { showToast: (msg: string, type?: "success"|"error"|"info") => void }) {
  const [helpView,  setHelpView]  = useState<"home"|"faq"|"complaint">("home");
  const [activeTab, setActiveTab] = useState<"form"|"mycomplaints"|"myreservations">("form");
  const [faqCat,    setFaqCat]    = useState("all");
  const [faqSearch, setFaqSearch] = useState("");
  const [complaintForm, setComplaintForm] = useState({ issueType:"", subject:"", description:"" });
  const [complaintSubmitting, setComplaintSubmitting] = useState(false);
  const [imageFile,    setImageFile]    = useState<File|null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [uploadedFilename, setUploadedFilename] = useState("");
  const [complaints,    setComplaints]    = useState<ComplaintRecord[]>([]);
  const [reservations,  setReservations]  = useState<ReservationRecord[]>([]);
  const [complaintsLoaded,   setComplaintsLoaded]   = useState(false);
  const [reservationsLoaded, setReservationsLoaded] = useState(false);
  const [expandedComplaint, setExpandedComplaint] = useState<string|null>(null);

  // Load complaints when tab switches to mycomplaints
  useEffect(() => {
    if (complaintsLoaded) return;
    if (activeTab !== "mycomplaints") return;
    fetch("/api/complaints").then(r=>r.json()).then(d=>{
      setComplaints(d.complaints||[]); setComplaintsLoaded(true);
    }).catch(()=>setComplaintsLoaded(true));
  }, [activeTab, complaintsLoaded]);

  // Load reservations when tab switches to myreservations
  useEffect(() => {
    if (reservationsLoaded) return;
    if (activeTab !== "myreservations") return;
    fetch("/api/reservations").then(r=>r.json()).then(d=>{
      setReservations(d.reservations||[]); setReservationsLoaded(true);
    }).catch(()=>setReservationsLoaded(true));
  }, [activeTab, reservationsLoaded]);

  function loadComplaints() {
    setComplaintsLoaded(false); // trigger useEffect
  }
  function loadReservations() {
    setReservationsLoaded(false);
  }

  const FAQ_DATA: { cat: string; label: string; items: [string,string][] }[] = [
    { cat:"orders", label:"Orders", items:[
      ["How can I track my order status?","You can track your order in the My Orders section. Click on your order to view real-time status."],
      ["How can I place an order?","Browse the menu, add items to your cart, proceed to checkout, select your address and payment method, and confirm your order."],
      ["Can I cancel my order?","Yes, you can cancel your order before preparation begins. Go to My Orders and click Cancel Order."],
      ["Can I modify my order after placing it?","No, once the order is placed items cannot be modified. You may cancel and place a new order."],
      ["What if my order is delayed?","If your order is delayed, you can track it in real time or contact support for assistance."],
      ["What should I do if I receive the wrong items?","Please report the issue in Help & Support. Our team will resolve it promptly."],
      ["Can I reorder the same items?","Yes, you can use the Reorder option in My Orders section to quickly place the same order again."],
    ]},
    { cat:"payments", label:"Payments", items:[
      ["What payment methods are accepted?","We accept Credit Cards, Debit Cards, UPI, Net Banking, Wallets, and Cash on Delivery (COD)."],
      ["Is UPI payment safe?","Yes, all UPI transactions are fully encrypted and secured."],
      ["Why did my payment fail?","Payment may fail due to: poor internet connection, incorrect card details, insufficient balance, or bank server issues."],
      ["My order was deducted but order failed. What should I do?","Don't worry. The deducted amount will be automatically refunded within 5–7 business days."],
      ["Can I change my payment method after placing an order?","No, once the order is placed the payment method cannot be changed."],
    ]},
    { cat:"delivery", label:"Delivery", items:[
      ["How long does delivery take?","Delivery usually takes 30–60 minutes, depending on the restaurant, traffic, and order volume."],
      ["How do I track my delivery?","You can track a delivery in real time from the My Orders section after placing your order."],
      ["What are delivery charges?","Delivery charges may vary based on location and order amount. They will be shown at checkout."],
      ["Do you deliver to my location?","Enter your address at checkout to see if delivery is available in your area."],
      ["What if I miss my delivery?","The delivery partner may try for a few minutes. If missed, the order may be cancelled and refunded."],
      ["Can I change my delivery address after placing an order?","No, once the order is placed the delivery address cannot be changed."],
    ]},
    { cat:"account", label:"Account", items:[
      ["How do I create an account?","Click Sign Up, enter your name, email, phone, and password to complete registration."],
      ["I forgot my password. What should I do?","Click Forgot Password on the login page, enter your email and follow instructions to reset your password."],
      ["How can I change my password?","Go to Account Settings > Change Password, enter your current and new password then save."],
      ["How do I update my profile details?","Go to My Profile, click Edit Profile, update your details, and click Save."],
      ["How do I delete my account?","Go to Account Settings > Delete Account and confirm your request."],
      ["Is my personal data secure?","Yes, your data is securely protected. We do not share it with third parties without consent."],
    ]},
    { cat:"offers", label:"Offers", items:[
      ["How do I apply a coupon code?","At checkout, enter the code in the Apply Coupon field and press Apply to get the discount."],
      ["Why is my coupon code not working?","Your coupon may not work due to: expired validity, minimum order value not met, or first-time user only offer."],
      ["Can I use multiple coupons per order?","No, only one coupon can be applied per order."],
      ["Where can I find available offers?","Check the Offers & Coupons section in your profile or use the cart page."],
      ["What is the minimum order value for coupons?","Each coupon has its own minimum order requirement mentioned in its description."],
    ]},
  ];

  const visibleFaqs = FAQ_DATA.filter(cat => faqCat === "all" || cat.cat === faqCat)
    .map(cat => ({ ...cat, items: cat.items.filter(([q,a]) => !faqSearch.trim() || q.toLowerCase().includes(faqSearch.toLowerCase()) || a.toLowerCase().includes(faqSearch.toLowerCase())) }))
    .filter(cat => cat.items.length > 0);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
    setUploadedFilename(file.name);
  }
  function removeImage() { setImageFile(null); setImagePreview(""); setUploadedFilename(""); }

  async function submitComplaint() {
    if (!complaintForm.issueType) { showToast("Please select an issue type!"); return; }
    if (!complaintForm.subject.trim()) { showToast("Please enter a subject!"); return; }
    if (!complaintForm.description.trim()) { showToast("Please enter a description!"); return; }
    setComplaintSubmitting(true);
    try {
      let attachmentFilename = "";
      if (imageFile) {
        const fd = new FormData(); fd.append("file", imageFile); fd.append("target", "complaints");
        const uploadResponse=await fetch("/api/upload", { method:"POST", body:fd });const up=await uploadResponse.json();
        if(!uploadResponse.ok||!up.filename){showToast(getUserResponseError(uploadResponse,up,"Unable to upload complaint attachment."));return;}
        attachmentFilename = up.filename;
      }
      const res = await fetch("/api/complaints", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...complaintForm, attachment: attachmentFilename }),
      });
      const data = await res.json();
      if (!res.ok||data.error) { showToast(getUserResponseError(res,data,"Unable to submit complaint.")); return; }
      setComplaintForm({ issueType:"", subject:"", description:"" });
      removeImage();
      setComplaintsLoaded(false); // triggers useEffect to reload
      showToast("Your complaint has been submitted successfully! ✅");
      setActiveTab("mycomplaints");
    } catch { showToast("Failed to submit. Please try again."); }
    finally { setComplaintSubmitting(false); }
  }

  // HOME
  if (helpView === "home") return (
    <div>
      <div className="profile__help-cards">
        <div className="profile__help-card">
          <div className="profile__help-icon-wrap"><i className="fa-regular fa-circle-question"></i></div>
          <div className="profile__help-card-title">FAQs</div>
          <div className="profile__help-card-desc">Find answers to frequently asked questions</div>
          <button className="profile__help-btn" onClick={()=>setHelpView("faq")}>Browse FAQs</button>
        </div>
        <div className="profile__help-card">
          <div className="profile__help-icon-wrap"><i className="fa-solid fa-phone"></i></div>
          <div className="profile__help-card-title">Contact Us</div>
          <div className="profile__help-card-desc">Get in touch with our support team</div>
          <button className="profile__help-btn" onClick={()=>showToast("Use the contact page or call the restaurant to reach our support team.","info")}>Get In Touch</button>
        </div>
        <div className="profile__help-card">
          <div className="profile__help-icon-wrap"><i className="fa-regular fa-pen-to-square"></i></div>
          <div className="profile__help-card-title">Raise a Complaint</div>
          <div className="profile__help-card-desc">Report an issue with your order or service</div>
          <button className="profile__help-btn" onClick={()=>setHelpView("complaint")}>Report Issue</button>
        </div>
      </div>
      <div className="profile__card">
        <div className="profile__faq-title"><i className="fa-regular fa-circle-question"></i> Common Questions</div>
        {[
          ["How can I track my order status?","Go to My Orders section in your profile to view real-time status."],
          ["What is the estimated delivery time?","30–45 minutes depending on your location and order size."],
          ["How can I apply a coupon code?","Go to Offers & Coupons section, copy the code and use it at checkout."],
          ["How to cancel an order and request a refund?","Orders can be cancelled before preparation begins. Refunds are processed within 5–7 business days."],
        ].map(([q,a])=><FaqItem key={q} q={q} a={a}/>)}
      </div>
    </div>
  );

  // FAQ PAGE
  if (helpView === "faq") return (
    <div className="profile__faq-page active">
      <div className="profile__order-detail-back" onClick={()=>setHelpView("home")}><i className="fa-solid fa-arrow-left"></i> Back to Help & Support</div>
      <h2 style={{fontSize:20,fontWeight:700,color:"#1a1a1a",marginBottom:4}}>Frequently Asked Questions</h2>
      <p style={{fontSize:13,color:"#888",marginBottom:18}}>Find answers to common questions about orders, payments, and more.</p>
      <div className="profile__faq-search-wrap">
        <i className="fa-solid fa-magnifying-glass"></i>
        <input className="profile__faq-search" type="text" placeholder="Search your question"
          value={faqSearch} onChange={e=>{setFaqSearch(e.target.value);setFaqCat("all");}}/>
      </div>
      <div className="profile__faq-tabs">
        {["all","orders","payments","delivery","account","offers"].map(cat=>(
          <span key={cat} className={`profile__faq-tab${faqCat===cat?" active":""}`}
            onClick={()=>{setFaqCat(cat);setFaqSearch("");}}>
            {cat.charAt(0).toUpperCase()+cat.slice(1)}
          </span>
        ))}
      </div>
      {visibleFaqs.map(cat=>(
        <div key={cat.cat} className="profile__faq-category">
          <div className="profile__faq-cat-header"><span className="cat-num">?</span> {cat.label}</div>
          <div className="profile__faq-cat-body">{cat.items.map(([q,a])=><FaqItemNew key={q} q={q} a={a}/>)}</div>
        </div>
      ))}
      {visibleFaqs.length===0&&<p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13,padding:20}}>No results found for "{faqSearch}"</p>}
      <div className="profile__faq-still-help">
        <div className="profile__faq-still-left">
          <i className="fa-regular fa-circle-question"></i>
          <span><strong>Still Need Help?</strong><br/><span style={{fontSize:12,fontWeight:400}}>Can't find the answer you are looking for?</span></span>
        </div>
        <div className="profile__faq-still-btns">
          <button className="profile__faq-contact-btn" onClick={()=>showToast("Use the contact page or call the restaurant to reach our support team.","info")}>Contact Support</button>
          <button className="profile__faq-raise-btn" onClick={()=>setHelpView("complaint")}>Raise a Complaint</button>
        </div>
      </div>
    </div>
  );

  // COMPLAINT + MY HISTORY PAGE
  return (
    <div className="profile__complaint-page active">
      <div className="profile__order-detail-back" onClick={()=>setHelpView("home")}><i className="fa-solid fa-arrow-left"></i> Back to Help & Support</div>

      {/* ── 3 Tabs ── */}
      <div style={{display:"flex",gap:0,borderBottom:"2px solid #f0f0f0",marginBottom:20}}>
        {([
          ["form",           "fa-regular fa-pen-to-square", "Raise Complaint"],
          ["mycomplaints",   "fa-solid fa-list",            "My Complaints"],
          ["myreservations", "fa-solid fa-calendar-check",  "My Reservations"],
        ] as [typeof activeTab, string, string][]).map(([tab, icon, label])=>(
          <button key={tab}
            onClick={()=>setActiveTab(tab)}
            style={{
              flex:1, padding:"10px 6px", background:"none", border:"none",
              borderBottom: activeTab===tab ? "2.5px solid #e67e22" : "2.5px solid transparent",
              color: activeTab===tab ? "#e67e22" : "#888",
              fontFamily:"Poppins,sans-serif", fontSize:13, fontWeight: activeTab===tab ? 600 : 400,
              cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
              marginBottom:-2, transition:"all 0.15s",
            }}>
            <i className={icon}></i> {label}
          </button>
        ))}
      </div>

      {/* ── Tab: Raise Complaint ── */}
      {activeTab==="form" && (
        <div className="profile__card">
          <div className="profile__complaint-section-title"><i className="fa-regular fa-pen-to-square"></i> Submit a Complaint</div>
          <div className="profile__complaint-label">Issue Type</div>
          <select className="profile__complaint-select" value={complaintForm.issueType} onChange={e=>setComplaintForm(p=>({...p,issueType:e.target.value}))}>
            <option value="">Select Issue Type</option>
            <option>Order Issue</option><option>Payment Issue</option><option>Delivery Issue</option>
            <option>Wrong Items</option><option>Missing Items</option><option>Account Issue</option><option>Other</option>
          </select>
          <div className="profile__complaint-label">Subject</div>
          <input className="profile__complaint-input" type="text" placeholder="Brief subject of your complaint"
            value={complaintForm.subject} onChange={e=>setComplaintForm(p=>({...p,subject:e.target.value}))}/>
          <div className="profile__complaint-label">Description</div>
          <textarea className="profile__complaint-textarea" placeholder="Describe your issue in detail…"
            value={complaintForm.description} onChange={e=>setComplaintForm(p=>({...p,description:e.target.value}))}></textarea>

          {/* ── Image Upload with Preview ── */}
          <div className="profile__complaint-label">Attachment (Optional)</div>
          {!imagePreview ? (
            <div className="profile__complaint-upload" onClick={()=>document.getElementById("complaint-img-input")?.click()}>
              <p>Click to upload or drag & drop<br/><span style={{fontSize:12,color:"#aaa"}}>Images (AVIF, WEBP, JPG, PNG) & PDF supported</span></p>
              <i className="fa-solid fa-paperclip"></i>
              <input id="complaint-img-input" type="file" style={{display:"none"}} accept="image/*,.pdf" onChange={handleImageSelect}/>
            </div>
          ) : (
            <div style={{position:"relative",display:"inline-block",marginBottom:16}}>
              {imageFile?.type?.startsWith("image/") ? (
                <img src={imagePreview} alt="Preview" style={{width:"100%",maxWidth:320,height:180,objectFit:"cover",borderRadius:10,border:"1.5px solid #e0e0e0",display:"block"}}/>
              ) : (
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px",background:"#f9fafb",border:"1.5px solid #e0e0e0",borderRadius:10}}>
                  <i className="fa-solid fa-file-pdf" style={{fontSize:28,color:"#e67e22"}}></i>
                  <span style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#333"}}>{uploadedFilename}</span>
                </div>
              )}
              <button onClick={removeImage} style={{position:"absolute",top:-8,right:-8,width:22,height:22,borderRadius:"50%",background:"#ef4444",border:"2px solid #fff",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:11,fontWeight:700}}>✕</button>
            </div>
          )}

          <button className="profile__complaint-submit" onClick={submitComplaint} disabled={complaintSubmitting} style={{opacity:complaintSubmitting?0.7:1}}>
            {complaintSubmitting ? "Submitting…" : "Submit Complaint"}
          </button>
        </div>
      )}

      {/* ── Tab: My Complaints ── */}
      {activeTab==="mycomplaints" && (
        <div>
          {!complaintsLoaded
            ? <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
            : complaints.length===0
              ? <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No complaints submitted yet.</p>
              : complaints.map(c => {
                  const cs = COMPLAINT_STATUS[c.status] ?? COMPLAINT_STATUS.open;
                  const isOpen = expandedComplaint===c._id;
                  return (
                    <div key={c._id} className="profile__card" style={{marginBottom:12,cursor:"pointer"}} onClick={()=>setExpandedComplaint(isOpen?null:c._id)}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{flex:1}}>
                          <div style={{fontFamily:"Poppins,sans-serif",fontSize:13,fontWeight:600,color:"#1a1a1a",marginBottom:3}}>{c.subject}</div>
                          <div style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888"}}>{c.issueType} · {fmtDate(c.createdAt)}</div>
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                          <span style={{fontFamily:"Poppins,sans-serif",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:cs.bg,color:cs.color}}>
                            {c.status.replace(/_/g," ").replace(/\w/g,x=>x.toUpperCase())}
                          </span>
                          <i className={`fa-solid fa-chevron-${isOpen?"up":"down"}`} style={{color:"#aaa",fontSize:12}}></i>
                        </div>
                      </div>
                      {isOpen && (
                        <div style={{marginTop:12,paddingTop:12,borderTop:"1px solid #f3f4f6"}}>
                          <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#555",lineHeight:1.6,marginBottom:10}}>{c.description}</p>
                          {c.attachment && (
                            <div style={{marginBottom:10}}>
                              <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#aaa",marginBottom:6}}>Attachment:</p>
                              {/\.(jpg|jpeg|png)$/i.test(c.attachment)
                                ? <img src={`/uploads/complaints/${c.attachment}`} alt="attachment" style={{width:"100%",maxWidth:280,height:140,objectFit:"cover",borderRadius:8,border:"1px solid #e0e0e0"}}/>
                                : <a href={`/uploads/complaints/${c.attachment}`} target="_blank" rel="noreferrer" style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#e67e22"}}>📎 View Attachment</a>
                              }
                            </div>
                          )}
                          {c.adminNote && (
                            <div style={{background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:8,padding:"10px 14px"}}>
                              <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,fontWeight:600,color:"#15803d",marginBottom:4}}>Admin Response:</p>
                              <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#166534"}}>{c.adminNote}</p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
          }
        </div>
      )}

      {/* ── Tab: My Reservations ── */}
      {activeTab==="myreservations" && (
        <div>
          {!reservationsLoaded
            ? <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
            : reservations.length===0
              ? <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No reservations made yet. <a href="/#reservation" style={{color:"#e67e22"}}>Book a table →</a></p>
              : reservations.map(r => {
                  const rs = RESERVATION_STATUS[r.status] ?? RESERVATION_STATUS.pending;
                  return (
                    <div key={r._id} className="profile__card" style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
                        <div>
                          <div style={{fontFamily:"Poppins,sans-serif",fontSize:13,fontWeight:600,color:"#1a1a1a"}}>
                            <i className="fa-solid fa-calendar-days" style={{color:"#e67e22",marginRight:6}}></i>
                            {fmtDateFull(r.date, r.createdAt) || "Date unavailable"}
                          </div>
                          <div style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",marginTop:3}}>
                            <i className="fa-regular fa-clock" style={{marginRight:5}}></i>{r.time}
                            <span style={{margin:"0 8px"}}>·</span>
                            <i className="fa-solid fa-users" style={{marginRight:5}}></i>{r.persons}
                          </div>
                        </div>
                        <span style={{fontFamily:"Poppins,sans-serif",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:rs.bg,color:rs.color,flexShrink:0}}>
                          {r.status === "cancelled" ? "Declined" : r.status.charAt(0).toUpperCase()+r.status.slice(1)}
                        </span>
                      </div>
                      {r.notes && (
                        <div style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#555",background:"#fafafa",padding:"8px 12px",borderRadius:8,borderLeft:"3px solid #e67e22"}}>
                          {r.notes}
                        </div>
                      )}
                      {r.status === "cancelled" && r.declineReason && (
                        <div style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#991b1b",background:"#fef2f2",padding:"10px 12px",borderRadius:8,borderLeft:"3px solid #dc2626",marginTop:8,lineHeight:1.5}}>
                          <strong style={{display:"block",marginBottom:2}}>Why we couldn&apos;t accept your request</strong>
                          {r.declineReason}
                        </div>
                      )}
                      <div style={{fontFamily:"Poppins,sans-serif",fontSize:11,color:"#bbb",marginTop:8,textAlign:"right"}}>
                        Booked on {fmtDate(r.createdAt)}
                      </div>
                    </div>
                  );
                })
          }
        </div>
      )}
    </div>
  );
}

// FAQ accordion item for full FAQ page
function FaqItemNew({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`profile__faq-q${open?" open":""}`} onClick={()=>setOpen(v=>!v)}>
      <div className="profile__faq-q-header">
        <span>{q}</span>
        <i className="fa-solid fa-chevron-right faq-chevron"></i>
      </div>
      {open&&<div className="profile__faq-q-body">{a}</div>}
      {open&&<div className="profile__faq-helpful"><span>Was this helpful?</span><i className="fa-regular fa-thumbs-up"></i><i className="fa-regular fa-thumbs-down"></i></div>}
    </div>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (<>
    <div className="profile__faq-item" onClick={() => setOpen(v=>!v)}>
      <span>{q}</span>
      <i className="fa-solid fa-chevron-right" style={{ transform:open?"rotate(90deg)":"none",transition:"0.2s" }}></i>
    </div>
    {open && <div className="profile__faq-answer open">{a}</div>}
  </>);
}

function MyProfileContent() {
  const actionToast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { dashboard: rewardsDashboard } = useRewards();
  const [section,setSection]  = useState<Section>("overview");
  const [user,setUser]        = useState<UserInfo|null>(null);
  const [loading,setLoading]  = useState(true);
  const [addresses,setAddresses]     = useState<Address[]>([]);
  const [orders,setOrders]           = useState<Order[]>([]);
  const [ordersLoaded,setOrdersLoaded]=useState(false);
  const [coupons,setCoupons]         = useState<Coupon[]>([]);
  const [couponsLoaded,setCouponsLoaded]=useState(false);
  const [copiedCode,setCopiedCode]   = useState("");
  const [viewOrder,setViewOrder]     = useState<Order|null>(null);
  const [cancelOrderOpen,setCancelOrderOpen] = useState(false);
  const [cancelMessage,setCancelMessage] = useState("");
  const [cancelSaving,setCancelSaving] = useState(false);
  const [cancelError,setCancelError] = useState("");
  const [showEditModal,setShowEditModal]=useState(false);
  const [editForm,setEditForm]       = useState({name:"",phone:"",city:""});
  const [avatarFile,setAvatarFile]   = useState<File|null>(null);
  const [avatarPreview,setAvatarPreview]=useState("");
  const [editSaving,setEditSaving]   = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const [showAddrModal,setShowAddrModal]=useState(false);
  const [editingAddr,setEditingAddr] = useState<Address|null>(null);
  const [addrForm,setAddrForm]       = useState({label:"Home",fullName:"",phone:"",house:"",area:"",city:"",state:"",pincode:"",isDefault:false});
  const [addrSaving,setAddrSaving]   = useState(false);
  const [pwForm,setPwForm]           = useState({current:"",newPw:"",confirm:""});
  const [pwSaving,setPwSaving]       = useState(false);
  const [showPw,setShowPw]           = useState({current:false,newPw:false,confirm:false});

  // ── Damru Rewards ─────────────────────────────────────────
  const [rewardsHistory,setRewardsHistory]           = useState<RewardTransaction[]>([]);
  const [rewardsHistoryPage,setRewardsHistoryPage]   = useState(1);
  const [rewardsHistoryPages,setRewardsHistoryPages] = useState(1);
  const [rewardsHistoryLoading,setRewardsHistoryLoading] = useState(false);
  const [rewardsCoupons,setRewardsCoupons]           = useState<RewardCoupon[]>([]);
  const [rewardsCouponsLoaded,setRewardsCouponsLoaded]=useState(false);
  const [rewardsUpcoming,setRewardsUpcoming]         = useState<RewardsUpcoming|null>(null);
  const [rewardsLoaded,setRewardsLoaded]             = useState(false);
  const [achievementsData,setAchievementsData]       = useState<AchievementsResponse|null>(null);
  const [achievementsLoading,setAchievementsLoading] = useState(false);
  const [missionsData,setMissionsData]               = useState<MissionsResponse|null>(null);
  const [missionsLoading,setMissionsLoading]         = useState(false);
  const [referralsData,setReferralsData]             = useState<ReferralsResponse|null>(null);
  const [referralsLoading,setReferralsLoading]       = useState(false);
  const [referralCopied,setReferralCopied]           = useState<""|"code"|"link">("");
  const [dobInput,setDobInput]       = useState("");
  const [dobSaving,setDobSaving]     = useState(false);
  const [dobError,setDobError]       = useState("");
  const [annivInput,setAnnivInput]   = useState("");
  const [annivSaving,setAnnivSaving] = useState(false);
  const [annivError,setAnnivError]   = useState("");

  const [notifItems,setNotifItems]         = useState<{_id:string;title:string;message:string;isRead:boolean;createdAt:string;category:string;action?:{route:string}}[]>([]);
  const [notifPage,setNotifPage]           = useState(1);
  const [notifPages,setNotifPages]         = useState(1);
  const [notifLoading,setNotifLoading]     = useState(false);
  const [notifPrefs,setNotifPrefs]         = useState<{orderUpdates:boolean;rewardUpdates:boolean;promotionalPush:boolean;promotionalEmail:boolean;promotionalInApp:boolean}|null>(null);
  const [notifPrefsSaving,setNotifPrefsSaving] = useState(false);

  function showToast(msg:string, type?:"success"|"error"|"info"){
    const resolved = type ?? (/fail|unable|invalid|required|match|fill|wrong|error|please (select|enter)/i.test(msg) ? "error" : "success");
    if(resolved==="error")actionToast.error("Action not completed",msg);
    else if(resolved==="info")actionToast.info("Update",msg);
    else actionToast.success("Action completed",msg);
  }

  useEffect(()=>{
    fetch("/api/user/me").then(r=>r.json()).then(d=>{
      if(!d.user){router.push("/");return;}
      setUser(d.user);
      setEditForm({name:d.user.name,phone:d.user.phone||"",city:d.user.city||""});
      setAvatarPreview(d.user.avatar?`/uploads/avatars/${d.user.avatar}`:"");
    }).catch(()=>router.push("/")).finally(()=>setLoading(false));
  },[]);

  async function loadAddresses(){
    const r=await fetch("/api/address");const d=await r.json();setAddresses(d.addresses||[]);
  }
  useEffect(()=>{loadAddresses();},[]);

  // Load orders and coupons on mount so overview always shows them
  useEffect(()=>{loadOrders();loadCoupons();},[]);

  async function loadOrders(){
    if(ordersLoaded)return;
    const r=await fetch("/api/orders");const d=await r.json();
    setOrders(d.orders||[]);setOrdersLoaded(true);
  }
  async function submitOrderCancellation(){
    if(!viewOrder || cancelSaving)return;
    const message=cancelMessage.trim();
    if(message.length<5){const error="Please tell us why you are cancelling (at least 5 characters).";setCancelError(error);actionToast.error("Order not cancelled",error);return;}
    setCancelSaving(true);setCancelError("");
    try{
      const r=await fetch(`/api/orders/${viewOrder._id}/cancel`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message})});
      const d=await r.json();
      if(!r.ok)throw new Error(d.error||"Unable to cancel order.");
      const updated=d.order as Order;
      setOrders(items=>items.map(order=>order._id===updated._id?updated:order));
      setViewOrder(updated);setCancelOrderOpen(false);setCancelMessage("");
      showToast("Order cancelled successfully.");
    }catch(error){const message=getUserErrorMessage(error,"Unable to cancel order.");setCancelError(message);actionToast.error("Order not cancelled",message);}
    finally{setCancelSaving(false);}
  }
  async function loadCoupons(){
    if(couponsLoaded)return;
    const r=await fetch("/api/coupons");const d=await r.json();
    setCoupons(d.coupons||[]);setCouponsLoaded(true);
  }

  async function loadRewardsHistoryPage(page:number){
    setRewardsHistoryLoading(true);
    try{
      const d=await rewardApi.getHistory(page);
      if(!("error" in d && d.error)){
        setRewardsHistory(d.transactions||[]);
        setRewardsHistoryPage(d.page||1);
        setRewardsHistoryPages(d.totalPages||1);
      }
    }finally{setRewardsHistoryLoading(false);}
  }

  async function loadNotifications(page:number){
    setNotifLoading(true);
    try{
      const r=await fetch(`/api/notifications?page=${page}&limit=20`);
      const d=await r.json();
      if(r.ok){
        setNotifItems(d.notifications||[]);
        setNotifPage(d.page||1);
        setNotifPages(d.totalPages||1);
      }
    }finally{setNotifLoading(false);}
    if(!notifPrefs){
      const pr=await fetch("/api/user/notification-preferences");
      const pd=await pr.json();
      if(pr.ok)setNotifPrefs(pd.preferences);
    }
  }

  async function markNotifRead(id:string){
    setNotifItems(prev=>prev.map(n=>n._id===id?{...n,isRead:true}:n));
    const r=await fetch(`/api/notifications/${id}/read`,{method:"PATCH"});
    if(r.ok)actionToast.success("Notification marked as read",undefined,{id:`notification-read-${id}`});
    else actionToast.error("Notification not updated",getUserResponseError(r),{id:`notification-read-${id}`});
  }

  async function markAllNotifsRead(){
    setNotifItems(prev=>prev.map(n=>({...n,isRead:true})));
    const r=await fetch("/api/notifications/read-all",{method:"PATCH"});
    if(r.ok)actionToast.success("Notifications updated","All notifications were marked as read.",{id:"notifications-read-all"});
    else actionToast.error("Notifications not updated",getUserResponseError(r),{id:"notifications-read-all"});
  }

  async function saveNotifPref(key:string,value:boolean){
    setNotifPrefsSaving(true);
    setNotifPrefs(prev=>prev?{...prev,[key]:value}:prev);
    try{
      const r=await fetch("/api/user/notification-preferences",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({[key]:value})});
      const d=await r.json();
      if(r.ok){setNotifPrefs(d.preferences);actionToast.success("Preferences saved",undefined,{id:"notification-preferences"});}
      else {setNotifPrefs(prev=>prev?{...prev,[key]:!value}:prev);actionToast.error("Preferences not saved",getUserResponseError(r,d),{id:"notification-preferences"});}
    }catch(error){setNotifPrefs(prev=>prev?{...prev,[key]:!value}:prev);actionToast.error("Preferences not saved",getUserErrorMessage(error),{id:"notification-preferences"});
    }finally{setNotifPrefsSaving(false);}
  }

  async function loadRewardsUpcoming(){
    const d=await rewardApi.getUpcoming();
    if(!("error" in d && d.error))setRewardsUpcoming(d);
  }

  async function loadAchievements(){
    setAchievementsLoading(true);
    trackRewardEvent("achievements_viewed");
    try{
      const d=await rewardApi.getAchievements();
      if(!("error" in d && d.error))setAchievementsData(d);
    }finally{setAchievementsLoading(false);}
  }

  async function loadMissions(){
    setMissionsLoading(true);
    trackRewardEvent("missions_viewed");
    try{
      const d=await rewardApi.getMissions();
      if(!("error" in d && d.error))setMissionsData(d);
    }finally{setMissionsLoading(false);}
  }

  async function loadReferrals(){
    setReferralsLoading(true);
    trackRewardEvent("referral_screen_viewed");
    try{
      const d=await rewardApi.getReferrals();
      if(!("error" in d && d.error))setReferralsData(d);
    }finally{setReferralsLoading(false);}
  }

  async function copyReferral(kind:"code"|"link"){
    if(!referralsData)return;
    const text=kind==="code"?referralsData.referralCode:referralsData.share.link;
    try{await navigator.clipboard.writeText(text);}catch{actionToast.error("Referral not copied","Clipboard access was unavailable.",{id:`referral-${kind}-copied`});return;}
    setReferralCopied(kind);
    trackRewardEvent(kind==="code"?"referral_code_copied":"referral_link_copied");
    actionToast.success(kind==="code"?"Referral code copied":"Referral link copied",undefined,{id:`referral-${kind}-copied`});
    setTimeout(()=>setReferralCopied(""),2000);
  }

  async function shareReferral(){
    if(!referralsData)return;
    trackRewardEvent("referral_shared");
    if(typeof navigator!=="undefined" && "share" in navigator){
      try{ await (navigator as unknown as {share:(d:{title:string;text:string;url:string})=>Promise<void>}).share({title:"Join Damru By Namo",text:referralsData.share.message,url:referralsData.share.link}); return; }catch{ /* user cancelled or unsupported — fall back to copy */ }
    }
    await copyReferral("link");
  }

  const expiryWarningTrackedRef=useRef(false);
  useEffect(()=>{
    const amount=rewardsDashboard?.expiry?.expiringSoonAmount??0;
    if(section==="rewards"&&amount>0&&!expiryWarningTrackedRef.current){
      expiryWarningTrackedRef.current=true;
      trackRewardEvent("expiry_warning_viewed");
    }
    if(amount<=0)expiryWarningTrackedRef.current=false;
  },[section,rewardsDashboard?.expiry?.expiringSoonAmount]);

  async function loadRewardsExtras(){
    trackRewardEvent("rewards_viewed");
    if(rewardsLoaded)return;
    setRewardsLoaded(true);
    await Promise.all([
      loadRewardsHistoryPage(1),
      rewardApi.getCoupons().then(d=>{setRewardsCoupons(d.coupons||[]);setRewardsCouponsLoaded(true);}),
      loadRewardsUpcoming(),
      loadAchievements(),
      loadMissions(),
      loadReferrals(),
    ]);
  }

  async function handleSaveDob(){
    if(!dobInput){setDobError("Please select a date.");actionToast.warning("Birthday not saved","Please select a date.",{id:"birthday-save"});return;}
    setDobSaving(true);setDobError("");
    const res=await rewardApi.updateDateOfBirth(dobInput);
    setDobSaving(false);
    if(!res.success){const message=getSafeUserMessage(res.error,"Could not save.");setDobError(message);actionToast.error("Birthday not saved",message,{id:"birthday-save"});return;}
    trackRewardEvent("birthday_added");
    await loadRewardsUpcoming();
    showToast("Date of birth saved!");
  }

  async function handleSaveAnniversary(){
    if(!annivInput){setAnnivError("Please select a date.");actionToast.warning("Anniversary not saved","Please select a date.",{id:"anniversary-save"});return;}
    setAnnivSaving(true);setAnnivError("");
    const res=await rewardApi.updateMarriageAnniversary(annivInput);
    setAnnivSaving(false);
    if(!res.success){const message=getSafeUserMessage(res.error,"Could not save.");setAnnivError(message);actionToast.error("Anniversary not saved",message,{id:"anniversary-save"});return;}
    trackRewardEvent("anniversary_added");
    await loadRewardsUpcoming();
    showToast("Anniversary date saved!");
  }

  function copyRewardCoupon(code:string){
    copyCoupon(code);
    trackRewardEvent("coupon_copied");
  }

  function switchSection(s:Section){
    setSection(s);setViewOrder(null);
    if(s==="orders")loadOrders();
    if(s==="coupons")loadCoupons();
    if(s==="rewards")loadRewardsExtras();
    if(s==="notifications")loadNotifications(1);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  // Deep-link: /my-profile?tab=rewards|notifications
  useEffect(()=>{
    const tab=searchParams.get("tab");
    if(tab!=="rewards"&&tab!=="notifications")return;
    Promise.resolve().then(()=>{ switchSection(tab); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[searchParams]);

  async function handleLogout(){const r=await fetch("/api/user/logout",{method:"POST"});if(!r.ok){actionToast.error("Unable to sign out",getUserResponseError(r));return;}actionToast.success("Signed out successfully");router.push("/");router.refresh();}

  async function handleSaveProfile(){
    if(!editForm.name.trim()){showToast("Name is required.");return;}
    if(editForm.phone && !/^[6-9]\d{9}$/.test(editForm.phone.trim())){showToast("Please enter a valid 10-digit phone number.");return;}
    setEditSaving(true);
    try{
      let avatarFilename=user?.avatar||"";
      if(avatarFile){
        const fd=new FormData();fd.append("file",avatarFile);fd.append("target","avatar");
        const uploadResponse=await fetch("/api/upload",{method:"POST",body:fd});const up=await uploadResponse.json();
        if(!uploadResponse.ok||!up.filename){const message=getUserResponseError(uploadResponse,up,"Unable to upload profile photo.");actionToast.error("Photo not uploaded",message,{id:"profile-save"});return;}
        avatarFilename=up.filename;
      }
      const r=await fetch("/api/user/me",{method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"updateProfile",...editForm,avatar:avatarFilename})});
      const d=await r.json();
      if(!r.ok||d.error){showToast(getUserResponseError(r,d,"Unable to update profile."),"error");return;}
      setUser(prev=>prev?{...prev,...d.user}:prev);
      setAvatarPreview(avatarFilename?`/uploads/avatars/${avatarFilename}`:"");
      if (typeof window !== "undefined" && d.user) {
        window.dispatchEvent(new CustomEvent("user-profile-updated", { detail: d.user }));
      }
      setShowEditModal(false);setAvatarFile(null);showToast("Profile updated successfully!");
    }catch(error){actionToast.error("Profile not updated",getUserErrorMessage(error),{id:"profile-save"});}finally{setEditSaving(false);}
  }

  async function handleChangePassword(){
    if(!pwForm.current||!pwForm.newPw||!pwForm.confirm){showToast("Fill all fields.");return;}
    if(pwForm.newPw!==pwForm.confirm){showToast("Passwords don't match.");return;}
    if(pwForm.newPw.length<6){showToast("Min 6 characters.");return;}
    setPwSaving(true);
    const r=await fetch("/api/user/me",{method:"PATCH",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({action:"changePassword",currentPassword:pwForm.current,newPassword:pwForm.newPw})});
    const d=await r.json();
    setPwSaving(false);
    if(!r.ok||d.error){showToast(getUserResponseError(r,d,"Unable to change password."),"error");return;}
    setPwForm({current:"",newPw:"",confirm:""});showToast("Password updated successfully!");
  }

  function openAddAddress(){setEditingAddr(null);setAddrForm({label:"Home",fullName:"",phone:"",house:"",area:"",city:"",state:"",pincode:"",isDefault:false});setShowAddrModal(true);}
  function openEditAddress(a:Address){setEditingAddr(a);setAddrForm({label:a.label,fullName:a.fullName,phone:a.phone,house:a.house,area:a.area,city:a.city,state:a.state,pincode:a.pincode,isDefault:a.isDefault});setShowAddrModal(true);}

  async function handleSaveAddress(){
    if(!addrForm.fullName||!addrForm.phone||!addrForm.house||!addrForm.city||!addrForm.state||!addrForm.pincode){showToast("Fill all required fields.");return;}
    if(!/^[6-9]\d{9}$/.test(addrForm.phone.trim())){showToast("Please enter a valid 10-digit phone number.");return;}
    setAddrSaving(true);
    const r=await fetch("/api/address",{method:editingAddr?"PATCH":"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(editingAddr?{id:editingAddr._id,...addrForm}:addrForm)});
    const d=await r.json();
    setAddrSaving(false);
    if(!r.ok||d.error){showToast(getUserResponseError(r,d,"Unable to save address."),"error");return;}
    await loadAddresses();setShowAddrModal(false);showToast(editingAddr?"Address updated!":"Address added!");
  }

  async function handleDeleteAddress(id:string){
    if(!confirm("Delete this address?"))return;
    const r=await fetch("/api/address",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    const d=await r.json();if(!r.ok){showToast(getUserResponseError(r,d,"Unable to delete address."),"error");return;}
    await loadAddresses();showToast("Address deleted!");
  }

  function copyCoupon(code:string){
    navigator.clipboard.writeText(code).then(()=>{setCopiedCode(code);setTimeout(()=>setCopiedCode(""),2000);showToast(`"${code}" copied to clipboard!`);}).catch(()=>actionToast.error("Coupon not copied","Clipboard access was unavailable.",{id:"coupon-copy"}));
  }

  if (loading) return <ProfileSkeleton />;
  if(!user) return null;

  const initials=user.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return(
    <div className="profile">
      <aside className="profile__sidebar">
        {([["overview","fa-regular fa-user","My Profile"],["rewards","fa-solid fa-coins","Damru Rewards"],["notifications","fa-solid fa-bell","Notifications"],["address","fa-solid fa-book","Address Book"],["orders","fa-solid fa-bag-shopping","My Orders"],["payment","fa-regular fa-credit-card","Payment Methods"],["coupons","fa-solid fa-tag","Offers & Coupons"],["settings","fa-solid fa-gear","Account Settings"],["help","fa-solid fa-circle-dollar-to-slot","Help & Support"]] as [Section,string,string][]).map(([id,icon,label])=>(
          <div key={id} className={`profile__nav-item${section===id?" active":""}`} onClick={()=>switchSection(id)}>
            <i className={icon}></i> {label}
          </div>
        ))}
        <div className="profile__nav-logout" onClick={handleLogout}><i className="fa-regular fa-user"></i> Logout</div>
      </aside>

      <main className="profile__main">

        {/* OVERVIEW */}
        {section==="overview"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">My Profile</h1>
            <p className="profile__page-subtitle">Manage your personal information.</p>
            <div className="profile__card">
              <div className="profile__user-row">
                <div className="profile__user-avatar" style={{overflow:"hidden",background:avatarPreview?"transparent":undefined}}>
                  {avatarPreview?<img src={avatarPreview} alt={user.name} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>:<span style={{fontFamily:"Poppins,sans-serif",fontWeight:700,fontSize:"1.4rem",color:"#e67e22"}}>{initials}</span>}
                </div>
                <div className="profile__user-info">
                  <div className="profile__user-name">{user.name}</div>
                  <div className="profile__user-email">{user.email}</div>
                  {user.phone&&<div className="profile__user-phone">{user.phone}</div>}
                  {user.city&&<div className="profile__user-phone" style={{color:"#aaa",fontSize:13}}>{user.city}</div>}
                </div>
                <button className="profile__edit-btn" onClick={()=>{setEditForm({name:user.name,phone:user.phone||"",city:user.city||""});setShowEditModal(true);}}>
                  <i className="fa-solid fa-pen"></i> Edit Profile
                </button>
              </div>
            </div>
            {rewardsDashboard && (
              <div className="profile__card" style={{cursor:"pointer"}} onClick={()=>switchSection("rewards")}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:"1.6rem"}}>🪙</span>
                    <div>
                      <p style={{fontFamily:"Poppins,sans-serif",fontWeight:700,fontSize:"1.1rem",color:"#e67e22",margin:0}}>{rewardsDashboard.damruBalance} Damru</p>
                      <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#aaa",margin:0,textTransform:"capitalize"}}>{rewardsDashboard.loyaltyLevel} member</p>
                    </div>
                  </div>
                  <span className="profile__view-all">View Rewards &gt;</span>
                </div>
              </div>
            )}
            <div className="profile__overview-grid">
              <div className="profile__overview-card">
                <div className="profile__overview-card-title">Address Book</div>
                {addresses.slice(0,3).map(a=>(
                  <div key={a._id} className="profile__addr-mini">
                    <div className="profile__addr-label"><i className={`fa-solid ${a.label==="Home"?"fa-house":a.label==="Office"?"fa-building":"fa-location-dot"}`}></i> {a.label}</div>
                    <div className="profile__addr-text">{a.house}{a.area?`, ${a.area}`:""}, {a.city}, {a.state} {a.pincode}</div>
                  </div>
                ))}
                {addresses.length===0&&<p style={{fontSize:13,color:"#aaa",fontFamily:"Poppins,sans-serif"}}>No addresses saved.</p>}
                <span className="profile__add-new" onClick={()=>switchSection("address")}>+ Add New Address</span>
              </div>
              <div className="profile__overview-card">
                <div className="profile__overview-card-title">My Orders <span className="profile__view-all" onClick={()=>switchSection("orders")}>View All &gt;</span></div>
                {orders.slice(0,2).map(o=>(
                  <div key={o._id} className="profile__order-mini">
                    <div className="profile__order-top"><span className="profile__order-id">{o.orderId}</span><span className="profile__order-date">{fmtDate(o.createdAt)}</span></div>
                    <div className="profile__order-items">{o.items.map(i=>`${i.qty}x ${i.name}`).join(", ")}</div>
                    <div className="profile__order-bottom"><span className="profile__order-total">Total ₹{o.total}/-</span><span className="profile__view-order" onClick={()=>{switchSection("orders");setViewOrder(o);}}>View Order</span></div>
                  </div>
                ))}
                {!ordersLoaded&&<p style={{fontSize:13,color:"#aaa",fontFamily:"Poppins,sans-serif"}}>Loading…</p>}
                {ordersLoaded&&orders.length===0&&<p style={{fontSize:13,color:"#aaa",fontFamily:"Poppins,sans-serif"}}>No orders yet.</p>}
              </div>
              <div className="profile__overview-card">
                <div className="profile__overview-card-title">Payment Method</div>
                <div className="profile__pay-mini"><div className="profile__card-chip"></div><span className="profile__card-num">....8475</span></div>
                <div className="profile__add-pay" onClick={()=>switchSection("payment")}>+ Add New Payment Method</div>
              </div>
              <div className="profile__overview-card">
                <div className="profile__overview-card-title">Offer & Coupons <span className="profile__view-all" onClick={()=>switchSection("coupons")}>View All &gt;</span></div>
                {coupons.slice(0,2).map(c=>(
                  <div key={c._id} className="profile__coupon-mini">
                    <div className="profile__coupon-top"><span className="profile__coupon-code">{c.code}</span>{c.expiryDate&&<div className="profile__coupon-valid">Valid till :<br/>{fmtDate(c.expiryDate)}</div>}</div>
                    <div className="profile__coupon-desc">{c.description||(c.type==="flat"?`₹${c.value} off`:`${c.value}% off`)}</div>
                  </div>
                ))}
                {!couponsLoaded&&<p style={{fontSize:13,color:"#aaa",fontFamily:"Poppins,sans-serif"}}>Loading…</p>}
                {couponsLoaded&&coupons.length===0&&<p style={{fontSize:13,color:"#aaa",fontFamily:"Poppins,sans-serif"}}>No coupons available.</p>}
              </div>
            </div>
          </section>
        )}

        {/* DAMRU REWARDS */}
        {section==="rewards"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">Damru Rewards</h1>
            <p className="profile__page-subtitle">Your Damru wallet, coupons, and upcoming rewards</p>
            <ActiveCampaignOffers />

            {!rewardsDashboard ? (
              <div className="profile__card"><p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading your wallet…</p></div>
            ) : (
              <div className="profile__card">
                <div className="rewards__wallet-grid">
                  <div className="rewards__wallet-stat">
                    <p className="rewards__wallet-stat-label">Available Damru</p>
                    <p className="rewards__wallet-stat-value">{rewardsDashboard.damruBalance}</p>
                  </div>
                  <div className="rewards__wallet-stat">
                    <p className="rewards__wallet-stat-label">Lifetime Earned</p>
                    <p className="rewards__wallet-stat-value">{rewardsDashboard.damruTotalEarned}</p>
                  </div>
                  <div className="rewards__wallet-stat">
                    <p className="rewards__wallet-stat-label">Redeemed</p>
                    <p className="rewards__wallet-stat-value">{rewardsDashboard.damruTotalRedeemed}</p>
                  </div>
                  <div className="rewards__wallet-stat">
                    <p className="rewards__wallet-stat-label">Current Tier</p>
                    <p className="rewards__wallet-stat-value">{rewardsDashboard.loyalty?.currentTier?.badgeIcon} {rewardsDashboard.loyalty?.currentTier?.name || rewardsDashboard.loyaltyLevel}</p>
                  </div>
                </div>
                {rewardsDashboard.rewardDebt > 0 && <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#b91c1c",margin:"12px 0 0"}}>Future rewards will first settle {rewardsDashboard.rewardDebt} Damru from a prior reward adjustment.</p>}
                {rewardsDashboard.loyalty?.nextTier && (
                  <div>
                    <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",margin:"0 0 4px"}}>
                      {rewardsDashboard.loyalty.remainingValue.toLocaleString("en-IN")} {rewardsDashboard.loyalty.currentTier?.code ? "qualification points" : "Damru"} to reach <span style={{fontWeight:600}}>{rewardsDashboard.loyalty.nextTier.name}</span>
                    </p>
                    <div className="rewards__progress-track">
                      <div className="rewards__progress-fill" style={{width:`${rewardsDashboard.loyalty.progressPercentage}%`}} />
                    </div>
                  </div>
                )}
                {rewardsDashboard.expiry?.expiringSoonAmount>0 && (
                  <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#e67e22",margin:"10px 0 0"}}>
                    ⚠ {rewardsDashboard.expiry.expiringSoonAmount} Damru expiring within {rewardsDashboard.expiry.warningDays} days
                  </p>
                )}
              </div>
            )}

            {/* Expiring Soon */}
            {rewardsDashboard && rewardsDashboard.expiry && rewardsDashboard.expiry.expiringSoonAmount>0 && (
              <>
                <div className="rewards__section-title">Expiring Soon</div>
                <div className="profile__card" style={{background:"#fffbeb",border:"1px solid #fde68a"}}>
                  <p style={{fontFamily:"Poppins,sans-serif",fontWeight:700,fontSize:15,color:"#92400e",margin:"0 0 4px"}}>
                    ⚠ {rewardsDashboard.expiry.expiringSoonAmount} Damru expiring soon
                  </p>
                  {rewardsDashboard.expiry.nearestExpiryDate&&(
                    <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#92400e",margin:"0 0 10px"}}>
                      Expires by {fmtDateFull(rewardsDashboard.expiry.nearestExpiryDate)}
                    </p>
                  )}
                  <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#92400e",margin:"0 0 12px"}}>Use your Damru before they expire.</p>
                  <Link href="/menu" className="profile__update-btn" style={{textDecoration:"none",display:"inline-block"}} onClick={()=>trackRewardEvent("shop_from_expiry_warning")}>Shop Now</Link>
                </div>
              </>
            )}

            {/* Daily Streak */}
            {rewardsDashboard?.streak?.isActive && (
              <>
                <div className="rewards__section-title">Daily Streak 🔥</div>
                <div className="profile__card">
                  <div className="rewards__streak-row">
                    <div>
                      <p className="rewards__streak-current">{rewardsDashboard.streak.currentStreak} Day{rewardsDashboard.streak.currentStreak===1?"":"s"}</p>
                      <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",margin:"2px 0 0"}}>
                        Longest streak: {rewardsDashboard.streak.longestStreak} day{rewardsDashboard.streak.longestStreak===1?"":"s"}
                      </p>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",margin:"0 0 2px"}}>
                        {rewardsDashboard.streak.claimedToday ? "Next reward" : "Check in today for"}
                      </p>
                      <p className="rewards__streak-next">+{rewardsDashboard.streak.nextRewardAmount} Damru</p>
                    </div>
                  </div>
                  <div className="rewards__streak-dots">
                    {rewardsDashboard.streak.days.map(d=>{
                      const cyclePos = ((rewardsDashboard.streak!.currentStreak-1)%Math.max(1,rewardsDashboard.streak!.cycleLength))+1;
                      const isToday = rewardsDashboard.streak!.claimedToday && d.day===cyclePos;
                      const isNext = !rewardsDashboard.streak!.claimedToday && d.day===rewardsDashboard.streak!.nextRewardDay;
                      return (
                        <div key={d.day} className={`rewards__streak-dot${isToday?" rewards__streak-dot--done":""}${isNext?" rewards__streak-dot--next":""}`}>
                          <span>{d.day}</span>
                          <small>{d.amount}</small>
                        </div>
                      );
                    })}
                  </div>
                  {rewardsDashboard.streak.claimedToday
                    ? <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#16a34a",margin:"10px 0 0"}}>✓ Today&apos;s streak reward has been credited.</p>
                    : <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",margin:"10px 0 0"}}>Visit again tomorrow to keep your streak alive.</p>}
                </div>
              </>
            )}

            {/* Missions */}
            <div className="rewards__section-title">Missions</div>
            <div className="profile__card">
              {missionsLoading && !missionsData ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading missions…</p>
              ) : !missionsData || missionsData.missions.length===0 ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No missions available right now.</p>
              ) : (<>
                <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#888",margin:"0 0 14px"}}>
                  {missionsData.summary.active} Active{missionsData.summary.completed>0?` · ${missionsData.summary.completed} Completed`:""}
                </p>
                <div className="rewards__mission-list">
                  {missionsData.missions.map(m=>{
                    const done=m.status==="CLAIMED"||m.status==="COMPLETED";
                    const expired=m.status==="EXPIRED";
                    const daysLeft=m.timeRemaining!==null?Math.ceil(m.timeRemaining/86400000):null;
                    return (
                      <div key={`${m.id}`} className={`rewards__mission-card${done?" rewards__mission-card--done":""}${expired?" rewards__mission-card--expired":""}`}>
                        <div className="rewards__mission-head">
                          <p className="rewards__mission-name">{done?"✓ ":""}{m.name}</p>
                          {!done && !expired && daysLeft!==null && <span className="rewards__mission-time">{daysLeft<=0?"Ends today":`${daysLeft} day${daysLeft===1?"":"s"} left`}</span>}
                          {expired && <span className="rewards__mission-time rewards__mission-time--expired">Expired</span>}
                        </div>
                        <p className="rewards__mission-desc">{m.description}</p>
                        {done ? (
                          <p className="rewards__achievement-reward">{m.reward.damruAmount} Damru Earned</p>
                        ) : (
                          <>
                            <p className="rewards__achievement-progress">{m.progress} / {m.target} · {m.progressPercentage}%</p>
                            <div className="rewards__progress-track">
                              <div className="rewards__progress-fill" style={{width:`${m.progressPercentage}%`}} />
                            </div>
                            {m.reward.damruAmount>0 && <p className="rewards__achievement-reward-hint">Reward: {m.reward.damruAmount} Damru</p>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>)}
            </div>

            {/* Achievements */}
            <div className="rewards__section-title">Achievements</div>
            <div className="profile__card">
              {achievementsLoading && !achievementsData ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading achievements…</p>
              ) : !achievementsData || achievementsData.achievements.length===0 ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No achievements available right now.</p>
              ) : (<>
                <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#888",margin:"0 0 14px"}}>
                  {achievementsData.summary.unlocked} / {achievementsData.summary.total} Unlocked
                </p>
                <div className="rewards__achievement-grid">
                  {achievementsData.achievements.map(a=>{
                    const done=a.status==="CLAIMED"||a.status==="COMPLETED";
                    return (
                      <div key={a.id} className={`rewards__achievement-card${done?" rewards__achievement-card--done":""}`}>
                        <p className="rewards__achievement-name">{done?"✓ ":""}{a.name}</p>
                        <p className="rewards__achievement-desc">{a.description}</p>
                        {done ? (
                          <p className="rewards__achievement-reward">{a.reward.damruAmount>0?`${a.reward.damruAmount} Damru Earned`:""}{a.badgeName?` · ${a.badgeName}`:""}</p>
                        ) : (
                          <>
                            <p className="rewards__achievement-progress">{a.progress} / {a.target} · {a.progressPercentage}%</p>
                            <div className="rewards__progress-track">
                              <div className="rewards__progress-fill" style={{width:`${a.progressPercentage}%`}} />
                            </div>
                            {a.reward.damruAmount>0 && <p className="rewards__achievement-reward-hint">Reward: {a.reward.damruAmount} Damru{a.badgeName?` + ${a.badgeName} badge`:""}</p>}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>)}
            </div>

            {/* Invite & Earn */}
            <div className="rewards__section-title">Invite &amp; Earn</div>
            <div className="profile__card">
              {referralsLoading && !referralsData ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
              ) : !referralsData ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Referrals aren&apos;t available right now.</p>
              ) : (<>
                <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",margin:"0 0 6px"}}>Your Code</p>
                <div className="rewards__referral-code-row">
                  <span className="rewards__referral-code">{referralsData.referralCode}</span>
                  <button className="profile__btn-reorder" onClick={()=>copyReferral("code")}>{referralCopied==="code"?"Copied!":"Copy Code"}</button>
                  <button className="profile__btn-reorder" onClick={()=>copyReferral("link")}>{referralCopied==="link"?"Copied!":"Copy Link"}</button>
                  <button className="profile__update-btn" onClick={shareReferral}>Share</button>
                </div>
                <div className="rewards__wallet-grid" style={{marginTop:16}}>
                  <div className="rewards__wallet-stat">
                    <p className="rewards__wallet-stat-label">Successful</p>
                    <p className="rewards__wallet-stat-value">{referralsData.summary.successful}</p>
                  </div>
                  <div className="rewards__wallet-stat">
                    <p className="rewards__wallet-stat-label">Pending</p>
                    <p className="rewards__wallet-stat-value">{referralsData.summary.pending}</p>
                  </div>
                  <div className="rewards__wallet-stat">
                    <p className="rewards__wallet-stat-label">Damru Earned</p>
                    <p className="rewards__wallet-stat-value">{referralsData.summary.totalDamruEarned}</p>
                  </div>
                </div>
                {referralsData.referrals.length>0 && (
                  <div style={{marginTop:18}}>
                    {referralsData.referrals.map(r=>(
                      <div key={r.id} className="rewards__tx-row">
                        <div>
                          <p className="rewards__tx-desc">{r.referredName||"Referral"} — {r.status.replace(/_/g," ").toLowerCase()}</p>
                          <p className="rewards__tx-date">{fmtDate(r.registeredAt)}</p>
                        </div>
                        {r.status==="REWARDED" && <span className="rewards__tx-amount rewards__tx-amount--credit">+{r.rewardAmount} Damru</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>)}
            </div>

            {/* Upcoming Rewards */}
            <div className="rewards__section-title">Upcoming Rewards</div>
            <div className="profile__card">
              {!rewardsUpcoming ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
              ) : (
                <div className="rewards__upcoming-grid">
                  <div className="rewards__upcoming-card">
                    <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#aaa",margin:"0 0 4px"}}>🎂 Birthday</p>
                    {rewardsUpcoming.birthdayDaysLeft!==null
                      ? <p style={{fontFamily:"Poppins,sans-serif",fontWeight:700,margin:0}}>{rewardsUpcoming.birthdayDaysLeft} Days Left</p>
                      : <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#e67e22",margin:0,cursor:"pointer"}} onClick={()=>document.getElementById("rewards-occasion-form")?.scrollIntoView({behavior:"smooth"})}>Add your birthday to unlock rewards →</p>}
                  </div>
                  <div className="rewards__upcoming-card">
                    <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#aaa",margin:"0 0 4px"}}>💍 Marriage Anniversary</p>
                    {rewardsUpcoming.anniversaryDaysLeft!==null
                      ? <p style={{fontFamily:"Poppins,sans-serif",fontWeight:700,margin:0}}>{rewardsUpcoming.anniversaryDaysLeft} Days Left</p>
                      : <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#e67e22",margin:0,cursor:"pointer"}} onClick={()=>document.getElementById("rewards-occasion-form")?.scrollIntoView({behavior:"smooth"})}>Add your anniversary to unlock rewards →</p>}
                  </div>
                  <div className="rewards__upcoming-card">
                    <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#aaa",margin:"0 0 4px"}}>⭐ Next Loyalty Level</p>
                    <p style={{fontFamily:"Poppins,sans-serif",fontWeight:700,margin:0}}>
                      {rewardsUpcoming.nextLoyaltyLevel ? `${rewardsUpcoming.damruToNextLevel} Damru Remaining` : "Top tier reached"}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Active Coupons */}
            <div className="rewards__section-title">Active Coupons</div>
            <div className="profile__card">
              {!rewardsCouponsLoaded ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
              ) : rewardsCoupons.length===0 ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No active coupons right now.</p>
              ) : rewardsCoupons.map(c=>(
                <div key={c._id} className="profile__coupon-row">
                  <i className="fa-solid fa-tag profile__coupon-icon"></i>
                  <div className="profile__coupon-info">
                    <div className="profile__coupon-name">{c.code}</div>
                    <div className="profile__coupon-detail">{c.description||(c.type==="flat"?`₹${c.value} off`:`${c.value}% off${c.maxDiscount?` (max ₹${c.maxDiscount})`:""}`)} {c.minOrderValue>0?`· Min ₹${c.minOrderValue}`:""}</div>
                    {c.expiryDate&&<div className="profile__coupon-validity">Valid till: {fmtDate(c.expiryDate)}</div>}
                  </div>
                  <div style={{display:"flex",gap:6}}>
                    <button className="profile__btn-reorder" style={{fontSize:12,padding:"6px 12px",whiteSpace:"nowrap"}} onClick={()=>copyRewardCoupon(c.code)}>
                      {copiedCode===c.code?"Copied!":"Copy"}
                    </button>
                    <Link href="/menu" className="profile__btn-reorder" style={{fontSize:12,padding:"6px 12px",whiteSpace:"nowrap",textDecoration:"none"}} onClick={()=>trackRewardEvent("coupon_used")}>
                      Shop Now
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Reward History */}
            <div className="rewards__section-title">Reward History</div>
            <div className="profile__card">
              {rewardsHistoryLoading ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
              ) : rewardsHistory.length===0 ? (
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No Damru activity yet.</p>
              ) : (<>
                {rewardsHistory.map(tx=>(
                  <div key={tx._id} className="rewards__tx-row">
                    <div>
                      <p className="rewards__tx-desc">{tx.description||tx.category}</p>
                      <p className="rewards__tx-date">{fmtDateTime(tx.createdAt)}</p>
                      {tx.type==="credit"&&tx.expiresAt&&<p className="rewards__tx-date">Expires {fmtDate(tx.expiresAt)}</p>}
                    </div>
                    <span className={`rewards__tx-amount rewards__tx-amount--${tx.type}`}>{tx.type==="credit"?"+":"−"}{tx.amount} Damru</span>
                  </div>
                ))}
                {rewardsHistoryPages>1&&(
                  <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:14}}>
                    <button className="profile__btn-reorder" disabled={rewardsHistoryPage<=1} onClick={()=>loadRewardsHistoryPage(rewardsHistoryPage-1)}>Prev</button>
                    <span style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#888",alignSelf:"center"}}>Page {rewardsHistoryPage} of {rewardsHistoryPages}</span>
                    <button className="profile__btn-reorder" disabled={rewardsHistoryPage>=rewardsHistoryPages} onClick={()=>loadRewardsHistoryPage(rewardsHistoryPage+1)}>Next</button>
                  </div>
                )}
              </>)}
            </div>

            {/* Occasion Profile */}
            <div className="rewards__section-title" id="rewards-occasion-form">Occasion Profile</div>
            <div className="profile__card">
              <div className="rewards__occasion-row">
                <div>
                  <p style={{fontFamily:"Poppins,sans-serif",fontWeight:600,fontSize:14,margin:"0 0 2px"}}>🎂 Date of Birth</p>
                  {rewardsUpcoming?.birthdayDaysLeft!==null&&rewardsUpcoming!==null
                    ? <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#888",margin:0}}><i className="fa-solid fa-lock" style={{marginRight:6}}></i>{rewardsUpcoming.dateOfBirth?fmtDateFull(rewardsUpcoming.dateOfBirth):"Set"} — contact support to change</p>
                    : (
                      <div style={{marginTop:6}}>
                        <input type="date" value={dobInput} max={todayISO()} onChange={e=>{setDobInput(e.target.value);setDobError("");}}
                          style={{border:"1px solid #eee",borderRadius:8,padding:"7px 10px",fontFamily:"Poppins,sans-serif",fontSize:13}}/>
                        <p className="rewards__occasion-warning">After saving this date, future changes require support approval.</p>
                        {dobError&&<p style={{color:"#dc2626",fontSize:12,fontFamily:"Poppins,sans-serif",margin:"6px 0 0"}}>{dobError}</p>}
                      </div>
                    )}
                </div>
                {(rewardsUpcoming===null||rewardsUpcoming.birthdayDaysLeft===null)&&(
                  <button className="profile__update-btn" onClick={handleSaveDob} disabled={dobSaving}>{dobSaving?"Saving…":"Save"}</button>
                )}
              </div>
              <div className="rewards__occasion-row">
                <div>
                  <p style={{fontFamily:"Poppins,sans-serif",fontWeight:600,fontSize:14,margin:"0 0 2px"}}>💍 Marriage Anniversary</p>
                  {rewardsUpcoming?.anniversaryDaysLeft!==null&&rewardsUpcoming!==null
                    ? <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#888",margin:0}}><i className="fa-solid fa-lock" style={{marginRight:6}}></i>{rewardsUpcoming.marriageAnniversary?fmtDateFull(rewardsUpcoming.marriageAnniversary):"Set"} — contact support to change</p>
                    : (
                      <div style={{marginTop:6}}>
                        <input type="date" value={annivInput} max={todayISO()} onChange={e=>{setAnnivInput(e.target.value);setAnnivError("");}}
                          style={{border:"1px solid #eee",borderRadius:8,padding:"7px 10px",fontFamily:"Poppins,sans-serif",fontSize:13}}/>
                        <p className="rewards__occasion-warning">After saving this date, future changes require support approval.</p>
                        {annivError&&<p style={{color:"#dc2626",fontSize:12,fontFamily:"Poppins,sans-serif",margin:"6px 0 0"}}>{annivError}</p>}
                      </div>
                    )}
                </div>
                {(rewardsUpcoming===null||rewardsUpcoming.anniversaryDaysLeft===null)&&(
                  <button className="profile__update-btn" onClick={handleSaveAnniversary} disabled={annivSaving}>{annivSaving?"Saving…":"Save"}</button>
                )}
              </div>
            </div>
          </section>
        )}

        {/* NOTIFICATIONS */}
        {section==="notifications"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">Notifications</h1>
            <p className="profile__page-subtitle">Order, payment, reward, and offer updates</p>

            <div style={{display:"flex",justifyContent:"flex-end",marginBottom:10}}>
              {notifItems.some(n=>!n.isRead) && (
                <button className="profile__btn-reorder" onClick={markAllNotifsRead}>Mark All Read</button>
              )}
            </div>

            <div className="profile__card">
              {notifLoading?(
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
              ):notifItems.length===0?(
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No notifications yet.</p>
              ):(<>
                {notifItems.map(n=>(
                  <div key={n._id} className="rewards__tx-row" style={{cursor:"pointer",background:n.isRead?"transparent":"#fff7ed",borderRadius:8,padding:"10px 8px"}}
                    onClick={()=>{ if(!n.isRead)markNotifRead(n._id); if(n.action?.route)router.push(n.action.route); }}>
                    <div>
                      <p className="rewards__tx-desc">{n.title}</p>
                      <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",margin:"2px 0"}}>{n.message}</p>
                      <p className="rewards__tx-date">{fmtDateTime(n.createdAt)}</p>
                    </div>
                    {!n.isRead && <span style={{width:8,height:8,borderRadius:"50%",background:"#e67e22",flexShrink:0}} />}
                  </div>
                ))}
                {notifPages>1&&(
                  <div style={{display:"flex",justifyContent:"center",gap:10,marginTop:14}}>
                    <button className="profile__btn-reorder" disabled={notifPage<=1} onClick={()=>loadNotifications(notifPage-1)}>Prev</button>
                    <span style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#888",alignSelf:"center"}}>Page {notifPage} of {notifPages}</span>
                    <button className="profile__btn-reorder" disabled={notifPage>=notifPages} onClick={()=>loadNotifications(notifPage+1)}>Next</button>
                  </div>
                )}
              </>)}
            </div>

            <div className="rewards__section-title">Notification Preferences</div>
            <div className="profile__card">
              {!notifPrefs?(
                <p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:14}}>
                  {([
                    ["orderUpdates","Order & Payment Updates"],
                    ["rewardUpdates","Reward Updates"],
                    ["promotionalInApp","Offers — In-App"],
                    ["promotionalEmail","Offers — Email"],
                    ["promotionalPush","Offers — Push"],
                  ] as [keyof typeof notifPrefs,string][]).map(([key,label])=>(
                    <label key={key} style={{display:"flex",alignItems:"center",justifyContent:"space-between",fontFamily:"Poppins,sans-serif",fontSize:14}}>
                      {label}
                      <input type="checkbox" checked={notifPrefs[key]} disabled={notifPrefsSaving} onChange={e=>saveNotifPref(key,e.target.checked)} />
                    </label>
                  ))}
                  <p style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#aaa",margin:0}}>
                    Critical account and security notifications (like password changes) are always sent regardless of these settings.
                  </p>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ADDRESS */}
        {section==="address"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">Address Book</h1>
            <p className="profile__page-subtitle">Manage your saved addresses</p>
            <div id="address-list">
              {addresses.map(a=>(
                <div key={a._id} className="profile__addr-card">
                  <div className="profile__addr-header">
                    <div className="profile__addr-type">
                      <i className={`fa-solid ${a.label==="Home"?"fa-house":a.label==="Office"?"fa-building":"fa-location-dot"}`}></i> {a.label}
                      {a.isDefault&&<span style={{marginLeft:8,fontSize:11,background:"#fff7ed",color:"#e67e22",border:"1px solid #fed7aa",borderRadius:6,padding:"1px 7px",fontWeight:600}}>Default</span>}
                    </div>
                    <div className="profile__addr-actions">
                      <i className="fa-regular fa-pen-to-square" onClick={()=>openEditAddress(a)} title="Edit"></i>
                      <i className="fa-regular fa-trash-can" onClick={()=>handleDeleteAddress(a._id)} title="Delete"></i>
                    </div>
                  </div>
                  <div className="profile__addr-full">{a.fullName} · {a.phone}<br/>{a.house}{a.area?`, ${a.area}`:""}, {a.city}, {a.state} {a.pincode}</div>
                </div>
              ))}
              {addresses.length===0&&<p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",marginBottom:16}}>No addresses yet.</p>}
            </div>
            <button className="profile__add-addr-btn" onClick={openAddAddress}>+ Add New Address</button>
          </section>
        )}

        {/* ORDERS LIST */}
        {section==="orders"&&!viewOrder&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">My Orders</h1>
            <p className="profile__page-subtitle">View or manage your orders</p>
            {!ordersLoaded?<p style={{fontFamily:"Poppins,sans-serif",color:"#aaa"}}>Loading orders…</p>:orders.length===0?<p style={{fontFamily:"Poppins,sans-serif",color:"#aaa"}}>No orders yet. <Link href="/menu" style={{color:"#e67e22"}}>Browse Menu →</Link></p>:(
              <div id="orders-list">
                {orders.map(o=>{const ss=STATUS_STYLE[o.status]??STATUS_STYLE.pending;return(
                  <div key={o._id} className="profile__order-card">
                    <div className="profile__order-header">
                      <div><div className="profile__order-card-id">{o.orderId}</div><div className="profile__order-card-date">{fmtDate(o.createdAt)}</div></div>
                      <span className="profile__status-badge" style={{background:ss.bg,color:ss.color}}><i className={ss.icon}></i> {o.status === "delivered" && o.tableNumber ? "Served" : o.status === "out_for_delivery" ? "Out for Delivery" : o.status.replace(/_/g," ").replace(/\b\w/g,c=>c.toUpperCase())}</span>
                    </div>
                    <div className="profile__order-card-items">{o.items.map(i=>`${i.qty}x ${i.name}`).join(", ")}</div>
                    <div className="profile__order-card-footer">
                      <span className="profile__order-card-total">Total ₹{o.total}/-</span>
                      <div className="profile__order-btns"><button className="profile__btn-view" onClick={()=>setViewOrder(o)}>View Order</button></div>
                    </div>
                  </div>
                );})}
              </div>
            )}
          </section>
        )}

        {/* ORDER DETAIL */}
        {section==="orders"&&viewOrder&&(
          <section className="profile__section active">
            <button type="button" className="profile__order-detail-back" onClick={()=>{setViewOrder(null);setCancelOrderOpen(false);}} style={{border:0,background:"transparent",padding:0,cursor:"pointer"}}><i className="fa-solid fa-arrow-left"></i> Back to Orders</button>
            <h1 className="profile__page-title">{viewOrder.orderId}</h1>
            <p className="profile__page-subtitle">
              {fmtDate(viewOrder.createdAt)} · {viewOrder.paymentMethod.toUpperCase()}
              {viewOrder.paymentMethod !== "cod" && viewOrder.paymentStatus && PAYMENT_STATUS_DISPLAY[viewOrder.paymentStatus] && (
                <span style={{
                  marginLeft: 8, fontSize: 12, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
                  color: PAYMENT_STATUS_DISPLAY[viewOrder.paymentStatus].color,
                  background: PAYMENT_STATUS_DISPLAY[viewOrder.paymentStatus].bg,
                }}>
                  {PAYMENT_STATUS_DISPLAY[viewOrder.paymentStatus].label}
                </span>
              )}
            </p>
            {viewOrder.paymentMethod !== "cod" && (viewOrder.paymentStatus === "refund_pending" || viewOrder.paymentStatus === "partially_refunded" || viewOrder.paymentStatus === "refunded") && (
              <p style={{ fontSize: 13, color: "#6b7280", marginTop: -4, marginBottom: 12 }}>
                {viewOrder.paymentStatus === "refund_pending"
                  ? "A refund has been initiated for this order."
                  : `₹${viewOrder.refundedAmount || 0} refunded${(viewOrder.paymentAmount ?? 0) > (viewOrder.refundedAmount ?? 0) ? ` of ₹${viewOrder.paymentAmount}` : ""}.`}
                {" "}Bank/payment-provider settlement timing can differ from this status.
              </p>
            )}
            {/* ── Order Status Pipeline ── */}
            <div className="profile__card" style={{marginBottom:16}}>
              <div className="profile__cart-section-title" style={{marginBottom:16}}>Order Status</div>
              {(() => {
                const STEPS = [
                  { key:"pending",          label:viewOrder.paymentMethod !== "cod" && viewOrder.paymentStatus !== "paid" ? "Payment Pending" : "Order Placed",  icon:"fa-regular fa-clock" },
                  { key:"confirmed",        label:"Confirmed",     icon:"fa-regular fa-circle-check" },
                  { key:"preparing",        label:"Preparing",     icon:"fa-solid fa-utensils" },
                  { key:"out_for_delivery", label:"Out for Delivery", icon:"fa-solid fa-truck" },
                  { key:"delivered",        label:"Delivered",     icon:"fa-solid fa-house-circle-check" },
                ].filter(s => {
                  if (viewOrder.tableNumber && s.key === "out_for_delivery") return false;
                  return true;
                }).map(s => {
                  if (s.key === "delivered" && viewOrder.tableNumber) {
                    return { ...s, label: "Served", icon: "fa-regular fa-circle-check" };
                  }
                  return s;
                });
                const ORDER = STEPS.map(s => s.key);
                const isCancelled = viewOrder.status === "cancelled";
                const currentIdx  = isCancelled ? -1 : ORDER.indexOf(viewOrder.status);
                return (
                  <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",padding:"0 8px",overflowX:"auto"}}>
                    {STEPS.map((step, i) => {
                      const isDone   = !isCancelled && currentIdx > i;
                      const isActive = !isCancelled && currentIdx === i;
                      const color    = isDone || isActive ? "#e67e22" : "#d1d5db";
                      const textColor = isDone || isActive ? "#e67e22" : "#9ca3af";
                      return (
                        <div key={step.key} style={{display:"flex",alignItems:"center",flex:1}}>
                          <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:6,minWidth:60}}>
                            <div style={{
                              width:44, height:44, borderRadius:"50%",
                              background: isDone ? "#e67e22" : isActive ? "#fff7ed" : "#f9fafb",
                              border: `2.5px solid ${color}`,
                              display:"flex", alignItems:"center", justifyContent:"center",
                              boxShadow: isActive ? "0 0 0 4px rgba(230,126,34,0.15)" : "none",
                              transition:"all 0.3s",
                              position:"relative",
                            }}>
                              <i className={step.icon} style={{color: isDone ? "#fff" : color, fontSize:16}}></i>
                              {isDone && <span style={{position:"absolute",top:-4,right:-4,width:16,height:16,background:"#16a34a",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",border:"2px solid #fff"}}>
                                <i className="fa-solid fa-check" style={{color:"#fff",fontSize:8}}></i>
                              </span>}
                            </div>
                            <span style={{fontFamily:"Poppins,sans-serif",fontSize:10,fontWeight:isActive?700:500,color:textColor,textAlign:"center",lineHeight:1.3,whiteSpace:"nowrap"}}>{step.label}</span>
                          </div>
                          {i < STEPS.length - 1 && (
                            <div style={{flex:1,height:2.5,background:isDone?"#e67e22":"#e5e7eb",margin:"0 4px",marginBottom:22,borderRadius:2,transition:"background 0.3s"}} />
                          )}
                        </div>
                      );
                    })}
                    {isCancelled && (
                      <div style={{position:"absolute",display:"none"}}></div>
                    )}
                  </div>
                );
              })()}
              {viewOrder.status === "cancelled" && (
                <div style={{display:"flex",alignItems:"center",gap:10,marginTop:12,padding:"10px 14px",background:"#fef2f2",borderRadius:10,fontFamily:"Poppins,sans-serif",fontSize:13,color:"#b91c1c"}}>
                  <i className="fa-solid fa-ban" style={{fontSize:16}}></i>
                  <span><strong>Order Cancelled</strong> — {viewOrder.cancellationReason || "This order was cancelled."}</span>
                </div>
              )}
            </div>

            <div className="profile__card">
              <div className="profile__cart-section-title">Items</div>
              {viewOrder.items.map((item,i)=>(
                <div key={i} className="profile__cart-item">
                  <div className="profile__cart-item-img">{item.image?<img src={`/uploads/menu-items/${item.image}`} alt={item.name} style={{width:44,height:44,objectFit:"cover",borderRadius:8}}/>:"🍽️"}</div>
                  <div className="profile__cart-item-name">{item.name}{item.custom&&<span style={{fontSize:12,color:"#888",display:"block"}}>{item.custom}</span>}</div>
                  <div className="profile__cart-item-qty">× {item.qty}</div>
                  <div className="profile__cart-item-price">₹{item.price*item.qty}</div>
                </div>
              ))}
              <div style={{marginTop:14,borderTop:"1px solid #f3f4f6",paddingTop:12,fontSize:14,fontFamily:"Poppins,sans-serif"}}>
                {([ [`Subtotal`,`₹${viewOrder.subtotal}`], ...(viewOrder.discount>0?[[`Discount (${viewOrder.couponCode})`,`−₹${viewOrder.discount}`]]:[]), [`Tax`,`₹${viewOrder.tax}`], [`Shipping`,`₹${viewOrder.shipping}`] ] as [string,string][]).map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:5}}><span style={{color:"#666"}}>{l}</span><span>{v}</span></div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",borderTop:"1px solid #f3f4f6",paddingTop:8,fontWeight:700}}><span>Total</span><span style={{color:"#e67e22"}}>₹{viewOrder.total}</span></div>
              </div>
              {viewOrder.deliveryAddress&&(
                <div style={{marginTop:12,padding:"12px 14px",background:"#fafafa",borderRadius:10,fontSize:13,fontFamily:"Poppins,sans-serif",color:"#555"}}>
                  <strong>Delivery Address:</strong><br/>
                  {viewOrder.deliveryAddress.fullName} · {viewOrder.deliveryAddress.phone}<br/>
                  {viewOrder.deliveryAddress.house}{viewOrder.deliveryAddress.area?`, ${viewOrder.deliveryAddress.area}`:""}, {viewOrder.deliveryAddress.city}, {viewOrder.deliveryAddress.state} {viewOrder.deliveryAddress.pincode}
                </div>
              )}
              {viewOrder.tableNumber&&(
                <div style={{marginTop:12,padding:"12px 14px",background:"#fafafa",borderRadius:10,fontSize:13,fontFamily:"Poppins,sans-serif",color:"#555"}}>
                  <strong>Dine-in Order:</strong><br/>
                  Table Number: <strong>{viewOrder.tableNumber}</strong>{viewOrder.tableName ? ` (${viewOrder.tableName})` : ""}<br/>
                  Type: QR Code Scan Ordering
                </div>
              )}
              {["pending","confirmed"].includes(viewOrder.status) && (viewOrder.paymentMethod === "cod" || viewOrder.paymentStatus !== "paid") && (
                <div style={{marginTop:18,paddingTop:16,borderTop:"1px solid #f3f4f6",display:"flex",justifyContent:"flex-end"}}>
                  <button type="button" onClick={()=>{setCancelError("");setCancelOrderOpen(true);}} style={{border:"1px solid #fecaca",background:"#fff",color:"#dc2626",borderRadius:10,padding:"10px 18px",fontFamily:"Poppins,sans-serif",fontWeight:600,cursor:"pointer"}}>Cancel Order</button>
                </div>
              )}
            </div>

            {cancelOrderOpen&&(
              <div role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget&&!cancelSaving)setCancelOrderOpen(false);}} style={{position:"fixed",inset:0,zIndex:10000,background:"rgba(15,23,42,.58)",backdropFilter:"blur(5px)",display:"grid",placeItems:"center",padding:20}}>
                <div role="dialog" aria-modal="true" aria-labelledby="cancel-order-title" style={{width:"min(540px,100%)",background:"#fff",borderRadius:22,padding:28,boxShadow:"0 28px 80px rgba(15,23,42,.28)",borderTop:"4px solid #ef4444"}}>
                  <div style={{display:"flex",justifyContent:"space-between",gap:16,alignItems:"flex-start"}}>
                    <div><h2 id="cancel-order-title" style={{fontFamily:"Poppins,sans-serif",fontSize:24,margin:"0 0 6px",color:"#111827"}}>Cancel this order?</h2><p style={{fontFamily:"Poppins,sans-serif",fontSize:14,color:"#6b7280",margin:0}}>Order #{viewOrder.orderId} will be cancelled. Tell the restaurant why.</p></div>
                    <button type="button" aria-label="Close cancellation dialog" disabled={cancelSaving} onClick={()=>setCancelOrderOpen(false)} style={{border:0,background:"transparent",fontSize:24,color:"#9ca3af",cursor:"pointer"}}>×</button>
                  </div>
                  <label htmlFor="cancel-order-message" style={{display:"block",fontFamily:"Poppins,sans-serif",fontWeight:600,fontSize:14,marginTop:22,marginBottom:8}}>Cancellation message</label>
                  <textarea id="cancel-order-message" autoFocus maxLength={500} value={cancelMessage} onChange={e=>{setCancelMessage(e.target.value);setCancelError("");}} placeholder="For example: I placed this order by mistake." style={{width:"100%",minHeight:120,resize:"vertical",border:`1px solid ${cancelError?"#fca5a5":"#d1d5db"}`,borderRadius:12,padding:"12px 14px",fontFamily:"Poppins,sans-serif",fontSize:14,outline:"none",boxSizing:"border-box"}} />
                  <div style={{display:"flex",justifyContent:"space-between",fontFamily:"Poppins,sans-serif",fontSize:12,marginTop:6,color:cancelError?"#dc2626":"#9ca3af"}}><span>{cancelError||"This message is saved with the order."}</span><span>{cancelMessage.length}/500</span></div>
                  <div style={{display:"flex",gap:12,justifyContent:"flex-end",marginTop:22,flexWrap:"wrap"}}>
                    <button type="button" disabled={cancelSaving} onClick={()=>setCancelOrderOpen(false)} style={{border:"1px solid #d1d5db",background:"#fff",color:"#374151",borderRadius:10,padding:"11px 18px",fontFamily:"Poppins,sans-serif",fontWeight:600,cursor:"pointer"}}>Keep Order</button>
                    <button type="button" disabled={cancelSaving||cancelMessage.trim().length<5} onClick={submitOrderCancellation} style={{border:0,background:"#ef4444",color:"#fff",borderRadius:10,padding:"11px 20px",fontFamily:"Poppins,sans-serif",fontWeight:700,cursor:"pointer",opacity:(cancelSaving||cancelMessage.trim().length<5)?.55:1}}>{cancelSaving?"Cancelling…":"Confirm Cancellation"}</button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* PAYMENT — static */}
        {section==="payment"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">Payment Method</h1>
            <p className="profile__page-subtitle">Manage your saved payment methods</p>
            <div className="profile__card">
              <div className="profile__pay-row">
                <div className="profile__pay-card-visual"><div className="chip"></div><div className="profile__pay-card-num">4085 9536 8475 9530</div><div className="profile__pay-card-brand"><div className="circle1"></div><div className="circle2"></div></div></div>
              </div>
              <div className="profile__upi-section-title">Saved UPI IDs</div>
              <div className="profile__pay-row"><div><div className="profile__upi-label">Saved UPI IDs</div><div className="profile__upi-id">example@ybl</div></div></div>
            </div>
            <p style={{fontFamily:"Poppins,sans-serif",fontSize:13,color:"#aaa",marginTop:12}}>Online payment integration coming soon.</p>
          </section>
        )}

        {/* COUPONS */}
        {section==="coupons"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">Offers & Coupons</h1>
            <p className="profile__page-subtitle">View available discount codes</p>
            <div className="profile__card">
              <div className="profile__coupon-section-title">Available Coupons</div>
              {!couponsLoaded?<p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>Loading…</p>:coupons.length===0?<p style={{fontFamily:"Poppins,sans-serif",color:"#aaa",fontSize:13}}>No coupons available right now.</p>:coupons.map(c=>(
                <div key={c._id} className="profile__coupon-row">
                  <i className="fa-solid fa-tag profile__coupon-icon"></i>
                  <div className="profile__coupon-info">
                    <div className="profile__coupon-name">{c.code}</div>
                    <div className="profile__coupon-detail">{c.description||(c.type==="flat"?`₹${c.value} off`:`${c.value}% off${c.maxDiscount?` (max ₹${c.maxDiscount})`:""}`)} {c.minOrderValue>0?`· Min ₹${c.minOrderValue}`:""}</div>
                    {c.expiryDate&&<div className="profile__coupon-validity">Valid till: {fmtDate(c.expiryDate)}</div>}
                  </div>
                  <button className="profile__btn-reorder" style={{fontSize:12,padding:"6px 12px",whiteSpace:"nowrap"}} onClick={()=>copyCoupon(c.code)}>
                    {copiedCode===c.code?"Copied!":"Copy Code"}
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SETTINGS */}
        {section==="settings"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">Account Settings</h1>
            <p className="profile__page-subtitle">Manage your account preferences</p>
            <div className="profile__card">
              <div className="profile__settings-group">
                <div className="profile__settings-group-title"><i className="fa-solid fa-lock"></i> Change Password</div>
                {([["current","Current Password"],["newPw","New Password"],["confirm","Confirm New Password"]] as [keyof typeof pwForm,string][]).map(([key,label])=>(
                  <div key={key} className="profile__input-wrap">
                    <input type={showPw[key]?"text":"password"} placeholder={label} value={pwForm[key]} onChange={e=>setPwForm(p=>({...p,[key]:e.target.value}))}/>
                    <i className={`fa-regular ${showPw[key]?"fa-eye-slash":"fa-eye"} profile__eye-icon`} onClick={()=>setShowPw(p=>({...p,[key]:!p[key]}))}></i>
                  </div>
                ))}
                <div style={{textAlign:"right"}}>
                  <button className="profile__update-btn" onClick={handleChangePassword} disabled={pwSaving}>{pwSaving?"Updating…":"Update Password"}</button>
                </div>
              </div>
            </div>
            <div className="profile__card">
              <div className="profile__settings-group-title"><i className="fa-regular fa-bell"></i> Notification</div>
              <div className="profile__notif-row"><span>Send Me Email Notification</span><div className="profile__toggle"></div></div>
              <div className="profile__notif-row"><span>Send Me SMS Notification</span><div className="profile__toggle"></div></div>
            </div>
            <div className="profile__card">
              <div className="profile__settings-group-title"><i className="fa-regular fa-user-xmark"></i> Delete Account</div>
              <div className="profile__delete-row">
                <span className="profile__delete-info">Permanently delete your account and all associated data.</span>
                <button className="profile__delete-btn" onClick={()=>{if(confirm("Are you sure? This cannot be undone."))actionToast.warning("Account deletion unavailable","Please contact support to request account deletion.");}}>Delete Account</button>
              </div>
            </div>
          </section>
        )}

        {/* HELP — static with full FAQ and complaint pages */}
        {section==="help"&&(
          <section className="profile__section active">
            <h1 className="profile__page-title">Help & Support</h1>
            <p className="profile__page-subtitle">We're here to help you with any issues or questions</p>
            <HelpSection showToast={showToast}/>
          </section>
        )}

      </main>

      {/* EDIT PROFILE MODAL */}
      {showEditModal&&(
        <div className="profile__modal-overlay open" onClick={e=>{if(e.target===e.currentTarget)setShowEditModal(false);}}>
          <div className="profile__modal">
            <div className="profile__modal-title">Edit Profile</div>
            <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:20}}>
              <div style={{width:80,height:80,borderRadius:"50%",overflow:"hidden",background:"#f3f4f6",border:"3px solid #e67e22",display:"flex",alignItems:"center",justifyContent:"center",marginBottom:10,cursor:"pointer"}} onClick={()=>avatarRef.current?.click()}>
                {avatarPreview?<img src={avatarPreview} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<span style={{fontFamily:"Poppins,sans-serif",fontWeight:700,fontSize:"1.4rem",color:"#e67e22"}}>{initials}</span>}
              </div>
              <button type="button" style={{background:"none",border:"none",color:"#e67e22",fontFamily:"Poppins,sans-serif",fontSize:13,fontWeight:600,cursor:"pointer"}} onClick={()=>avatarRef.current?.click()}>
                <i className="fa-solid fa-camera"></i> Change Photo
              </button>
              <input ref={avatarRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>{const f=e.target.files?.[0];if(f){setAvatarFile(f);setAvatarPreview(URL.createObjectURL(f));}}}/>
            </div>
            {[["Full Name *","name","text","Your full name"],["Phone","phone","tel","e.g. 9876543210"],["City","city","text","e.g. Jaipur"]].map(([label,key,type,placeholder])=>(
              <div key={key} className="profile__modal-field">
                <label className="profile__modal-label">{label}</label>
                <input 
                  className="profile__modal-input" 
                  type={type} 
                  placeholder={placeholder} 
                  maxLength={key === "phone" ? 10 : undefined}
                  value={editForm[key as keyof typeof editForm]} 
                  onChange={e=>{
                    let val = e.target.value;
                    if(key === "phone"){
                      val = val.replace(/\D/g, "").slice(0, 10);
                    }
                    setEditForm(p=>({...p,[key]:val}));
                  }}
                />
              </div>
            ))}
            <div style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#aaa",marginBottom:12}}>Email cannot be changed.</div>
            <div className="profile__modal-btns">
              <button className="profile__modal-cancel" onClick={()=>setShowEditModal(false)}>Cancel</button>
              <button className="profile__modal-save" onClick={handleSaveProfile} disabled={editSaving}>{editSaving?"Saving…":"Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* ADDRESS MODAL */}
      {showAddrModal&&(
        <div className="profile__addr-modal-overlay open" onClick={e=>{if(e.target===e.currentTarget)setShowAddrModal(false);}}>
          <div className="profile__modal">
            <div className="profile__modal-title">{editingAddr?"Edit Address":"Add New Address"}</div>
            <div className="profile__modal-field">
              <label className="profile__modal-label">Type</label>
              <select className="profile__modal-input" value={addrForm.label} onChange={e=>setAddrForm(p=>({...p,label:e.target.value}))}>
                <option>Home</option><option>Office</option><option>Other</option>
              </select>
            </div>
            {[
              ["Full Name *","fullName","Your full name"],
              ["Phone *","phone","e.g. 9876543210"],
              ["House / Flat / Street *","house","208, Shiv Vihar, MG Road"],
              ["Area / Landmark","area","Near City Mall (optional)"],
              ["Pincode *","pincode","302034"],
              ["City *","city","Jaipur"],
              ["State *","state","Rajasthan"]
            ].map(([label,key,placeholder])=>(
              <div key={key} className="profile__modal-field">
                <label className="profile__modal-label">{label}</label>
                <input 
                  className="profile__modal-input" 
                  placeholder={placeholder} 
                  maxLength={key === "phone" ? 10 : (key === "pincode" ? 6 : undefined)}
                  value={addrForm[key as keyof typeof addrForm] as string} 
                  onChange={e=>{
                    let val = e.target.value;
                    if(key === "phone"){
                      val = val.replace(/\D/g, "").slice(0, 10);
                      setAddrForm(p=>({...p,[key]:val}));
                    } else if(key === "pincode"){
                      val = val.replace(/\D/g, "").slice(0, 6);
                      setAddrForm(p=>({...p,[key]:val}));
                      if (val.length === 6) {
                        fetch(`https://api.postalpincode.in/pincode/${val}`)
                          .then(r => r.json())
                          .then(res => {
                            if (res && res[0] && res[0].Status === "Success" && res[0].PostOffice && res[0].PostOffice.length > 0) {
                              const po = res[0].PostOffice[0];
                              setAddrForm(p => ({
                                ...p,
                                city: po.District || po.Block || p.city,
                                state: po.State || p.state
                              }));
                            }
                          })
                          .catch(() => {});
                      }
                    } else {
                      setAddrForm(p=>({...p,[key]:val}));
                    }
                  }}
                />
              </div>
            ))}
            <div style={{marginBottom:14,fontFamily:"Poppins,sans-serif",fontSize:13}}>
              <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <input type="checkbox" checked={addrForm.isDefault} onChange={e=>setAddrForm(p=>({...p,isDefault:e.target.checked}))}/>
                Set as default address
              </label>
            </div>
            <div className="profile__modal-btns">
              <button className="profile__modal-cancel" onClick={()=>setShowAddrModal(false)}>Cancel</button>
              <button className="profile__modal-save" onClick={handleSaveAddress} disabled={addrSaving}>{addrSaving?"Saving…":"Save Address"}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default function MyProfilePage() {
  return (
    <Suspense fallback={null}>
      <MyProfileContent />
    </Suspense>
  );
}

function ProfileSkeleton() {
  return (
    <div className="profile profile--loading" aria-busy="true" aria-label="Loading your profile">
      <aside className="profile__sidebar profile-skeleton__sidebar" aria-hidden="true">
        {Array.from({ length: 8 }, (_, index) => (
          <div className={`profile-skeleton__nav${index === 0 ? " profile-skeleton__nav--active" : ""}`} key={index}>
            <span className="profile-skeleton profile-skeleton__nav-icon" />
            <span className="profile-skeleton profile-skeleton__nav-label" />
          </div>
        ))}
        <div className="profile-skeleton__logout" />
      </aside>
      <main className="profile__main profile-skeleton__main">
        <div className="profile-skeleton profile-skeleton__title" />
        <div className="profile-skeleton profile-skeleton__subtitle" />
        <div className="profile__card profile-skeleton__card">
          <div className="profile-skeleton__user-row">
            <div className="profile-skeleton profile-skeleton__avatar" />
            <div className="profile-skeleton__user-copy">
              <div className="profile-skeleton profile-skeleton__name" />
              <div className="profile-skeleton profile-skeleton__email" />
            </div>
            <div className="profile-skeleton profile-skeleton__button" />
          </div>
        </div>
        <div className="profile-skeleton__grid">
          {Array.from({ length: 4 }, (_, index) => (
            <div className="profile__card profile-skeleton__mini-card" key={index}>
              <div className="profile-skeleton profile-skeleton__mini-icon" />
              <div>
                <div className="profile-skeleton profile-skeleton__mini-label" />
                <div className="profile-skeleton profile-skeleton__mini-value" />
              </div>
            </div>
          ))}
        </div>
        <span className="profile-skeleton__status" role="status">Preparing your profile</span>
      </main>
    </div>
  );
}
