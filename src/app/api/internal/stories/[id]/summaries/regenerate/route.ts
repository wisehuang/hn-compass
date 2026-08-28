import { createInternalPostHandler, isUuid } from "@/server/http";
import { regenerateStorySummaries } from "@/server/internal-operations";
import { getDatabase } from "@/server/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const work = () => isUuid(id)
    ? regenerateStorySummaries(getDatabase(), id)
    : Promise.resolve({ regenerated: false, reason: "not_found" });
  return createInternalPostHandler(process.env.INTERNAL_JOB_SECRET, work)(request);
}
