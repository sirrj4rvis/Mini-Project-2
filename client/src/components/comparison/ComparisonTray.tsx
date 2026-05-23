import { useCompareStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, Scale } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ComparisonTray() {
  const { comparisonTray, removeFromComparison, clearComparison } = useCompareStore();

  if (comparisonTray.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        className="fixed bottom-6 left-1/2 z-50 w-[95%] max-w-3xl -translate-x-1/2 rounded-full border border-border bg-foreground/95 p-3 pr-4 shadow-2xl backdrop-blur supports-[backdrop-filter]:bg-foreground/80 md:w-fit"
      >
        <div className="flex items-center gap-4 text-background">
          <div className="hidden items-center gap-2 pl-3 md:flex">
            <Scale className="h-5 w-5 text-accent" />
            <span className="text-sm font-semibold uppercase tracking-wider text-background/80">
              Compare
            </span>
          </div>

          <div className="flex flex-1 items-center gap-3">
            {comparisonTray.map((p, i) => (
              <div
                key={p.id}
                className="relative flex items-center gap-3 rounded-full bg-background/20 py-1 pl-2 pr-3"
              >
                <img src={p.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                <div className="hidden md:block">
                  <div className="text-xs font-semibold leading-none">
                    {p.title.split(" ").slice(0, 2).join(" ")}
                  </div>
                  <div className="mt-0.5 text-[10px] text-background/60">
                    ₹{p.bestPrice.toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => removeFromComparison(p.id)}
                  className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}

            {Array.from({ length: Math.max(0, 3 - comparisonTray.length) }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="hidden h-10 w-10 items-center justify-center rounded-full border border-dashed border-background/20 md:flex"
              >
                <span className="text-xs text-background/40">+{i + 1}</span>
              </div>
            ))}
          </div>

          <div className="flex shrink-0 items-center gap-2 pl-2 border-l border-background/20">
            <button
              onClick={clearComparison}
              className="hidden px-2 text-xs font-medium text-background/60 hover:text-background md:block"
            >
              Clear
            </button>
            <Link
              to="/compare/$id"
              params={{ id: comparisonTray[0]?.id || "empty" }}
              className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                comparisonTray.length >= 2
                  ? "bg-accent text-accent-foreground hover:bg-accent/90"
                  : "cursor-not-allowed bg-background/20 text-background/40"
              }`}
              onClick={(e) => {
                if (comparisonTray.length < 2) e.preventDefault();
              }}
            >
              Compare <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
