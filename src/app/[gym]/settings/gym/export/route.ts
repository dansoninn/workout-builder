import { gymExport } from "@/lib/export/gym-export";
import { can } from "@/lib/permissions";
import { getGym } from "@/lib/session";

/** The gym's data as a zip file (PLAN-step-6 6c). Owners only; anyone else gets "not found", as for another gym's pages. */
export async function GET(_request: Request, { params }: RouteContext<"/[gym]/settings/gym/export">) {
  const { gym: slug } = await params;
  const gym = await getGym(slug);
  if (!gym || !can.editGym(gym.role)) return new Response("Not found", { status: 404 });

  const now = new Date();
  const zip = await gymExport(gym, now);
  return new Response(new Blob([zip as BlobPart], { type: "application/zip" }), {
    headers: {
      "Content-Disposition": `attachment; filename="${gym.slug}-data-${now.toISOString().slice(0, 10)}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
