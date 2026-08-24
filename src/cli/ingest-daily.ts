import { createDatabase } from "@/db/client";
import { runDailyIngestion } from "@/server/ingestion/daily";

function taipeiDate() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  const rssUrl = process.env.RSS_URL;
  const openAiApiKey = process.env.OPENAI_API_KEY;
  const openAiModel = process.env.OPENAI_MODEL;
  if (!databaseUrl || !rssUrl || !openAiApiKey || !openAiModel) throw new Error("DATABASE_URL, RSS_URL, OPENAI_API_KEY, and OPENAI_MODEL are required.");
  const database = createDatabase(databaseUrl);
  try { return await runDailyIngestion(database.db, { digestDate: taipeiDate(), rssUrl, openAiApiKey, openAiModel }); }
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
