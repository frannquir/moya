import { Skeleton } from "@/components/ui/skeleton";
import { CardSkeleton, PageSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <PageSkeleton>
      <Skeleton className="h-7 w-48" />
      {/* The tab strip, so the tabs do not jump when they mount. */}
      <div className="flex gap-1.5">
        {[88, 104, 72, 116].map((w) => (
          <Skeleton key={w} className="h-9" style={{ width: w }} />
        ))}
      </div>
      <CardSkeleton lines={6} />
    </PageSkeleton>
  );
}
