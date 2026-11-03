// No-op stand-in for the "server-only" package under plain Node tests. The
// real package throws outside React Server Components; under node:test the
// modules under test ARE server modules, so the guard is a no-op here.
export {};
