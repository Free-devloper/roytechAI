export type TourStop = {
  target: string;
  label: string;
  summary: string;
};

export const TOUR_STOPS: TourStop[] = [
  {
    target: "/#top",
    label: "Home",
    summary: "The hero is the studio pitch: weekly demos, senior ownership, and a clean handover. Start a build is the primary CTA.",
  },
  {
    target: "/#why",
    label: "Why RoyTech AI",
    summary: "This is the partner framing: less vendor drag, clearer tradeoffs, and a team that keeps context instead of handing it off.",
  },
  {
    target: "/#services",
    label: "Capabilities",
    summary: "Six capabilities sit here: agentic AI, full-stack web apps, n8n automation, RAG pipelines, MVP delivery, and custom platform work.",
  },
  {
    target: "/#method",
    label: "Delivery model",
    summary: "The method is FRAME → SHAPE → BUILD → COMPOUND. AI speeds research and iteration; engineers stay accountable for architecture and release.",
  },
  {
    target: "/#estimator",
    label: "Estimator",
    summary: "The calculator gives indicative ranges from scope, AI features, full-stack modules, and pace. It is a sketch, not a contract.",
  },
  {
    target: "/#solutions",
    label: "Solutions",
    summary: "Six repeatable product patterns you can start from, then tailor to your customers, data, and workflow.",
  },
  {
    target: "/#contact",
    label: "Contact",
    summary: "The lead form collects name, email, need, and brief so a human on the RoyTech AI team can follow up.",
  },
];

export const TOUR_INTRO = "I'll walk you through the studio, one section at a time.\n\n";
export const TOUR_CLOSE =
  "We're back at the top. What would you like to do next — look closer at a section, get an indicative quote, or send a note to the team?";

export function isSiteTour(text: string) {
  const t = text.toLowerCase().trim();
  return (
    t === "tour" ||
    /\btour(\s+the)?\s+site\b/.test(t) ||
    /\bsite tour\b/.test(t) ||
    /\bwalk me through\b/.test(t) ||
    /\bshow me (the |around the )?site\b/.test(t) ||
    /\baround the site\b/.test(t) ||
    /\bguide me (through|around)\b/.test(t)
  );
}

export function tourStepMarkdown(stop: TourStop) {
  return `### ${stop.label}\n${stop.summary}\n\n`;
}
