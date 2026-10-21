import { Badge } from "@/components/ui/badge";

import { PageBody, PageHeader } from "./page";

/** A section that is planned but not built yet: what it will do and when. */
export function ComingSoon({
  title,
  description,
  when,
  points,
}: {
  title: string;
  description: string;
  when: string;
  points: string[];
}) {
  return (
    <PageBody>
      <PageHeader title={title} description={description} />
      <section
        aria-label={`${title}: coming in ${when}`}
        className="grid gap-4 rounded-lg border border-dashed border-border-strong bg-surface p-6 sm:p-8"
      >
        <Badge variant="secondary" className="w-fit">
          Coming in {when}
        </Badge>
        <ul className="grid max-w-prose list-disc gap-2 pl-5 text-base text-muted-foreground marker:text-subtle-foreground">
          {points.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </section>
    </PageBody>
  );
}
