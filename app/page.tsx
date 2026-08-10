"use client";

import { useMemo, useState, type FormEvent } from "react";

type BuildPath = "Pilot" | "Foundation";
type Platform = "Web product" | "Mobile app" | "Web + mobile" | "Internal platform";
type Pace = "Flexible" | "Standard" | "Accelerated";

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
  const [path, setPath] = useState<BuildPath>("Pilot");
  const [platform, setPlatform] = useState<Platform>("Web product");
  const [pace, setPace] = useState<Pace>("Standard");
  const [faq, setFaq] = useState(0);
  const [sent, setSent] = useState(false);

  const estimate = useMemo(() => {
    const base = path === "Pilot" ? 7500 : 18000;
    const productFactor = { "Web product": 1, "Mobile app": 1.15, "Web + mobile": 1.55, "Internal platform": 1.2 }[platform];
    const paceFactor = { Flexible: 0.9, Standard: 1, Accelerated: 1.25 }[pace];
    const center = Math.round((base * productFactor * paceFactor) / 500) * 500;
    return { low: Math.round(center * .86 / 500) * 500, high: Math.round(center * 1.18 / 500) * 500, timeline: path === "Pilot" ? (pace === "Accelerated" ? "3–6 weeks" : "5–10 weeks") : (pace === "Accelerated" ? "8–14 weeks" : "12–22 weeks") };
  }, [path, platform, pace]);

  const submit = (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setSent(true); };
  const closeMenu = () => setMenu(false);

  return (
    <main id="top">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="RoyTech AI home"><span className="mark"><i /><i /><i /></span>RoyTech<sup>AI</sup></a>
        <button className="menu-button" type="button" onClick={() => setMenu(!menu)} aria-label="Toggle navigation" aria-expanded={menu}><i /><i /></button>
        <nav className={menu ? "navigation open" : "navigation"} aria-label="Primary navigation">
          <a href="#why" onClick={closeMenu}>Why RoyTech AI</a>
          <div className="nav-drop"><button type="button" onClick={() => setCapabilities(!capabilities)} aria-expanded={capabilities}>Capabilities <b>⌄</b></button><div className={capabilities ? "nav-popover shown" : "nav-popover"}>{services.slice(0, 5).map(([num, title]) => <a href="#services" onClick={() => { setCapabilities(false); closeMenu(); }} key={num}><small>{num}</small>{title}</a>)}</div></div>
          <a href="#method" onClick={closeMenu}>Delivery model</a><a href="#estimator" onClick={closeMenu}>MVP planner</a><a href="#contact" onClick={closeMenu}>Contact</a>
        </nav>
        <a className="button header-button" href="#contact">Start a build <Arrow /></a>
      </header>

      <section className="hero page-pad">
        <div className="hero-copy"><p className="eyebrow"><i /> AI PRODUCT DEVELOPMENT STUDIO</p><h1>The software your business needs <em>next.</em></h1><p className="lead">We build AI products, focused MVPs, custom software, and delivery systems for founders and teams ready to turn ambitious ideas into operating products.</p><div className="hero-actions"><a className="button" href="#contact">Get a build plan <Arrow /></a><a className="link" href="#services">Explore capabilities <Arrow /></a></div><div className="hero-metrics"><div><b>Weekly</b><span>working demos</span></div><div><b>Senior</b><span>delivery ownership</span></div><div><b>Full</b><span>product handover</span></div></div></div>
        <div className="console"><div className="console-head"><span>ROYTECH AI DELIVERY CONSOLE</span><span className="status"><i /> ACTIVE</span></div><div className="brief"><small>YOUR BRIEF</small><strong>Founder / operator / technology lead</strong><span>Remote · global · outcome-led</span></div><div className="console-label">VISIBLE DELIVERY LOOP</div><div className="console-flow"><div><small>01</small><b>Frame</b><span>Scope the useful first release</span></div><div><small>02</small><b>Build</b><span>Ship working software fast</span></div><div><small>03</small><b>Launch</b><span>Make the product operational</span></div></div><div className="console-row"><div><small>PRODUCT</small><b>Decisions stay visible</b></div><div><small>ENGINEERING</small><b>Code you can inherit</b></div></div><div className="pills">{["PYTHON", "LLMS", "NEXT.JS", "FASTAPI", "POSTGRES", "AWS", "AUTOMATION"].map((x) => <span key={x}>{x}</span>)}</div></div>
      </section>

      <div className="ticker"><span>Founder-led companies</span><i /><span>Growing software teams</span><i /><span>AI-forward operators</span><i /><span>Legacy systems under pressure</span><i /><span>Founder-led companies</span><i /><span>Growing software teams</span></div>

      <section className="section page-pad dark-panel" id="why"><div className="heading split"><div><p className="eyebrow"><i /> A BETTER DELIVERY PARTNER</p><h2>More momentum. Less vendor drag.</h2></div><p>A great software partner should lower the cognitive load on your team. We make the product, tradeoffs, progress, and ownership clear from the beginning.</p></div><div className="frictions"><article><span>/ 01</span><h3>Context disappears in handoffs.</h3><p>When a project changes hands too often, customer insight and technical judgment disappear with it.</p></article><article><span>/ 02</span><h3>Busy work hides the real release.</h3><p>Long plans and status updates should never be a substitute for working software in front of the right people.</p></article><article><span>/ 03</span><h3>More hours do not mean more leverage.</h3><p>We focus the team on customer value, reliable systems, and decisions that compound after the first launch.</p></article></div></section>

      <section className="section page-pad services" id="services"><div className="heading align-end"><div><p className="eyebrow"><i /> WHAT WE MAKE</p><h2>One team for the product you need to unlock.</h2></div><a className="link" href="#contact">Tell us what is blocked <Arrow /></a></div><div className="service-grid">{services.map(([number, title, text, tags]) => <article key={number}><div><span>{number}</span><b>↗</b></div><h3>{title}</h3><p>{text}</p><small>{tags}</small></article>)}</div></section>

      <section className="section page-pad method" id="method"><div className="heading split"><div><p className="eyebrow"><i /> THE ROYTECH AI METHOD</p><h2>AI accelerates the work. Product judgment keeps it useful.</h2></div><p>We use AI for research, boilerplate, test coverage, documentation, and iteration—while engineers stay accountable for architecture, quality, security, and release.</p></div><div className="method-board"><div><span>AI-NATIVE PRODUCT LOOP</span><span>INPUT → OUTPUT</span></div><p>Product brief <b>→</b> Scope & system map <b>→</b> AI-augmented build <b>→</b> Tested release</p><footer>{["Model selection", "Human review", "Automated QA", "Evaluation sets", "Observability", "Documented handover"].map((x) => <span key={x}>{x}</span>)}</footer></div><div className="steps">{steps.map(([number, label, title, text]) => <article key={number}><span>{number}</span><div><small>{label}</small><h3>{title}</h3></div><p>{text}</p></article>)}</div></section>

      <section className="estimator page-pad" id="estimator"><div className="estimate-copy"><p className="eyebrow"><i /> LIVE MVP PLANNER</p><h2>Put an early range around the build.</h2><p>Choose a starting path and a few constraints. This is a planning range—not a generic package price—and it gives us a better conversation to start from.</p><ul><li>No sign-up to estimate</li><li>Scope before commitment</li><li>Clear next step</li></ul></div><div className="calculator"><div className="calc-head"><span>ROYTECH AI RANGE CALCULATOR</span><span>01 / 03</span></div><fieldset><legend>Your path</legend><div className="path-options">{(["Pilot", "Foundation"] as BuildPath[]).map((value) => <button type="button" onClick={() => setPath(value)} className={path === value ? "selected" : ""} key={value}><span>{value === "Pilot" ? "Validate first" : "Build for growth"}</span><b>{value}</b><small>{value === "Pilot" ? "Focused release for evidence" : "Product foundation for the roadmap"}</small></button>)}</div></fieldset><fieldset><legend>Primary surface</legend><div className="choices">{(["Web product", "Mobile app", "Web + mobile", "Internal platform"] as Platform[]).map((value) => <button type="button" onClick={() => setPlatform(value)} className={platform === value ? "selected" : ""} key={value}>{value}</button>)}</div></fieldset><fieldset><legend>Timing</legend><div className="choices">{(["Flexible", "Standard", "Accelerated"] as Pace[]).map((value) => <button type="button" onClick={() => setPace(value)} className={pace === value ? "selected" : ""} key={value}>{value}</button>)}</div></fieldset><div className="range" aria-live="polite"><div><span>Indicative planning range</span><b>{money.format(estimate.low)}–{money.format(estimate.high)}</b></div><div><span>Typical first-release window</span><b>{estimate.timeline}</b></div><a className="button full" href="#contact">Discuss this range <Arrow /></a></div></div></section>

      <section className="section page-pad audience"><div className="heading split"><div><p className="eyebrow"><i /> BUILT FOR BOTH SIDES OF THE TABLE</p><h2>A useful product for the business. A trusted system for the team.</h2></div><p>Founders need confident product movement. Technology leaders need software their people can operate, extend, and respect. A good delivery model serves both.</p></div><div className="audience-grid"><article><span>FOR FOUNDERS & OPERATORS</span><h3>Move from problem to product signal.</h3><p>Make the first release deliberate, put it in front of real users, and learn what deserves the next investment.</p><ul><li>Clear product scope</li><li>Frequent working demos</li><li>Decisions tied to customers</li><li>Ownership from day one</li></ul></article><article><span>FOR CTOs & PRODUCT LEADS</span><h3>Give your roadmap more capable hands.</h3><p>Work with engineers who fit into the architecture and standards you are accountable for—without turning the engagement into a black box.</p><ul><li>Architecture and code review</li><li>Testing and delivery pipelines</li><li>Security and operational thinking</li><li>Practical documentation</li></ul></article></div></section>

      <section className="section page-pad solution-section" id="solutions"><div className="heading split"><div><p className="eyebrow"><i /> COMMON PRODUCT MOVES</p><h2>Repeatable patterns. Tailored to your operating reality.</h2></div><p>Start with a proven shape, then design the details around your customers, data, and workflow.</p></div><div className="solution-grid">{solutions.map(([title, text, tags], index) => <article key={title}><div><span>0{index + 1}</span><b>+</b></div><h3>{title}</h3><p>{text}</p><small>{tags}</small></article>)}</div></section>

      <section className="section page-pad proof"><div className="proof-intro"><p className="eyebrow"><i /> WHAT “READY TO BUILD” CAN LOOK LIKE</p><p>Not a static portfolio—three delivery directions we can make concrete together.</p></div><div className="proof-grid"><article><span>AI OPERATIONS</span><h3>Turn scattered knowledge into a governed assistant.</h3><p>Search, workflows, approvals, citations, and an operator view built around what people actually ask.</p><small>AI PRODUCT · INTERNAL PLATFORM</small></article><article><span>B2B SAAS</span><h3>Give a manual client process a product-shaped home.</h3><p>From onboarding to delivery updates, build the secure portal and operational backbone that stops work living in inboxes.</p><small>CUSTOM SOFTWARE · INTEGRATIONS</small></article><article><span>MODERNIZATION</span><h3>Move a revenue-critical system forward in stages.</h3><p>Stabilize the surface, extract risky pieces, automate confidence checks, and release without a leap of faith.</p><small>LEGACY SOFTWARE · PLATFORM ENGINEERING</small></article></div></section>

      <section className="section page-pad stack"><p className="eyebrow"><i /> A MODERN, PRACTICAL STACK</p><h2>We meet the codebase where it is—and improve it from there.</h2><div>{["React", "Next.js", "TypeScript", "Python", "FastAPI", "Node.js", "PostgreSQL", "Supabase", "AWS", "Docker", "LangChain", "OpenAI", "n8n", "HubSpot", "Salesforce", "REST APIs"].map((x) => <span key={x}>{x}</span>)}</div></section>

      <section className="section page-pad faq"><div className="faq-copy"><p className="eyebrow"><i /> GOOD QUESTIONS</p><h2>What teams ask before we start.</h2><p>If you have a different constraint, bring it to the first conversation. Useful planning begins with real context.</p></div><div className="faq-list">{faqs.map(([question, answer], index) => <article className={faq === index ? "open" : ""} key={question}><button type="button" onClick={() => setFaq(faq === index ? -1 : index)} aria-expanded={faq === index}><span>{question}</span><b>{faq === index ? "−" : "+"}</b></button><div><p>{answer}</p></div></article>)}</div></section>

      <section className="contact page-pad" id="contact"><div className="contact-copy"><p className="eyebrow"><i /> START A CONVERSATION</p><h2>Tell us what you are trying to make work.</h2><p>Share the product, system, or bottleneck. We will help frame the most sensible next move—whether that is a discovery sprint, focused MVP, AI workflow, or stronger delivery squad.</p><ul><li>Weekly working demos</li><li>Clear scope before build</li><li>Full product ownership</li></ul></div><form onSubmit={submit}>{sent ? <div className="success" role="status"><span>✓</span><h3>Your build brief is ready.</h3><p>This demo form is ready to connect to your email, CRM, or scheduling workflow before launch.</p><button type="button" className="link" onClick={() => setSent(false)}>Send another brief <Arrow /></button></div> : <><label>Name<input name="name" placeholder="Your name" required /></label><label>Email<input name="email" type="email" placeholder="you@company.com" required /></label><label>What do you need?<select name="need" defaultValue="" required><option value="" disabled>Select a direction</option><option>Build an MVP</option><option>Add AI to a product</option><option>Modernize existing software</option><option>Build a custom platform</option><option>Extend an engineering team</option><option>Automation and integrations</option></select></label><label>What are you trying to achieve?<textarea name="brief" rows={4} placeholder="The problem, users, current system, and what good looks like." required /></label><button className="button full" type="submit">Send my build brief <Arrow /></button><small>Use this form as the front end for your lead workflow. Connect it to your inbox or CRM before publishing.</small></>}</form></section>

      <footer className="footer page-pad"><a className="brand" href="#top"><span className="mark"><i /><i /><i /></span>RoyTech<sup>AI</sup></a><p>AI product development, MVP builds, custom software, integrations, and embedded delivery for teams that want to keep moving.</p><div><a href="#services">Capabilities</a><a href="#method">Method</a><a href="#estimator">MVP planner</a><a href="#contact">Start a build</a></div><small>© 2026 RoyTech AI</small></footer>
    </main>
  );
}
