"use client";

import { fmtDateTime } from "@/lib/formatDate";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Comment {
  _id: string; name: string; avatar?: string; userId?: string;
  comment: string; parentId?: string | null; createdAt: string;
}
interface Category { _id: string; name: string; slug: string; count: number }
interface SearchResult { _id: string; title: string; slug: string; coverImage: string; readTime: number }
interface UserInfo { id: string; name: string; email: string; avatar?: string }

function fmtDate(d: string) {
  return fmtDateTime(d);
}

function Avatar({ name, avatar, size = 40 }: { name: string; avatar?: string; size?: number }) {
  if (avatar && avatar.trim() !== "") {
    // Avoid double-prefixing if somehow full path is stored
    const src = avatar.startsWith("/") || avatar.startsWith("http") ? avatar : `/uploads/avatars/${avatar}`;
    return <img src={src} alt={name} onError={e => { (e.target as HTMLImageElement).style.display="none"; }}
      style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover" }} />;
  }
  // Generate a consistent color from name
  const colors = ["#e67e22","#3b82f6","#8b5cf6","#059669","#dc2626","#0891b2"];
  const colorIdx = name.charCodeAt(0) % colors.length;
  const initials = name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase();
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:colors[colorIdx], color:"#fff",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily:"Poppins,sans-serif", fontWeight:700, fontSize:size*0.38, flexShrink:0 }}>
      {initials}
    </div>
  );
}

// ── Sidebar — search + categories ──────────────────────────────────────────
export function BlogSidebar({ blogSlug, currentCategoryName }: { blogSlug: string; currentCategoryName?: string }) {
  const router = useRouter();
  const [categories,    setCategories]    = useState<Category[]>([]);
  const [searchQuery,   setSearchQuery]   = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen,    setSearchOpen]    = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/blog-categories").then(r=>r.json()).then(d=>setCategories(d.categories||[]));
  }, []);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]); setSearchLoading(false); setSearchOpen(false); return;
    }
    setSearchLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/blog-search?q=${encodeURIComponent(searchQuery.trim())}`);
        const data = await res.json();
        setSearchResults(data.results || []);
        setSearchOpen(true);
      } catch { setSearchResults([]); }
      finally { setSearchLoading(false); }
    }, 300);
  }, [searchQuery]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <>
      {/* Search widget — exact same structure as HTML */}
      <div className="sb-sidebar__widget" ref={searchRef} style={{ position:"relative" }}>
        <input type="text" className="sb-sidebar__search" placeholder="Search......"
          value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
          onKeyDown={e => {
            if (e.key === "Enter" && searchQuery.trim()) {
              router.push(`/blogs?search=${encodeURIComponent(searchQuery.trim())}`);
              setSearchOpen(false);
            }
          }}
        />
        {/* Dropdown */}
        {(searchOpen || searchLoading) && searchQuery.length >= 2 && (
          <div style={{ position:"absolute", top:"calc(100% + 4px)", left:0, right:0,
            background:"#fff", border:"1px solid #e5e7eb", borderRadius:8,
            boxShadow:"0 8px 24px rgba(0,0,0,0.12)", zIndex:9999, overflow:"hidden" }}>
            {searchLoading ? (
              <div style={{ padding:"12px 14px", fontFamily:"Poppins,sans-serif", fontSize:13, color:"#aaa" }}>Searching…</div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding:"12px 14px", fontFamily:"Poppins,sans-serif", fontSize:13, color:"#aaa" }}>No results for &ldquo;{searchQuery}&rdquo;</div>
            ) : (
              <>
                {searchResults.map(r => (
                  <Link key={r._id} href={`/blogs/${r.slug}`}
                    onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
                    style={{ display:"flex", gap:10, padding:"10px 14px", textDecoration:"none",
                      borderBottom:"1px solid #f5f5f5", background:"#fff" }}
                    onMouseEnter={e=>(e.currentTarget.style.background="#fff7ed")}
                    onMouseLeave={e=>(e.currentTarget.style.background="#fff")}>
                    {r.coverImage && (
                      <img src={`/uploads/blogs/${r.coverImage}`} alt={r.title}
                        style={{ width:42, height:42, objectFit:"cover", borderRadius:6, flexShrink:0 }} />
                    )}
                    <div>
                      <div style={{ fontFamily:"Poppins,sans-serif", fontSize:13, fontWeight:600, color:"#111",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:200 }}>{r.title}</div>
                      <div style={{ fontFamily:"Poppins,sans-serif", fontSize:11, color:"#aaa" }}>{r.readTime} min read</div>
                    </div>
                  </Link>
                ))}
                <Link href={`/blogs?search=${encodeURIComponent(searchQuery)}`}
                  onClick={()=>setSearchOpen(false)}
                  style={{ display:"block", padding:"10px 14px", textAlign:"center",
                    fontFamily:"Poppins,sans-serif", fontSize:12, fontWeight:600,
                    color:"#e67e22", textDecoration:"none", background:"#fffbf5" }}>
                  See all results →
                </Link>
              </>
            )}
          </div>
        )}
      </div>

      {/* Categories widget — with counts */}
      <div className="sb-sidebar__widget">
        <h3 className="sb-sidebar__title">Category</h3>
        <ul className="sb-sidebar__list">
          {categories.length === 0
            ? <li style={{ color:"#aaa", fontSize:"0.85rem" }}>Loading…</li>
            : categories.map(cat => (
              <li key={cat._id}>
                <Link href={`/blogs?category=${encodeURIComponent(cat.name)}`}
                  style={{ textDecoration:"none",
                    color: cat.name === currentCategoryName ? "#e67e22" : "inherit",
                    fontWeight: cat.name === currentCategoryName ? 600 : 400 }}>
                  {cat.name}
                </Link>
                <span>{cat.count}</span>
              </li>
            ))
          }
        </ul>
      </div>
    </>
  );
}

// ── Comments + Form — exact HTML structure ──────────────────────────────────
export function BlogComments({ blogSlug }: { blogSlug: string }) {
  const [comments,    setComments]    = useState<Comment[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [user,        setUser]        = useState<UserInfo | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const [err,  setErr]  = useState("");
  const [ok,   setOk]   = useState("");
  const [replyingTo,  setReplyingTo]  = useState<string | null>(null); // comment._id being replied to
  const [replyTexts,  setReplyTexts]  = useState<Record<string, string>>({});
  const [replySubmitting, setReplySubmitting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/user/me").then(r=>r.json())
      .then(d => setUser(d.user || null)).catch(() => setUser(null))
      .finally(() => setUserLoading(false));
  }, []);

  useEffect(() => {
    fetch(`/api/blog-comments?slug=${encodeURIComponent(blogSlug)}`)
      .then(r=>r.json()).then(d => setComments(d.comments || []))
      .catch(()=>{}).finally(() => setLoading(false));
  }, [blogSlug]);

  // Group replies under parent
  // parentId is null for top-level, string ObjectId for replies (after JSON serialization)
  const topLevel = comments.filter(c => !c.parentId || c.parentId === "null");
  const repliesFor = (id: string) => comments.filter(c => c.parentId && c.parentId !== "null" && String(c.parentId) === id);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!commentText.trim()) { setErr("Please write a comment."); return; }
    setSubmitting(true); setErr(""); setOk("");
    try {
      const res  = await fetch("/api/blog-comments", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ blogSlug, comment: commentText.trim() }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); return; }
      setComments(prev => [data.comment, ...prev]);
      setCommentText("");
      setOk("Comment posted! ✅");
      setTimeout(() => setOk(""), 3000);
    } catch { setErr("Failed to post. Try again."); }
    finally { setSubmitting(false); }
  }

  async function handleReply(parentId: string) {
    const text = (replyTexts[parentId] || "").trim();
    if (!text) return;
    setReplySubmitting(parentId);
    try {
      const res  = await fetch("/api/blog-comments", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ blogSlug, comment: text, parentId }),
      });
      const data = await res.json();
      if (data.error) return;
      setComments(prev => [...prev, data.comment]);
      setReplyTexts(p => ({ ...p, [parentId]: "" }));
      setReplyingTo(null);
    } finally { setReplySubmitting(null); }
  }

  const totalCount = topLevel.length;

  return (
    <>
      {/* ── Comments List — exact HTML structure ── */}
      <div className="sb-fullwidth__comments">
        <h2 className="sb-fullwidth__section-title">
          {loading ? "Comments" : `${totalCount} Comment${totalCount !== 1 ? "s" : ""}`}
        </h2>

        {loading && <p style={{ fontFamily:"Poppins,sans-serif", color:"#aaa", fontSize:"0.9rem" }}>Loading comments…</p>}

        {!loading && topLevel.length === 0 && (
          <p style={{ fontFamily:"Poppins,sans-serif", color:"#aaa", fontSize:"0.9rem", padding:"12px 0" }}>
            No comments yet. Be the first to comment!
          </p>
        )}

        {topLevel.map(c => {
          const avatarSrc = c.avatar && c.avatar.trim() !== ""
            ? (c.avatar.startsWith("/") || c.avatar.startsWith("http") ? c.avatar : `/uploads/avatars/${c.avatar}`)
            : null;
          return (
            <div key={c._id}>
              {/* ── Top-level comment — exact HTML structure ── */}
              <div className="sb-fullwidth__comment">
                {avatarSrc
                  ? <img src={avatarSrc} alt={c.name} />
                  : <div style={{ width:52, height:52, borderRadius:"50%", flexShrink:0,
                      background: ["#e67e22","#3b82f6","#8b5cf6","#059669","#dc2626","#0891b2"][c.name.charCodeAt(0)%6],
                      color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                      fontFamily:"Poppins,sans-serif", fontWeight:700, fontSize:18 }}>
                      {c.name.split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase()}
                    </div>
                }
                <div className="sb-fullwidth__comment-body">
                  <div className="sb-fullwidth__comment-header">
                    <strong>{c.name}</strong>
                    {/* Reply button — <a> tag to match HTML, shown only when logged in */}
                    {user && (
                      <a href="#" className="sb-fullwidth__reply-btn"
                        onClick={e => { e.preventDefault(); setReplyingTo(replyingTo === c._id ? null : c._id); }}>
                        {replyingTo === c._id ? "Cancel" : "Reply"}
                      </a>
                    )}
                  </div>
                  <small>{fmtDate(c.createdAt)}</small>
                  <p>{c.comment}</p>
                </div>
              </div>

              {/* ── Inline reply textarea — shown when Reply clicked ── */}
              {replyingTo === c._id && user && (() => {
                const userAvatarSrc = user.avatar && user.avatar.trim() !== ""
                  ? (user.avatar.startsWith("/") || user.avatar.startsWith("http") ? user.avatar : `/uploads/avatars/${user.avatar}`)
                  : null;
                return (
                  <div className="sb-fullwidth__comment sb-fullwidth__comment--reply">
                    {userAvatarSrc
                      ? <img src={userAvatarSrc} alt={user.name} style={{ width:40, height:40, borderRadius:"50%", objectFit:"cover" }} />
                      : <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0,
                          background: ["#e67e22","#3b82f6","#8b5cf6","#059669","#dc2626","#0891b2"][user.name.charCodeAt(0)%6],
                          color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                          fontFamily:"Poppins,sans-serif", fontWeight:700, fontSize:14 }}>
                          {user.name.split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                    }
                    <div className="sb-fullwidth__comment-body" style={{ flex:1 }}>
                      <small style={{ color:"#e67e22", fontWeight:600 }}>Replying to {c.name}</small>
                      <textarea rows={3} value={replyTexts[c._id] || ""}
                        onChange={e => setReplyTexts(p => ({ ...p, [c._id]: e.target.value }))}
                        placeholder="Write your reply…"
                        style={{ width:"100%", marginTop:6, padding:"10px 12px", border:"1.5px solid #e0e0e0",
                          borderRadius:8, fontFamily:"Poppins,sans-serif", fontSize:13,
                          outline:"none", resize:"vertical", boxSizing:"border-box" }}
                        onFocus={e=>(e.target.style.borderColor="#e67e22")}
                        onBlur={e=>(e.target.style.borderColor="#e0e0e0")}
                      />
                      <button className="sb-fullwidth__post-btn"
                        style={{ marginTop:8, padding:"8px 20px", fontSize:13 }}
                        onClick={() => handleReply(c._id)}
                        disabled={replySubmitting === c._id || !(replyTexts[c._id]||"").trim()}>
                        {replySubmitting === c._id ? "Posting…" : "Post Reply"}
                      </button>
                    </div>
                  </div>
                );
              })()}

              {/* ── Replies — sb-fullwidth__comment--reply (indented, exact HTML structure) ── */}
              {repliesFor(c._id).map(reply => {
                const replySrc = reply.avatar && reply.avatar.trim() !== ""
                  ? (reply.avatar.startsWith("/") || reply.avatar.startsWith("http") ? reply.avatar : `/uploads/avatars/${reply.avatar}`)
                  : null;
                return (
                  <div key={reply._id} className="sb-fullwidth__comment sb-fullwidth__comment--reply">
                    {replySrc
                      ? <img src={replySrc} alt={reply.name} />
                      : <div style={{ width:40, height:40, borderRadius:"50%", flexShrink:0,
                          background: ["#e67e22","#3b82f6","#8b5cf6","#059669","#dc2626","#0891b2"][reply.name.charCodeAt(0)%6],
                          color:"#fff", display:"flex", alignItems:"center", justifyContent:"center",
                          fontFamily:"Poppins,sans-serif", fontWeight:700, fontSize:14 }}>
                          {reply.name.split(" ").map((w:string)=>w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                    }
                    <div className="sb-fullwidth__comment-body">
                      <div className="sb-fullwidth__comment-header">
                        <strong>{reply.name}</strong>
                        <a href="#" className="sb-fullwidth__reply-btn"
                          onClick={e => e.preventDefault()}>Reply</a>
                      </div>
                      <small>{fmtDate(reply.createdAt)}</small>
                      <p>{reply.comment}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* ── Leave a Reply form ── */}
      <div className="sb-fullwidth__form">
        <h2 className="sb-fullwidth__section-title">Leave a Reply</h2>

        {userLoading ? (
          <p style={{ fontFamily:"Poppins,sans-serif", color:"#aaa", fontSize:"0.9rem" }}>Loading…</p>
        ) : !user ? (
          /* Not logged in */
          <div style={{ padding:"18px 20px", background:"#fff7ed", border:"1.5px solid #fed7aa",
            borderRadius:10, fontFamily:"Poppins,sans-serif" }}>
            <p style={{ fontWeight:600, color:"#92400e", marginBottom:6, fontSize:14 }}>
              Please log in to leave a comment.
            </p>
            <p style={{ color:"#b45309", fontSize:13, margin:0 }}>
              <button onClick={() => document.getElementById("profileIconBtn")?.click()}
                style={{ background:"none", border:"none", cursor:"pointer", color:"#e67e22",
                  fontFamily:"Poppins,sans-serif", fontSize:13, fontWeight:600,
                  padding:0, textDecoration:"underline" }}>
                Log in now →
              </button>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            {/* Commenting as */}
            <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14,
              padding:"8px 12px", background:"#f9fafb", borderRadius:8,
              border:"1px solid #f0f0f0", fontFamily:"Poppins,sans-serif", fontSize:13 }}>
              <Avatar name={user.name} avatar={user.avatar} size={32} />
              <span>Commenting as <strong style={{ color:"#e67e22" }}>{user.name}</strong></span>
            </div>

            {err && <div style={{ background:"#fef2f2", border:"1px solid #fecaca", color:"#b91c1c",
              padding:"10px 14px", borderRadius:8, marginBottom:10,
              fontFamily:"Poppins,sans-serif", fontSize:13 }}>⚠ {err}</div>}
            {ok  && <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", color:"#15803d",
              padding:"10px 14px", borderRadius:8, marginBottom:10,
              fontFamily:"Poppins,sans-serif", fontSize:13 }}>✓ {ok}</div>}

            <label>Comment</label>
            <textarea rows={5} value={commentText}
              onChange={e => setCommentText(e.target.value)}
              placeholder="Write your comment…" />

            <button className="sb-fullwidth__post-btn" type="submit"
              disabled={submitting || !commentText.trim()}
              style={{ opacity: submitting || !commentText.trim() ? 0.65 : 1,
                cursor: submitting || !commentText.trim() ? "not-allowed" : "pointer" }}>
              {submitting ? "Posting…" : "Post Comment"}
            </button>
          </form>
        )}
      </div>
    </>
  );
}