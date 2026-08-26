import { createDatabase } from "@/db/client";
import { runDailyIngestion } from "@/server/ingestion/daily";
import { readSummaryEnv } from "@/server/summary-config";

function taipeiDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const rssUrl = process.env.RSS_URL;
  if (!databaseUrl || !rssUrl) throw new Error("DATABASE_URL and RSS_URL are required.");
  const database = createDatabase(databaseUrl);
  try { return await runDailyIngestion(database.db, { digestDate: taipeiDate(), rssUrl, ...readSummaryEnv() }); }
  finally { await database.close(); }
}

void main()
  .then((result) => {
    console.info(JSON.stringify({ event: "daily_ingestion_completed", status: result.status, metrics: result.metrics }));
  })
  .catch(() => {
    console.error(JSON.stringify({ event: "daily_ingestion_failed", message: "Daily ingestion failed. Check protected server logs and configuration." }));
    process.exitCode = 1;
  });
