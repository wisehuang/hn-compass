import { createPublicGetHandler } from "@/server/http";
import { getPublicDigestQueries } from "@/server/runtime";

export const dynamic = "force-dynamic";
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(_: Request, { params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  return createPublicGetHandler(() => datePattern.test(date) ? getPublicDigestQueries().byDate(date) : Promise.resolve(null))();
}
