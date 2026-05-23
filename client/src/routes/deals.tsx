import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { productApi } from "@/api/productApi";
import { adaptProduct } from "@/lib/data-adapter";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductSkeleton } from "@/components/skeletons/ProductSkeleton";
import { Tag } from "lucide-react";

export const Route = createFileRoute("/deals")({
  head: () => ({ meta: [{ title: "Best Deals — PriceLens" }] }),
  component: DealsPage,
});

function DealsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const res = await productApi.getTrending(20);
      if (!res.success) throw new Error("Failed to load deals");

      const mapped = res.products.map(adaptProduct);
      return mapped.sort((a: any, b: any) => {
        const discountA =
          a.originalPrice > a.bestPrice ? (a.originalPrice - a.bestPrice) / a.originalPrice : 0;
        const discountB =
          b.originalPrice > b.bestPrice ? (b.originalPrice - b.bestPrice) / b.originalPrice : 0;
        return discountB - discountA;
      });
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success/10 text-success">
          <Tag className="h-6 w-6" />
        </div>
        <div>
          <h1 className="font-display text-4xl font-bold">Best Deals</h1>
          <p className="text-sm text-muted-foreground">
            Biggest price drops and highest discounts available today.
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
        <div className="mt-10 p-10 text-center text-destructive">Failed to load deals.</div>
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
