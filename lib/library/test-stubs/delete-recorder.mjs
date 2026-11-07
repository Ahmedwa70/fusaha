// Records DELETE ... WHERE conditions issued through the db proxy so tests
// can assert the exact scoping of destructive queries.
export const deleteCalls = [];

export const db = {
  delete: (table) => ({
    where: (condition) => {
      deleteCalls.push({ table, condition });
      return {
        returning: async () => [{ id: "deleted-grant" }],
      };
    },
  }),
};

export function resetDeleteCalls() {
  deleteCalls.length = 0;
}

// Flatten a Drizzle SQL node tree into { columns: string[], params: any[] }.
export function flattenSql(node) {
  const columns = [];
  const params = [];
  const walk = (chunk) => {
    if (chunk == null) return;
    if (Array.isArray(chunk)) return chunk.forEach(walk);
    if (typeof chunk === "string") return;
    if (chunk.constructor?.name === "SQL") return walk(chunk.queryChunks);
    if (typeof chunk.name === "string" && chunk.table) return columns.push(chunk.name);
    if (chunk.constructor?.name === "Param") return params.push(chunk.value);
    walk(chunk.queryChunks);
  };
  walk(node?.queryChunks ?? node);
  return { columns, params };
}
