# Architecture

```text
Railway Cron ──npm run ingest:daily──> PostgreSQL <── Next.js Web
       │                                      ▲             │
       ├── RSS / article / HN Firebase         │             └── public pages and read APIs
       └── OpenAI Responses ───────────────────┘
```

PostgreSQL 是唯一的 reader read model，包含 digests、stories、comments、summaries 與 ingestion_runs。Web service 不呼叫 RSS、HN、文章網站或 OpenAI；這些不可信任輸入只在短生命週期的 Cron ingestion 中經過 URL 檢查、大小／逾時限制、淨化與驗證。

容器使用 `Dockerfile` 建置，預設命令為 `npm run start`。同一 image 同時攜帶 Next runtime、ingestion TypeScript source 與 Drizzle migrations，因此 Railway Cron 可以覆寫命令為 `npm run ingest:daily`，migration 也可覆寫為 `npm run db:migrate`。`PORT` 由 Next.js 讀取，`HOSTNAME=0.0.0.0` 已在 image 設定。

沒有獨立後端、公開資料庫或常駐 worker。長期 Railway 拓樸僅有 private PostgreSQL、public Web、short-lived Cron 三個 service。
