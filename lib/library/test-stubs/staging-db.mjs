import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { libraryBooks } from "../../../database/schema/library-books.ts";

// Lazily-connected real db for staging integration tests: connects only when
// the module under test first touches the proxy, after the test file has set
// process.env.DATABASE_URL from the validated staging configuration.

let dbInstance;
let clientInstance;
const getDb = () => {
  if (!dbInstance) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    clientInstance = postgres(connectionString, { prepare: false });
    dbInstance = drizzle(clientInstance, { schema: { libraryBooks } });
  }
  return dbInstance;
};

// Test teardown helper: closes the lazily-opened connection so the test
// process can exit.
export async function closeStagingDb() {
  dbInstance = undefined;
  if (clientInstance) {
    const client = clientInstance;
    clientInstance = undefined;
    await client.end();
  }
}

export const db = new Proxy({}, {
  get(_target, property, receiver) {
    return Reflect.get(getDb(), property, receiver);
  },
});
