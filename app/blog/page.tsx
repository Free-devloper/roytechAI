"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  category: "AI & Agents" | "Architecture" | "Product Strategy" | "Engineering";
  date: string;
  readTime: string;
  author: string;
  excerpt: string;
  content: string;
}

import INITIAL_POSTS from "./data/posts.json";

const initialPostsData = INITIAL_POSTS as BlogPost[];

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>(initialPostsData);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [activePost, setActivePost] = useState<BlogPost | null>(null);

  // Admin Publishing Protection State
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");

  // New Post Form State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<BlogPost["category"]>("AI & Agents");
  const [newExcerpt, setNewExcerpt] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newReadTime, setNewReadTime] = useState("5 min read");
  const [previewTab, setPreviewTab] = useState<"edit" | "preview">("edit");

  // Load local posts if published previously
  useEffect(() => {
    try {
      const saved = localStorage.getItem("roytech_blog_posts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setPosts(parsed);
        }
      }
    } catch {
      // fallback to initial
    }
  }, []);

  // Filter posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesCat = selectedCategory === "All" || post.category === selectedCategory;
      const matchesSearch =
        searchQuery.trim() === "" ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.category.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesSearch;
    });
  }, [posts, selectedCategory, searchQuery]);

const EXPECTED_HASH = "fc767f373f24caf9ecd1a937bc3904f9925f7706a3166d14433ed3cf3bb183b2";

async function verifyPasscodeHash(passcode: string): Promise<boolean> {
  try {
    const msgBuffer = new TextEncoder().encode(passcode + "_roytech_salt_2026");
    const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hexHash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    return hexHash === EXPECTED_HASH;
  } catch {
    return false;
  }
}

  // Handle Admin Passcode Auth
  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const isValid = await verifyPasscodeHash(adminPasscode);
    if (isValid) {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Invalid Admin Passcode! Access Denied.");
    }
  };

  // Handle New Post Publish
  const handlePublish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    const slug = newTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)+/g, "");

    const newPost: BlogPost = {
      id: `post-${Date.now()}`,
      title: newTitle,
      slug: slug || `post-${Date.now()}`,
      category: newCategory,
      date: new Date().toISOString().split("T")[0],
      readTime: newReadTime || "4 min read",
      author: "Rehan Ghafoor",
      excerpt: newExcerpt || newTitle,
      content: newContent,
    };

    const updated = [newPost, ...posts];
    setPosts(updated);
    try {
      localStorage.setItem("roytech_blog_posts", JSON.stringify(updated));
    } catch {
      // ignore
    }

    // Reset Form
    setNewTitle("");
    setNewExcerpt("");
    setNewContent("");
    setIsAdminOpen(false);
    setActivePost(newPost);
  };

  const renderedActiveContent = useMemo(() => {
    if (!activePost) return "";
    return marked.parse(activePost.content);
  }, [activePost]);

  const renderedPreviewContent = useMemo(() => {
    return marked.parse(newContent || "*No content written yet...*");
  }, [newContent]);

  return (
    <main className="blog-container">
      {/* HEADER NAVBAR */}
      <header className="site-header">
        <a className="brand" href="/" aria-label="RoyTech AI home">
          <span className="mark"><i /><i /><i /></span>RoyTech<sup>AI</sup>
        </a>
        <nav className="navigation open">
          <a href="/">Home</a>
          <a href="/#services">Capabilities</a>
          <a href="/#estimator">Estimator</a>
          <a href="/blog" className="active-nav">Blog</a>
          <a href="/#contact">Contact</a>
        </nav>
        <button
          type="button"
          className="button header-button"
          onClick={() => setIsAdminOpen(true)}
          style={{ cursor: "pointer" }}
        >
          🔐 Admin Studio
        </button>
      </header>

      {/* ARTICLE READER VIEW */}
      {activePost ? (
        <article className="blog-reader page-pad">
          <button type="button" className="back-btn" onClick={() => setActivePost(null)}>
            ← Back to All Articles
          </button>
          
          <div className="reader-header">
            <div className="reader-meta">
              <span className="blog-tag">{activePost.category}</span>
              <span>{activePost.date}</span>
              <span>•</span>
              <span>{activePost.readTime}</span>
            </div>
            <h1>{activePost.title}</h1>
            <div className="author-card">
              <div className="author-avatar">RG</div>
              <div>
                <strong>{activePost.author}</strong>
                <small>Founder & Lead Architect · RoyTech AI</small>
              </div>
            </div>
          </div>

          <div
            className="markdown-body"
            dangerouslySetInnerHTML={{ __html: renderedActiveContent }}
          />

          <div className="reader-footer">
            <h3>Ready to build your AI product?</h3>
            <p>We work directly with founders and product teams to deliver operating software fast.</p>
            <a href="/#contact" className="button">Start a Build Plan ↗</a>
          </div>
        </article>
      ) : (
        /* BLOG INDEX FEED VIEW */
        <section className="blog-index page-pad">
          <div className="blog-hero">
            <p className="eyebrow"><i /> ENGINEERING & PRODUCT INSIGHTS</p>
            <h1>Insights on AI, Architecture & Product Shipping</h1>
            <p className="lead">
              Practical guides, code patterns, and product engineering strategies from founder & architect Rehan Ghafoor.
            </p>
          </div>

          {/* SEARCH & CATEGORY FILTERS */}
          <div className="blog-filter-bar">
            <div className="search-box">
              <input
                type="text"
                placeholder="Search articles by title or keyword..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="category-pills">
              {["All", "AI & Agents", "Architecture", "Product Strategy"].map((cat) => (
                <button
                  type="button"
                  key={cat}
                  className={`pill-btn ${selectedCategory === cat ? "active" : ""}`}
                  onClick={() => setSelectedCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* ARTICLES GRID */}
          <div className="posts-grid">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post) => (
                <article
                  key={post.id}
                  className="post-card"
                  onClick={() => setActivePost(post)}
                >
                  <div className="card-top">
                    <span className="blog-tag">{post.category}</span>
                    <small>{post.readTime}</small>
                  </div>
                  <h2>{post.title}</h2>
                  <p>{post.excerpt}</p>
                  <div className="card-bottom">
                    <span>By {post.author}</span>
                    <span className="read-link">Read Article ↗</span>
                  </div>
                </article>
              ))
            ) : (
              <div className="no-posts">
                <h3>No articles found</h3>
                <p>Try searching for a different keyword or category.</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* PROTECTED ADMIN PUBLISHING MODAL */}
      {isAdminOpen && (
        <div className="modal-overlay" onClick={() => setIsAdminOpen(false)}>
          <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔐 RoyTech AI Blog Publishing Studio</h3>
              <button type="button" className="close-x" onClick={() => setIsAdminOpen(false)}>
                ✕
              </button>
            </div>

            {!isAuthenticated ? (
              /* PASSCODE PROTECTION FORM */
              <form onSubmit={handleAuthSubmit} className="auth-form">
                <p className="auth-instructions">
                  This blog publishing studio is protected. Enter the author admin passcode to continue.
                </p>
                <label>
                  Admin Passcode
                  <input
                    type="password"
                    placeholder="Enter author passcode"
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
                {authError && <div className="auth-error">{authError}</div>}
                <button type="submit" className="button full-btn">
                  Verify & Unlock Studio ↗
                </button>
              </form>
            ) : (
              /* RICH MARKDOWN PUBLISHER FORM */
              <form onSubmit={handlePublish} className="publisher-form">
                <div className="tab-switch">
                  <button
                    type="button"
                    className={previewTab === "edit" ? "active" : ""}
                    onClick={() => setPreviewTab("edit")}
                  >
                    ✏️ Edit Markdown
                  </button>
                  <button
                    type="button"
                    className={previewTab === "preview" ? "active" : ""}
                    onClick={() => setPreviewTab("preview")}
                  >
                    👁️ Live Article Preview
                  </button>
                </div>

                {previewTab === "edit" ? (
                  <div className="form-fields">
                    <div className="form-row">
                      <label>
                        Article Title
                        <input
                          type="text"
                          placeholder="e.g. Building Production Multi-Agent Systems"
                          value={newTitle}
                          onChange={(e) => setNewTitle(e.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Category
                        <select
                          value={newCategory}
                          onChange={(e) =>
                            setNewCategory(e.target.value as BlogPost["category"])
                          }
                        >
                          <option value="AI & Agents">AI & Agents</option>
                          <option value="Architecture">Architecture</option>
                          <option value="Product Strategy">Product Strategy</option>
                          <option value="Engineering">Engineering</option>
                        </select>
                      </label>
                    </div>

                    <div className="form-row">
                      <label>
                        Short Excerpt / Summary
                        <input
                          type="text"
                          placeholder="Brief 1-2 sentence description for search & preview..."
                          value={newExcerpt}
                          onChange={(e) => setNewExcerpt(e.target.value)}
                        />
                      </label>
                      <label>
                        Estimated Read Time
                        <input
                          type="text"
                          placeholder="e.g. 5 min read"
                          value={newReadTime}
                          onChange={(e) => setNewReadTime(e.target.value)}
                        />
                      </label>
                    </div>

                    <label>
                      Markdown Article Content
                      <textarea
                        rows={12}
                        placeholder="# Heading 1&#10;&#10;Write article content in Markdown format..."
                        value={newContent}
                        onChange={(e) => setNewContent(e.target.value)}
                        required
                      />
                    </label>
                  </div>
                ) : (
                  <div className="preview-container">
                    <h2>{newTitle || "Untitled Article"}</h2>
                    <div
                      className="markdown-body"
                      dangerouslySetInnerHTML={{ __html: renderedPreviewContent }}
                    />
                  </div>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="button secondary-btn"
                    onClick={() => setIsAdminOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="button">
                    🚀 Publish Post Live ↗
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
