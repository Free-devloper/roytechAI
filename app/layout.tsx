import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AssistantWidget from "./components/AssistantWidget";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.roytechworkforce.com"),
  title: "RoyTech AI | Rehan Ghafoor - AI Product & Software Studio",
  description: "RoyTech AI by Rehan Ghafoor builds AI products, focused MVPs, custom software, autonomous AI agent workflows, and full-stack platforms.",
  keywords: [
    "Rehan Ghafoor",
    "RoyTech AI",
    "AI Product Development",
    "AI Agents",
    "RAG Systems",
    "MVP Development",
    "Custom Software Engineering",
    "Full-Stack SaaS",
    "FastAPI",
    "Next.js",
    "Python AI"
  ],
  authors: [{ name: "Rehan Ghafoor" }],
  creator: "Rehan Ghafoor",
  publisher: "RoyTech AI",
  alternates: {
    canonical: "https://www.roytechworkforce.com",
  },
  openGraph: {
    title: "RoyTech AI | Rehan Ghafoor - AI Product & Software Studio",
    description: "We build AI products, focused MVPs, custom software, and delivery systems for founders and engineering teams.",
    url: "https://www.roytechworkforce.com",
    siteName: "RoyTech AI",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RoyTech AI | Rehan Ghafoor",
    description: "AI product development, focused MVPs, custom software, and delivery systems by Rehan Ghafoor.",
    creator: "@RehanGhafoor",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

const jsonLdSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "ProfessionalService",
      "@id": "https://www.roytechworkforce.com/#organization",
      "name": "RoyTech AI",
      "url": "https://www.roytechworkforce.com",
      "logo": "https://www.roytechworkforce.com/favicon.svg",
      "image": "https://www.roytechworkforce.com/favicon.svg",
      "description": "RoyTech AI by Rehan Ghafoor builds AI products, focused MVPs, custom software, and autonomous delivery systems for ambitious teams.",
      "founder": {
        "@type": "Person",
        "name": "Rehan Ghafoor"
      },
      "priceRange": "$$$",
      "knowsAbout": [
        "Artificial Intelligence",
        "AI Agents",
        "RAG Knowledge Systems",
        "Full-Stack Web Development",
        "SaaS Architecture",
        "Python & FastAPI",
        "Next.js & React"
      ],
      "areaServed": "Global",
      "hasOfferCatalog": {
        "@type": "OfferCatalog",
        "name": "RoyTech AI Services",
        "itemListElement": [
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "AI Product Engineering",
              "description": "Production LLM features, Knowledge RAG, Multi-Agent Workflows, & Evals."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "MVP Development",
              "description": "Focused SaaS & MVP product releases designed for fast market validation."
            }
          },
          {
            "@type": "Offer",
            "itemOffered": {
              "@type": "Service",
              "name": "Custom Software Engineering",
              "description": "Internal ops platforms, client portals, and scalable cloud systems."
            }
          }
        ]
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://www.roytechworkforce.com/#website",
      "url": "https://www.roytechworkforce.com",
      "name": "RoyTech AI | Rehan Ghafoor",
      "publisher": {
        "@id": "https://www.roytechworkforce.com/#organization"
      }
    }
  ]
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdSchema) }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <AssistantWidget />
      </body>
    </html>
  );
}
