// Test double for "@/lib/db". The binding service takes a drizzle instance
// as a factory argument; tests inject a real one pointed at a disposable
// database, so this default is never used in tests.
export const db = null;
