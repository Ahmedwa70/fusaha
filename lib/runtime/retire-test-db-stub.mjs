// Injectable db stand-in for retire-independence tests (same idea as
// runtime-binding-db-stub.mjs, but mutable). The actions under test import
// the exported `db` binding; the test injects its real drizzle instance via
// setInjectedDb() before calling any action.
let injected = null;

export function setInjectedDb(instance) {
  injected = instance;
}

export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      if (injected === null) {
        throw new Error("retire tests: injected db not set — call setInjectedDb() first");
      }
      const value = injected[prop];
      return typeof value === "function" ? value.bind(injected) : value;
    },
  },
);
