import type { Metadata } from "next";
import HomeClient from "./HomeClient";

const TITLE = "Mentis — AI Commerce Infrastructure for Fashion Retail";
const DESCRIPTION =
  "Turn any fashion catalog into an AI-powered shopping experience. AI Cataloging, Fashion Studio, Virtual Try-On, Smart Matching, and In-Store Kiosk — one platform for fashion retailers.";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mentishq.com";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    url: "/",
    title: TITLE,
    description: DESCRIPTION,
  },
};

// Same copy as the FAQ() section in HomeClient.tsx — kept in lockstep so the
// structured data never claims a question/answer pair the page doesn't show.
const faqs = [
  { q: "Do I need a developer to set up Mentis?", a: "No. Mentis is designed for retailers, not engineers. Setup takes under 30 minutes. For website embed, you copy one line of code. The kiosk is plug-and-play." },
  { q: "What kind of product images does Mentis need?", a: "Any format works — flat-lay, mannequin, or mobile photos taken in good lighting. The Fashion Studio produces best results with clean backgrounds, but AI Cataloging works on almost anything you already have." },
  { q: "How realistic is the Virtual Try-On?", a: "Very. Mentis uses state-of-the-art diffusion models to drape clothing realistically on the customer's selfie, respecting body shape, skin tone, and garment texture. Results are typically indistinguishable from a real photo." },
  { q: "Is the AI trained on Indian ethnic fashion specifically?", a: "Yes. Our cataloging, matching, and color harmony models are tuned for Indian ethnic wear — sarees, lehengas, kurtis, sherwanis, and more. The system understands occasions, regional styles, and traditional Indian color harmony rules." },
  { q: "What happens to my product images and customer data?", a: "Your data is yours. Product images and customer selfies are stored securely with AES-256 encryption. Customer selfies used for try-on are never stored beyond the session. We do not train our models on your proprietary data without consent." },
  { q: "Can I integrate Mentis with my existing website or e-commerce platform?", a: "Yes. Mentis provides embed widgets for Virtual Try-On and product recommendations that work on any website. We also offer API access on Pro and Enterprise plans for deeper integration with Shopify, WooCommerce, or custom storefronts." },
  { q: "How quickly will I see results?", a: "Most retailers see catalog-ready content within hours of uploading. Fashion Studio images are generated in under 60 seconds per product. Virtual Try-On goes live the same day you embed the widget." },
  { q: "What if I want to cancel?", a: "Cancel anytime from your dashboard. No lock-in, no cancellation fees. Your catalog data is exportable at any time in standard formats. We'd rather earn your business every month than trap you." },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

// Same three fixed-price plans shown in the Pricing() section — Enterprise is
// "Custom" pricing and doesn't map to a schema.org Offer.price, so it's
// intentionally left out here rather than encoded with a fabricated number.
const offers = [
  { name: "Starter", price: "999", desc: "Launch your AI catalog and try-on for a focused product range." },
  { name: "Growth", price: "4999", desc: "The complete AI commerce stack for growing boutiques and D2C brands." },
  { name: "Business", price: "9999", desc: "For established retailers with high catalog volume and multi-channel needs." },
];

const softwareOffersJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Mentis",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: APP_URL,
  offers: offers.map((o) => ({
    "@type": "Offer",
    name: o.name,
    price: o.price,
    priceCurrency: "INR",
    description: o.desc,
    url: `${APP_URL}/signup`,
  })),
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareOffersJsonLd) }}
      />
      <HomeClient />
    </>
  );
}
