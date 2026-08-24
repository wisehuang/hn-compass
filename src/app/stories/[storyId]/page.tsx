import { StoryReader } from "@/components/digest-reader";
import { getPublicDigestQueries } from "@/server/runtime";

export const dynamic = "force-dynamic";
export default async function StoryPage({ params }: { params: Promise<{ storyId: string }> }) {
  const { storyId } = await params;
  const result = await loadStory(storyId);
  if (result.error) return <main className="empty-state"><h1>暫時無法載入</h1><p>請稍後再試。</p></main>;
  return result.story ? <StoryReader story={result.story} /> : <main className="empty-state"><h1>找不到這篇文章</h1><p>它可能尚未被保存，或連結已失效。</p></main>;
}

async function loadStory(storyId: string) { try { return { story: await getPublicDigestQueries().story(storyId), error: false }; } catch { return { story: null, error: true }; } }
