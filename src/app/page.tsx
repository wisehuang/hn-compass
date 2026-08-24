import { DigestReader } from "@/components/digest-reader";
import { getPublicDigestQueries } from "@/server/runtime";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const result = await loadLatest();
  if (result.error) return <main className="empty-state"><h1>HN Compass</h1><p role="alert">目前無法載入摘要，請稍後再試。</p></main>;
  return result.digest ? <DigestReader digest={result.digest} /> : <main className="empty-state"><h1>HN Compass</h1><p role="status">目前尚無已發布的每日摘要。</p></main>;
}

async function loadLatest() {
  try {
    return { digest: await getPublicDigestQueries().latest(), error: false };
  } catch { return { digest: null, error: true }; }
}
