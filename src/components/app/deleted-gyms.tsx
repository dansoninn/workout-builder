import { createClient } from "@/lib/supabase/server";
import { dayLabel } from "@/lib/week";

import { RestoreGymButton } from "./restore-gym-button";

/**
 * The gyms this person deleted and owns, with "Bring back" until they are
 * erased for good, 30 days after deletion (PLAN-step-6 6c). Nothing when
 * there are none.
 */
export async function DeletedGyms({ className }: { className?: string }) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_deleted_gyms");
  if (error) throw error;
  if (data.length === 0) return null;
  return (
    <section aria-labelledby="deleted-gyms" className={className}>
      <h2 id="deleted-gyms" className="text-lg font-semibold">
        Gyms you deleted
      </h2>
      <p className="text-sm text-muted-foreground">Hidden from everyone. Bring one back, as it was, until it is erased for good.</p>
      <ul className="mt-3 grid gap-2">
        {data.map((g) => (
          <li key={g.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2">
            <span className="grid">
              <span className="font-medium">{g.name}</span>
              <span className="text-xs text-muted-foreground">Erased for good on {dayLabel(g.erased_after.slice(0, 10))}</span>
            </span>
            <RestoreGymButton gymId={g.id} name={g.name} />
          </li>
        ))}
      </ul>
    </section>
  );
}
