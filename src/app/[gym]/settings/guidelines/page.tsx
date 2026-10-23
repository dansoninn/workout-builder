import type { Metadata } from "next";
import Link from "next/link";

import { GymPage } from "@/components/app/gym-page";
import { SectionSkeleton } from "@/components/app/settings";
import { parseGuidelines, readGuidelines } from "@/lib/analytics/guidelines";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

import { programParam } from "../../builder/load";
import { GuidelinesForm } from "./guidelines-form";

export const metadata: Metadata = { title: "Guidelines" };

export default function GuidelinesPage({ params, searchParams }: PageProps<"/[gym]/settings/guidelines">) {
  return (
    <GymPage params={params} fallback={<SectionSkeleton rows={6} />} render={(gym) => <Guidelines gym={gym} searchParams={searchParams} />} />
  );
}

/** The gym's guidelines (every program's default), and each program's own when it has them (decision 5, 2026-10-23). */
async function Guidelines({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/settings/guidelines">["searchParams"] }) {
  const query = await searchParams;
  const supabase = await createClient();
  const [org, programs] = await Promise.all([
    supabase.from("organizations").select("settings").eq("id", gym.id).single(),
    supabase.from("tracks").select("id, name, color, archived_at, guidelines").eq("org_id", gym.id).order("position").order("name"),
  ]);
  if (org.error) throw org.error;
  if (programs.error) throw programs.error;

  const gymGuidelines = readGuidelines(org.data.settings);
  const asked = programParam(query);
  const program = programs.data.find((p) => p.id === asked) ?? null;
  const own = program ? parseGuidelines(program.guidelines) : null;
  const tabs = programs.data.filter((p) => p.archived_at === null || p.id === program?.id);
  const href = `/${gym.slug}/settings/guidelines`;

  return (
    <div className="grid grid-cols-1 gap-6">
      <nav aria-label="Guidelines for" className="flex flex-wrap gap-1">
        <Tab href={href} current={!program}>
          Gym defaults
        </Tab>
        {tabs.map((p) => (
          <Tab key={p.id} href={`${href}?program=${p.id}`} current={p.id === program?.id}>
            <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: p.color ?? "var(--border-strong)" }} />
            {p.name}
            <span className="text-xs font-normal text-muted-foreground">{p.guidelines === null ? "gym's" : "own"}</span>
          </Tab>
        ))}
      </nav>
      <GuidelinesForm
        key={program?.id ?? "gym"}
        slug={gym.slug}
        program={program ? { id: program.id, name: program.name, own: own !== null } : null}
        initial={own ?? gymGuidelines}
        gymGuidelines={gymGuidelines}
        canEdit={program ? can.manageTracks(gym.role) : can.editGym(gym.role)}
      />
    </div>
  );
}

function Tab({ href, current, children }: { href: string; current: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md border border-border px-3 text-sm text-muted-foreground transition-colors duration-100 hover:bg-hover hover:text-foreground",
        current && "border-border-strong bg-hover font-medium text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
