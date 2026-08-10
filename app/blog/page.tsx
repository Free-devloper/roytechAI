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

const INITIAL_POSTS: BlogPost[] = [
  {
    id: "multi-agent-systems-2026",
    title: "Building Production-Grade Multi-Agent Systems in 2026",
    slug: "multi-agent-systems-2026",
    category: "AI & Agents",
    date: "2026-08-08",
    readTime: "6 min read",
    author: "Rehan Ghafoor",
    excerpt: "A practical breakdown of autonomous agent routing, tool orchestration, fallback state machines, and model evaluations for high-scale enterprise apps.",
    content: `## The Architecture of Autonomous AI Agents

Building AI agents that work reliably in production requires moving past naive prompt loops. At **RoyTech AI**, we design agentic systems with deterministic state machines and strict validation guardrails.

### Key Components of Production Multi-Agent Systems

1. **Task Router & Dispatcher**: Evaluates user intent and dispatches tasks to specialist agents (e.g., Data Analyst, Code Generator, QA Inspector).
2. **Tool Orchestration & Schema Validation**: Ensures tool calls conform strictly to Pydantic/TypeScript schemas before execution.
3. **Fallback & Recovery Loops**: Automatic retry handlers when an LLM hallucination or tool error occurs.
4. **Automated Evaluation Sets**: Continuous benchmarking using evaluation frameworks to test accuracy and latency.

\`\`\`python
# Example Agent Routing Handler (FastAPI / LangChain)
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="RoyTech AI Agent Orchestrator")

class AgentTask(BaseModel):
    query: str
    context: dict

@app.post("/api/agents/execute")
async def execute_agent_workflow(task: AgentTask):
    # Dispatch to specialized agent pipeline
    return {"status": "success", "result": "Agent completed task autonomously"}
\`\`\`

### Summary
Multi-agent systems provide immense leverage when paired with robust software engineering practices.
`
  },
  {
    id: "rag-hybrid-vector-search",
    title: "Why RAG + Hybrid Vector Search Beat Plain LLM Context",
    slug: "rag-hybrid-vector-search",
    category: "Architecture",
    date: "2026-08-01",
    readTime: "5 min read",
    author: "Rehan Ghafoor",
    excerpt: "Context window sizes are growing, but precision retrieval with PgVector, BM25 hybrid search, and cross-encoder re-ranking remains the gold standard for data governance.",
    content: `## Modern Retrieval-Augmented Generation (RAG)

While large language models now feature multi-million token context windows, feeding entire document repositories into context is expensive, slow, and prone to "middle-of-the-needle" retrieval loss.

### The 3-Tier Retrieval Pipeline

* **Tier 1: Sparse Retrieval (BM25)** — Catches exact keyword matches, SKU numbers, and strict technical terminology.
* **Tier 2: Dense Embeddings (PgVector / Qdrant)** — Captures semantic intent and conceptual similarity.
* **Tier 3: Cross-Encoder Re-ranking** — Re-orders top candidate chunks for maximum precision.

\`\`\`sql
-- Hybrid Vector Search Query in PostgreSQL (PgVector)
SELECT id, document_title, content, 
       (1 - (embedding <=> $1)) AS similarity_score
FROM knowledge_chunks
WHERE organization_id = $2
ORDER BY similarity_score DESC
LIMIT 10;
\`\`\`

### Conclusion
Combining hybrid search with domain-specific guardrails ensures knowledge assistants remain accurate, fast, and secure.
`
  },
  {
    id: "mvp-delivery-guide",
    title: "The Founder's Guide to Shipping a Useful MVP in 3 Weeks",
    slug: "mvp-delivery-guide",
    category: "Product Strategy",
    date: "2026-07-25",
    readTime: "4 min read",
    author: "Rehan Ghafoor",
    excerpt: "How senior product engineering squads cut unnecessary scope drag and turn ambitious business problems into tested, operating software fast.",
    content: `## Shipping Without Vendor Drag

Speed is the ultimate advantage for early-stage products. The goal of an MVP is not to build a stripped-down broken app, but to build the **smallest useful release** that answers a core customer thesis.

### The RoyTech AI 3-Week Delivery Model

* **Week 1: Framing & System Mapping** — Define core release goals, UX workflows, database schemas, and API contracts.
* **Week 2: Focused Build Sprints** — Deliver working software daily with automated CI/CD and visible feedback loops.
* **Week 3: Launch & Handover** — Production deployment, load testing, security review, and full code handover.

> "Working software in front of real customers will always beat long status documents."
`
  }
];

export default function BlogPage() {
  const [posts, setPosts] = useState<BlogPost[]>(INITIAL_POSTS);
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

  // Handle Admin Passcode Auth
  const handleAuthSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPasscode === "roytech2026" || adminPasscode === "admin") {
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
                    placeholder="Enter passcode (Default: roytech2026)"
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
                <small className="hint-text">Author Key: <code>roytech2026</code></small>
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
