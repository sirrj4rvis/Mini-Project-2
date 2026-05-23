import { Skeleton } from "@/components/ui/skeleton";

export function ProductSkeleton() {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card p-4 transition-all">
      <div className="relative mb-4 aspect-square w-full overflow-hidden rounded-xl bg-surface/50">
        <Skeleton className="h-full w-full" />
      </div>
      <div className="flex flex-1 flex-col justify-between gap-4">
        <div>
          <div className="flex items-start justify-between gap-2">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-6 w-12 rounded-full" />
          </div>
          <Skeleton className="mt-2 h-4 w-1/3" />
        </div>
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="mb-1 h-6 w-20" />
            <Skeleton className="h-3 w-16" />
          </div>
          <Skeleton className="h-8 w-24 rounded-full" />
        </div>
      </div>
    </div>
  );
}
