import { Skeleton } from "@/components/ui/skeleton";
import {
  CardSkeleton,
  HeaderSkeleton,
  PageSkeleton,
  SplitSkeleton,
} from "@/components/page-skeletons";

// The heaviest page in the app: eight serialized round trips before its
// Promise.all, so this is the fallback that shows the longest.
export default function Loading() {
  return (
    <PageSkeleton>
      <div className="space-y-3 rounded-xl border bg-card p-4">
        <HeaderSkeleton />
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-28" />
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>

      <SplitSkeleton
        left={
          <>
            <CardSkeleton lines={6} />
            <CardSkeleton lines={3} />
          </>
        }
        right={
          <>
            <CardSkeleton lines={4} />
            <CardSkeleton lines={3} />
            <CardSkeleton lines={2} />
          </>
        }
      />
    </PageSkeleton>
  );
}
