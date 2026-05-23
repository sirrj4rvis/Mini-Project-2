import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductSkeleton } from "@/components/skeletons/ProductSkeleton";
import { Flame } from "lucide-react";
import { adaptProduct } from "@/lib/data-adapter";

export const Route = createFileRoute("/trending")({
  head: () => ({ meta: [{ title: "Trending Products — PriceLens" }] }),
  component: TrendingPage,
});

function TrendingPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["trending"],
    queryFn: async () => {
      const res = await productApi.getTrending(12);
      if (!res.success) throw new Error("Failed to load trending products");
      return res.products.map(adaptProduct);
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <Flame className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold">Trending Now</h1>
          <p className="text-sm text-muted-foreground">
            Most searched and highly rated products right now.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <ProductSkeleton key={i} />
          ))}
        </div>
      ) : error ? (
        <div className="mt-10 p-10 text-center text-destructive">
          Failed to load trending products.
        </div>
      ) : (
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {data?.map((p: any, i: number) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
