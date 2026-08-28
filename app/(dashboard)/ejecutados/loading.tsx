import { Skeleton } from "@/components/ui/skeleton";
import {
  FigurasSkeleton,
  FilasSkeleton,
  HeaderSkeleton,
  PageSkeleton,
} from "@/components/page-skeletons";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HeaderSkeleton />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
      <FigurasSkeleton n={3} />
      <FilasSkeleton n={10} />
    </PageSkeleton>
  );
}
