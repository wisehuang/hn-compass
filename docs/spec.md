# Product specification

HN Compass 將 Daemonology HN Daily RSS 轉成每日繁體中文閱讀頁。每篇故事保留原文與 HN 討論連結，並分別呈現文章洞見和社群討論洞見。

## Acceptance criteria

- 公開頁面、公開 API 與 RSC 僅讀取已保存的 PostgreSQL projection。
- ingestion 對不安全或無法擷取的文章保留來源連結，卻不杜撰文章摘要。
- OpenAI 輸出必須經過結構化驗證，且討論摘要引用的留言 ID 必須已保存。
- 每日 ingestion 可重跑且不重複建立同一日期的 snapshot；個別故事失敗不可抹除其他故事。
- 受保護的操作路由須使用 `INTERNAL_JOB_SECRET`，公開錯誤不得含有診斷或機密。
- Railway Cron 每日 01:00 UTC（Asia/Taipei 09:00）執行一次後退出。
