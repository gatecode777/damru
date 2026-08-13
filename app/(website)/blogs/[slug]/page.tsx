import type { Metadata } from "next";
import "@/styles/website/blog.css";
import "@/styles/website/blogdetails.css";
import { notFound } from "next/navigation";
import Link from "next/link";
import { BlogSidebar, BlogComments } from "@/components/website/BlogDetailClient";
import { connectDB } from "@/lib/mongodb";
import Blog, { IContentBlock } from "@/models/Blog";
import BlogComment from "@/models/BlogComment";

interface IBlog {
  _id: string; title: string; slug: string; excerpt: string;
  content: IContentBlock[]; category: string; tags: string[];
  author: { name: string; image: string; designation: string; bio: string };
  coverImage: string; coverImageAlt: string;
  publishedAt?: string; createdAt: string; updatedAt: string;
  views: number; readTime: number; isFeatured: boolean;
  seo: { metaTitle: string; metaDescription: string; metaKeywords: string };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  try {
    await connectDB();
    const blog = await Blog.findOne({ slug, status: "published" }).populate("category", "name").lean() as IBlog | null;
    if (!blog) return { title: "Post Not Found" };
    const title = blog.seo?.metaTitle || blog.title;
    const desc = blog.seo?.metaDescription || blog.excerpt;
    const siteUrl = process.env.NEXTAUTH_URL || "https://damrurestro.com";
    return {
      title: `${title} | Damru By Namo`,
      description: desc,
      keywords: blog.seo?.metaKeywords,
      alternates: {
        canonical: `${siteUrl}/blogs/${blog.slug}`,
      },
      openGraph: {
        title,
        description: desc,
        type: "article",
        url: `${siteUrl}/blogs/${blog.slug}`,
        publishedTime: blog.publishedAt,
        modifiedTime: blog.updatedAt,
        authors: [blog.author?.name || "Damru Team"],
        tags: blog.tags,
        images: blog.coverImage ? [{ url: `/uploads/blogs/${blog.coverImage}`, alt: blog.coverImageAlt || blog.title }] : [],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description: desc,
        images: blog.coverImage ? [`/uploads/blogs/${blog.coverImage}`] : [],
      }
    };
  } catch { return { title: "Blog | Damru By Namo" }; }
}

export async function generateStaticParams() {
  try {
    await connectDB();
    const blogs = await Blog.find({ status: "published" }).select("slug").lean();
    return (blogs as { slug: string }[]).map(b => ({ slug: b.slug }));
  } catch { return []; }
}

function formatDate(d?: string) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ── Render a single content block ──────────────────────────
function RenderBlock({ block, skipImages }: { block: IContentBlock; skipImages?: Set<string> }) {
  switch (block.type) {
    case "heading":
      return <h2 className="sb-main__heading-2">{block.text}</h2>;
    case "subheading":
      return <h3 className="sb-main__heading-3">{block.text}</h3>;
    case "paragraph":
      return <p className="sb-main__paragraph">{block.text}</p>;
    case "quote":
      return <div className="sb-main__quote">&ldquo;{block.text}&rdquo;</div>;
    case "callout":
      return (
        <div style={{ background: "#fff7ed", border: "1.5px solid #fed7aa", borderRadius: 10, padding: "14px 18px", margin: "16px 0", fontFamily: "Poppins,sans-serif", fontSize: "0.9rem", color: "#92400e" }}>
          💡 {block.text}
        </div>
      );
    case "bullet_list":
      return (
        <ul className="sb-main__list sb-main__list--bullet">
          {(block.items || []).map((item, i) => item && <li key={i}>{item}</li>)}
        </ul>
      );
    case "numbered_list":
      return (
        <ol className="sb-main__list sb-main__list--numbered">
          {(block.items || []).map((item, i) => item && <li key={i}>{item}</li>)}
        </ol>
      );
    case "image":
      if (block.imageFile && skipImages?.has(block.imageFile)) {
        return null;
      }
      return block.imageFile ? (
        <figure style={{ margin: "20px 0" }}>
          <img src={`/uploads/blogs/${block.imageFile}`} alt={block.imageAlt || ""} style={{ width: "100%", borderRadius: 10 }} loading="lazy" />
          {block.imageCaption && <figcaption style={{ textAlign: "center", fontSize: "0.8rem", color: "#9ca3af", marginTop: 6 }}>{block.imageCaption}</figcaption>}
        </figure>
      ) : null;
    case "table":
      return (block.tableHeaders?.length) ? (
        <div className="sb-main__table-wrapper">
          <table className="sb-main__table">
            <thead>
              <tr>{block.tableHeaders.map((h, i) => <th key={i}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {(block.tableRows || []).map((row, ri) => (
                <tr key={ri}>{row.map((cell, ci) => <td key={ci}>{cell}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null;
    case "divider":
      return <hr style={{ border: "none", borderTop: "1px solid #e5e7eb", margin: "24px 0" }} />;
    default:
      return null;
  }
}

const IMG_FALLBACK = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&q=80&w=800";
const AVATAR_FALLBACK = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  let blog: IBlog | null = null;
  let recent: IBlog[] = [];
  let prev: IBlog | null = null;
  let next: IBlog | null = null;
  let archives: { year: number; month: number; monthName: string; count: number }[] = [];
  let recentComments: any[] = [];

  try {
    await connectDB();
    blog = JSON.parse(JSON.stringify(await Blog.findOne({ slug, status: "published" }).populate("category", "name").lean()));
    if (!blog) notFound();

    // Fire-and-forget view count increment
    Blog.findByIdAndUpdate(blog._id, { $inc: { views: 1 } }).catch(() => {});

    // Recent 3 posts (excluding current)
    const rawRecent = await Blog.find({ status: "published", _id: { $ne: blog._id } })
      .sort({ publishedAt: -1, createdAt: -1 }).limit(3).lean();
    recent = JSON.parse(JSON.stringify(rawRecent));

    // Prev post
    const publishedAt = blog.publishedAt || blog.createdAt;
    const rawPrev = await Blog.findOne({ status: "published", publishedAt: { $lt: publishedAt } })
      .sort({ publishedAt: -1 }).select("title slug coverImage").lean();
    prev = rawPrev ? JSON.parse(JSON.stringify(rawPrev)) : null;

    // Next post
    const rawNext = await Blog.findOne({ status: "published", publishedAt: { $gt: publishedAt } })
      .sort({ publishedAt: 1 }).select("title slug coverImage").lean();
    next = rawNext ? JSON.parse(JSON.stringify(rawNext)) : null;

    // Archives Aggregation
    const rawArchives = await Blog.aggregate([
      { $match: { status: "published" } },
      {
        $group: {
          _id: {
            year: { $year: { $ifNull: ["$publishedAt", "$createdAt"] } },
            month: { $month: { $ifNull: ["$publishedAt", "$createdAt"] } }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": -1, "_id.month": -1 } }
    ]);
    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    archives = rawArchives.map(a => ({
      year: a._id.year,
      month: a._id.month,
      monthName: monthNames[a._id.month - 1] || "Unknown",
      count: a.count
    }));

    // Recent Comments
    const rawComments = await BlogComment.find({ approved: true })
      .sort({ createdAt: -1 }).limit(3).populate("blogId", "title").lean();
    recentComments = JSON.parse(JSON.stringify(rawComments));

  } catch (err) {
    console.error("Data fetching error in blog detail:", err);
    notFound();
  }

  if (!blog) notFound();

  // ── Extract Images for gallery grid ───────────────────────
  const galleryImages: string[] = [];
  const galleryImageFiles = new Set<string>();

  if (blog.coverImage) {
    galleryImages.push(`/uploads/blogs/${blog.coverImage}`);
  }

  (blog.content || []).forEach((block: any) => {
    if (block.type === "image" && block.imageFile && galleryImages.length < 3) {
      galleryImages.push(`/uploads/blogs/${block.imageFile}`);
      galleryImageFiles.add(block.imageFile);
    }
  });

  // ── JSON-LD Structured Data ────────────────────────────────
  const siteUrl = process.env.NEXTAUTH_URL || "https://damrurestro.com";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `${siteUrl}/blogs/${blog.slug}`
    },
    "headline": blog.title,
    "image": galleryImages.map(img => img.startsWith("http") ? img : `${siteUrl}${img}`),
    "datePublished": blog.publishedAt || blog.createdAt,
    "dateModified": blog.updatedAt || blog.createdAt,
    "author": {
      "@type": "Person",
      "name": blog.author?.name || "Damru Team",
      "image": blog.author?.image ? `${siteUrl}/uploads/authors/${blog.author.image}` : undefined
    },
    "description": blog.excerpt || blog.title,
    "publisher": {
      "@type": "Organization",
      "name": "Damru By Namo",
      "logo": {
        "@type": "ImageObject",
        "url": `${siteUrl}/assets/images/damru.png`
      }
    }
  };

  return (
    <div className="sb-page">
      {/* Breadcrumb & Centered Title */}
      <div className="sb-page__top-header">
        <div className="sb-page__breadcrumb">
          <Link href="/">Home</Link> / <Link href="/blogs">Blog</Link> / <strong>{blog.title}</strong>
        </div>
        <h1 className="sb-page__main-title">{blog.title}</h1>
      </div>

      <div className="sb-page__container">
        {/* Left Column: Main content stream */}
        <main className="sb-main">
          {blog.excerpt && <p className="sb-main__intro">{blog.excerpt}</p>}

          {/* Gallery Image Grid */}
          {galleryImages.length > 0 && (
            <div className="sb-main__gallery">
              {galleryImages.length >= 3 ? (
                <div className="sb-main__gallery-grid">
                  <div className="sb-main__gallery-left">
                    <img src={galleryImages[0]} alt={blog.coverImageAlt || blog.title} fetchPriority="high" />
                  </div>
                  <div className="sb-main__gallery-right">
                    <img src={galleryImages[1]} alt={blog.title} loading="lazy" />
                    <img src={galleryImages[2]} alt={blog.title} loading="lazy" />
                  </div>
                </div>
              ) : galleryImages.length === 2 ? (
                <div className="sb-main__gallery-grid sb-main__gallery-grid--two">
                  <img src={galleryImages[0]} alt={blog.coverImageAlt || blog.title} fetchPriority="high" />
                  <img src={galleryImages[1]} alt={blog.title} loading="lazy" />
                </div>
              ) : (
                <div className="sb-main__gallery-single">
                  <img src={galleryImages[0]} alt={blog.coverImageAlt || blog.title} fetchPriority="high" />
                </div>
              )}
            </div>
          )}

          {/* Structured content blocks */}
          <div className="sb-main__body">
            {(blog.content || []).map((block, i) => (
              <RenderBlock key={i} block={block} skipImages={galleryImageFiles} />
            ))}
          </div>

          {/* Tags list */}
          {blog.tags?.length > 0 && (
            <div className="sb-main__tags">
              {blog.tags.map(tag => (
                <Link key={tag} href={`/blogs?tag=${encodeURIComponent(tag)}`} className="sb-main__tag-chip">
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Author info */}
          {blog.author && (blog.author.name || blog.author.bio) && (
            <div className="sb-main__author">
              <img src={blog.author.image ? `/uploads/authors/${blog.author.image}` : AVATAR_FALLBACK} alt={blog.author.name || "Author"} />
              <div className="sb-main__author-info">
                <h3>{blog.author.name || "Damru Team"}</h3>
                {blog.author.designation && <p className="sb-main__author-designation">{blog.author.designation}</p>}
                {blog.author.bio && <p className="sb-main__author-bio">{blog.author.bio}</p>}
              </div>
            </div>
          )}

          {/* Previous & Next post navigation */}
          {(prev || next) && (
            <div className="sb-fullwidth__nav">
              {prev ? (
                <Link href={`/blogs/${prev.slug}`} className="sb-fullwidth__nav-box"
                  style={{ backgroundImage: `url('${prev.coverImage ? `/uploads/blogs/${prev.coverImage}` : IMG_FALLBACK}')` }}>
                  <div className="sb-fullwidth__nav-overlay"></div>
                  <span className="sb-fullwidth__nav-label">&larr; PREVIOUS POST</span>
                  <h4 className="sb-fullwidth__nav-title">{prev.title}</h4>
                </Link>
              ) : <div className="sb-fullwidth__nav-placeholder" />}
              {next ? (
                <Link href={`/blogs/${next.slug}`} className="sb-fullwidth__nav-box"
                  style={{ backgroundImage: `url('${next.coverImage ? `/uploads/blogs/${next.coverImage}` : IMG_FALLBACK}')` }}>
                  <div className="sb-fullwidth__nav-overlay"></div>
                  <span className="sb-fullwidth__nav-label">NEXT POST &rarr;</span>
                  <h4 className="sb-fullwidth__nav-title">{next.title}</h4>
                </Link>
              ) : <div className="sb-fullwidth__nav-placeholder" />}
            </div>
          )}

          {/* Comments and replies */}
          <BlogComments blogSlug={slug} />
        </main>

        {/* Right Column: Sidebar */}
        <aside className="sb-sidebar">
          {/* Search + Categories Client component */}
          <BlogSidebar
            blogSlug={slug}
            currentCategoryName={blog.category && typeof blog.category === "object" && "name" in (blog.category as object) ? (blog.category as any).name : String(blog.category || "")}
          />

          {/* Recent Comments widget */}
          {recentComments.length > 0 && (
            <div className="sb-sidebar__widget">
              <h3 className="sb-sidebar__title">Recent Comments</h3>
              <div className="sb-sidebar__comments">
                {recentComments.map((c: any) => (
                  <div key={c._id} className="sb-sidebar__comment-item">
                    <span>{c.name} on:</span>
                    <Link href={`/blogs/${c.blogSlug}`}>
                      <strong>{c.blogId?.title || c.blogSlug}</strong>
                    </Link>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Archives widget */}
          {archives.length > 0 && (
            <div className="sb-sidebar__widget">
              <h3 className="sb-sidebar__title">Archives</h3>
              <ul className="sb-sidebar__list">
                {archives.map((a, i) => (
                  <li key={i}>
                    <Link href={`/blogs?archive=${a.year}-${String(a.month).padStart(2, "0")}`}>
                      {a.monthName} {a.year}
                    </Link>
                    <span>({a.count})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recent Posted widget */}
          {recent.length > 0 && (
            <div className="sb-sidebar__widget">
              <h3 className="sb-sidebar__title">Recent Posted</h3>
              {recent.map(r => (
                <div key={r._id} className="sb-sidebar__post">
                  <img src={r.coverImage ? `/uploads/blogs/${r.coverImage}` : IMG_FALLBACK} alt={r.title} loading="lazy" />
                  <div className="sb-sidebar__post-info">
                    <h4>
                      <Link href={`/blogs/${r.slug}`} style={{ textDecoration: "none", color: "inherit" }}>
                        {r.title}
                      </Link>
                    </h4>
                    <small>
                      {typeof r.author === "object" ? (r.author as any)?.name : r.author || "Damru Team"} • {formatDate(r.publishedAt || r.createdAt)}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tags widget */}
          <div className="sb-sidebar__widget">
            <h3 className="sb-sidebar__title">Tags</h3>
            <div className="sb-sidebar__tags">
              {blog.tags?.map(tag => (
                <Link key={tag} href={`/blogs?tag=${encodeURIComponent(tag)}`}>
                  #{tag}
                </Link>
              ))}
              {!blog.tags?.length && <span style={{ color: "#aaa", fontSize: "0.85rem" }}>No tags</span>}
            </div>
          </div>
        </aside>
      </div>

      {/* Structured Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </div>
  );
}