import { register } from "node:module";
import { mock, after, describe, test } from "node:test";
import assert from "node:assert/strict";

register(new URL("./index.test-hooks.mjs", import.meta.url).href);

const postgresCalls: string[] = [];
const drizzleCalls: object[] = [];
const transactionCalls: object[] = [];
const fakeDb = {
  select: () => "select-result",
  transaction: async (callback: (tx: object) => unknown) => {
    transactionCalls.push(fakeDb);
    return callback(fakeDb);
  },
};

mock.module("postgres", {
  defaultExport: (url: string) => {
    postgresCalls.push(url);
    return { end: async () => undefined };
  },
});
mock.module("drizzle-orm/postgres-js", {
  namedExports: {
    drizzle: (client: object) => {
      drizzleCalls.push(client);
      return fakeDb;
    },
  },
});

const originalDatabaseUrl = process.env.DATABASE_URL;
process.env.DATABASE_URL = "postgres://test-only.invalid/db";
const { db } = await import("./index" + ".ts");
const testDb = db as unknown as {
  select: () => string;
  transaction: (callback: (tx: object) => unknown) => Promise<unknown>;
};

after(() => {
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
});

describe("lazy database initialization", () => {
  test("module import does not create a postgres client", () => {
    assert.equal(postgresCalls.length, 0);
    assert.equal(drizzleCalls.length, 0);
  });

  test("first db.select initializes once and later access reuses it", () => {
    assert.equal(testDb.select(), "select-result");
    assert.equal(testDb.select(), "select-result");
    assert.equal(postgresCalls.length, 1);
    assert.equal(drizzleCalls.length, 1);
  });

  test("transaction is forwarded to the original drizzle client", async () => {
    const result = await testDb.transaction((tx: object) => tx);
    assert.equal(result, fakeDb);
    assert.deepEqual(transactionCalls, [fakeDb]);
    assert.equal(postgresCalls.length, 1);
  });

  test("missing DATABASE_URL fails at first use without exposing a value", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    try {
      const isolated = await import("./index" + ".ts?missing-database-url");
      const isolatedDb = isolated.db as unknown as { select: () => unknown };
      assert.throws(() => isolatedDb.select(), /DATABASE_URL is not set/);
    } finally {
      process.env.DATABASE_URL = previous;
    }
  });
});
