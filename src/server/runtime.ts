import { createDatabase } from "@/db/client";
import { createE2EFixtureQueries } from "@/server/e2e-fixture";
import { createPublicDigestQueries } from "@/server/queries/public-digest";

let database: ReturnType<typeof createDatabase> | undefined;

export function getDatabase() {
  if (database) return database.db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required.");
  database = createDatabase(url);
  return database.db;
}

export function getPublicDigestQueries() {
  if (process.env.E2E_FIXTURE === "1") return createE2EFixtureQueries();
  return createPublicDigestQueries(getDatabase());
}
