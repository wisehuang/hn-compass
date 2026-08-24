import { DigestReader } from "@/components/digest-reader";
import { getPublicDigestQueries } from "@/server/runtime";

export const dynamic = "force-dynamic";
export default async function DailyPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  const result = await loadDigest(date);
  if (result.error) return <main className="empty-state"><h1>暫時無法載入</h1><p>請稍後再試。</p></main>;
  return result.digest ? <DigestReader digest={result.digest} /> : <main className="empty-state"><h1>找不到這一天的摘要</h1><p>此日期尚未有已保存的日報。</p></main>;
}

async function loadDigest(date: string) { try { return { digest: await getPublicDigestQueries().byDate(date), error: false }; } catch { return { digest: null, error: true }; } }
