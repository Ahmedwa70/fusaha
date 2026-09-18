import { Permissions } from "@/database/seeder/permissions.mjs";

// Keys live in database/seeder/permissions.mjs (the single source of truth,
// kept as plain JS since database/seed.mjs runs under plain `node` with no
// TS build). This module re-exports it with the app-facing types.
export { Permissions };

export type PermissionKey = (typeof Permissions)[keyof typeof Permissions];

export const ALL_PERMISSIONS: PermissionKey[] = Object.values(Permissions);

// Maps a permission key (e.g. "users.list") back to its constant name (e.g.
// "usersList") — used to look up the matching `admin.permissions.<name>`
// translation for a checkbox label.
export const PERMISSION_TRANSLATION_KEYS: Record<string, string> = Object.fromEntries(
  Object.entries(Permissions).map(([name, key]) => [key, name])
);
