import type { Metadata } from "next";
import { connection } from "next/server";

import { GymPage } from "@/components/app/gym-page";
import { SectionSkeleton } from "@/components/app/settings";
import { HOLIDAY_COUNTRIES } from "@/lib/calendar/holidays";
import { can } from "@/lib/permissions";
import type { GymMembership } from "@/lib/session";
import { createClient } from "@/lib/supabase/server";

import { DaysManager } from "./days-manager";

export const metadata: Metadata = { title: "Days" };

export default function DaysPage({ params, searchParams }: PageProps<"/[gym]/settings/days">) {
  return <GymPage params={params} fallback={<SectionSkeleton rows={4} />} render={(gym) => <Days gym={gym} searchParams={searchParams} />} />;
}

/** The gym's day focuses, and its holidays and closed days for a year (?year=). */
async function Days({ gym, searchParams }: { gym: GymMembership; searchParams: PageProps<"/[gym]/settings/days">["searchParams"] }) {
  await connection();
  const query = await searchParams;
  const thisYear = new Date().getUTCFullYear();
  const asked = typeof query.year === "string" ? Number(query.year) : NaN;
  const year = Number.isInteger(asked) && asked >= 2000 && asked <= 2100 ? asked : thisYear;

  const supabase = await createClient();
  const [focuses, days] = await Promise.all([
    supabase.from("day_focuses").select("id, name, color, archived_at").eq("org_id", gym.id).order("position").order("name"),
    supabase.from("calendar_days").select("id, date, name, closed, holiday_of").eq("org_id", gym.id).gte("date", `${year}-01-01`).lte("date", `${year}-12-31`).order("date"),
  ]);
  if (focuses.error) throw focuses.error;
  if (days.error) throw days.error;

  // The gym's own country first; any country with a preset can be added.
  const countries = Object.entries(HOLIDAY_COUNTRIES)
    .map(([code, c]) => ({ code, label: c.label, holidays: c.holidays(year).length }))
    .sort((a, b) => Number(b.code === gym.country) - Number(a.code === gym.country));

  return (
    <DaysManager
      slug={gym.slug}
      canManage={can.manageTracks(gym.role)}
      year={year}
      focuses={focuses.data.map((f) => ({ id: f.id, name: f.name, color: f.color, archived: f.archived_at !== null }))}
      days={days.data.map((d) => ({ id: d.id, date: d.date, name: d.name, closed: d.closed, holidayOf: d.holiday_of }))}
      countries={countries.map((c) => ({
        ...c,
        added: days.data.filter((d) => d.holiday_of === c.code).length,
      }))}
    />
  );
}
