import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Filter, ChevronDown, Check, X } from "lucide-react";
import { categories } from "@/lib/mock-data";

const mockBrands = ["Apple", "Samsung", "Sony", "Dell", "HP", "Asus"];
const mockStores = ["Amazon", "Flipkart", "Croma", "Reliance Digital"];

interface FilterSidebarProps {
  cat: string;
  setCat: (c: string) => void;
  priceRange: [number, number];
  setPriceRange: (range: [number, number]) => void;
  selectedBrands: string[];
  toggleBrand: (b: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (o: boolean) => void;
}

export function FilterSidebar({
  cat,
  setCat,
  priceRange,
  setPriceRange,
  selectedBrands,
  toggleBrand,
  mobileOpen,
  setMobileOpen,
}: FilterSidebarProps) {
  // Collapsible states
  const [catOpen, setCatOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);
  const [brandOpen, setBrandOpen] = useState(true);

  const SidebarContent = (
    <div className="flex h-full flex-col gap-6 p-5">
      <div className="flex items-center justify-between lg:hidden">
        <h2 className="font-display text-lg font-bold flex items-center gap-2">
          <Filter className="h-4 w-4" /> Filters
        </h2>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-full bg-surface p-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Categories */}
      <div className="border-b border-border pb-6">
        <button
          onClick={() => setCatOpen(!catOpen)}
          className="flex w-full items-center justify-between font-semibold"
        >
          Categories
          <ChevronDown className={`h-4 w-4 transition-transform ${catOpen ? "rotate-180" : ""}`} />
        </button>
        <AnimatePresence>
          {catOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-2">
                {categories.map((c) => (
                  <button
                    key={c}
                    onClick={() => setCat(c)}
                    className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors ${
                      cat === c
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground"
                    }`}
                  >
                    {c}
                    {cat === c && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Price Range */}
      <div className="border-b border-border pb-6">
        <button
          onClick={() => setPriceOpen(!priceOpen)}
          className="flex w-full items-center justify-between font-semibold"
        >
          Price Range
          <ChevronDown
            className={`h-4 w-4 transition-transform ${priceOpen ? "rotate-180" : ""}`}
          />
        </button>
        <AnimatePresence>
          {priceOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-4">
                <input
                  type="range"
                  min="0"
                  max="200000"
                  step="5000"
                  value={priceRange[1]}
                  onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                  className="w-full accent-primary"
                />
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    ₹0
                  </div>
                  <span className="text-muted-foreground">-</span>
                  <div className="flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm">
                    ₹{priceRange[1].toLocaleString()}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Brands */}
      <div>
        <button
          onClick={() => setBrandOpen(!brandOpen)}
          className="flex w-full items-center justify-between font-semibold"
        >
          Brands
          <ChevronDown
            className={`h-4 w-4 transition-transform ${brandOpen ? "rotate-180" : ""}`}
          />
        </button>
        <AnimatePresence>
          {brandOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-3">
                {mockBrands.map((b) => (
                  <label key={b} className="flex items-center gap-3 cursor-pointer group">
                    <div
                      className={`flex h-4 w-4 items-center justify-center rounded border transition-colors ${
                        selectedBrands.includes(b)
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-muted-foreground/40 group-hover:border-foreground"
                      }`}
                    >
                      {selectedBrands.includes(b) && <Check className="h-3 w-3" />}
                    </div>
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={selectedBrands.includes(b)}
                      onChange={() => toggleBrand(b)}
                    />
                    <span className="text-sm text-muted-foreground group-hover:text-foreground">
                      {b}
                    </span>
                  </label>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 rounded-3xl border border-border bg-card self-start sticky top-24 max-h-[calc(100vh-120px)] overflow-y-auto no-scrollbar shadow-sm">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer Backdrop */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 left-0 z-50 w-4/5 max-w-sm border-r border-border bg-card shadow-2xl lg:hidden overflow-y-auto"
          >
            {SidebarContent}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
