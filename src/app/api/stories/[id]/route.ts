import { createPublicGetHandler } from "@/server/http";
import { getPublicDigestQueries } from "@/server/runtime";

export const dynamic = "force-dynamic";
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return createPublicGetHandler(() => uuidPattern.test(id) ? getPublicDigestQueries().story(id) : Promise.resolve(null))();
}
