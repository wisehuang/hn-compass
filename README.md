# HN Compass

以繁體中文呈現、由已保存資料驅動的每日 Hacker News 精選。讀者頁面和公開 API 只讀取 PostgreSQL 快照；RSS、文章、HN 留言與 OpenAI 僅會在 ingestion 執行時存取。

## 本機啟動

先安裝 Node.js 20.9 以上、pnpm 10 與可連線的 PostgreSQL 16 以上，再執行：

```bash
pnpm install
cp .env.example .env.local
# 編輯 .env.local，填入 DATABASE_URL、RSS_URL、KAGI_API_KEY、KAGI_SUMMARIZER_ENGINE、OPENAI_API_KEY、OPENAI_MODEL
set -a; source .env.local; set +a
pnpm db:migrate
pnpm dev
```

開啟 `http://localhost:3000`。新資料庫尚沒有 digest 是正常的；執行一次 `pnpm ingest:daily` 取得並保存當日資料。完整摘要需要六個變數：`DATABASE_URL`、`RSS_URL`、`KAGI_API_KEY`、`KAGI_SUMMARIZER_ENGINE`、`OPENAI_API_KEY`、`OPENAI_MODEL`。Kagi 只產生文章摘要；OpenAI 只產生具 HN 留言證據的討論摘要。本機開發不需要 `INTERNAL_JOB_SECRET`，除非要呼叫 `/api/internal/*` 路由。

在另一個 shell 先載入同一份環境變數再執行 ingestion：

```bash
set -a; source .env.local; set +a
pnpm ingest:daily
```

詳細設定、測試與 Railway 上線程序請見 [docs/operations.md](docs/operations.md)。

## Quality gates

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

資料庫 integration test 只會在設定 `TEST_DATABASE_URL` 時執行。E2E 使用不連線外部服務的受控 persisted-data fixture。
