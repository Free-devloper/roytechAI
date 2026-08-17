# Full-stack and web apps at RoyTech AI

RoyTech AI ships SaaS products, client portals, internal platforms, and mobile-plus-web apps. Frontend is typically React / Next.js / TypeScript. Backend is typically FastAPI (Python) or Node.js. Data is PostgreSQL (often via Supabase). Auth, billing, admin, and integrations are first-class product pieces, not afterthoughts.

## Product shapes

- Focused MVP: one customer workflow, a clear release goal, enough foundation for the next decision
- Full-stack SaaS: auth, Stripe, admin portal, Postgres
- Client portal: requests, documents, progress, payments, support
- Operations control room: roles, live workflow, less spreadsheet chasing
- Mobile + web: iOS/Android plus web admin and real-time sync
- Enterprise / internal platform: RBAC, legacy migration, microservices where they earn their keep

## Typical modules (estimator)

- Auth & multi-tenant RBAC — $1,500
- Stripe billing and subscriptions — $1,800
- Custom admin control room — $2,200
- CRM and API integrations — $2,000
- High-performance cloud and queues (Redis, Postgres/Supabase, WebSockets, autoscaling) — $2,500

Base Full-Stack SaaS $12,500 / 4–8 weeks. Enterprise Platform $19,500 / 6–12 weeks. Mobile + Web App $16,000 / 5–10 weeks. Pace: Standard 1.0, Accelerated 1.25, Turnkey 1.5.

## Engineering practices

- Short cycles and weekly demos
- CI/CD, tests, and staged modernization rather than big-bang rewrites
- Client owns the code; handover is planned
- Meet the existing codebase and improve it (React, Next.js, TypeScript, Python, FastAPI, Node, Docker, AWS)

## AI on a web app

Add AI only when it serves the workflow: RAG over tenant documents, an operator assistant, or an agent behind a job queue. Pair with evals and an admin view. "Add AI to a product" is a first-class contact option.

If the visitor wants a build, collect name and email after you understand the workflow; compile the brief yourself.
