import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  Search,
  ArrowRight,
  Sparkles,
  TrendingUp,
  ShieldCheck,
  Zap,
  LineChart,
  Tag,
  MonitorSmartphone,
  Clock,
} from "lucide-react";
import { products, trendingSearches } from "@/lib/mock-data";
import { ProductCard } from "@/components/product/ProductCard";
import { useState, useRef } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PriceLens — Intelligent Price Comparison" },
      { name: "description", content: "AI-powered price comparison and historical tracking." },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const y = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/search", search: { q } });
  };

  return (
    <div ref={containerRef} className="relative bg-background overflow-hidden">
      {/* 1. Hero Section & 2. Smart Search Section */}
      <section className="relative min-h-[90vh] flex flex-col items-center justify-center pt-20 pb-32 px-5 text-center overflow-hidden">
        {/* Animated Gradient Background */}
        <motion.div style={{ y }} className="absolute inset-0 z-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-primary/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow"></div>
          <div
            className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-accent/20 rounded-full blur-[100px] mix-blend-screen animate-pulse-slow"
            style={{ animationDelay: "2s" }}
          ></div>
        </motion.div>

        <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm text-primary font-medium mb-8 backdrop-blur-md">
              <Sparkles className="h-4 w-4" />
              <span>Next-Gen ML Price Intelligence</span>
            </div>

            <h1 className="font-display text-[4rem] sm:text-[5.5rem] lg:text-[7rem] font-bold leading-[0.9] tracking-tighter text-foreground mb-8">
              Never pay <br className="md:hidden" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-accent to-primary bg-300% animate-gradient">
                full price
              </span>{" "}
              again.
            </h1>

            <p className="max-w-2xl text-lg sm:text-xl text-muted-foreground leading-relaxed mb-12">
              Our AI continuously monitors millions of products across 200+ stores. Discover real
              discounts, view 60-day price histories, and know exactly when to buy.
            </p>
          </motion.div>

          {/* Smart Search UI */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full max-w-2xl"
          >
            <form onSubmit={onSearch} className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25 group-hover:opacity-50 transition duration-500"></div>
              <div className="relative flex items-center h-16 rounded-full border border-border/50 bg-card/80 backdrop-blur-xl shadow-2xl overflow-hidden pl-6 pr-2">
                <Search className="h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Paste a link or search for any product..."
                  className="flex-1 bg-transparent px-4 py-2 text-lg outline-none placeholder:text-muted-foreground/70"
                />
                <button
                  type="submit"
                  className="h-12 px-8 rounded-full bg-foreground text-background font-bold hover:scale-105 transition-transform active:scale-95"
                >
                  Compare
                </button>
              </div>
            </form>

            {/* Recent Searches Placeholder */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-muted-foreground font-medium">Trending:</span>
              {trendingSearches.map((t) => (
                <button
                  key={t}
                  onClick={() => navigate({ to: "/search", search: { q: t } })}
                  className="flex items-center gap-1.5 rounded-full border border-border/60 bg-surface/50 px-4 py-1.5 text-sm font-medium hover:bg-surface hover:border-border transition-colors backdrop-blur-md"
                >
                  <TrendingUp className="h-3.5 w-3.5 text-primary" /> {t}
                </button>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Trust Indicators */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.8 }}
          className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-8 opacity-50 grayscale"
        >
          {/* Mock Logos */}
          <div className="text-xl font-display font-bold tracking-widest">AMAZON</div>
          <div className="text-xl font-display font-bold tracking-widest">FLIPKART</div>
          <div className="text-xl font-display font-bold tracking-widest">CROMA</div>
          <div className="text-xl font-display font-bold tracking-widest">RELIANCE</div>
        </motion.div>
      </section>

      {/* 4. Platform Features */}
      <section className="py-24 bg-surface/30 border-y border-border/50">
        <div className="max-w-7xl mx-auto px-5">
          <div className="text-center mb-16">
            <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
              Why shop with PriceLens?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              We cut through the noise of fake sales to bring you the truth about pricing.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {[
              {
                i: MonitorSmartphone,
                t: "Real-Time Comparison",
                d: "Instantly compare live prices across 200+ verified retailers in one single view.",
              },
              {
                i: LineChart,
                t: "Price History",
                d: "View 60-day price charts to identify genuine discounts versus inflated retail prices.",
              },
              {
                i: Zap,
                t: "AI Deal Detection",
                d: "Our Machine Learning algorithm detects unusual price drops and alerts you instantly.",
              },
              {
                i: ShieldCheck,
                t: "Unbiased Results",
                d: "No sponsored rankings. The cheapest, most reliable option always wins.",
              },
            ].map((f, i) => (
              <div
                key={i}
                className="p-8 rounded-3xl bg-card border border-border/50 hover:border-primary/50 transition-colors group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <f.i className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.t}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">{f.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Trending Products Carousel */}
      <section className="py-32 max-w-[1600px] mx-auto px-5 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <div className="inline-flex items-center gap-2 text-primary font-bold mb-3">
              <TrendingUp className="h-5 w-5" /> Trending Now
            </div>
            <h2 className="font-display text-4xl md:text-5xl font-bold">
              Products everyone is eyeing.
            </h2>
          </div>
          <Link
            to="/trending"
            className="inline-flex items-center gap-2 font-bold hover:text-primary transition-colors"
          >
            View All Trending <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* CSS-based Carousel wrapper */}
        <div className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory no-scrollbar pr-10">
          {products.slice(0, 6).map((p, i) => (
            <div key={p.id} className="min-w-[300px] max-w-[300px] snap-start">
              <ProductCard product={p} index={i} />
            </div>
          ))}
        </div>
      </section>

      {/* 6. Comparison Demo Section */}
      <section className="py-32 bg-foreground text-background relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-primary via-background to-background"></div>
        <div className="max-w-7xl mx-auto px-5 relative z-10 grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="font-display text-5xl lg:text-6xl font-bold mb-6 leading-tight">
              Don't just guess.
              <br />
              <span className="text-primary">Compare it.</span>
            </h2>
            <p className="text-lg text-background/70 mb-10 max-w-md">
              A single search instantly aggregates listings from top e-commerce platforms. We
              highlight the absolute best deal, including shipping costs.
            </p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-primary-foreground font-bold hover:bg-primary/90 transition-transform hover:scale-105"
            >
              Try a comparison <ArrowRight className="h-5 w-5" />
            </Link>
          </div>

          {/* Mock Comparison UI */}
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-3xl blur-2xl opacity-20"></div>
            <div className="relative bg-card text-foreground rounded-3xl border border-border p-6 shadow-2xl">
              <div className="flex items-center gap-4 border-b border-border pb-6 mb-6">
                <div className="h-16 w-16 bg-surface rounded-xl flex items-center justify-center">
                  <MonitorSmartphone className="h-8 w-8 text-muted-foreground" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Sony WH-1000XM5</h3>
                  <div className="text-sm text-muted-foreground">Noise Cancelling Headphones</div>
                </div>
              </div>

              <div className="space-y-4">
                {[
                  { store: "Amazon", price: "₹24,990", shipping: "Free", best: true },
                  { store: "Flipkart", price: "₹25,490", shipping: "Free", best: false },
                  { store: "Croma", price: "₹26,990", shipping: "₹100", best: false },
                ].map((s, i) => (
                  <div
                    key={i}
                    className={`flex items-center justify-between p-4 rounded-2xl border ${s.best ? "border-success bg-success/10" : "border-border bg-surface"}`}
                  >
                    <div className="font-bold">{s.store}</div>
                    <div className="text-right">
                      <div
                        className={`font-display text-xl font-bold ${s.best ? "text-success" : ""}`}
                      >
                        {s.price}
                      </div>
                      <div className="text-xs text-muted-foreground">+ {s.shipping} shipping</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Statistics Section */}
      <section className="py-24 border-b border-border bg-surface/50">
        <div className="max-w-7xl mx-auto px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4 text-center">
            {[
              { num: "12M+", label: "Products Tracked" },
              { num: "200+", label: "Stores Monitored" },
              { num: "500k", label: "Daily Comparisons" },
              { num: "₹4.2Cr", label: "Savings Generated" },
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center justify-center p-6">
                <div className="font-display text-4xl md:text-5xl font-bold text-primary mb-2 tracking-tight">
                  {stat.num}
                </div>
                <div className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
