import { createInternalPostHandler } from "@/server/http";
import { ingestDaily } from "@/server/internal-operations";
import { getDatabase } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const POST = createInternalPostHandler(process.env.INTERNAL_JOB_SECRET, () => ingestDaily(getDatabase()));
