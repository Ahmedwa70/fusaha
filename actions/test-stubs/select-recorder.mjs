// Recording SELECT stub: every chain method records its argument and the
// chain is awaitable (resolves to []). Mutations are hard failures — the
// dashboard actions must never write.
export const selectCalls = [];

function chainable(call) {
  const target = {};
  for (const method of ["where", "orderBy", "groupBy", "limit", "offset", "innerJoin"]) {
    target[method] = (arg) => {
      call[method] = arg ?? null;
      return target;
    };
  }
  target.then = (resolve) => resolve([]);
  return target;
}

export const db = {
  select: (fields) => {
    const call = { fields };
    selectCalls.push(call);
    return {
      from: (table) => {
        call.table = table;
        return chainable(call);
      },
    };
  },
  insert: () => {
    throw new Error("unexpected INSERT in dashboard test");
  },
  update: () => {
    throw new Error("unexpected UPDATE in dashboard test");
  },
  delete: () => {
    throw new Error("unexpected DELETE in dashboard test");
  },
};

export function resetSelectCalls() {
  selectCalls.length = 0;
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
