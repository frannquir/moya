import { FigurasSkeleton, FilasSkeleton, HeaderSkeleton, PageSkeleton } from "@/components/page-skeletons";

export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <FigurasSkeleton n={3} />
      <FilasSkeleton n={9} />
    </PageSkeleton>
  );
}
