import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCompareStore } from "@/store";
import { ArrowLeft, Check, Minus, Star, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { adaptProduct } from "@/lib/data-adapter";
import { useEffect } from "react";

export const Route = createFileRoute("/compare/$id")({
  head: () => ({ meta: [{ title: "Compare Products — PriceLens" }] }),
  component: ComparePage,
});

function ComparePage() {
  const { id } = Route.useParams();
  const { comparisonTray, removeFromComparison, addToComparison } = useCompareStore();
  const navigate = useNavigate();

  const { data: prodData, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const prodRes = await productApi.getById(id);
      if (!prodRes.success) throw new Error("Product not found");
      return adaptProduct(prodRes.product, null);
    },
    enabled: !!id,
  });

  useEffect(() => {
    if (prodData && !comparisonTray.find((p) => p.id === prodData.id)) {
      addToComparison(prodData);
    }
  }, [prodData, comparisonTray, addToComparison]);

  if (isLoading)
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  if (comparisonTray.length === 0) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-20 text-center">
        <h1 className="font-display text-4xl font-bold">Compare Products</h1>
        <p className="mt-4 text-muted-foreground">You haven't selected any products to compare.</p>
        <Button onClick={() => navigate({ to: "/search" })} className="mt-8 rounded-full">
          Browse products
        </Button>
      </div>
    );
  }

  // Get unique spec keys
  const specs = new Set<string>();
  comparisonTray.forEach((p) => {
    if (p.specs) {
      Object.keys(p.specs).forEach((k) => specs.add(k));
    }
  });

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
      <Link
        to="/search"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to search
      </Link>

      <div className="mt-6 flex items-end justify-between">
        <h1 className="font-display text-4xl font-bold">Compare</h1>
        <div className="text-sm text-muted-foreground">{comparisonTray.length} items</div>
      </div>

      <div className="mt-10 overflow-x-auto pb-10">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-4 gap-6">
            {/* Empty first column for labels */}
            <div className="col-span-1"></div>

            {/* Products */}
            {comparisonTray.map((product) => (
              <div key={product.id} className="col-span-1 flex flex-col items-center text-center">
                <button
                  onClick={() => removeFromComparison(product.id)}
                  className="mb-4 text-xs font-semibold text-destructive hover:underline flex items-center gap-1"
                >
                  <Trash2 className="h-3 w-3" /> Remove
                </button>
                <div className="aspect-square w-40 overflow-hidden rounded-2xl bg-surface mb-4">
                  <img
                    src={product.image}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                </div>
                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {product.brand}
                </div>
                <Link
                  to="/product/$id"
                  params={{ id: product.id }}
                  className="mt-2 font-display text-lg font-bold leading-tight hover:underline"
                >
                  {product.title}
                </Link>
                <div className="mt-4 text-3xl font-bold gradient-text">
                  ₹{product.bestPrice.toLocaleString()}
                </div>
                <div className="mt-1 text-sm text-muted-foreground line-through">
                  ₹{product.originalPrice.toLocaleString()}
                </div>
                <div className="mt-4 flex items-center gap-1 font-semibold">
                  <Star className="h-4 w-4 fill-warning text-warning" /> {product.rating}
                </div>
                <a
                  href={product.offers?.[0]?.link || "#"}
                  target="_blank"
                  className="mt-6 w-full rounded-full bg-foreground px-4 py-3 text-sm font-semibold text-background hover:bg-foreground/90 transition-colors"
                >
                  Buy now
                </a>
              </div>
            ))}
          </div>

          <div className="mt-16 border-t border-border">
            <h3 className="py-6 font-display text-xl font-bold">Price Intelligence</h3>
            <div className="grid grid-cols-4 gap-6 border-t border-border py-6">
              <div className="col-span-1 text-sm font-semibold text-muted-foreground">
                ML Recommendation
              </div>
              {comparisonTray.map((p) => (
                <div key={p.id} className="col-span-1 flex justify-center">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                      p.recommendation === "BUY_NOW"
                        ? "bg-success/20 text-success"
                        : "bg-warning/20 text-warning"
                    }`}
                  >
                    {p.recommendation === "BUY_NOW" ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    {p.recommendation === "BUY_NOW" ? "Buy now" : "Wait for drop"}
                  </span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-4 gap-6 border-t border-border py-6 bg-surface/30">
              <div className="col-span-1 text-sm font-semibold text-muted-foreground">
                Confidence
              </div>
              {comparisonTray.map((p) => (
                <div key={p.id} className="col-span-1 text-center font-medium">
                  {p.predictionConfidence ? `${p.predictionConfidence}%` : "N/A"}
                </div>
              ))}
            </div>
          </div>

          {specs.size > 0 && (
            <div className="mt-10 border-t border-border">
              <h3 className="py-6 font-display text-xl font-bold">Specifications</h3>
              {Array.from(specs).map((key, i) => (
                <div
                  key={key}
                  className={`grid grid-cols-4 gap-6 border-t border-border py-4 ${i % 2 === 0 ? "bg-surface/30" : ""}`}
                >
                  <div className="col-span-1 pl-4 text-sm font-semibold text-muted-foreground capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}
                  </div>
                  {comparisonTray.map((p) => (
                    <div key={p.id} className="col-span-1 text-center text-sm">
                      {p.specs?.[key] || "—"}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
