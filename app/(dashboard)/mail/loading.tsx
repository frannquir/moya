import { Skeleton } from "@/components/ui/skeleton";
import { FilasSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <PageSkeleton>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HeaderSkeleton />
        <Skeleton className="h-9 w-36" />
      </div>
      <FilasSkeleton n={10} />
    </PageSkeleton>
  );
}
