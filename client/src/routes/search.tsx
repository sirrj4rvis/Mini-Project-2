import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, SlidersHorizontal, Loader2, Filter, LayoutGrid, List } from "lucide-react";
import { categories } from "@/lib/mock-data";
import { ProductCard } from "@/components/product/ProductCard";
import { useState, useEffect } from "react";
import { adaptProduct } from "@/lib/data-adapter";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { ProductSkeleton } from "@/components/skeletons/ProductSkeleton";
import { FilterSidebar } from "@/components/layout/FilterSidebar";

type SearchParams = { q?: string; cat?: string };

export const Route = createFileRoute("/search")({
  validateSearch: (s: Record<string, unknown>): SearchParams => ({
    q: typeof s.q === "string" ? s.q : "",
    cat: typeof s.cat === "string" ? s.cat : "All",
  }),
  head: () => ({ meta: [{ title: "Compare prices — PriceLens" }] }),
  component: SearchPage,
});

function SearchPage() {
  const { q = "", cat = "All" } = Route.useSearch();
  const navigate = useNavigate();
  const [input, setInput] = useState(q);
  const [sort, setSort] = useState<"relevance" | "price-asc" | "price-desc" | "rating">(
    "relevance",
  );
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 12;

  // Filter States
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 150000]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);

  // Debounced Search
  useEffect(() => {
    const handler = setTimeout(() => {
      if (input !== q) {
        navigate({ to: "/search", search: { q: input, cat }, replace: true });
        setPage(1); // Reset page on new search
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [input, cat, navigate, q]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["search", q],
    queryFn: () => productApi.search({ q }),
    enabled: !!q,
  });

  const results = data?.success ? data.products.map(adaptProduct) : [];

  // Apply Filters
  const filtered = results.filter((p: any) => {
    const matchCat = cat === "All" || p.category === cat;
    const matchPrice = p.bestPrice >= priceRange[0] && p.bestPrice <= priceRange[1];
    const matchBrand =
      selectedBrands.length === 0 ||
      selectedBrands.some((b) => p.brand.toLowerCase().includes(b.toLowerCase()));
    return matchCat && matchPrice && matchBrand;
  });

  // Apply Sorting
  const sorted = [...filtered].sort((a, b) => {
    if (sort === "price-asc") return a.bestPrice - b.bestPrice;
    if (sort === "price-desc") return b.bestPrice - a.bestPrice;
    if (sort === "rating") return b.rating - a.rating;
    return 0;
  });

  const toggleBrand = (b: string) => {
    setSelectedBrands((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
    setPage(1);
  };

  const paginatedResults = sorted.slice(0, page * ITEMS_PER_PAGE);
  const hasMore = paginatedResults.length < sorted.length;

  return (
    <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-10 flex gap-8 relative">
      <FilterSidebar
        cat={cat}
        setCat={(c) => navigate({ to: "/search", search: { q, cat: c } })}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        selectedBrands={selectedBrands}
        toggleBrand={toggleBrand}
        mobileOpen={mobileFilterOpen}
        setMobileOpen={setMobileFilterOpen}
      />

      <div className="flex-1 min-w-0">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/search", search: { q: input, cat } });
          }}
          className="flex items-center rounded-full border border-border bg-card/80 backdrop-blur pl-5 pr-2 py-1.5 max-w-2xl"
        >
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search products..."
            className="flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
          />
          <button className="rounded-full bg-gradient-to-r from-primary to-accent px-5 py-2 text-sm font-semibold text-primary-foreground transition-transform hover:scale-105">
            Search
          </button>
        </form>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Filter className="h-4 w-4" /> Filters
            </button>
            <div className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{sorted.length}</span> results
              {q && (
                <>
                  {" "}
                  for "<span className="text-foreground font-medium">{q}</span>"
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center rounded-lg border border-border bg-surface p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>

            <SlidersHorizontal className="hidden sm:block h-4 w-4 text-muted-foreground" />
            <select
              value={sort}
              onChange={(e) => {
                setSort(e.target.value as typeof sort);
                setPage(1);
              }}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm outline-none focus:border-primary cursor-pointer hover:bg-surface/50 transition-colors"
            >
              <option value="relevance">Relevance</option>
              <option value="price-asc">Price: low to high</option>
              <option value="price-desc">Price: high to low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="mt-20 rounded-3xl border border-destructive/20 bg-destructive/5 p-16 text-center text-destructive">
            <div className="font-display text-2xl font-bold">Oops!</div>
            <p className="mt-2">{error instanceof Error ? error.message : "An error occurred"}</p>
          </div>
        ) : sorted.length === 0 && q ? (
          <div className="mt-20 rounded-3xl border border-border bg-card/50 p-16 text-center">
            <div className="font-display text-2xl font-bold">No matches found</div>
            <p className="mt-2 text-muted-foreground">Try adjusting your filters or keyword.</p>
          </div>
        ) : !q ? (
          <div className="mt-20 rounded-3xl border border-border bg-card/50 p-16 text-center">
            <div className="font-display text-2xl font-bold">Start Searching</div>
            <p className="mt-2 text-muted-foreground">
              Enter a product name to compare prices across stores.
            </p>
          </div>
        ) : (
          <>
            <div
              className={`mt-8 grid gap-5 ${viewMode === "grid" ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1 max-w-4xl"}`}
            >
              {paginatedResults.map((p, i) => (
                <div key={p.id} className={viewMode === "list" ? "flex w-full" : ""}>
                  <ProductCard product={p} index={i} layout={viewMode} />
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-12 flex justify-center">
                <button
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-full border border-border bg-card px-8 py-3 font-semibold text-foreground hover:bg-surface transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
