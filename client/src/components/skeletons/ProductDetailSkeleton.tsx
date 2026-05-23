import { Skeleton } from "@/components/ui/skeleton";

export function ProductDetailSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 md:px-8 py-10">
      <Skeleton className="mb-6 h-4 w-48" />

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        {/* Image skeleton */}
        <Skeleton className="aspect-square w-full rounded-3xl" />

        {/* Info skeleton */}
        <div>
          <Skeleton className="h-4 w-32 uppercase" />
          <Skeleton className="mt-2 h-12 w-full max-w-lg" />
          <Skeleton className="mt-2 h-12 w-3/4 max-w-md" />

          <div className="mt-4 flex items-center gap-3">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>

          <div className="mt-8 rounded-3xl border border-border bg-card p-6">
            <div className="flex items-end gap-3">
              <Skeleton className="h-12 w-40" />
              <Skeleton className="h-6 w-24" />
            </div>
            <Skeleton className="mt-1 h-4 w-32" />

            <Skeleton className="mt-6 h-24 w-full rounded-2xl" />
            <Skeleton className="mt-5 h-12 w-full rounded-full" />
          </div>
        </div>
      </div>

      {/* Compare table skeleton */}
      <div className="mt-16">
        <Skeleton className="h-8 w-64 mb-5" />
        <div className="rounded-3xl border border-border bg-card">
          <Skeleton className="h-12 w-full rounded-t-3xl border-b" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex h-20 items-center justify-between border-b px-6">
              <Skeleton className="h-8 w-1/4" />
              <Skeleton className="h-8 w-1/6" />
              <Skeleton className="h-8 w-1/6" />
              <Skeleton className="h-8 w-1/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
