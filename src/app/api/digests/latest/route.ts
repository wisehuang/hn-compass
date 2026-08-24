import { createPublicGetHandler } from "@/server/http";
import { getPublicDigestQueries } from "@/server/runtime";

export const dynamic = "force-dynamic";
export const GET = createPublicGetHandler(() => getPublicDigestQueries().latest());
