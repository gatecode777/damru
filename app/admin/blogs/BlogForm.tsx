"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Save, Loader2, ChevronRight, Upload, Trash2, Plus,
  AlignLeft, Heading, Type, List, ListOrdered,
  Quote, Info, ImageIcon, Table2, Minus, GripVertical,
} from "lucide-react";
import { createBlog, updateBlog } from "@/app/actions/blogs";
import { useToast } from "@/components/admin/Toast";

// ── Types ────────────────────────────────────────────────────
type BlockType = "paragraph"|"heading"|"subheading"|"bullet_list"|"numbered_list"|"quote"|"callout"|"image"|"table"|"divider";

interface ContentBlock {
  _key:         string;
  type:         BlockType;
  text?:        string;
  items?:       string[];
  imageFile?:   string;
  imageAlt?:    string;
  imageCaption?:string;
  tableHeaders?:string[];
  tableRows?:   string[][];
}

interface BlogCategory { _id: string; name: string; }

interface Blog {
  _id: string; title: string; slug: string; excerpt: string;
  content: ContentBlock[];
  coverImage?: string; coverImageAlt?: string;
  category?: { _id: string; name: string } | null;
  tags: string[];
  author: { name: string; image: string; designation: string; bio: string };
  status: string; isFeatured: boolean; sortOrder: number;
  seo: { metaTitle: string; metaDescription: string; metaKeywords: string };
}

// ── Block type config ────────────────────────────────────────
const BLOCK_TYPES: { type: BlockType; label: string; Icon: React.ElementType; color: string }[] = [
  { type:"paragraph",     label:"Paragraph",     Icon:AlignLeft,    color:"#6366f1" },
  { type:"heading",       label:"Heading H2",    Icon:Heading,      color:"#f59e0b" },
  { type:"subheading",    label:"Subheading",    Icon:Type,         color:"#f97316" },
  { type:"bullet_list",   label:"Bullet List",   Icon:List,         color:"#10b981" },
  { type:"numbered_list", label:"Numbered List", Icon:ListOrdered,  color:"#3b82f6" },
  { type:"quote",         label:"Blockquote",    Icon:Quote,        color:"#8b5cf6" },
  { type:"callout",       label:"Callout Box",   Icon:Info,         color:"#ec4899" },
  { type:"image",         label:"Image",         Icon:ImageIcon,    color:"#06b6d4" },
  { type:"table",         label:"Table",         Icon:Table2,       color:"#14b8a6" },
  { type:"divider",       label:"Divider",       Icon:Minus,        color:"#9ca3af" },
];

function newBlock(type: BlockType): ContentBlock {
  return {
    _key:        Math.random().toString(36).slice(2),
    type,
    text:        "",
    items:       [""],
    tableHeaders:["Column 1","Column 2"],
    tableRows:   [["",""]],
    imageFile:   "", imageAlt: "", imageCaption: "",
  };
}

// ── Single Block Editor ──────────────────────────────────────
function BlockEditor({ block, idx, total, onChange, onRemove, onMove }: {
  block: ContentBlock; idx: number; total: number;
  onChange: (key: string, patch: Partial<ContentBlock>) => void;
  onRemove: (key: string) => void;
  onMove:   (key: string, dir: -1|1) => void;
}) {
  const cfg   = BLOCK_TYPES.find(b => b.type === block.type)!;
  const upd   = (patch: Partial<ContentBlock>) => onChange(block._key, patch);
  const color = cfg?.color || "#6b7280";

  const [imgUploading, setImgUploading] = useState(false);
  const blockImgRef = useRef<HTMLInputElement>(null);

  async function handleBlockImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImgUploading(true);
    const fd = new FormData();
    fd.append("file", file); fd.append("target", "blog");
    const res  = await fetch("/api/upload", { method:"POST", body:fd });
    const data = await res.json();
    setImgUploading(false);
    if (data.filename) upd({ imageFile: data.filename });
  }

  const listItems = block.items?.length ? block.items : [""];

  return (
    <div className="bf-block" style={{ borderLeft: `3px solid ${color}` }}>
      {/* Block header */}
      <div className="bf-block-header">
        <div className="bf-block-info">
          <GripVertical size={14} style={{ color:"#d1d5db" }} />
          {cfg && <cfg.Icon size={13} style={{ color }} />}
          <span className="bf-block-type-label" style={{ color }}>{cfg?.label || block.type}</span>
        </div>
        <div className="bf-block-controls">
          <button type="button" onClick={() => onMove(block._key,-1)} disabled={idx===0} className="bf-ctrl-btn" title="Move up">↑</button>
          <button type="button" onClick={() => onMove(block._key, 1)} disabled={idx===total-1} className="bf-ctrl-btn" title="Move down">↓</button>
          <button type="button" onClick={() => onRemove(block._key)} className="bf-ctrl-btn bf-ctrl-del" title="Remove">✕</button>
        </div>
      </div>

      {/* Block body */}
      <div className="bf-block-body">
        {/* Text blocks */}
        {["paragraph","heading","subheading","quote","callout"].includes(block.type) && (
          <textarea
            rows={block.type==="paragraph" ? 4 : 2}
            className="inp-textarea"
            placeholder={
              block.type==="heading"    ? "Section heading…"     :
              block.type==="subheading" ? "Sub-section heading…" :
              block.type==="quote"      ? "Blockquote text…"     :
              block.type==="callout"    ? "Callout / tip text…"  :
              "Paragraph text…"
            }
            value={block.text || ""}
            onChange={e => upd({ text: e.target.value })}
          />
        )}

        {/* Divider */}
        {block.type==="divider" && (
          <div style={{ padding:"12px 0" }}><hr style={{ border:"1px dashed #e5e7eb" }} /></div>
        )}

        {/* Lists */}
        {["bullet_list","numbered_list"].includes(block.type) && (
          <div className="bf-list">
            {listItems.map((item, i) => (
              <div key={i} className="bf-list-row">
                <span className="bf-list-marker">{block.type==="numbered_list" ? `${i+1}.` : "•"}</span>
                <input
                  className="inp"
                  value={item}
                  placeholder={`Item ${i+1}`}
                  onChange={e => {
                    const items = [...listItems]; items[i] = e.target.value;
                    upd({ items });
                  }}
                />
                {listItems.length > 1 && (
                  <button type="button" className="bf-ctrl-btn bf-ctrl-del"
                    onClick={() => upd({ items: listItems.filter((_,j)=>j!==i) })}>✕</button>
                )}
              </div>
            ))}
            <button type="button" className="bf-add-item" onClick={() => upd({ items:[...listItems,""] })}>
              <Plus size={12}/> Add item
            </button>
          </div>
        )}

        {/* Image block */}
        {block.type==="image" && (
          <div className="bf-img-block">
            {block.imageFile ? (
              <div className="bf-img-preview-wrap">
                <Image src={`/uploads/blogs/${block.imageFile}`} alt={block.imageAlt||""} width={400} height={240}
                  style={{ width:"100%", height:200, objectFit:"cover", borderRadius:8 }} />
                <button type="button" className="bf-img-remove" onClick={() => upd({ imageFile:"" })}>
                  <Trash2 size={13}/>
                </button>
              </div>
            ) : (
              <div className="bf-img-upload" onClick={() => blockImgRef.current?.click()}>
                {imgUploading ? <Loader2 size={20} className="spin" /> : <ImageIcon size={24} style={{ color:"#9ca3af" }}/>}
                <p>{imgUploading ? "Uploading…" : "Click to upload image"}</p>
              </div>
            )}
            <input ref={blockImgRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleBlockImage} />
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <input className="inp" placeholder="Alt text" value={block.imageAlt||""}
                onChange={e => upd({ imageAlt:e.target.value })} style={{ flex:1 }} />
              <input className="inp" placeholder="Caption (optional)" value={block.imageCaption||""}
                onChange={e => upd({ imageCaption:e.target.value })} style={{ flex:1 }} />
            </div>
          </div>
        )}

        {/* Table */}
        {block.type==="table" && (
          <div className="bf-table-wrap">
            <div className="bf-table-scroll">
              <table className="bf-table">
                <thead>
                  <tr>
                    {(block.tableHeaders||[]).map((h,ci) => (
                      <th key={ci}>
                        <input value={h} placeholder={`Header ${ci+1}`}
                          onChange={e => {
                            const headers=[...(block.tableHeaders||[])]; headers[ci]=e.target.value;
                            upd({ tableHeaders:headers });
                          }} />
                      </th>
                    ))}
                    <th>
                      <button type="button" className="bf-add-item" onClick={() => upd({
                        tableHeaders:[...(block.tableHeaders||[]),"New Col"],
                        tableRows:(block.tableRows||[]).map(r=>[...r,""]),
                      })}>+ Col</button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {(block.tableRows||[]).map((row,ri) => (
                    <tr key={ri}>
                      {(block.tableHeaders||[]).map((_,ci) => (
                        <td key={ci}>
                          <input value={row[ci]||""} placeholder="Cell"
                            onChange={e => {
                              const rows=(block.tableRows||[]).map(r=>[...r]);
                              if(!rows[ri]) rows[ri]=[];
                              rows[ri][ci]=e.target.value;
                              upd({ tableRows:rows });
                            }} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button type="button" className="bf-add-item" style={{ marginTop:8 }} onClick={() =>
              upd({ tableRows:[...(block.tableRows||[]), new Array((block.tableHeaders||[]).length).fill("")] })
            }>
              <Plus size={12}/> Add row
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// Main BlogForm
// ════════════════════════════════════════════════════════════
export default function BlogForm({ blog, categories = [] }: { blog?: Blog; categories?: BlogCategory[] }) {
  const toast = useToast();
  const isEdit = !!blog;
  const [isPending, startTransition] = useTransition();
  const [error,    setError]    = useState<string|null>(null);
  const [activeTab,setActiveTab]= useState<"author"|"seo">("author");
  const [status,   setStatus]   = useState(blog?.status || "draft");
  const [isFeatured,setIsFeatured]= useState(blog?.isFeatured || false);
  const [blocks,   setBlocks]   = useState<ContentBlock[]>(
    blog?.content?.length
      ? blog.content.map(b => ({ ...b, _key: Math.random().toString(36).slice(2) }))
      : [newBlock("paragraph")]
  );

  // Cover image
  const [coverPreview, setCoverPreview] = useState<string>(
    blog?.coverImage ? `/uploads/blogs/${blog.coverImage}` : ""
  );
  const [coverFilename, setCoverFilename]   = useState(blog?.coverImage || "");
  const [coverUploading, setCoverUploading] = useState(false);
  const coverRef = useRef<HTMLInputElement>(null);

  // Author image
  const [authorPreview,   setAuthorPreview]   = useState(blog?.author?.image ? `/uploads/authors/${blog.author.image}` : "");
  const [authorFilename,  setAuthorFilename]   = useState(blog?.author?.image || "");
  const [authorUploading, setAuthorUploading]  = useState(false);
  const authorRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File, target: string, onDone: (f:string)=>void, setUploading:(v:boolean)=>void) {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file); fd.append("target", target);
      const res  = await fetch("/api/upload", { method:"POST", body:fd });
      const data = await res.json();
      if (data.filename) onDone(data.filename);
    } finally { setUploading(false); }
  }

  // Block ops
  const addBlock    = (type: BlockType) => setBlocks(b => [...b, newBlock(type)]);
  const removeBlock = (key:string) => setBlocks(b => b.filter(bl => bl._key!==key));
  const updateBlock = useCallback((key:string, patch:Partial<ContentBlock>) => {
    setBlocks(b => b.map(bl => bl._key===key ? { ...bl, ...patch } : bl));
  }, []);
  const moveBlock = (key:string, dir:-1|1) => {
    setBlocks(b => {
      const arr=[...b]; const i=arr.findIndex(bl=>bl._key===key);
      const t=i+dir; if(t<0||t>=arr.length) return arr;
      [arr[i],arr[t]]=[arr[t],arr[i]]; return arr;
    });
  };

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("status",      status);
    fd.set("isFeatured",  String(isFeatured));
    fd.set("coverImage",  coverFilename);
    fd.set("authorImage", authorFilename);
    // Serialize blocks (strip _key)
    fd.set("content", JSON.stringify(blocks.map(({ _key, ...rest }) => rest)));

    startTransition(async () => {
      const res = isEdit ? await updateBlog(blog._id, fd) : await createBlog(fd);
      if (res?.error) { setError(res.error); toast.error("Unable to save blog post"); }
      else toast.success(isEdit ? "Blog post updated" : "Blog post created");
    });
  }

  const seoTitleLen = "";
  const seoDescLen  = "";

  return (
    <div className="form-layouti" style={{padding:"20px"}}>

      <main className="form-maini">
        <div className="breadcrumb">
          <Link href="/admin/blogs">Blogs</Link>
          <ChevronRight size={12} className="breadcrumb-sep"/>
          <span className="breadcrumb-current">{isEdit ? blog.title : "New Post"}</span>
        </div>

        {error && <div className="alert-error"><span>⚠</span> {error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="bf-layout">

            {/* ── LEFT / MAIN ── */}
            <div className="bf-main">

              {/* Cover Image */}
              <div className="form-card" style={{ marginBottom:16 }}>
                <div className="form-card-header">
                  <p className="form-card-title">Cover Image</p>
                  <p className="form-card-subtitle">Shown at top of post and on listing cards</p>
                </div>
                <div className="form-card-body">
                  <div
                    className={`bf-cover-upload${coverPreview ? " has-image" : ""}`}
                    onClick={() => !coverPreview && coverRef.current?.click()}
                  >
                    {coverPreview ? (
                      <div style={{ position:"relative", width:"100%", height:220 }}>
                        <Image src={coverPreview} alt="Cover" fill style={{ objectFit:"cover", borderRadius:8 }} />
                        {coverUploading && (
                          <div style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.4)", display:"flex", alignItems:"center", justifyContent:"center", borderRadius:8 }}>
                            <Loader2 size={24} style={{ color:"#fff" }} className="spin" />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="bf-upload-placeholder">
                        {coverUploading ? <Loader2 size={28} className="spin" /> : <Upload size={28} strokeWidth={1.5} />}
                        <p>{coverUploading ? "Uploading…" : "Click to upload cover image"}</p>
                        <small>Any image format (AVIF, WEBP, JPG, PNG) — max 5MB</small>
                      </div>
                    )}
                  </div>
                  <input ref={coverRef} type="file" accept="image/*" style={{ display:"none" }}
                    onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      setCoverPreview(URL.createObjectURL(file));
                      await uploadFile(file, "blog", (f) => { setCoverFilename(f); setCoverPreview(`/uploads/blogs/${f}`); }, setCoverUploading);
                    }} />
                  {coverPreview && (
                    <div style={{ display:"flex", gap:8, marginTop:10 }}>
                      <button type="button" className="action-btn change-btn" onClick={() => coverRef.current?.click()} disabled={coverUploading}>
                        <Upload size={13}/> Change
                      </button>
                      <button type="button" className="action-btn remove-btn" onClick={() => { setCoverPreview(""); setCoverFilename(""); }}>
                        <Trash2 size={13}/> Remove
                      </button>
                      <input name="coverImageAlt" className="inp" placeholder="Alt text for cover image"
                        defaultValue={blog?.coverImageAlt} style={{ flex:1 }} />
                    </div>
                  )}
                </div>
              </div>

              {/* Title + Excerpt */}
              <div className="form-card" style={{ marginBottom:16 }}>
                <div className="form-card-header"><p className="form-card-title">Post Details</p></div>
                <div className="form-card-body">
                  <div className="field">
                    <label className="field-label">Title *</label>
                    <input name="title" defaultValue={blog?.title} placeholder="Blog post title…" className="inp" required />
                  </div>
                  <div className="field">
                    <label className="field-label">Excerpt <span className="field-hint">(shown on listing cards)</span></label>
                    <textarea name="excerpt" defaultValue={blog?.excerpt} className="inp-textarea" rows={2} placeholder="Brief summary…" />
                  </div>
                </div>
              </div>

              {/* Content Blocks */}
              <div className="form-card" style={{ marginBottom:16 }}>
                <div className="form-card-header">
                  <p className="form-card-title">Content Blocks</p>
                  <p className="form-card-subtitle">{blocks.length} block{blocks.length!==1?"s":""}</p>
                </div>
                <div className="form-card-body">
                  <div className="bf-blocks-list">
                    {blocks.map((block, i) => (
                      <BlockEditor key={block._key} block={block} idx={i} total={blocks.length}
                        onChange={updateBlock} onRemove={removeBlock} onMove={moveBlock} />
                    ))}
                  </div>

                  {/* Add block toolbar */}
                  <div className="bf-add-toolbar">
                    <span className="bf-add-label">Add block:</span>
                    <div className="bf-add-btns">
                      {BLOCK_TYPES.map(bt => (
                        <button key={bt.type} type="button" className="bf-add-btn"
                          onClick={() => addBlock(bt.type)} title={bt.label}>
                          <bt.Icon size={13} style={{ color:bt.color }} />
                          <span>{bt.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* ── RIGHT SIDEBAR ── */}
            <div className="bf-sidebar">

              {/* Publish */}
              <div className="form-card" style={{ marginBottom:16 }}>
                <div className="form-card-header"><p className="form-card-title">Publish</p></div>
                <div className="form-card-body">
                  <div style={{ display:"flex", gap:8, marginBottom:12 }}>
                    {["draft","published","archived"].map(s => (
                      <button key={s} type="button"
                        style={{
                          flex:1, padding:"8px 4px", border:"1.5px solid",
                          borderRadius:8, cursor:"pointer", fontSize:"0.78rem", fontWeight:500, fontFamily:"DM Sans,sans-serif",
                          borderColor: status===s ? "#f97316" : "#e5e7eb",
                          background:  status===s ? "#fff7ed" : "#fff",
                          color:       status===s ? "#f97316" : "#6b7280",
                        }}
                        onClick={() => setStatus(s)}>
                        {s==="published" ? "🟢" : s==="archived" ? "📦" : "📝"} {s.charAt(0).toUpperCase()+s.slice(1)}
                      </button>
                    ))}
                  </div>
                  <label className="toggle-field-row" style={{ cursor:"pointer" }}>
                    <div>
                      <p style={{ fontSize:"0.875rem", color:"#111827", fontWeight:400, marginBottom:2 }}>⭐ Featured Post</p>
                      <p style={{ fontSize:"0.74rem", color:"#9ca3af" }}>Shown in homepage featured section</p>
                    </div>
                    <button type="button" onClick={() => setIsFeatured(v=>!v)}
                      style={{ width:44, height:24, borderRadius:12, border:"none", background:isFeatured?"#f97316":"#e5e7eb", cursor:"pointer", position:"relative", transition:"background 0.2s", flexShrink:0 }}>
                      <span style={{ position:"absolute", top:3, left:isFeatured?22:3, width:18, height:18, background:"#fff", borderRadius:"50%", transition:"left 0.2s", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }} />
                    </button>
                  </label>
                </div>
              </div>

              {/* Category + Tags + Sort */}
              <div className="form-card" style={{ marginBottom:16 }}>
                <div className="form-card-header"><p className="form-card-title">Classification</p></div>
                <div className="form-card-body">
                  <div className="field">
                    <label className="field-label">Category</label>
                    <select name="category" defaultValue={blog?.category ? (typeof blog.category === "string" ? blog.category : blog.category._id) : ""} className="inp-select">
                      <option value="">— No category —</option>
                      {categories.map(c => (
                        <option key={c._id} value={c._id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label className="field-label">Tags <span className="field-hint">(comma separated)</span></label>
                    <input name="tags" defaultValue={blog?.tags?.join(", ")} placeholder="health, nutrition, recipe" className="inp" />
                  </div>
                  <div className="field">
                    <label className="field-label">Sort Order</label>
                    <input name="sortOrder" type="number" min={0} defaultValue={blog?.sortOrder ?? 0} className="inp" />
                  </div>
                </div>
              </div>

              {/* Author + SEO tabs */}
              <div className="form-card" style={{ marginBottom:16 }}>
                <div className="form-card-body" style={{ paddingTop:0 }}>
                  {/* Tab switcher */}
                  <div style={{ display:"flex", borderBottom:"1px solid #e5e7eb", marginBottom:14, marginTop:0 }}>
                    {(["author","seo"] as const).map(tab => (
                      <button key={tab} type="button"
                        style={{ padding:"10px 14px", border:"none", background:"none", cursor:"pointer",
                          fontFamily:"DM Sans,sans-serif", fontSize:"0.84rem", fontWeight:500,
                          color:activeTab===tab?"#f97316":"#6b7280",
                          borderBottom:activeTab===tab?"2px solid #f97316":"2px solid transparent",
                          marginBottom:-1 }}
                        onClick={() => setActiveTab(tab)}>
                        {tab==="author" ? "Author" : "SEO"}
                      </button>
                    ))}
                  </div>

                  {/* Author tab */}
                  {activeTab==="author" && (
                    <div>
                      {/* Author image */}
                      <div className="bf-author-upload" onClick={() => authorRef.current?.click()}>
                        {authorPreview ? (
                          <img src={authorPreview} alt="Author" className="bf-author-preview" />
                        ) : (
                          <div className="bf-author-placeholder">
                            {authorUploading ? <Loader2 size={16} className="spin"/> : <span>👤</span>}
                          </div>
                        )}
                        <div>
                          <p style={{ fontSize:"0.82rem", fontWeight:500, color:"#374151" }}>{authorPreview ? "Change Photo" : "Upload Author Photo"}</p>
                          <p style={{ fontSize:"0.72rem", color:"#9ca3af" }}>Any image format (AVIF, WEBP, JPG, PNG) — max 5MB</p>
                        </div>
                      </div>
                      <input ref={authorRef} type="file" accept="image/*" style={{ display:"none" }}
                        onChange={async e => {
                          const file = e.target.files?.[0]; if (!file) return;
                          setAuthorPreview(URL.createObjectURL(file));
                          await uploadFile(file, "author", (f) => { setAuthorFilename(f); setAuthorPreview(`/uploads/authors/${f}`); }, setAuthorUploading);
                        }} />

                      <div className="field" style={{ marginTop:12 }}>
                        <label className="field-label">Author Name</label>
                        <input name="authorName" defaultValue={blog?.author?.name||"Damru Team"} placeholder="Author name" className="inp" />
                      </div>
                      <div className="field">
                        <label className="field-label">Designation</label>
                        <input name="authorDesignation" defaultValue={blog?.author?.designation} placeholder="e.g. Food Writer" className="inp" />
                      </div>
                      <div className="field">
                        <label className="field-label">Bio</label>
                        <textarea name="authorBio" defaultValue={blog?.author?.bio} className="inp-textarea" rows={2} placeholder="Short bio…" />
                      </div>
                    </div>
                  )}

                  {/* SEO tab */}
                  {activeTab==="seo" && (
                    <div>
                      <div className="field">
                        <label className="field-label">Meta Title <span className="field-hint">(50–60 chars)</span></label>
                        <input name="seoTitle" defaultValue={blog?.seo?.metaTitle} className="inp" placeholder="SEO title…" maxLength={70} />
                      </div>
                      <div className="field">
                        <label className="field-label">Meta Description <span className="field-hint">(max 160)</span></label>
                        <textarea name="seoDescription" defaultValue={blog?.seo?.metaDescription} className="inp-textarea" rows={3} placeholder="Search result description…" maxLength={170} />
                      </div>
                      <div className="field">
                        <label className="field-label">Meta Keywords</label>
                        <input name="seoKeywords" defaultValue={blog?.seo?.metaKeywords} className="inp" placeholder="keyword1, keyword2…" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Save */}
              <div className="form-card">
                <div className="form-footer">
                  <Link href="/admin/blogs" className="btn-cancel">Cancel</Link>
                  <button type="submit" disabled={isPending} className="btn-submit">
                    {isPending ? <><Loader2 size={15} className="spin"/> Saving…</> : <><Save size={15}/> {isEdit?"Update Post":"Create Post"}</>}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
