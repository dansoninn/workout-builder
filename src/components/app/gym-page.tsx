import "server-only";

import { Suspense } from "react";

import { type GymMembership, requireGym } from "@/lib/session";

import { PageSkeleton } from "./page";

type Params = Promise<{ gym: string }>;

async function Guarded({ params, render }: { params: Params; render: (gym: GymMembership) => React.ReactNode }) {
  const { gym } = await params;
  return render(await requireGym(gym));
}

/**
 * A page inside a gym: renders only for members (anyone else gets "not
 * found"), with a skeleton of the page while membership is checked.
 */
export function GymPage({
  params,
  render,
  skeletonRows,
}: {
  params: Params;
  render: (gym: GymMembership) => React.ReactNode;
  skeletonRows?: number;
}) {
  return (
    <Suspense fallback={<PageSkeleton rows={skeletonRows} />}>
      <Guarded params={params} render={render} />
    </Suspense>
  );
}
