import type { Metadata } from "next";
import Link from "next/link";
import { connectDB } from "@/lib/mongodb";
import Blog from "@/models/Blog";

const PAGE_SIZE = 9;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { page } = await searchParams;
  return {
    title: page && page !== "1" ? `Blog — Page ${page} | Damru By Namo` : "Blog | Damru By Namo",
    description: "Read our latest articles on food, recipes, health, and restaurant news from Damru By Namo, Jaipur.",
    openGraph: {
      title: "Blog | Damru By Namo",
      description: "Latest food stories and recipes from Damru By Namo.",
      type: "website",
    },
  };
}

interface IAuthor { name: string; image: string; designation: string; bio: string; }
interface IBlog {
  _id: string; title: string; slug: string; excerpt: string;
  category: string | { _id: string; name: string };
  author: string | IAuthor;
  coverImage?: string; publishedAt?: string; createdAt: string;
  views: number; tags: string[];
}

// helpers
function authorName(a: IBlog["author"]): string {
  return typeof a === "object" && a ? a.name : (a as string) || "Damru Team";
}
function authorAvatar(a: IBlog["author"], fallback: string): string {
  if (typeof a === "object" && a && a.image) return `/uploads/authors/${a.image}`;
  return fallback;
}
function catName(c: IBlog["category"]): string {
  return typeof c === "object" && c ? (c as { name: string }).name : (c as string) || "General";
}

const ARROW_SVG = (
  <svg width="20" height="10" viewBox="0 0 25 12" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 1L24 6L19 11M0 6H24H0Z" stroke="#4a6cf7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default async function BlogsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam || "1", 10));

  let blogs: IBlog[] = [];
  let total = 0;

  try {
    await connectDB();
    total = await Blog.countDocuments({ status: "published" });
    const raw = await Blog.find({ status: "published" })
      .populate("category", "name")
      .sort({ publishedAt: -1, createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean();
    blogs = JSON.parse(JSON.stringify(raw));
  } catch { /* empty state */ }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function formatDate(d?: string) {
    if (!d) return "";
    return new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  }

  const AVATAR_FALLBACK = "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200";
  const IMG_FALLBACK = "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=500&q=80";

  return (
    <div className="blog-section-wrapper">

      {/* Breadcrumb */}
      {/* <div className="blog-breadcrumb">
        <p>Home / <span>Blog</span></p>
      </div> */}
      <div className="blog-breadcrumb">
        <Link href="/">Home</Link> / <span>Blog</span>
      </div>

      {/* Blog Grid */}
      <div className="blog-container">
        {blogs.length === 0 ? (
          <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "80px 20px", fontFamily: "Poppins,sans-serif", color: "#aaa" }}>
            No blog posts yet. Check back soon!
          </div>
        ) : (
          blogs.map(blog => (
            <article key={blog._id} className="blog-card">
              <div className="blog-img-box">
                <img
                  src={blog.coverImage ? `/uploads/blogs/${blog.coverImage}` : IMG_FALLBACK}
                  alt={blog.title}
                />
                <span className="category-badge">{catName(blog.category)}</span>
              </div>
              <div className="blog-content">
                <div className="blog-meta">
                  <img
                    src={authorAvatar(blog.author, AVATAR_FALLBACK)}
                    alt={authorName(blog.author)}
                    className="author-img"
                  />
                  <p>{authorName(blog.author)} • {formatDate(blog.publishedAt || blog.createdAt)}</p>
                </div>
                <h2 className="blog-title">{blog.title}</h2>
                <div className="dotted-line"></div>
                <p className="blog-excerpt">{blog.excerpt}</p>
                <Link href={`/blogs/${blog.slug}`} className="read-more">
                  Read More {ARROW_SVG}
                </Link>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="blog-pagination">
          {page > 1 ? (
            <Link href={`/blogs?page=${page - 1}`} className="pag-btn">Prev</Link>
          ) : (
            <button className="pag-btn" disabled>Prev</button>
          )}

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <Link
              key={p}
              href={`/blogs?page=${p}`}
              className={`pag-num${p === page ? " active" : ""}`}
            >
              {p}
            </Link>
          ))}

          {page < totalPages ? (
            <Link href={`/blogs?page=${page + 1}`} className="pag-btn">Next</Link>
          ) : (
            <button className="pag-btn" disabled>Next</button>
          )}
        </div>
      )}

    </div>
  );
}