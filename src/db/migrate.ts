import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createDatabase } from "@/db/client";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required for migrations.");
const database = createDatabase(databaseUrl);
await migrate(database.db, { migrationsFolder: "drizzle" });
await database.close();
