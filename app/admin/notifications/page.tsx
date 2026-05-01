import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminHeader from "@/components/admin/AdminHeader";
import { Bell, ShoppingBag, Users, AlertTriangle, CheckCircle2, Info, Trash2, CheckCheck } from "lucide-react";

export const metadata = { title: "Notifications" };

const notifs = [
  {id:1,type:"order",  icon:ShoppingBag,   title:"New Enterprise order",        desc:"Rahul Verma subscribed to Enterprise Plan for ₹9,999/mo.",            time:"2 min ago",   unread:true},
  {id:2,type:"user",   icon:Users,         title:"New user registered",          desc:"Kavya Reddy created an account from Hyderabad.",                        time:"15 min ago",  unread:true},
  {id:3,type:"alert",  icon:AlertTriangle, title:"Server load spike detected",   desc:"CPU usage hit 87% on production node. Auto-scaling triggered.",          time:"38 min ago",  unread:true},
  {id:4,type:"success",icon:CheckCircle2,  title:"Payout processed",             desc:"Monthly payout of ₹4,82,300 transferred to your account.",             time:"1 hr ago",    unread:true},
  {id:5,type:"order",  icon:ShoppingBag,   title:"Payment failed",               desc:"₹2,999 from Sneha Gupta failed. Retry #2 scheduled.",                  time:"2 hr ago",    unread:false},
  {id:6,type:"info",   icon:Info,          title:"Maintenance scheduled",        desc:"Planned downtime Saturday 3–4 AM IST.",                                  time:"5 hr ago",    unread:false},
  {id:7,type:"user",   icon:Users,         title:"Account suspended",            desc:"Rohan Mehta flagged and auto-suspended for TOS violation.",              time:"Yesterday",   unread:false},
  {id:8,type:"success",icon:CheckCircle2,  title:"SSL certificates renewed",     desc:"SSL for damru.com renewed. Valid 365 days.",                             time:"Yesterday",   unread:false},
  {id:9,type:"info",   icon:Info,          title:"v2.4.1 deployed",              desc:"Includes analytics improvements and bug fixes.",                          time:"2 days ago",  unread:false},
];
const ts: Record<string,{iconBg:string;iconColor:string;border:string}> = {
  order:   {iconBg:"#fff7ed",iconColor:"#f97316",border:"#fed7aa"},
  user:    {iconBg:"#eff6ff",iconColor:"#2563eb",border:"#bfdbfe"},
  alert:   {iconBg:"#fffbeb",iconColor:"#d97706",border:"#fde68a"},
  success: {iconBg:"#f0fdf4",iconColor:"#16a34a",border:"#bbf7d0"},
  info:    {iconBg:"#f5f3ff",iconColor:"#7c3aed",border:"#ddd6fe"},
};
export default async function NotifPage() {
  const session = await auth();
  if (!session) redirect("/admin/login");
  const unread = notifs.filter(n => n.unread).length;
  return (
    <>
      <AdminSidebar/>
      <div className="layout">
        <AdminHeader title="Notifications"/>
        <main className="main">
          <div className="top">
            <div>
              <h2 className="ptitle">All Notifications</h2>
              <p className="psub">You have <strong style={{color:"#f97316"}}>{unread} unread</strong> notifications</p>
            </div>
            <div className="tactions">
              <button className="obtn"><CheckCheck size={13}/> Mark all read</button>
              <button className="dbtn"><Trash2 size={13}/> Clear all</button>
            </div>
          </div>

          <div className="ftabs">
            {["All","Orders","Users","Alerts","System"].map((t,i) => (
              <button key={t} className={`ftab${i===0?" ftab-a":""}`}>{t}</button>
            ))}
          </div>

          <div className="nlist">
            <p className="grp">Today</p>
            {notifs.filter((_,i)=>i<4).map(n => {
              const Icon = n.icon; const s = ts[n.type];
              return (
                <div key={n.id} className={`ncard${n.unread?" ncard-u":""}`}>
                  {n.unread && <span className="upip"/>}
                  <div className="nic" style={{background:s.iconBg,border:`1.5px solid ${s.border}`}}><Icon size={17} style={{color:s.iconColor}}/></div>
                  <div className="nbody">
                    <div className="ntop">
                      <p className="ntitle">{n.title}</p>
                      <span className="ntime">{n.time}</span>
                    </div>
                    <p className="ndesc">{n.desc}</p>
                  </div>
                  <button className="deln"><Trash2 size={13}/></button>
                </div>
              );
            })}
            <p className="grp" style={{marginTop:"8px"}}>Earlier</p>
            {notifs.filter((_,i)=>i>=4).map(n => {
              const Icon = n.icon; const s = ts[n.type];
              return (
                <div key={n.id} className="ncard">
                  <div className="nic" style={{background:s.iconBg,border:`1.5px solid ${s.border}`}}><Icon size={17} style={{color:s.iconColor}}/></div>
                  <div className="nbody">
                    <div className="ntop"><p className="ntitle">{n.title}</p><span className="ntime">{n.time}</span></div>
                    <p className="ndesc">{n.desc}</p>
                  </div>
                  <button className="deln"><Trash2 size={13}/></button>
                </div>
              );
            })}
          </div>
        </main>
      </div>
      <style>{`
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{background:#f5f6fa;font-family:'DM Sans',sans-serif;color:#111827}
        .layout{margin-left:220px;min-height:100vh;background:#f5f6fa}
        .main{padding:24px;display:flex;flex-direction:column;gap:14px;max-width:860px}
        .top{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px}
        .ptitle{font-family:'DM Sans',sans-serif;font-size:1.1rem;font-weight:700;color:#111827;margin-bottom:3px}
        .psub{font-size:0.84rem;color:#6b7280}
        .tactions{display:flex;gap:8px}
        .obtn,.dbtn{display:flex;align-items:center;gap:5px;border-radius:9px;padding:7px 13px;font-family:'DM Sans',sans-serif;font-size:0.8rem;cursor:pointer;font-weight:500;transition:all 0.13s}
        .obtn{background:#fff;border:1.5px solid #e5e7eb;color:#6b7280}
        .obtn:hover{border-color:#f97316;color:#f97316;background:#fff7ed}
        .dbtn{background:#fef2f2;border:1.5px solid #fecaca;color:#dc2626}
        .dbtn:hover{background:#fee2e2}
        .ftabs{display:flex;gap:4px}
        .ftab{background:#fff;border:1.5px solid #e5e7eb;border-radius:20px;padding:5px 13px;font-family:'DM Sans',sans-serif;font-size:0.8rem;color:#6b7280;cursor:pointer;transition:all 0.13s}
        .ftab:hover{border-color:#f97316;color:#f97316;background:#fff7ed}
        .ftab-a{background:#fff7ed;border-color:#fed7aa;color:#f97316;font-weight:500}
        .grp{font-size:0.68rem;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:#9ca3af;margin-bottom:4px}
        .nlist{display:flex;flex-direction:column;gap:6px}
        .ncard{display:flex;align-items:flex-start;gap:12px;background:#fff;border:1.5px solid #e5e7eb;border-radius:13px;padding:14px 16px;position:relative;transition:all 0.13s}
        .ncard:hover{border-color:#fed7aa;box-shadow:0 3px 12px rgba(249,115,22,0.08)}
        .ncard-u{background:#fffbf5;border-color:#fed7aa}
        .upip{position:absolute;left:-5px;top:50%;transform:translateY(-50%);width:8px;height:8px;background:#f97316;border-radius:50%;border:2px solid #f5f6fa}
        .nic{width:40px;height:40px;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
        .nbody{flex:1;min-width:0}
        .ntop{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:4px;flex-wrap:wrap}
        .ntitle{font-size:0.875rem;font-weight:500;color:#111827}
        .ntime{font-size:0.72rem;color:#9ca3af;white-space:nowrap;flex-shrink:0}
        .ndesc{font-size:0.82rem;color:#6b7280;line-height:1.5}
        .deln{width:28px;height:28px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#9ca3af;flex-shrink:0;transition:all 0.13s}
        .deln:hover{background:#fef2f2;border-color:#fecaca;color:#dc2626}
      `}</style>
    </>
  );
}
