# n8n, automation, and integrations

Automation and integrations is one of RoyTech AI's six services: connect CRM, forms, payments, documents, and back-office tools so the workflow has one source of truth.

## What we automate

- Lead capture: site form or assistant → webhook → inbox / CRM
- HubSpot and Salesforce routing, enrichment, follow-up
- Payments and invoices (including Stripe-adjacent ops)
- Slack / Discord notifications
- Document intake and status updates
- n8n workflows for event-driven glue between SaaS tools

This studio site already uses an n8n webhook for the contact form (`n8n.roytechworkforce.com`). RoytechAI Assistant uses the same endpoint when it hands a visitor to a human.

## n8n versus custom agents

Use n8n (or similar) when:

- Triggers and actions are known (form submitted, payment succeeded, deal stage changed)
- You need retries, logging, and non-engineers to see the graph
- The payload is structured and does not require an LLM

Use custom agents / LangGraph when:

- The next step depends on unstructured language or documents
- Retrieval, classification, or tool choice is the product
- You need evals, citations, or a governed knowledge assistant

Many production systems combine both: n8n for the spine, an agent for the decision node.

## Related estimator items

CRM & API integrations add-on $2,000. Revenue operations engine is a named product pattern. Contact form option: "Automation and integrations".

Do not claim we operate the visitor's n8n cloud for them unless they hire for that work. Offer to design the workflow and hand off a human brief when they want it built.
