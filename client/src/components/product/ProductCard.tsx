import { Link } from "@tanstack/react-router";
import { ArrowUpRight, Heart, Star, ShoppingBag, BarChart2, TrendingUp, Zap, Crown, Flame, Tag } from "lucide-react";
import { motion } from "framer-motion";
import React, { useState } from "react";
import type { Product, RecommendationBadge } from "@/lib/mock-data";
import { useCompareStore } from "@/store";

// Badge visual configuration — color + icon per badge type
const BADGE_CONFIG: Record<RecommendationBadge, { label: string; icon: React.ReactNode; className: string }> = {
  "Best Value":        { label: "Best Value",        icon: <Zap   className="w-3 h-3" />, className: "bg-emerald-500 text-white" },
  "Budget Pick":       { label: "Budget Pick",       icon: <Tag   className="w-3 h-3" />, className: "bg-sky-500 text-white" },
  "Premium Pick":      { label: "Premium Pick",      icon: <Crown className="w-3 h-3" />, className: "bg-violet-600 text-white" },
  "Most Popular":      { label: "Most Popular",      icon: <Flame className="w-3 h-3" />, className: "bg-orange-500 text-white" },
  "Lowest Price Today":{ label: "Lowest Price Today",icon: <TrendingUp className="w-3 h-3" />, className: "bg-rose-500 text-white" },
};

export const ProductCard = React.memo(function ProductCard({
  product,
  index = 0,
  layout = "grid",
}: {
  product: Product;
  index?: number;
  layout?: "grid" | "list";
}) {
  const [liked, setLiked] = useState(false);
  const { addToComparison, comparisonTray } = useCompareStore();

  const discount = Math.round(((product.originalPrice - product.bestPrice) / product.originalPrice) * 100);

  const inComparison = comparisonTray.some((p) => p.id === product.id);

  // Extract unique platforms
  const platforms = Array.from(new Set(product.offers?.map((s: any) => s.source) || [])).slice(0, 3);

  if (layout === "list") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="group relative flex w-full flex-col sm:flex-row gap-6 rounded-3xl border border-border bg-card p-4 hover:border-primary/40 hover:shadow-xl transition-all overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity"></div>

        {/* Image Section */}
        <Link
          to="/product/$id"
          params={{ id: product.id }}
          className="relative h-48 w-full sm:w-48 shrink-0 overflow-hidden rounded-2xl bg-surface dark:bg-white p-2 flex items-center justify-center"
        >
          <img
            src={product.image}
            alt={product.title}
            loading="lazy"
            decoding="async"
            onError={(e) => {
              e.currentTarget.src = "https://placehold.co/400x400?text=No+Image";
            }}
            className="h-full w-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-105"
          />
          {discount > 0 && (
            <div className="absolute left-3 top-3 rounded-full bg-destructive/10 px-2.5 py-1 text-[11px] font-bold text-destructive backdrop-blur-md">
              {discount}% OFF
            </div>
          )}
        </Link>

        {/* Content Section */}
        <div className="flex flex-1 flex-col justify-between py-1">
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  {product.brand}
                </div>
                <Link
                  to="/product/$id"
                  params={{ id: product.id }}
                  className="group-hover:text-primary transition-colors"
                >
                  <h3 className="font-display text-xl font-bold line-clamp-2 leading-tight">
                    {product.canonicalTitle || product.title}
                  </h3>
                </Link>

                {/* Recommendation Badge — List Layout */}
                {product.recommendationBadge && BADGE_CONFIG[product.recommendationBadge] && (
                  <div className={`mt-2 w-fit flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide shadow-sm ${BADGE_CONFIG[product.recommendationBadge].className}`}>
                    {BADGE_CONFIG[product.recommendationBadge].icon}
                    {BADGE_CONFIG[product.recommendationBadge].label}
                  </div>
                )}
              </div>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  setLiked(!liked);
                }}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface hover:bg-muted transition-colors"
              >
                <Heart
                  className={`h-4 w-4 ${liked ? "fill-accent text-accent" : "text-muted-foreground"}`}
                />
              </button>
            </div>

            {/* Ratings & Platforms */}
            <div className="mt-3 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <Star className="h-4 w-4 fill-warning text-warning" />
                <span className="text-sm font-bold">{product.rating}</span>
                <span className="text-xs text-muted-foreground">
                  ({product.reviews?.toLocaleString() || "1.2k"} reviews)
                </span>
              </div>
              <div className="hidden sm:block w-px h-4 bg-border"></div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Available on:</span>
                <div className="flex gap-1.5">
                  {platforms.length > 0 ? (
                    platforms.map((p, i) => (
                      <span
                        key={i}
                        className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-semibold"
                      >
                        {p as string}
                      </span>
                    ))
                  ) : (
                    <span className="rounded-md bg-surface px-2 py-0.5 text-[10px] font-semibold">
                      Amazon
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Pricing & Actions */}
          <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-foreground">
                  ₹{product.bestPrice.toLocaleString()}
                </span>
                {discount > 0 && (
                  <span className="text-sm text-muted-foreground line-through">
                    ₹{product.originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
              <div className="text-[11px] font-medium text-success mt-1 flex items-center gap-2">
                <span>
                  {product.recommendation === "BUY_NOW"
                    ? "✓ Best time to buy"
                    : "Wait for price drop"}
                </span>
                {product.dealScore && (
                  <span className="bg-primary/20 text-primary-foreground px-2 py-0.5 rounded font-bold">
                    Score: {product.dealScore}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  addToComparison(product);
                }}
                disabled={inComparison}
                className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2.5 text-sm font-semibold hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <BarChart2 className="h-4 w-4" />
                <span className="hidden sm:inline">{inComparison ? "Comparing" : "Compare"}</span>
              </button>
              <Link
                to="/product/$id"
                params={{ id: product.id }}
                className="flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-bold text-background hover:bg-foreground/90 transition-transform hover:scale-105"
              >
                <ShoppingBag className="h-4 w-4" />
                View Deals
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Grid Layout (Default)
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.05 }}
      className="group relative flex flex-col rounded-[2rem] border border-border/50 bg-card hover:border-primary/30 hover:shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300"
    >
      <Link
        to="/product/$id"
        params={{ id: product.id }}
        className="relative aspect-[4/5] overflow-hidden rounded-t-[2rem] bg-surface dark:bg-white p-6 flex items-center justify-center"
      >
        <img
          src={product.image}
          alt={product.title}
          loading="lazy"
          decoding="async"
          onError={(e) => {
            e.currentTarget.src = "https://placehold.co/400x400?text=No+Image";
          }}
          className="h-full w-full object-contain mix-blend-multiply transition-transform duration-700 group-hover:scale-110"
        />

        {/* Top Badges */}
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          {discount > 0 && (
            <div className="w-fit rounded-full bg-destructive px-2.5 py-1 text-[11px] font-bold tracking-wide text-destructive-foreground shadow-sm">
              {discount}% OFF
            </div>
          )}
          {product.recommendation === "BUY_NOW" && (
            <div className="w-fit rounded-full bg-success/20 px-2.5 py-1 text-[11px] font-bold tracking-wide text-success shadow-sm backdrop-blur-md">
              GREAT DEAL
            </div>
          )}
          {product.dealScore && (
            <div className="w-fit rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold tracking-wide text-primary-foreground shadow-sm backdrop-blur-md flex items-center gap-1">
              <Star className="w-3 h-3 fill-current" /> {product.dealScore}
            </div>
          )}
          {/* Recommendation Badge — Grid Layout */}
          {product.recommendationBadge && BADGE_CONFIG[product.recommendationBadge] && (
            <div className={`w-fit flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wide shadow-sm backdrop-blur-md ${BADGE_CONFIG[product.recommendationBadge].className}`}>
              {BADGE_CONFIG[product.recommendationBadge].icon}
              {BADGE_CONFIG[product.recommendationBadge].label}
            </div>
          )}
        </div>

        {/* Hover Action Buttons */}
        <div className="absolute right-4 top-4 flex flex-col gap-2 translate-x-4 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          <button
            onClick={(e) => {
              e.preventDefault();
              setLiked(!liked);
            }}
            aria-label="Wishlist"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur transition-transform hover:scale-110"
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-accent text-accent" : "text-foreground"}`} />
          </button>
          <button
            onClick={(e) => {
              e.preventDefault();
              addToComparison(product);
            }}
            disabled={inComparison}
            aria-label="Compare"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-background/90 shadow-sm backdrop-blur transition-transform hover:scale-110 disabled:opacity-50"
          >
            <BarChart2 className={`h-4 w-4 ${inComparison ? "text-primary" : "text-foreground"}`} />
          </button>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            {product.brand}
          </div>
          <div className="flex items-center gap-1 bg-surface px-1.5 py-0.5 rounded text-xs font-semibold">
            <Star className="h-3 w-3 fill-warning text-warning" />
            {product.rating}
          </div>
        </div>

        <Link
          to="/product/$id"
          params={{ id: product.id }}
          className="group-hover:text-primary transition-colors"
        >
          <h3 className="font-display text-lg font-semibold leading-tight line-clamp-2 mb-2">
            {product.canonicalTitle || product.title}
          </h3>
        </Link>

        {/* Recommendation Badge — lower grid card */}
        {product.recommendationBadge && BADGE_CONFIG[product.recommendationBadge] && (
          <div className={`mb-3 w-fit flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide shadow-sm ${BADGE_CONFIG[product.recommendationBadge].className}`}>
            {BADGE_CONFIG[product.recommendationBadge].icon}
            {BADGE_CONFIG[product.recommendationBadge].label}
          </div>
        )}

        {/* Available Stores */}
        <div className="mt-auto mb-4 flex flex-wrap gap-1">
          {platforms.length > 0 ? (
            platforms.map((p, i) => (
              <span
                key={i}
                className="rounded border border-border/50 bg-surface/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground"
              >
                {p as string}
              </span>
            ))
          ) : (
            <span className="rounded border border-border/50 bg-surface/50 px-1.5 py-0.5 text-[9px] font-bold uppercase text-muted-foreground">
              Amazon
            </span>
          )}
        </div>

        <div className="flex items-end justify-between pt-4 border-t border-border/50">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-xl font-bold">
                ₹{product.bestPrice.toLocaleString()}
              </span>
            </div>
            {discount > 0 && (
              <div className="text-xs text-muted-foreground line-through mt-0.5">
                M.R.P: ₹{product.originalPrice.toLocaleString()}
              </div>
            )}
          </div>
          <Link
            to="/product/$id"
            params={{ id: product.id }}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background transition-transform hover:scale-105"
          >
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
});
