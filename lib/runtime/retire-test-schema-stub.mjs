// Redirected target for "@/database/schema" in retire-independence tests:
// the alias-free binding-test re-exports plus creditsLedgerEntries, which
// actions/generation.ts imports at runtime (createLesson's credit ledger).
export * from "./runtime-binding-schema-stub.mjs";
export { creditsLedgerEntries } from "../../database/schema/credits-ledger-entries.ts";
