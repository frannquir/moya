import {
  CardSkeleton,
  FigurasSkeleton,
  FilasSkeleton,
  HeaderSkeleton,
  PageSkeleton,
  SplitSkeleton,
} from "@/components/page-skeletons";

export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <FigurasSkeleton />
      <SplitSkeleton
        left={
          <>
            {/* Para reclamar carries the most rows, so it holds the most height. */}
            <FilasSkeleton n={8} />
            <CardSkeleton lines={4} />
          </>
        }
        right={
          <>
            <CardSkeleton lines={2} />
            <FilasSkeleton n={5} />
          </>
        }
      />
    </PageSkeleton>
  );
}
