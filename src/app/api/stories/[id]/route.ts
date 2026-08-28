import { createPublicGetHandler, isUuid } from "@/server/http";
import { getPublicDigestQueries } from "@/server/runtime";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createPublicGetHandler(() => isUuid(id) ? getPublicDigestQueries().story(id) : Promise.resolve(null))();
}
