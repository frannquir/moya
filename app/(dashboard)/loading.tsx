import {
  CardSkeleton,
  FilasSkeleton,
  HeaderSkeleton,
  PageSkeleton,
} from "@/components/page-skeletons";

/**
 * The fallback for dashboard routes with no skeleton of their own. The pages
 * that carry the most I/O — /ejecutados/[id], /estadisticas, /ejecutados, /mail,
 * /cobros, /estudio — have their own, shaped like the layout they settle into.
 *
 * Generic on purpose: the routes left here are lists and forms, so a header over
 * rows is closer to all of them than any single layout would be.
 */
export default function Loading() {
  return (
    <PageSkeleton>
      <HeaderSkeleton />
      <CardSkeleton lines={3} />
      <FilasSkeleton n={6} />
    </PageSkeleton>
  );
}
