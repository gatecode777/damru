import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BlogSidebar, BlogComments } from "@/components/website/BlogDetailClient";
import { connectDB } from "@/lib/mongodb";
import Blog, { IContentBlock } from "@/models/Blog";

interface IBlog {
  _id: string; title: string; slug: string; excerpt: string;
  content: IContentBlock[]; category: string; tags: string[];
  author: { name: string; image: string; designation: string; bio: string };
  coverImage: string; coverImageAlt: string;
  publishedAt?: string; createdAt: string;
  views: number; readTime: number; isFeatured: boolean;
  seo: { metaTitle: string; metaDescription: string; metaKeywords: string };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    await connectDB();
    const blog = await Blog.findOne({ slug, status: "published" }).populate("category","name").lean() as IBlog|null;
    if (!blog) return { title: "Post Not Found" };
    const title = blog.seo?.metaTitle || blog.title;
    const desc  = blog.seo?.metaDescription || blog.excerpt;
    return {
      title: `${title} | Damru By Namo`,
      description: desc,
      keywords: blog.seo?.metaKeywords,
      openGraph: {
        title, description: desc, type: "article",
        publishedTime: blog.publishedAt,
        authors: [blog.author?.name],
        tags: blog.tags,
        images: blog.coverImage ? [{ url:`/uploads/blogs/${blog.coverImage}`, alt:blog.coverImageAlt||blog.title }] : [],
      },
    };
  } catch { return { title: "Blog | Damru By Namo" }; }
}

export async function generateStaticParams() {
  try {
    await connectDB();
    const blogs = await Blog.find({ status:"published" }).select("slug").lean();
    return (blogs as { slug: string }[]).map(b => ({ slug: b.slug }));
  } catch { return []; }
}

function formatDate(d?: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });
}

// ── Render a single content block ──────────────────────────
function RenderBlock({ block }: { block: IContentBlock }) {
  switch (block.type) {
    case "heading":
      return <h2>{block.text}</h2>;
    case "subheading":
      return <h3>{block.text}</h3>;
    case "paragraph":
      return <p>{block.text}</p>;
    case "quote":
      return <div className="sb-main__quote">&ldquo;{block.text}&rdquo;</div>;
    case "callout":
      return (
        <div style={{ background:"#fff7ed", border:"1.5px solid #fed7aa", borderRadius:10, padding:"14px 18px", margin:"16px 0", fontFamily:"Poppins,sans-serif", fontSize:"0.9rem", color:"#92400e" }}>
          💡 {block.text}
        </div>
      );
    case "bullet_list":
      return (
        <ul className="sb-main__list">
          {(block.items||[]).map((item,i) => item && <li key={i}>{item}</li>)}
        </ul>
      );
    case "numbered_list":
      return (
        <ol className="sb-main__list">
          {(block.items||[]).map((item,i) => item && <li key={i}>{item}</li>)}
        </ol>
      );
    case "image":
      return block.imageFile ? (
        <figure style={{ margin:"20px 0" }}>
          <img src={`/uploads/blogs/${block.imageFile}`} alt={block.imageAlt||""} style={{ width:"100%", borderRadius:10 }} />
          {block.imageCaption && <figcaption style={{ textAlign:"center", fontSize:"0.8rem", color:"#9ca3af", marginTop:6 }}>{block.imageCaption}</figcaption>}
        </figure>
      ) : null;
    case "table":
      return (block.tableHeaders?.length) ? (
        <table className="sb-main__table">
          <thead>
            <tr>{block.tableHeaders.map((h,i) => <th key={i}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {(block.tableRows||[]).map((row,ri) => (
              <tr key={ri}>{row.map((cell,ci) => <td key={ci}>{cell}</td>)}</tr>
            ))}
          </tbody>
        </table>
      ) : null;
    case "divider":
      return <hr style={{ border:"none", borderTop:"1px solid #e5e7eb", margin:"24px 0" }} />;
    default:
      return null;
  }
}

const IMG_FALLBACK    = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800";
const AVATAR_FALLBACK = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let blog: IBlog|null = null;
  let recent: IBlog[]  = [];
  let prev: IBlog|null = null;
  let next: IBlog|null = null;

  try {
    await connectDB();
    blog = JSON.parse(JSON.stringify(await Blog.findOne({ slug, status:"published" }).populate("category","name").lean()));
    if (!blog) notFound();

    await Blog.findByIdAndUpdate(blog._id, { $inc: { views:1 } });

    const rawRecent = await Blog.find({ status:"published", _id:{ $ne:blog._id } })
      .sort({ publishedAt:-1 }).limit(3).lean();
    recent = JSON.parse(JSON.stringify(rawRecent));

    const rawPrev = await Blog.findOne({ status:"published", publishedAt:{ $lt: blog.publishedAt||blog.createdAt } })
      .sort({ publishedAt:-1 }).lean();
    prev = rawPrev ? JSON.parse(JSON.stringify(rawPrev)) : null;

    const rawNext = await Blog.findOne({ status:"published", publishedAt:{ $gt: blog.publishedAt||blog.createdAt } })
      .sort({ publishedAt:1 }).lean();
    next = rawNext ? JSON.parse(JSON.stringify(rawNext)) : null;
  } catch { notFound(); }

  if (!blog) notFound();

  return (
    <div className="sb-page">
      <div className="sb-page__top-header">
        <div className="sb-page__breadcrumb">
          <Link href="/">Home</Link> / <Link href="/blogs">Blog</Link> / <strong>{blog.title}</strong>
        </div>
        <h1 className="sb-page__main-title">{blog.title}</h1>
        {/* <div style={{ display:"flex", gap:16, alignItems:"center", fontFamily:"Poppins,sans-serif", fontSize:"0.82rem", color:"#888", marginTop:8 }}>
          <span>By {blog.author?.name || "Damru Team"}</span>
          <span>•</span>
          <span>{formatDate(blog.publishedAt||blog.createdAt)}</span>
          <span>•</span>
          <span>{blog.readTime} min read</span>
          <span>•</span>
          <span>{blog.views} views</span>
        </div> */}
      </div>

      <div className="sb-page__container">
        <main className="sb-main">
          {blog.excerpt && <p className="sb-main__intro">{blog.excerpt}</p>}

          {/* Cover image */}
          {blog.coverImage && (
            <div className="sb-main__gallery">
              <img src={`/uploads/blogs/${blog.coverImage}`} alt={blog.coverImageAlt||blog.title} />
            </div>
          )}

          {/* Structured content blocks */}
          {(blog.content||[]).map((block, i) => (
            <RenderBlock key={i} block={block} />
          ))}

          {/* Tags */}
          {blog.tags?.length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:8, margin:"24px 0" }}>
              {blog.tags.map(tag => (
                <a key={tag} href={`/blogs?tag=${encodeURIComponent(tag)}`}
                  style={{ background:"#f3f4f6", borderRadius:20, padding:"4px 12px", fontSize:"0.8rem", color:"#6b7280", textDecoration:"none" }}>
                  #{tag}
                </a>
              ))}
            </div>
          )}

          {/* Author */}
          <div className="sb-main__author">
            <img src={blog.author?.image ? `/uploads/authors/${blog.author.image}` : AVATAR_FALLBACK} alt={blog.author?.name||"Author"} />
            <div>
              <h3>{blog.author?.name || "Damru Team"}</h3>
              {blog.author?.designation && <p style={{ fontWeight:600, color:"#e67e22", margin:"2px 0" }}>{blog.author.designation}</p>}
              {blog.author?.bio && <p>{blog.author.bio}</p>}
            </div>
          </div>
        </main>

        {/* Sidebar */}
        <aside className="sb-sidebar">
          <BlogSidebar
            blogSlug={slug}
            currentCategoryName={blog.category && typeof blog.category === "object" && "name" in (blog.category as object) ? (blog.category as any).name : String(blog.category || "")}
          />
          <div className="sb-sidebar__widget">
            <h3 className="sb-sidebar__title">Recent Posted</h3>
            {recent.map(r => (
              <div key={r._id} className="sb-sidebar__post">
                <img src={r.coverImage ? `/uploads/blogs/${r.coverImage}` : IMG_FALLBACK} alt={r.title} />
                <div className="sb-sidebar__post-info">
                  <h4><Link href={`/blogs/${r.slug}`} style={{ textDecoration:"none",color:"inherit" }}>{r.title}</Link></h4>
                  <small>{typeof r.author === "object" ? (r.author as any)?.name : r.author} • {formatDate(r.publishedAt||r.createdAt)}</small>
                </div>
              </div>
            ))}
          </div>
          <div className="sb-sidebar__widget">
            <h3 className="sb-sidebar__title">Tags</h3>
            <div className="sb-sidebar__tags">
              {blog.tags?.map(tag => <a key={tag} href={`/blogs?tag=${encodeURIComponent(tag)}`}>#{tag}</a>)}
              {!blog.tags?.length && <span style={{ color:"#aaa", fontSize:"0.85rem" }}>No tags</span>}
            </div>
          </div>
        </aside>
      </div>

      {/* Full width — prev/next + comments */}
      <div className="sb-fullwidth">
        {(prev||next) && (
          <div className="sb-fullwidth__nav">
            {prev ? (
              <Link href={`/blogs/${prev.slug}`} className="sb-fullwidth__nav-box"
                style={{ backgroundImage:`url('${prev.coverImage?`/uploads/blogs/${prev.coverImage}`:IMG_FALLBACK}')` }}>
                <span>&larr; PREVIOUS POST</span><h4>{prev.title}</h4>
              </Link>
            ) : <div />}
            {next ? (
              <Link href={`/blogs/${next.slug}`} className="sb-fullwidth__nav-box"
                style={{ backgroundImage:`url('${next.coverImage?`/uploads/blogs/${next.coverImage}`:IMG_FALLBACK}')` }}>
                <span>NEXT POST &rarr;</span><h4>{next.title}</h4>
              </Link>
            ) : <div />}
          </div>
        )}

        <BlogComments blogSlug={slug} />
      </div>
    </div>
  );
}