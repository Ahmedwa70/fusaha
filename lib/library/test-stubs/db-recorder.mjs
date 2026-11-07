// Records every query issued through the db proxy so tests can assert on the
// exact WHERE conditions the public catalog issues against library_books.
export const selectCalls = [];

function recorder(fields) {
  const call = { fields, where: undefined, orderBy: undefined, limit: undefined };
  selectCalls.push(call);
  return {
    from: (table) => ({
      where: (condition) => {
        call.where = condition;
        return {
          orderBy: (orderBy) => {
            call.orderBy = orderBy;
            return [];
          },
          limit: (limit) => {
            call.limit = limit;
            return [];
          },
        };
      },
    }),
  };
}

export const db = { select: (fields) => recorder(fields) };

export function resetSelectCalls() {
  selectCalls.length = 0;
}

// Flattens a Drizzle SQL node tree into { columns: string[], params: any[] }.
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
