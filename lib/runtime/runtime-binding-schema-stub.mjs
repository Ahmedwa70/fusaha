// Redirected target for "@/database/schema" in binding tests: the real table
// modules, minus the alias-importing barrel members the service never needs.
export * from "../../database/schema/enums.ts";
export { lessons } from "../../database/schema/lessons.ts";
export { lessonVersions } from "../../database/schema/lesson-versions.ts";
export { runtimeVersions } from "../../database/schema/runtime-versions.ts";
export { runtimePublicationAttempts } from "../../database/schema/runtime-publication-attempts.ts";
export { runtimeAssets } from "../../database/schema/runtime-assets.ts";
export { runtimeStorageObjects } from "../../database/schema/runtime-storage-objects.ts";
export { runtimeStorageLocations } from "../../database/schema/runtime-storage-locations.ts";
export { auditLogs } from "../../database/schema/audit-logs.ts";
export { users } from "../../database/schema/users.ts";
export { roles } from "../../database/schema/roles.ts";
export { folders } from "../../database/schema/folders.ts";
export { shareLinks } from "../../database/schema/share-links.ts";
export { templates } from "../../database/schema/templates.ts";
export { schemaDefinitions } from "./schema-definitions-stub.mjs";
