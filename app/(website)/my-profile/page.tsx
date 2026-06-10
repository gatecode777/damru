"use client";

import { fmtDate, fmtDateFull } from "@/lib/formatDate";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserInfo { id?: string; name: string; email: string; phone: string; city: string; avatar: string; createdAt?: string }
interface Address { _id: string; label: string; fullName: string; phone: string; house: string; area: string; city: string; state: string; pincode: string; isDefault: boolean }
interface OrderItem { name: string; custom: string; price: number; qty: number; image?: string }
interface Order { _id: string; orderId: string; status: string; paymentMethod: string; total: number; subtotal: number; discount: number; couponCode: string; tax: number; shipping: number; items: OrderItem[]; deliveryAddress: { fullName: string; phone: string; house: string; area: string; city: string; state: string; pincode: string }; createdAt: string }
interface Coupon { _id: string; code: string; description: string; type: string; value: number; maxDiscount: number | null; minOrderValue: number; expiryDate: string | null; usageLimit: number | null; usedCount: number }
type Section = "overview" | "address" | "orders" | "payment" | "coupons" | "settings" | "help";

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
interface ReservationRecord { _id: string; date: string; time: string; persons: string; notes?: string; status: string; createdAt: string }

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

function HelpSection({ showToast }: { showToast: (msg: string) => void }) {
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
        const up = await (await fetch("/api/upload", { method:"POST", body:fd })).json();
        if (up.filename) attachmentFilename = up.filename;
      }
      const res = await fetch("/api/complaints", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ ...complaintForm, attachment: attachmentFilename }),
      });
      const data = await res.json();
      if (data.error) { showToast(data.error); return; }
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
          <button className="profile__help-btn" onClick={()=>showToast("Our team will contact you shortly!")}>Get In Touch</button>
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
          <button className="profile__faq-contact-btn" onClick={()=>showToast("Connecting to support...")}>Contact Support</button>
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
              <p>Click to upload or drag & drop<br/><span style={{fontSize:12,color:"#aaa"}}>JPG, PNG, PDF supported</span></p>
              <i className="fa-solid fa-paperclip"></i>
              <input id="complaint-img-input" type="file" style={{display:"none"}} accept=".jpg,.jpeg,.png,.pdf" onChange={handleImageSelect}/>
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
                            {fmtDateFull(r.date)}
                          </div>
                          <div style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#888",marginTop:3}}>
                            <i className="fa-regular fa-clock" style={{marginRight:5}}></i>{r.time}
                            <span style={{margin:"0 8px"}}>·</span>
                            <i className="fa-solid fa-users" style={{marginRight:5}}></i>{r.persons}
                          </div>
                        </div>
                        <span style={{fontFamily:"Poppins,sans-serif",fontSize:11,fontWeight:600,padding:"3px 10px",borderRadius:20,background:rs.bg,color:rs.color,flexShrink:0}}>
                          {r.status.charAt(0).toUpperCase()+r.status.slice(1)}
                        </span>
                      </div>
                      {r.notes && (
                        <div style={{fontFamily:"Poppins,sans-serif",fontSize:12,color:"#555",background:"#fafafa",padding:"8px 12px",borderRadius:8,borderLeft:"3px solid #e67e22"}}>
                          {r.notes}
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

export default function MyProfilePage() {
  const router = useRouter();
  const [section,setSection]  = useState<Section>("overview");
  const [user,setUser]        = useState<UserInfo|null>(null);
  const [loading,setLoading]  = useState(true);
  const [toast,setToast]      = useState("");
  const [addresses,setAddresses]     = useState<Address[]>([]);
  const [orders,setOrders]           = useState<Order[]>([]);
  const [ordersLoaded,setOrdersLoaded]=useState(false);
  const [coupons,setCoupons]         = useState<Coupon[]>([]);
  const [couponsLoaded,setCouponsLoaded]=useState(false);
  const [copiedCode,setCopiedCode]   = useState("");
  const [viewOrder,setViewOrder]     = useState<Order|null>(null);
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

  function showToast(msg:string){setToast(msg);setTimeout(()=>setToast(""),3200);}

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
  async function loadCoupons(){
    if(couponsLoaded)return;
    const r=await fetch("/api/coupons");const d=await r.json();
    setCoupons(d.coupons||[]);setCouponsLoaded(true);
  }

  function switchSection(s:Section){
    setSection(s);setViewOrder(null);
    if(s==="orders")loadOrders();
    if(s==="coupons")loadCoupons();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleLogout(){await fetch("/api/user/logout",{method:"POST"});window.location.href="/";}

  async function handleSaveProfile(){
    if(!editForm.name.trim()){showToast("Name is required.");return;}
    setEditSaving(true);
    try{
      let avatarFilename=user?.avatar||"";
      if(avatarFile){
        const fd=new FormData();fd.append("file",avatarFile);fd.append("target","avatar");
        const up=await(await fetch("/api/upload",{method:"POST",body:fd})).json();
        if(up.filename)avatarFilename=up.filename;
      }
      const r=await fetch("/api/user/me",{method:"PATCH",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"updateProfile",...editForm,avatar:avatarFilename})});
      const d=await r.json();
      if(d.error){showToast(d.error);return;}
      setUser(prev=>prev?{...prev,...d.user}:prev);
      setAvatarPreview(avatarFilename?`/uploads/avatars/${avatarFilename}`:"");
      if (typeof window !== "undefined" && d.user) {
        window.dispatchEvent(new CustomEvent("user-profile-updated", { detail: d.user }));
      }
      setShowEditModal(false);setAvatarFile(null);showToast("Profile updated successfully!");
    }finally{setEditSaving(false);}
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
    if(d.error){showToast(d.error);return;}
    setPwForm({current:"",newPw:"",confirm:""});showToast("Password updated successfully!");
  }

  function openAddAddress(){setEditingAddr(null);setAddrForm({label:"Home",fullName:"",phone:"",house:"",area:"",city:"",state:"",pincode:"",isDefault:false});setShowAddrModal(true);}
  function openEditAddress(a:Address){setEditingAddr(a);setAddrForm({label:a.label,fullName:a.fullName,phone:a.phone,house:a.house,area:a.area,city:a.city,state:a.state,pincode:a.pincode,isDefault:a.isDefault});setShowAddrModal(true);}

  async function handleSaveAddress(){
    if(!addrForm.fullName||!addrForm.phone||!addrForm.house||!addrForm.city||!addrForm.state||!addrForm.pincode){showToast("Fill all required fields.");return;}
    setAddrSaving(true);
    const r=await fetch("/api/address",{method:editingAddr?"PATCH":"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify(editingAddr?{id:editingAddr._id,...addrForm}:addrForm)});
    const d=await r.json();
    setAddrSaving(false);
    if(d.error){showToast(d.error);return;}
    await loadAddresses();setShowAddrModal(false);showToast(editingAddr?"Address updated!":"Address added!");
  }

  async function handleDeleteAddress(id:string){
    if(!confirm("Delete this address?"))return;
    await fetch("/api/address",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});
    await loadAddresses();showToast("Address deleted!");
  }

  function copyCoupon(code:string){
    navigator.clipboard.writeText(code).then(()=>{setCopiedCode(code);setTimeout(()=>setCopiedCode(""),2000);showToast(`"${code}" copied to clipboard!`);});
  }

  if(loading) return <div className="profile" style={{display:"flex",alignItems:"center",justifyContent:"center",minHeight:"60vh"}}><p style={{fontFamily:"Poppins,sans-serif",color:"#aaa"}}>Loading profile…</p></div>;
  if(!user) return null;

  const initials=user.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();

  return(
    <div className="profile">
      <aside className="profile__sidebar">
        {([["overview","fa-regular fa-user","My Profile"],["address","fa-solid fa-book","Address Book"],["orders","fa-solid fa-bag-shopping","My Orders"],["payment","fa-regular fa-credit-card","Payment Methods"],["coupons","fa-solid fa-tag","Offers & Coupons"],["settings","fa-solid fa-gear","Account Settings"],["help","fa-solid fa-circle-dollar-to-slot","Help & Support"]] as [Section,string,string][]).map(([id,icon,label])=>(
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
                      <span className="profile__status-badge" style={{background:ss.bg,color:ss.color}}><i className={ss.icon}></i> {o.status.replace(/_/g," ").replace(/\w/g,c=>c.toUpperCase())}</span>
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
            <div className="profile__order-detail-back" onClick={()=>setViewOrder(null)}><i className="fa-solid fa-arrow-left"></i> Back to Orders</div>
            <h1 className="profile__page-title">{viewOrder.orderId}</h1>
            <p className="profile__page-subtitle">{fmtDate(viewOrder.createdAt)} · {viewOrder.paymentMethod.toUpperCase()}</p>
            {/* ── Order Status Pipeline ── */}
            <div className="profile__card" style={{marginBottom:16}}>
              <div className="profile__cart-section-title" style={{marginBottom:16}}>Order Status</div>
              {(() => {
                const STEPS = [
                  { key:"pending",          label:"Order Placed",  icon:"fa-regular fa-clock" },
                  { key:"confirmed",        label:"Confirmed",     icon:"fa-regular fa-circle-check" },
                  { key:"preparing",        label:"Preparing",     icon:"fa-solid fa-utensils" },
                  { key:"out_for_delivery", label:"Out for Delivery", icon:"fa-solid fa-truck" },
                  { key:"delivered",        label:"Delivered",     icon:"fa-solid fa-house-circle-check" },
                ];
                const ORDER = ["pending","confirmed","preparing","out_for_delivery","delivered"];
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
                  <span><strong>Order Cancelled</strong> — This order was cancelled.</span>
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
            </div>
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
                <button className="profile__delete-btn" onClick={()=>{if(confirm("Are you sure? This cannot be undone."))showToast("Account deletion requested.");}}>Delete Account</button>
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
            {[["Full Name *","name","text","Your full name"],["Phone","phone","tel","+91-xxxxxxxxxx"],["City","city","text","e.g. Jaipur"]].map(([label,key,type,placeholder])=>(
              <div key={key} className="profile__modal-field">
                <label className="profile__modal-label">{label}</label>
                <input className="profile__modal-input" type={type} placeholder={placeholder} value={editForm[key as keyof typeof editForm]} onChange={e=>setEditForm(p=>({...p,[key]:e.target.value}))}/>
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
            {[["Full Name *","fullName","Your full name"],["Phone *","phone","+91-xxxxxxxxxx"],["House / Flat / Street *","house","208, Shiv Vihar, MG Road"],["Area / Landmark","area","Near City Mall (optional)"],["City *","city","Jaipur"],["State *","state","Rajasthan"],["Pincode *","pincode","302034"]].map(([label,key,placeholder])=>(
              <div key={key} className="profile__modal-field">
                <label className="profile__modal-label">{label}</label>
                <input className="profile__modal-input" placeholder={placeholder} value={addrForm[key as keyof typeof addrForm] as string} onChange={e=>setAddrForm(p=>({...p,[key]:e.target.value}))}/>
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

      <div className={`profile__toast${toast?" show":""}`}>{toast}</div>
    </div>
  );
}