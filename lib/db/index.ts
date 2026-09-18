import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/database/schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// Transaction-mode pooler (Supabase) does not support prepared statements.
const client = postgres(connectionString, { prepare: false });

export const db = drizzle(client, { schema });
