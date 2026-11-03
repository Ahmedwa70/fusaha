// Phase 4 controlled-cutover feature flag (TEMPLATE_RUNTIME_IMPLEMENTATION_PLAN
// "Temporary feature flag or resolver switch for rollback").
//
// OFF by default: every render path behaves exactly as before Phase 4 — the
// legacy template join supplies the player HTML, runtime bindings (if any) are
// never consulted, and no runtime storage is read.
//
// Rollback is instantaneous and data-preserving: disabling the flag returns
// all render paths to the legacy behavior WITHOUT a reverse migration, and it
// never alters stored runtime bindings — bound rows stay bound and resume
// resolving through the runtime the moment the flag is re-enabled.
//
// Server-only environments: the flag is read by server components and route
// handlers (the play queries), never shipped to the client.

export const RUNTIME_RESOLVER_CUTOVER_ENV = "RUNTIME_RESOLVER_CUTOVER_ENABLED";

export function isRuntimeResolverCutoverEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env[RUNTIME_RESOLVER_CUTOVER_ENV];
  return value === "1" || value === "true";
}
