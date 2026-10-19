import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/database/schema";

const createDb = () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }

  // Transaction-mode pooler (Supabase) does not support prepared statements.
  const client = postgres(connectionString, { prepare: false });
  return drizzle(client, { schema });
};

type Database = ReturnType<typeof createDb>;
let dbInstance: Database | undefined;

const getDb = (): Database => {
  dbInstance ??= createDb();
  return dbInstance;
};

// Keep the existing `db.select(...)` API while avoiding connection setup during
// module evaluation, which can happen while Next.js collects route data.
export const db = new Proxy({} as Database, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
