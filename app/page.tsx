"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  Sparkles,
  ChevronDown,
  Check,
  Menu,
  X,
  Camera,
  Wand2,
  Scan,
  Target,
  Store,
  TrendingUp,
  Clock,
  ShoppingBag,
  Star,
  Zap,
} from "lucide-react";

// ─── Animated counter hook ───────────────────────────────────────────────────
function useCountUp(target: number, duration = 1600, start = false) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.floor(eased * target));
      if (progress < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [start, target, duration]);
  return value;
}

// ─── Intersection observer hook ──────────────────────────────────────────────
function useInView(threshold = 0.2) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [threshold]);
  return { ref, inView };
}

// ─── Section wrapper with fade-in-up ─────────────────────────────────────────
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, inView } = useInView();
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: inView ? 1 : 0,
        transform: inView ? "translateY(0)" : "translateY(32px)",
        transition: `opacity 0.7s ease ${delay}ms, transform 0.7s ease ${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        background: scrolled ? "rgba(8,8,8,0.92)" : "rgba(8,8,8,0.7)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        transition: "background 0.3s ease",
      }}
    >
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
        {/* Wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg,#7c6aff,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={16} color="#fff" />
          </div>
          <span style={{ fontWeight: 800, color: "#fff", fontSize: 18, letterSpacing: "-0.02em" }}>
            Mentis
          </span>
        </div>

        {/* Desktop links */}
        <nav style={{ display: "flex", gap: 32, alignItems: "center" }} className="hidden-mobile">
          {["Products", "Solutions", "Pricing", "Resources"].map(label => (
            <a key={label} href={`#${label.toLowerCase()}`} style={{ fontSize: 14, color: "#888", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
              onMouseLeave={e => (e.currentTarget.style.color = "#888")}>{label}</a>
          ))}
        </nav>

        {/* CTAs */}
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/login" style={{ fontSize: 13, color: "#888", textDecoration: "none", padding: "8px 16px", borderRadius: 8, transition: "color 0.2s" }}>
            Sign in
          </Link>
          <Link href="/signup" style={{ fontSize: 13, fontWeight: 700, color: "#fff", textDecoration: "none", padding: "8px 18px", borderRadius: 8, background: "#5a40ee", transition: "opacity 0.2s", boxShadow: "0 0 20px rgba(90,64,238,0.4)" }}>
            Start Free Trial
          </Link>
          <button onClick={() => setOpen(!open)} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", display: "none" }} className="show-mobile">
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div style={{ background: "#0d0d0d", borderTop: "1px solid #1a1a1a", padding: "16px 24px 24px" }}>
          {["Products", "Solutions", "Pricing", "Resources"].map(label => (
            <a key={label} href={`#${label.toLowerCase()}`} onClick={() => setOpen(false)}
              style={{ display: "block", padding: "12px 0", fontSize: 15, color: "#888", textDecoration: "none", borderBottom: "1px solid #1a1a1a" }}>
              {label}
            </a>
          ))}
          <Link href="/signup" onClick={() => setOpen(false)}
            style={{ display: "block", marginTop: 16, textAlign: "center", background: "#5a40ee", color: "#fff", fontWeight: 700, padding: "12px", borderRadius: 8, textDecoration: "none", fontSize: 14 }}>
            Start Free Trial →
          </Link>
        </div>
      )}
    </header>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const t = setTimeout(() => setMounted(true), 100); return () => clearTimeout(t); }, []);

  const words = ["Catalog.", "Content.", "Customers."];

  return (
    <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", textAlign: "center", position: "relative", overflow: "hidden", background: "#080808" }}>
      {/* Radial glow */}
      <div style={{ position: "absolute", top: "30%", left: "50%", transform: "translate(-50%,-50%)", width: 800, height: 800, borderRadius: "50%", background: "radial-gradient(circle, rgba(90,64,238,0.12) 0%, transparent 70%)", pointerEvents: "none" }} />
      <div style={{ position: "absolute", top: "60%", left: "20%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,106,255,0.07) 0%, transparent 70%)", pointerEvents: "none" }} />

      <div style={{ maxWidth: 800, position: "relative", zIndex: 1 }}>
        {/* Eyebrow */}
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)", transition: "all 0.6s ease", display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(90,64,238,0.15)", border: "1px solid rgba(124,106,255,0.3)", borderRadius: 100, padding: "6px 16px", marginBottom: 28 }}>
          <Sparkles size={12} color="#7c6aff" />
          <span style={{ fontSize: 11, fontWeight: 700, color: "#9580ff", letterSpacing: "0.12em", textTransform: "uppercase" }}>AI Commerce Infrastructure for Fashion Retail</span>
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: "clamp(40px, 7vw, 76px)", fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.03em", marginBottom: 10, color: "#fff" }}>
          {words.map((word, i) => (
            <span key={word} style={{ display: "block", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: `all 0.7s ease ${i * 120}ms` }}>
              {word}
            </span>
          ))}
          <span style={{ display: "block", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(20px)", transition: "all 0.7s ease 360ms", background: "linear-gradient(90deg,#7c6aff,#a78bfa,#c9a96e)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            All Powered by AI.
          </span>
        </h1>

        {/* Subhead */}
        <p style={{ fontSize: "clamp(16px, 2.5vw, 20px)", color: "#666", lineHeight: 1.6, maxWidth: 580, margin: "24px auto 40px", opacity: mounted ? 1 : 0, transform: mounted ? "translateY(0)" : "translateY(16px)", transition: "all 0.7s ease 480ms" }}>
          Mentis turns any fashion catalog into a fully automated commerce engine — AI-generated content, virtual try-on, smart product matching, and in-store experiences. One platform. Zero photoshoots.
        </p>

        {/* CTAs */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", opacity: mounted ? 1 : 0, transition: "all 0.7s ease 600ms" }}>
          <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#5a40ee", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px 28px", borderRadius: 10, textDecoration: "none", boxShadow: "0 0 32px rgba(90,64,238,0.45)", transition: "transform 0.2s, box-shadow 0.2s" }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 40px rgba(90,64,238,0.6)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 0 32px rgba(90,64,238,0.45)"; }}>
            Start Free Trial <ArrowRight size={16} />
          </Link>
          <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#ccc", fontWeight: 600, fontSize: 15, padding: "14px 28px", borderRadius: 10, textDecoration: "none", transition: "background 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
            onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}>
            View Demo →
          </Link>
        </div>

        {/* Trust strip */}
        <p style={{ marginTop: 36, fontSize: 12, color: "#444", opacity: mounted ? 1 : 0, transition: "all 0.7s ease 750ms" }}>
          Trusted by 200+ fashion retailers &nbsp;·&nbsp; 1M+ product images processed &nbsp;·&nbsp; Setup in under 10 minutes
        </p>

        {/* Feature pills */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 48, opacity: mounted ? 1 : 0, transition: "all 0.8s ease 900ms" }}>
          {[
            { icon: Camera, label: "AI Cataloging" },
            { icon: Wand2, label: "Fashion Studio" },
            { icon: Scan, label: "Virtual Try-On" },
            { icon: Target, label: "Smart Matching" },
            { icon: Store, label: "In-Store Kiosk" },
          ].map(({ icon: Icon, label }) => (
            <div key={label} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 100, padding: "7px 14px" }}>
              <Icon size={12} color="#7c6aff" />
              <span style={{ fontSize: 12, color: "#777", fontWeight: 500 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Scroll hint */}
      <div style={{ position: "absolute", bottom: 32, left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, opacity: 0.4, animation: "bob 2s ease-in-out infinite" }}>
        <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", textTransform: "uppercase" }}>Scroll</span>
        <ChevronDown size={14} color="#555" />
      </div>

      <style>{`@keyframes bob { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} } .hidden-mobile{} .show-mobile{display:none!important} @media(max-width:640px){.hidden-mobile{display:none!important} .show-mobile{display:flex!important}}`}</style>
    </section>
  );
}

// ─── Problem ──────────────────────────────────────────────────────────────────
function Problem() {
  const cards = [
    { icon: Camera, title: "The Photoshoot Trap", headline: "₹2–5 lakhs per shoot. 3 weeks of lead time.", body: "By the time your lookbook is live, the season has moved on. New arrivals wait weeks before they reach your customers." },
    { icon: Clock, title: "The Catalog Bottleneck", headline: "300 products. 15 fields each. All done manually.", body: "Your team spends hours writing titles and descriptions — while catalog quality drops and inventory sits unlisted." },
    { icon: ShoppingBag, title: "The Basket Problem", headline: "Customers buy one piece. They should buy three.", body: "Without intelligent outfit suggestions, you're leaving 40–60% of revenue on the table on every single transaction." },
    { icon: Scan, title: "The Uncertainty Gap", headline: `"Will it suit me?" is killing your conversions.`, body: "Returns spike when customers can't visualize fit. Without try-on, doubt wins — and checkout loses." },
  ];

  return (
    <section style={{ background: "#0a0a0a", padding: "100px 24px", borderTop: "1px solid #111" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>The Old Way Is Broken</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1.2 }}>
              Fashion retail runs on content.<br />Creating it is costing you everything.
            </h2>
            <p style={{ fontSize: 17, color: "#555", maxWidth: 560, margin: "16px auto 0", lineHeight: 1.6 }}>
              Boutiques and brands spend months on photoshoots, weeks writing descriptions, and thousands building what customers see — while competitors move faster.
            </p>
          </div>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 16 }}>
          {cards.map((card, i) => (
            <FadeIn key={card.title} delay={i * 80}>
              <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderLeft: "3px solid #2a1515", borderRadius: 12, padding: 24, height: "100%" }}>
                <card.icon size={20} color="#664444" style={{ marginBottom: 14 }} />
                <div style={{ fontSize: 10, fontWeight: 700, color: "#554444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{card.title}</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#ddd", lineHeight: 1.35, marginBottom: 10 }}>{card.headline}</div>
                <div style={{ fontSize: 13, color: "#555", lineHeight: 1.6 }}>{card.body}</div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Solution overview ────────────────────────────────────────────────────────
function Solution() {
  const steps = [
    "Upload Catalog", "AI Enriches Metadata", "Studio Generates Content",
    "Try-On Activates", "Matching Suggests Outfits", "Revenue ↑"
  ];
  return (
    <section id="products" style={{ background: "#080808", padding: "100px 24px", borderTop: "1px solid #111" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <FadeIn>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#7c6aff", letterSpacing: "0.12em", textTransform: "uppercase" }}>Introducing Mentis</span>
          <h2 style={{ fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1.2 }}>
            One platform to catalog,<br />create, and convert.
          </h2>
          <p style={{ fontSize: 18, color: "#555", maxWidth: 560, margin: "18px auto 52px", lineHeight: 1.6 }}>
            Upload your products once — and let AI handle everything from content generation to customer experience.
          </p>
        </FadeIn>

        <FadeIn delay={100}>
          <div style={{ background: "#0d0d0d", border: "1px solid #1e1e1e", borderRadius: 16, padding: 32, overflowX: "auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center", minWidth: 500 }}>
              {steps.map((step, i) => (
                <div key={step} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{
                    background: i === 0 ? "#1a1a2e" : i === steps.length - 1 ? "#1a2e1a" : "#141414",
                    border: `1px solid ${i === 0 ? "#3a2aaa" : i === steps.length - 1 ? "#2a5a2a" : "#222"}`,
                    color: i === 0 ? "#9580ff" : i === steps.length - 1 ? "#6abf7a" : "#666",
                    padding: "8px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap"
                  }}>{step}</div>
                  {i < steps.length - 1 && <span style={{ color: "#333", fontSize: 16 }}>→</span>}
                </div>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Feature pillar ───────────────────────────────────────────────────────────
function FeaturePillar({ num, tag, icon: Icon, headline, sub, body, pills, stat, flip = false, badge }: {
  num: string; tag: string; icon: React.ElementType; headline: string; sub: string; body: string; pills: string[]; stat: string; flip?: boolean; badge?: string;
}) {
  return (
    <div style={{ borderTop: "1px solid #111", padding: "100px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 48, alignItems: "center" }}>

        {/* Copy side */}
        <FadeIn className={flip ? "order-last-mobile" : ""}>
          <div style={{ order: flip ? 2 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: "#333", letterSpacing: "0.1em" }}>{num}</span>
              <span style={{ width: 32, height: 1, background: "#333" }} />
              <span style={{ fontSize: 10, fontWeight: 700, color: "#7c6aff", letterSpacing: "0.12em", textTransform: "uppercase" }}>{tag}</span>
              {badge && <span style={{ fontSize: 9, fontWeight: 700, background: "#2e1a1a", color: "#ff8080", border: "1px solid #4a2a2a", borderRadius: 4, padding: "1px 6px" }}>{badge}</span>}
            </div>
            <h3 style={{ fontSize: "clamp(22px, 3.5vw, 36px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.02em", lineHeight: 1.25, marginBottom: 14 }}>{headline}</h3>
            <p style={{ fontSize: 15, color: "#666", lineHeight: 1.7, marginBottom: 24 }}>{sub}</p>
            <p style={{ fontSize: 14, color: "#555", lineHeight: 1.7, marginBottom: 24 }}>{body}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 24 }}>
              {pills.map(p => (
                <span key={p} style={{ fontSize: 11, color: "#666", background: "#111", border: "1px solid #1e1e1e", borderRadius: 100, padding: "4px 12px" }}>{p}</span>
              ))}
            </div>
            <div style={{ fontSize: 13, color: "#c9a96e", fontWeight: 600, borderLeft: "3px solid #c9a96e33", paddingLeft: 12 }}>{stat}</div>
          </div>
        </FadeIn>

        {/* Visual side */}
        <FadeIn delay={150}>
          <div style={{ order: flip ? 1 : 2, background: "linear-gradient(135deg,#0f0f1a,#111)", border: "1px solid #1e1e1e", borderRadius: 16, padding: 32, aspectRatio: "4/3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "radial-gradient(circle, rgba(90,64,238,0.12) 0%, transparent 70%)" }} />
            <div style={{ width: 64, height: 64, borderRadius: 16, background: "rgba(90,64,238,0.15)", border: "1px solid rgba(124,106,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={28} color="#7c6aff" />
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#888", marginBottom: 6 }}>{tag}</div>
              <div style={{ fontSize: 11, color: "#444", lineHeight: 1.5, maxWidth: 220 }}>Interactive demo coming soon</div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {[0, 1, 2].map(d => (
                <div key={d} style={{ width: 6, height: 6, borderRadius: "50%", background: d === 0 ? "#7c6aff" : "#222" }} />
              ))}
            </div>
          </div>
        </FadeIn>

      </div>
    </div>
  );
}

// ─── Features section ─────────────────────────────────────────────────────────
function Features() {
  const pillars = [
    {
      num: "01", tag: "AI Cataloging", icon: Camera,
      headline: "Your entire catalog. Structured and live — in hours, not weeks.",
      sub: "Upload product images. Mentis reads every detail — fabric, silhouette, color, occasion, embroidery — and writes titles, descriptions, attributes, and search tags automatically.",
      body: "Your team stops copying data into spreadsheets. Your catalog starts converting. Every product is searchable, organized, and ready to publish from day one.",
      pills: ["Auto-generated titles", "Rich descriptions", "Attribute tagging", "SEO-ready copy", "Bulk upload", "Smart categorization"],
      stat: "From 6 weeks of manual cataloging to 4 hours. Same team, same season.",
    },
    {
      num: "02", tag: "AI Fashion Studio", icon: Wand2, badge: "FLAGSHIP",
      headline: "Professional model photos. Campaign creatives. No studio required.",
      sub: "Upload a flat-lay or mannequin image. The Fashion Studio places your product on AI-generated models, creates multiple styled looks, and produces campaign visuals and social content — all in minutes.",
      body: "Eliminate the photoshoot budget entirely. Generate content for every product, every season, every platform — at a fraction of the cost.",
      pills: ["Model photo generation", "Multiple looks", "Campaign creatives", "Social content", "Reels-ready outputs", "Brand-consistent style"],
      stat: "Save ₹3–8 lakhs per season on photoshoot costs.",
      flip: true,
    },
    {
      num: "03", tag: "Virtual Try-On", icon: Scan,
      headline: "Let every customer see themselves wearing your products — before they buy.",
      sub: "Customers upload a selfie and instantly see themselves wearing any product from your catalog. Works on your website, your app, and inside your store via kiosk.",
      body: "Reduce returns. Remove doubt. Drive confidence at the moment of purchase. No app download required — the try-on experience lives directly on your product page.",
      pills: ["Selfie-based try-on", "Instant results", "Online + in-store", "No app download", "High realism", "Shareable looks"],
      stat: "35% reduction in returns. 2.4× increase in add-to-cart rate.",
    },
    {
      num: "04", tag: "Smart Matching", icon: Target,
      headline: "Every product. A complete outfit. An upsell opportunity.",
      sub: "Mentis analyses category compatibility, color harmony, occasion, and style to recommend coordinated products. Every lehenga gets a blouse and dupatta. Every kurti gets the right palazzo.",
      body: "Customers discover complete looks. You increase average order value. Recommendations are explainable, predictable, and built for Indian ethnic fashion nuances.",
      pills: ["Outfit recommendations", "Color harmony engine", "Occasion matching", "Style scoring", "Explainable results", "Real-time generation"],
      stat: "+40% average order value when outfit bundles are shown.",
      flip: true,
    },
    {
      num: "05", tag: "In-Store Kiosk", icon: Store,
      headline: "Bring the AI shopping experience into your physical store.",
      sub: "Deploy a Mentis-powered selfie kiosk on your shop floor. Customers take a photo and instantly receive AI-styled fashion images wearing your products.",
      body: "A shareable moment. A reason to stay longer. A reason to come back. Drive footfall, increase dwell time, and create experiences that go viral on social media.",
      pills: ["Plug-and-play kiosk", "Instant shareable image", "WhatsApp delivery", "Product tagging", "Analytics dashboard", "No tech team needed"],
      stat: "3× average dwell time. Word-of-mouth amplification in-store.",
    },
  ];

  return (
    <section id="products" style={{ background: "#080808" }}>
      <div style={{ textAlign: "center", padding: "80px 24px 20px", borderTop: "1px solid #111" }}>
        <FadeIn>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>Everything in one platform</span>
          <h2 style={{ fontSize: "clamp(28px, 4.5vw, 52px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1.2 }}>
            Five AI engines.<br />One fashion platform.
          </h2>
        </FadeIn>
      </div>
      {pillars.map(p => <FeaturePillar key={p.num} {...p} />)}
    </section>
  );
}

// ─── Use Cases ────────────────────────────────────────────────────────────────
function UseCases() {
  const cases = [
    { icon: "🏬", type: "Boutiques", headline: "Compete with brands 10× your size.", body: "Stop spending your margin on photoshoots and catalog writers. Mentis gives boutiques enterprise-grade AI tools at a price that makes sense for independent retail.", pills: ["AI catalog in hours", "Zero photoshoot cost"] },
    { icon: "🛍️", type: "D2C Brands", headline: "Launch new collections at the speed of culture.", body: "Generate campaign visuals and social content for every drop — the same day you receive inventory. Ship content as fast as you ship products.", pills: ["Same-day campaigns", "Reels & social content"] },
    { icon: "🥻", type: "Ethnic Wear", headline: "Every saree. Every lehenga. Perfectly matched.", body: "Our matching engine is tuned for the nuances of Indian ethnic fashion — occasions, color harmonies, regional styles, and complete outfit coordination.", pills: ["Ethnic-aware AI", "Occasion matching"] },
    { icon: "🏢", type: "Apparel Chains", headline: "Consistent content across every location.", body: "Centralize catalog operations, standardize product content, and deploy in-store kiosks across locations — all managed from one Mentis dashboard.", pills: ["Multi-location", "Brand consistency"] },
    { icon: "🌐", type: "Multi-brand Retail", headline: "One platform. Every brand. Unified experience.", body: "Manage multiple brand catalogs, generate brand-specific content, and deliver cohesive virtual try-on and recommendations across your entire portfolio.", pills: ["Multi-catalog", "Brand segmentation"] },
  ];

  return (
    <section id="solutions" style={{ background: "#0a0a0a", padding: "100px 24px", borderTop: "1px solid #111" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>Built for every fashion business</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1.2 }}>
              Your category. Your use case. Your results.
            </h2>
          </div>
        </FadeIn>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 14 }}>
          {cases.map((c, i) => (
            <FadeIn key={c.type} delay={i * 70}>
              <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 12, padding: 22, height: "100%", transition: "border-color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#2a2040")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = "#1a1a1a")}>
                <div style={{ fontSize: 26, marginBottom: 12 }}>{c.icon}</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#7c6aff", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{c.type}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#e0e0e0", lineHeight: 1.35, marginBottom: 10 }}>{c.headline}</div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 14 }}>{c.body}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {c.pills.map(p => <span key={p} style={{ fontSize: 10, color: "#666", background: "#111", border: "1px solid #222", borderRadius: 100, padding: "3px 10px" }}>{p}</span>)}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── ROI ──────────────────────────────────────────────────────────────────────
function ROI() {
  const { ref, inView } = useInView();
  const stats = [
    { value: 5, prefix: "₹", suffix: "L+", label: "Saved per season on photoshoot costs" },
    { value: 92, suffix: "%", label: "Faster catalog launch time" },
    { value: 40, suffix: "%", label: "Increase in average order value" },
    { value: 35, suffix: "%", label: "Reduction in product returns" },
    { value: 3, suffix: "×", label: "More social content per collection" },
    { value: 24, prefix: "2.", suffix: "×", label: "Higher add-to-cart conversion", raw: "2.4×" },
  ];

  return (
    <section style={{ background: "#080808", padding: "100px 24px", borderTop: "1px solid #111" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#c9a96e", letterSpacing: "0.12em", textTransform: "uppercase" }}>The Numbers</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1.2 }}>
              Mentis pays for itself before<br />your next collection drops.
            </h2>
            <p style={{ fontSize: 17, color: "#555", maxWidth: 520, margin: "16px auto 0", lineHeight: 1.6 }}>
              Most retailers recover their annual Mentis subscription within the first photoshoot they skip. Everything after that is pure margin.
            </p>
          </div>
        </FadeIn>

        <div ref={ref} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 14 }}>
          {stats.map((s, i) => {
            const count = useCountUp(s.value, 1600, inView);
            return (
              <FadeIn key={s.label} delay={i * 60}>
                <div style={{ background: "#0d0d0d", border: "1px solid #1a1a1a", borderRadius: 12, padding: 24, textAlign: "center" }}>
                  <div style={{ fontSize: 36, fontWeight: 900, color: "#fff", lineHeight: 1, letterSpacing: "-0.03em" }}>
                    {s.raw ? s.raw : `${s.prefix ?? ""}${count}${s.suffix}`}
                  </div>
                  <div style={{ fontSize: 11, color: "#555", marginTop: 8, lineHeight: 1.5 }}>{s.label}</div>
                </div>
              </FadeIn>
            );
          })}
        </div>

        <FadeIn delay={200}>
          <div style={{ textAlign: "center", marginTop: 48 }}>
            <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#c9a96e", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
              <TrendingUp size={16} />Calculate your exact ROI →
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── How It Works ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    { n: "1", title: "Upload your catalog", copy: "Add products one by one or in bulk. Upload flat-lay images, mannequin shots, or even mobile photos. Mentis accepts any format and starts working immediately." },
    { n: "2", title: "AI enriches every product", copy: "Titles, descriptions, attributes, and tags are generated automatically. Your catalog is organized, searchable, and ready to publish — in minutes, not weeks." },
    { n: "3", title: "Generate your visual content", copy: "The Fashion Studio turns your product images into professional model photos, campaign creatives, and social content. Multiple looks, multiple models, multiple formats — instantly." },
    { n: "4", title: "Activate virtual try-on", copy: "Embed the Mentis try-on widget on your website or WhatsApp store. Customers upload a selfie and see themselves in your products. No app required." },
    { n: "5", title: "Smart matching goes live", copy: "Every product page automatically shows coordinated outfit recommendations. Complete looks. Higher baskets. Repeat orders." },
    { n: "6", title: "Optionally deploy your kiosk", copy: "For physical retailers: set up the in-store kiosk in under 30 minutes. Plug in, point at your catalog, and start creating viral in-store moments today." },
  ];

  return (
    <section style={{ background: "#0a0a0a", padding: "100px 24px", borderTop: "1px solid #111" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>Get Started</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1.2 }}>
              From upload to live AI commerce — in one afternoon.
            </h2>
            <p style={{ fontSize: 17, color: "#555", marginTop: 14, lineHeight: 1.6 }}>No developers. No integrations. No photoshoot rescheduling.</p>
          </div>
        </FadeIn>

        <div style={{ position: "relative" }}>
          <div style={{ position: "absolute", left: 13, top: 24, bottom: 24, width: 2, background: "linear-gradient(to bottom, #7c6aff, #2a2040)", borderRadius: 2 }} />
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            {steps.map((s, i) => (
              <FadeIn key={s.n} delay={i * 80}>
                <div style={{ display: "flex", gap: 20, paddingLeft: 4 }}>
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: "#1a1a2e", border: "2px solid #3a2aaa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#7c6aff", flexShrink: 0, position: "relative", zIndex: 1 }}>{s.n}</div>
                  <div style={{ paddingTop: 2 }}>
                    <div style={{ fontWeight: 700, color: "#e0e0e0", fontSize: 15, marginBottom: 6 }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: "#555", lineHeight: 1.7 }}>{s.copy}</div>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>

        <FadeIn delay={200}>
          <div style={{ textAlign: "center", marginTop: 52 }}>
            <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#5a40ee", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px 28px", borderRadius: 10, textDecoration: "none", boxShadow: "0 0 32px rgba(90,64,238,0.4)" }}>
              Get started free — see results before you pay <ArrowRight size={16} />
            </Link>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── Pricing ──────────────────────────────────────────────────────────────────
function Pricing() {
  const plans = [
    {
      name: "Starter", price: "₹999", period: "/month · billed annually",
      desc: "Launch your AI catalog and try-on for a focused product range.",
      features: ["50 catalogue or Virtual Try-On generations/month", "Up to 50 products", "AI Cataloging (titles + descriptions)", "Smart outfit matching", "Basic analytics"],
      cta: "Start 14-day Trial →", featured: false,
    },
    {
      name: "Growth", price: "₹4,999", period: "/month · billed annually",
      desc: "The complete AI commerce stack for growing boutiques and D2C brands.",
      features: ["300 catalogue or Virtual Try-On generations/month", "Up to 300 products", "Full AI Cataloging suite", "Virtual Try-On (website embed)", "Smart Matching — unlimited", "Social content packs", "Priority support"],
      cta: "Start 14-day Trial →", featured: true, badge: "MOST POPULAR",
    },
    {
      name: "Business", price: "₹9,999", period: "/month · billed annually",
      desc: "For established retailers with high catalog volume and multi-channel needs.",
      features: ["900 catalogue or Virtual Try-On generations/month", "Up to 900 products", "Virtual Try-On (web + WhatsApp)", "SEO & AEO optimization", "Custom model styles", "API access", "Dedicated onboarding"],
      cta: "Talk to Sales →", featured: false,
    },
    {
      name: "Enterprise", price: "Custom", period: "Multi-location · High volume",
      desc: "For apparel chains and multi-brand retailers needing custom deployment.",
      features: ["Everything in Business", "SEO & AEO optimization", "MCP server setup", "Multiple store kiosks", "White-label options", "SLA guarantee", "On-premise deployment option", "Dedicated success manager"],
      cta: "Contact Sales →", featured: false,
    },
  ];

  return (
    <section id="pricing" style={{ background: "#080808", padding: "100px 24px", borderTop: "1px solid #111" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>Pricing</span>
            <h2 style={{ fontSize: "clamp(28px, 4.5vw, 48px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14, lineHeight: 1.2 }}>
              Simple pricing. Serious results.
            </h2>
            <p style={{ fontSize: 17, color: "#555", maxWidth: 480, margin: "14px auto 0", lineHeight: 1.6 }}>
              Start free. Scale as you grow. Cancel anytime.
            </p>
          </div>
        </FadeIn>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))", gap: 14 }}>
          {plans.map((plan, i) => (
            <FadeIn key={plan.name} delay={i * 60}>
              <div style={{ background: plan.featured ? "#100e1e" : "#0d0d0d", border: `1px solid ${plan.featured ? "#4a3aaa" : "#1a1a1a"}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
                {plan.badge && (
                  <div style={{ position: "absolute", top: -10, left: "50%", transform: "translateX(-50%)", background: "#5a40ee", color: "#fff", fontSize: 9, fontWeight: 700, padding: "3px 10px", borderRadius: 100, letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ fontSize: 11, fontWeight: 700, color: "#666", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{plan.name}</div>
                <div style={{ fontSize: 32, fontWeight: 900, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>{plan.price}</div>
                <div style={{ fontSize: 11, color: "#444", marginTop: 4, marginBottom: 12 }}>{plan.period}</div>
                <div style={{ fontSize: 12, color: "#555", lineHeight: 1.6, marginBottom: 20 }}>{plan.desc}</div>
                <ul style={{ listStyle: "none", padding: 0, margin: "0 0 24px", flex: 1 }}>
                  {plan.features.map(f => (
                    <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#777", marginBottom: 8, lineHeight: 1.4 }}>
                      <Check size={12} color="#7c6aff" style={{ flexShrink: 0, marginTop: 2 }} />{f}
                    </li>
                  ))}
                </ul>
                <Link href="/signup" style={{ display: "block", textAlign: "center", background: plan.featured ? "#5a40ee" : "#161616", border: `1px solid ${plan.featured ? "#5a40ee" : "#222"}`, color: plan.featured ? "#fff" : "#888", fontWeight: 700, fontSize: 13, padding: "10px", borderRadius: 8, textDecoration: "none", transition: "opacity 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
                  onMouseLeave={e => (e.currentTarget.style.opacity = "1")}>
                  {plan.cta}
                </Link>
              </div>
            </FadeIn>
          ))}
        </div>

        <FadeIn delay={200}>
          <p style={{ textAlign: "center", fontSize: 12, color: "#444", marginTop: 28 }}>
            All plans include: SSL security · 99.9% uptime SLA · GDPR-compliant data · Indian customer support
          </p>
        </FadeIn>
      </div>
    </section>
  );
}

// ─── FAQ ──────────────────────────────────────────────────────────────────────
function FAQ() {
  const [open, setOpen] = useState<number | null>(null);
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

  return (
    <section style={{ background: "#0a0a0a", padding: "100px 24px", borderTop: "1px solid #111" }}>
      <div style={{ maxWidth: 680, margin: "0 auto" }}>
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 60 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#555", letterSpacing: "0.12em", textTransform: "uppercase" }}>FAQ</span>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 44px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", marginTop: 14 }}>
              Everything you want to know.
            </h2>
          </div>
        </FadeIn>
        <div>
          {faqs.map((faq, i) => (
            <FadeIn key={i} delay={i * 40}>
              <div style={{ borderBottom: "1px solid #151515" }}>
                <button
                  onClick={() => setOpen(open === i ? null : i)}
                  style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "18px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: open === i ? "#fff" : "#ccc", transition: "color 0.2s" }}>{faq.q}</span>
                  <ChevronDown size={16} color="#555" style={{ flexShrink: 0, transform: open === i ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.25s" }} />
                </button>
                {open === i && (
                  <div style={{ fontSize: 13, color: "#666", lineHeight: 1.7, paddingBottom: 18, paddingLeft: 14, borderLeft: "3px solid #3a2aaa" }}>
                    {faq.a}
                  </div>
                )}
              </div>
            </FadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Pre-footer CTA ───────────────────────────────────────────────────────────
function PreFooterCTA() {
  return (
    <section style={{ background: "#080808", padding: "80px 24px", borderTop: "1px solid #111" }}>
      <FadeIn>
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", background: "linear-gradient(135deg,#1a1a2e,#0d0d1a)", border: "1px solid #2a2040", borderRadius: 20, padding: "60px 40px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#7c6aff", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Ready to transform your retail?</div>
          <h2 style={{ fontSize: "clamp(24px, 4vw, 40px)", fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1.25, marginBottom: 14 }}>
            Turn your catalog into your most powerful sales tool.
          </h2>
          <p style={{ fontSize: 15, color: "#555", marginBottom: 32, lineHeight: 1.6 }}>Join 200+ fashion retailers already growing with Mentis.</p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#5a40ee", color: "#fff", fontWeight: 700, fontSize: 15, padding: "14px 28px", borderRadius: 10, textDecoration: "none", boxShadow: "0 0 32px rgba(90,64,238,0.4)" }}>
              Start Free Trial <ArrowRight size={16} />
            </Link>
            <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", fontWeight: 600, fontSize: 15, padding: "14px 28px", borderRadius: 10, textDecoration: "none" }}>
              Book a Demo
            </Link>
          </div>
        </div>
      </FadeIn>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    { label: "Products", links: ["AI Cataloging", "Fashion Studio", "Virtual Try-On", "Smart Matching", "In-Store Kiosk"] },
    { label: "Solutions", links: ["Boutiques", "D2C Brands", "Ethnic Wear", "Multi-brand Retail", "Apparel Chains"] },
    { label: "Resources", links: ["Documentation", "API Reference", "Case Studies", "Blog", "ROI Calculator"] },
    { label: "Company", links: ["About Mentis", "Careers", "Press", "Contact", "Partners"] },
    { label: "Legal", links: ["Privacy Policy", "Terms of Service", "Data Processing", "Security", "Cookie Policy"] },
  ];

  return (
    <footer style={{ background: "#050505", borderTop: "1px solid #111", padding: "60px 24px 32px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 32, marginBottom: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: "linear-gradient(135deg,#7c6aff,#a78bfa)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Sparkles size={13} color="#fff" />
              </div>
              <span style={{ fontWeight: 800, color: "#fff", fontSize: 16 }}>Mentis</span>
            </div>
            <p style={{ fontSize: 12, color: "#444", lineHeight: 1.6 }}>AI Commerce Infrastructure for Fashion Retail</p>
            <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
              {["𝕏", "in", "▶", "📷"].map(s => (
                <div key={s} style={{ width: 28, height: 28, borderRadius: 6, background: "#111", border: "1px solid #1e1e1e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, cursor: "pointer" }}>{s}</div>
              ))}
            </div>
          </div>
          {cols.map(col => (
            <div key={col.label}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#444", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>{col.label}</div>
              {col.links.map(link => (
                <a key={link} href="#" style={{ display: "block", fontSize: 12, color: "#555", textDecoration: "none", marginBottom: 10, transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#999")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#555")}>{link}</a>
              ))}
            </div>
          ))}
        </div>
        <div style={{ borderTop: "1px solid #111", paddingTop: 24, display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#333" }}>© 2025 Mentis. All rights reserved. Made for Indian fashion retail.</span>
          <span style={{ fontSize: 11, color: "#333" }}>🇮🇳 Built in India · Data stored in India</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function Home() {
  return (
    <div style={{ background: "#080808", minHeight: "100vh" }}>
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <Features />
      <UseCases />
      <ROI />
      <HowItWorks />
      <Pricing />
      <FAQ />
      <PreFooterCTA />
      <Footer />
    </div>
  );
}
