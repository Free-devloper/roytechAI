"use client";

import { useMemo, useState, type FormEvent } from "react";

type ProjectScope = "AI Agentic System" | "Full-Stack SaaS" | "Enterprise Platform" | "Mobile + Web App";

interface FeatureOption {
  id: string;
  label: string;
  cost: number;
  description: string;
  tag: string;
}

const scopeBases: Record<ProjectScope, { base: number; timeline: string; desc: string; icon: string }> = {
  "AI Agentic System": { base: 8500, timeline: "3–6 weeks", desc: "Autonomous AI agents, RAG knowledge bases, tool orchestration, & model evals.", icon: "🤖" },
  "Full-Stack SaaS": { base: 12500, timeline: "4–8 weeks", desc: "Complete web SaaS product with Auth, Stripe billing, admin portal, & Postgres.", icon: "🚀" },
  "Enterprise Platform": { base: 19500, timeline: "6–12 weeks", desc: "High-scale internal ops platform, legacy migration, RBAC, & microservices.", icon: "🏢" },
  "Mobile + Web App": { base: 16000, timeline: "5–10 weeks", desc: "Cross-platform iOS/Android app + web admin dashboard & real-time sync.", icon: "📱" },
};

const aiFeatures: FeatureOption[] = [
  { id: "rag", label: "RAG & Vector Search", cost: 2500, description: "Multi-source ingestion, embeddings, hybrid search & citations", tag: "RAG · VECTOR DB" },
  { id: "agents", label: "Multi-Agent Workflows", cost: 4200, description: "Autonomous task routing, function calling, tool use & fallback loops", tag: "AUTONOMOUS AGENTS" },
  { id: "evals", label: "Model Evals & Guardrails", cost: 1800, description: "Hallucination filtering, prompt security, & automated evaluation sets", tag: "EVALS · SAFETY" },
  { id: "multimodal", label: "Real-time Voice / Vision", cost: 3500, description: "WebSocket audio streams, image analysis, & low-latency voice synthesis", tag: "VOICE · VISION" },
  { id: "finetuning", label: "Custom Fine-Tuning", cost: 3800, description: "Domain-specific model optimization, synthetic dataset creation & LoRA", tag: "LORA · FINE-TUNING" }
];

const fullStackFeatures: FeatureOption[] = [
  { id: "auth_rbac", label: "Auth & Multi-Tenant RBAC", cost: 1500, description: "User management, organization workspaces, OAuth, & permission roles", tag: "AUTH · RBAC" },
  { id: "billing", label: "Stripe Billing & Subscriptions", cost: 1800, description: "Tiered pricing, usage metering, invoices, & customer portal", tag: "STRIPE · BILLING" },
  { id: "admin", label: "Custom Admin Control Room", cost: 2200, description: "Operator dashboard, audit trails, user management, & live stats", tag: "ADMIN PORTAL" },
  { id: "integrations", label: "CRM & API Integrations", cost: 2000, description: "Webhooks, HubSpot/Salesforce, Slack/Discord bots, & automation", tag: "APIS · WEBHOOKS" },
  { id: "infra", label: "High-Performance Cloud & Queues", cost: 2500, description: "Redis queues, PostgreSQL/Supabase, WebSockets, & auto-scaling", tag: "REDIS · CLOUD" }
];

const deliveryPaces = [
  { key: "Standard", multiplier: 1.0, label: "Standard Sprint", desc: "Balanced cadence with weekly working demos" },
  { key: "Accelerated", multiplier: 1.25, label: "Accelerated Squad", desc: "Dedicated senior pair engineering (+35% velocity)" },
  { key: "Enterprise", multiplier: 1.5, label: "Turnkey & Support", desc: "Includes full Ops documentation, CI/CD & 90-day SLA support" }
];

const services = [
  ["01", "AI product engineering", "Production-minded LLM features, knowledge systems, AI agents, evaluations, and workflow automation.", "RAG · AGENTS · EVALUATIONS"],
  ["02", "MVP development", "Focused products built around a customer workflow, a clear release goal, and enough foundation for the next decision.", "SCOPE · UX · LAUNCH"],
  ["03", "Custom software", "SaaS products, client portals, internal platforms, and operating systems shaped around your real business process.", "SAAS · PORTALS · OPS"],
  ["04", "Legacy modernization", "Improve the system without betting the business on a rewrite: extract risk, add confidence, release in stages.", "APIS · CLOUD · REFACTOR"],
  ["05", "Automation & integrations", "Connect CRM, forms, payments, documents, and back-office tools so the workflow has one reliable source of truth.", "CRM · APIS · WORKFLOWS"],
  ["06", "Embedded delivery squads", "A senior extension of your roadmap across product, engineering, AI, QA, and technical delivery.", "PRODUCT · ENGINEERING · QA"],
];

const steps = [
  ["01", "FRAME", "Find the useful first move.", "Turn the business problem into a release goal, a practical scope, and a decision map before momentum is spent."],
  ["02", "SHAPE", "Design the product and system.", "Make the customer workflow, interface, architecture, data, and quality bar visible before development gathers pace."],
  ["03", "BUILD", "Ship in short, visible cycles.", "Review working software often, so feedback changes the product while it can still make a difference."],
  ["04", "COMPOUND", "Launch with an owner's mindset.", "Production readiness, documentation, handover, and the next roadmap are planned as part of the work."],
];

const solutions = [
  ["AI knowledge assistant", "Give teams trusted answers from their own documentation, policies, and product information.", "RAG · ACCESS · CITATIONS"],
  ["Revenue operations engine", "Connect lead capture, enrichment, CRM routing, and follow-up without manual handoffs.", "CRM · APIS · AUTOMATION"],
  ["Client experience portal", "Give customers one home for requests, documents, progress, payments, and support.", "PORTAL · AUTH · BILLING"],
  ["Operations control room", "Replace spreadsheets and status chasing with one live workflow for the team that owns delivery.", "WORKFLOWS · ROLES · DATA"],
  ["Modernization runway", "Stabilize the surface, extract risky pieces, automate confidence checks, and release without a leap of faith.", "TESTS · CLOUD · APIS"],
  ["AI-ready platform core", "Build a software foundation that can adopt useful AI safely as the roadmap evolves.", "DATA · EVALS · OBSERVABILITY"],
];

const faqs = [
  ["Can you take an idea from zero to launch?", "Yes. We can start from a product idea, rough brief, existing workflow, Figma file, or a product that needs to be rebuilt. First, we clarify the smallest useful release."],
  ["Do you build AI agents and RAG applications?", "Yes—when they improve the real workflow. We design the product experience, retrieval, guardrails, evaluation approach, integrations, and operational model around the feature."],
  ["Can you work with our in-house team?", "Absolutely. We can extend the team, own a defined product area, modernize part of the platform, or work as a focused delivery squad alongside your people."],
  ["Will we own the code and product?", "That is the intended delivery model. Your team should be able to understand, operate, and continue the work after launch, so handover and documentation are planned from the start."],
];

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const Arrow = () => <span aria-hidden="true">↗</span>;

export default function Home() {
  const [menu, setMenu] = useState(false);
  const [capabilities, setCapabilities] = useState(false);
  const [faq, setFaq] = useState(0);
  const [sent, setSent] = useState(false);
  const [briefText, setBriefText] = useState("");

  // Detailed Estimator State
  const [selectedScope, setSelectedScope] = useState<ProjectScope>("AI Agentic System");
  const [selectedAiFeatures, setSelectedAiFeatures] = useState<string[]>(["rag", "agents"]);
  const [selectedFullStackFeatures, setSelectedFullStackFeatures] = useState<string[]>(["auth_rbac", "billing"]);
  const [selectedPace, setSelectedPace] = useState<string>("Standard");

  const toggleAiFeature = (id: string) => {
    setSelectedAiFeatures((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleFullStackFeature = (id: string) => {
    setSelectedFullStackFeatures((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const detailedEstimate = useMemo(() => {
    const scopeData = scopeBases[selectedScope];
    const aiCost = selectedAiFeatures.reduce((acc, id) => {
      const item = aiFeatures.find((f) => f.id === id);
      return acc + (item ? item.cost : 0);
    }, 0);
    const fullStackCost = selectedFullStackFeatures.reduce((acc, id) => {
      const item = fullStackFeatures.find((f) => f.id === id);
      return acc + (item ? item.cost : 0);
    }, 0);

    const paceObj = deliveryPaces.find((p) => p.key === selectedPace) || deliveryPaces[0];
    const rawTotal = (scopeData.base + aiCost + fullStackCost) * paceObj.multiplier;
    
    const low = Math.round((rawTotal * 0.88) / 500) * 500;
    const high = Math.round((rawTotal * 1.15) / 500) * 500;

    return {
      baseCost: scopeData.base,
      aiCost,
      fullStackCost,
      low,
      high,
      timeline: scopeData.timeline,
      multiplier: paceObj.multiplier,
    };
  }, [selectedScope, selectedAiFeatures, selectedFullStackFeatures, selectedPace]);

  const applyToBrief = () => {
    const selectedAiLabels = selectedAiFeatures.map((id) => aiFeatures.find((f) => f.id === id)?.label).filter(Boolean);
    const selectedFsLabels = selectedFullStackFeatures.map((id) => fullStackFeatures.find((f) => f.id === id)?.label).filter(Boolean);

    const generatedBrief = `PROJECT SCOPE: ${selectedScope}
AI FEATURES: ${selectedAiLabels.length > 0 ? selectedAiLabels.join(", ") : "None"}
FULL-STACK MODULES: ${selectedFsLabels.length > 0 ? selectedFsLabels.join(", ") : "None"}
PACE & SUPPORT: ${selectedPace}
ESTIMATED BUDGET: ${money.format(detailedEstimate.low)} – ${money.format(detailedEstimate.high)} (${detailedEstimate.timeline})

[Describe your specific business goals, target audience, or constraints]`;

    setBriefText(generatedBrief);
    const contactElement = document.getElementById("contact");
    if (contactElement) {
      contactElement.scrollIntoView({ behavior: "smooth" });
    }
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
  };
  const closeMenu = () => {
    setMenu(false);
    setCapabilities(false);
  };

  return (
    <main id="top">
      {(menu || capabilities) && (
        <div className="nav-backdrop" onClick={closeMenu} aria-hidden="true" />
      )}
      <header className="site-header">
        <a className="brand" href="#top" aria-label="RoyTech AI home" onClick={closeMenu}><span className="mark"><i /><i /><i /></span>RoyTech<sup>AI</sup></a>
        <button className={menu ? "menu-button open" : "menu-button"} type="button" onClick={() => setMenu(!menu)} aria-label="Toggle navigation" aria-expanded={menu}>
          <span className="menu-icon"><i /><i /><i /></span>
          <span className="menu-text">{menu ? "CLOSE" : "MENU"}</span>
        </button>
        <nav className={menu ? "navigation open" : "navigation"} aria-label="Primary navigation">
          <a href="#why" onClick={closeMenu}>Why RoyTech AI</a>
          <div className="nav-drop"><button type="button" onClick={() => setCapabilities(!capabilities)} aria-expanded={capabilities}>Capabilities <b className={capabilities ? "up" : ""}>⌄</b></button><div className={capabilities ? "nav-popover shown" : "nav-popover"}>{services.slice(0, 5).map(([num, title]) => <a href="#services" onClick={closeMenu} key={num}><small>{num}</small><span>{title}</span></a>)}</div></div>
          <a href="#method" onClick={closeMenu}>Delivery model</a><a href="#estimator" onClick={closeMenu}>Detailed Estimator</a><a href="#contact" onClick={closeMenu}>Contact</a>
        </nav>
        <a className="button header-button" href="#contact" onClick={closeMenu}>Start a build <Arrow /></a>
      </header>

      <section className="hero page-pad">
        <div className="hero-copy"><p className="eyebrow"><i /> AI PRODUCT DEVELOPMENT STUDIO</p><h1>The software your business needs <em>next.</em></h1><p className="lead">We build AI products, focused MVPs, custom software, and delivery systems for founders and teams ready to turn ambitious ideas into operating products.</p><div className="hero-actions"><a className="button" href="#contact">Get a build plan <Arrow /></a><a className="link" href="#services">Explore capabilities <Arrow /></a></div><div className="hero-metrics"><div><b>Weekly</b><span>working demos</span></div><div><b>Senior</b><span>delivery ownership</span></div><div><b>Full</b><span>product handover</span></div></div></div>
        <div className="console"><div className="console-head"><span>ROYTECH AI DELIVERY CONSOLE</span><span className="status"><i /> ACTIVE</span></div><div className="brief"><small>AUTHOR & FOUNDER</small><strong>Rehan Ghafoor</strong><span>Remote · global · outcome-led</span></div><div className="console-label">VISIBLE DELIVERY LOOP</div><div className="console-flow"><div><small>01</small><b>Frame</b><span>Scope the useful first release</span></div><div><small>02</small><b>Build</b><span>Ship working software fast</span></div><div><small>03</small><b>Launch</b><span>Make the product operational</span></div></div><div className="console-row"><div><small>PRODUCT</small><b>Decisions stay visible</b></div><div><small>ENGINEERING</small><b>Code you can inherit</b></div></div><div className="pills">{["PYTHON", "LLMS", "NEXT.JS", "FASTAPI", "POSTGRES", "AWS", "AUTOMATION"].map((x) => <span key={x}>{x}</span>)}</div></div>
      </section>

      <div className="ticker"><span>Founder-led companies</span><i /><span>Growing software teams</span><i /><span>AI-forward operators</span><i /><span>Legacy systems under pressure</span><i /><span>Founder-led companies</span><i /><span>Growing software teams</span></div>

      <section className="section page-pad dark-panel" id="why"><div className="heading split"><div><p className="eyebrow"><i /> A BETTER DELIVERY PARTNER</p><h2>More momentum. Less vendor drag.</h2></div><p>A great software partner should lower the cognitive load on your team. We make the product, tradeoffs, progress, and ownership clear from the beginning.</p></div><div className="frictions"><article><span>/ 01</span><h3>Context disappears in handoffs.</h3><p>When a project changes hands too often, customer insight and technical judgment disappear with it.</p></article><article><span>/ 02</span><h3>Busy work hides the real release.</h3><p>Long plans and status updates should never be a substitute for working software in front of the right people.</p></article><article><span>/ 03</span><h3>More hours do not mean more leverage.</h3><p>We focus the team on customer value, reliable systems, and decisions that compound after the first launch.</p></article></div></section>

      <section className="section page-pad services" id="services"><div className="heading align-end"><div><p className="eyebrow"><i /> WHAT WE MAKE</p><h2>One team for the product you need to unlock.</h2></div><a className="link" href="#contact">Tell us what is blocked <Arrow /></a></div><div className="service-grid">{services.map(([number, title, text, tags]) => <article key={number}><div><span>{number}</span><b>↗</b></div><h3>{title}</h3><p>{text}</p><small>{tags}</small></article>)}</div></section>

      <section className="section page-pad method" id="method"><div className="heading split"><div><p className="eyebrow"><i /> THE ROYTECH AI METHOD</p><h2>AI accelerates the work. Product judgment keeps it useful.</h2></div><p>We use AI for research, boilerplate, test coverage, documentation, and iteration—while engineers stay accountable for architecture, quality, security, and release.</p></div><div className="method-board"><div><span>AI-NATIVE PRODUCT LOOP</span><span>INPUT → OUTPUT</span></div><p>Product brief <b>→</b> Scope & system map <b>→</b> AI-augmented build <b>→</b> Tested release</p><footer>{["Model selection", "Human review", "Automated QA", "Evaluation sets", "Observability", "Documented handover"].map((x) => <span key={x}>{x}</span>)}</footer></div><div className="steps">{steps.map(([number, label, title, text]) => <article key={number}><span>{number}</span><div><small>{label}</small><h3>{title}</h3></div><p>{text}</p></article>)}</div></section>

      {/* ENHANCED DETAILED COST ESTIMATOR SECTION */}
      <section className="estimator page-pad" id="estimator">
        <div className="estimate-copy">
          <p className="eyebrow"><i /> PROFESSIONAL COST & SCOPE ESTIMATOR</p>
          <h2>Interactive AI & Full-Stack Build Calculator.</h2>
          <p>Select your target system scope, AI agent capabilities, full-stack modules, and delivery velocity for an immediate, transparent estimate breakdown.</p>
          <ul>
            <li>Real-time itemized price & timeline estimation</li>
            <li>Configurable AI, Agent, RAG, & Full-Stack modules</li>
            <li>Instant auto-fill to project build brief</li>
            <li>No sign-up required</li>
          </ul>
        </div>

        <div className="estimator-wrapper">
          <div className="estimator-layout">
            <div className="estimator-controls">
              {/* STEP 1: PROJECT SCOPE */}
              <fieldset>
                <legend>1. Primary Architecture & Scope</legend>
                <div className="scope-grid">
                  {(Object.keys(scopeBases) as ProjectScope[]).map((scopeKey) => {
                    const data = scopeBases[scopeKey];
                    const isSelected = selectedScope === scopeKey;
                    return (
                      <button
                        type="button"
                        key={scopeKey}
                        className={`scope-card ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedScope(scopeKey)}
                      >
                        <div className="scope-icon">{data.icon}</div>
                        <h4>{scopeKey}</h4>
                        <p>{data.desc}</p>
                        <span className="scope-price">Base: {money.format(data.base)}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* STEP 2: AI & AGENT CAPABILITIES */}
              <fieldset>
                <legend>2. AI & Agent Infrastructure (Multi-Select)</legend>
                <div className="feature-toggle-grid">
                  {aiFeatures.map((feature) => {
                    const isActive = selectedAiFeatures.includes(feature.id);
                    return (
                      <button
                        type="button"
                        key={feature.id}
                        className={`feature-btn ${isActive ? "active" : ""}`}
                        onClick={() => toggleAiFeature(feature.id)}
                      >
                        <div className="feature-head">
                          <span>{feature.label}</span>
                          <span className="check-icon">{isActive ? "✓" : "+"}</span>
                        </div>
                        <p>{feature.description}</p>
                        <small>+{money.format(feature.cost)}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* STEP 3: FULL-STACK & CLOUD MODULES */}
              <fieldset>
                <legend>3. Full-Stack & Cloud Modules (Multi-Select)</legend>
                <div className="feature-toggle-grid">
                  {fullStackFeatures.map((module) => {
                    const isActive = selectedFullStackFeatures.includes(module.id);
                    return (
                      <button
                        type="button"
                        key={module.id}
                        className={`feature-btn ${isActive ? "active" : ""}`}
                        onClick={() => toggleFullStackFeature(module.id)}
                      >
                        <div className="feature-head">
                          <span>{module.label}</span>
                          <span className="check-icon">{isActive ? "✓" : "+"}</span>
                        </div>
                        <p>{module.description}</p>
                        <small>+{money.format(module.cost)}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* STEP 4: DELIVERY PACE */}
              <fieldset>
                <legend>4. Delivery Cadence & Support Tier</legend>
                <div className="pace-grid">
                  {deliveryPaces.map((pace) => {
                    const isSelected = selectedPace === pace.key;
                    return (
                      <button
                        type="button"
                        key={pace.key}
                        className={`pace-btn ${isSelected ? "selected" : ""}`}
                        onClick={() => setSelectedPace(pace.key)}
                      >
                        <b>{pace.label}</b>
                        <small>{pace.desc}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>

            {/* LIVE BREAKDOWN & SUMMARY PANEL */}
            <div className="estimator-summary">
              <div>
                <div className="summary-header">
                  <span>ROYTECH AI CALCULATOR</span>
                  <b>CONFIG READY</b>
                </div>

                <div className="price-display">
                  <small>Indicative Project Range</small>
                  <h3>{money.format(detailedEstimate.low)} – {money.format(detailedEstimate.high)}</h3>
                  <span>Estimated Timeframe: <strong>{detailedEstimate.timeline}</strong></span>
                </div>

                <div className="breakdown-list">
                  <div className="breakdown-item">
                    <span>Base Scope ({selectedScope})</span>
                    <span>{money.format(detailedEstimate.baseCost)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span>AI & Agent Modules ({selectedAiFeatures.length})</span>
                    <span>+{money.format(detailedEstimate.aiCost)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span>Full-Stack Cloud Modules ({selectedFullStackFeatures.length})</span>
                    <span>+{money.format(detailedEstimate.fullStackCost)}</span>
                  </div>
                  <div className="breakdown-item">
                    <span>Velocity Multiplier</span>
                    <span>{detailedEstimate.multiplier}x</span>
                  </div>
                </div>

                <div className="tech-stack-preview">
                  <small>RECOMMENDED STACK COMPOSITION</small>
                  <div className="tech-tags">
                    <span>Next.js 16</span>
                    <span>FastAPI</span>
                    <span>PostgreSQL</span>
                    {selectedAiFeatures.includes("rag") && <span>PgVector</span>}
                    {selectedAiFeatures.includes("agents") && <span>LangChain</span>}
                    {selectedAiFeatures.includes("evals") && <span>Braintrust Evals</span>}
                    {selectedFullStackFeatures.includes("billing") && <span>Stripe</span>}
                    {selectedFullStackFeatures.includes("infra") && <span>Redis / Docker</span>}
                  </div>
                </div>
              </div>

              <button type="button" className="apply-brief-button" onClick={applyToBrief}>
                Apply Estimate to Build Brief <Arrow />
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="section page-pad audience"><div className="heading split"><div><p className="eyebrow"><i /> BUILT FOR BOTH SIDES OF THE TABLE</p><h2>A useful product for the business. A trusted system for the team.</h2></div><p>Founders need confident product movement. Technology leaders need software their people can operate, extend, and respect. A good delivery model serves both.</p></div><div className="audience-grid"><article><span>FOR FOUNDERS & OPERATORS</span><h3>Move from problem to product signal.</h3><p>Make the first release deliberate, put it in front of real users, and learn what deserves the next investment.</p><ul><li>Clear product scope</li><li>Frequent working demos</li><li>Decisions tied to customers</li><li>Ownership from day one</li></ul></article><article><span>FOR CTOs & PRODUCT LEADS</span><h3>Give your roadmap more capable hands.</h3><p>Work with engineers who fit into the architecture and standards you are accountable for—without turning the engagement into a black box.</p><ul><li>Architecture and code review</li><li>Testing and delivery pipelines</li><li>Security and operational thinking</li><li>Practical documentation</li></ul></article></div></section>

      <section className="section page-pad solution-section" id="solutions"><div className="heading split"><div><p className="eyebrow"><i /> COMMON PRODUCT MOVES</p><h2>Repeatable patterns. Tailored to your operating reality.</h2></div><p>Start with a proven shape, then design the details around your customers, data, and workflow.</p></div><div className="solution-grid">{solutions.map(([title, text, tags], index) => <article key={title}><div><span>0{index + 1}</span><b>+</b></div><h3>{title}</h3><p>{text}</p><small>{tags}</small></article>)}</div></section>

      <section className="section page-pad proof"><div className="proof-intro"><p className="eyebrow"><i /> WHAT “READY TO BUILD” CAN LOOK LIKE</p><p>Not a static portfolio—three delivery directions we can make concrete together.</p></div><div className="proof-grid"><article><span>AI OPERATIONS</span><h3>Turn scattered knowledge into a governed assistant.</h3><p>Search, workflows, approvals, citations, and an operator view built around what people actually ask.</p><small>AI PRODUCT · INTERNAL PLATFORM</small></article><article><span>B2B SAAS</span><h3>Give a manual client process a product-shaped home.</h3><p>From onboarding to delivery updates, build the secure portal and operational backbone that stops work living in inboxes.</p><small>CUSTOM SOFTWARE · INTEGRATIONS</small></article><article><span>MODERNIZATION</span><h3>Move a revenue-critical system forward in stages.</h3><p>Stabilize the surface, extract risky pieces, automate confidence checks, and release without a leap of faith.</p><small>LEGACY SOFTWARE · PLATFORM ENGINEERING</small></article></div></section>

      <section className="section page-pad stack"><p className="eyebrow"><i /> A MODERN, PRACTICAL STACK</p><h2>We meet the codebase where it is—and improve it from there.</h2><div>{["React", "Next.js", "TypeScript", "Python", "FastAPI", "Node.js", "PostgreSQL", "Supabase", "AWS", "Docker", "LangChain", "OpenAI", "n8n", "HubSpot", "Salesforce", "REST APIs"].map((x) => <span key={x}>{x}</span>)}</div></section>

      <section className="section page-pad faq"><div className="faq-copy"><p className="eyebrow"><i /> GOOD QUESTIONS</p><h2>What teams ask before we start.</h2><p>If you have a different constraint, bring it to the first conversation. Useful planning begins with real context.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <article className={faq === index ? "open" : ""} key={question}><button type="button" onClick={() => setFaq(faq === index ? -1 : index)} aria-expanded={faq === index}><span>{question}</span><b>{faq === index ? "−" : "+"}</b></button><div><p>{answer}</p></div></article>)}</div></section>

      <section className="contact page-pad" id="contact">
        <div className="contact-copy">
          <p className="eyebrow"><i /> START A CONVERSATION</p>
          <h2>Tell us what you are trying to make work.</h2>
          <p>Share the product, system, or bottleneck. We will help frame the most sensible next move—whether that is a discovery sprint, focused MVP, AI workflow, or stronger delivery squad.</p>
          <ul>
            <li>Weekly working demos</li>
            <li>Clear scope before build</li>
            <li>Full product ownership</li>
          </ul>
        </div>
        <form onSubmit={submit}>
          {sent ? (
            <div className="success" role="status">
              <span>✓</span>
              <h3>Your build brief is ready.</h3>
              <p>This demo form is ready to connect to your email, CRM, or scheduling workflow before launch.</p>
              <button type="button" className="link" onClick={() => setSent(false)}>Send another brief <Arrow /></button>
            </div>
          ) : (
            <>
              <label>Name<input name="name" placeholder="Your name" required /></label>
              <label>Email<input name="email" type="email" placeholder="you@company.com" required /></label>
              <label>What do you need?
                <select name="need" defaultValue="" required>
                  <option value="" disabled>Select a direction</option>
                  <option>Build an MVP</option>
                  <option>Add AI to a product</option>
                  <option>Modernize existing software</option>
                  <option>Build a custom platform</option>
                  <option>Extend an engineering team</option>
                  <option>Automation and integrations</option>
                </select>
              </label>
              <label>What are you trying to achieve?
                <textarea
                  name="brief"
                  rows={6}
                  value={briefText}
                  onChange={(e) => setBriefText(e.target.value)}
                  placeholder="The problem, users, current system, and what good looks like."
                  required
                />
              </label>
              <button className="button full" type="submit">Send my build brief <Arrow /></button>
              <small>Use this form as the front end for your lead workflow. Connect it to your inbox or CRM before publishing.</small>
            </>
          )}
        </form>
      </section>

      <footer className="footer page-pad">
        <a className="brand" href="#top"><span className="mark"><i /><i /><i /></span>RoyTech<sup>AI</sup></a>
        <p>AI product development, MVP builds, custom software, integrations, and embedded delivery by Rehan Ghafoor for teams that want to keep moving.</p>
        <div>
          <a href="#services">Capabilities</a>
          <a href="#method">Method</a>
          <a href="#estimator">Detailed Estimator</a>
          <a href="#contact">Start a build</a>
        </div>
        <small>© 2026 Rehan Ghafoor · RoyTech AI</small>
      </footer>
    </main>
  );
}
