// Single source of truth for permission keys. Plain JS (no TS syntax) so it
// can be imported directly by database/seed.mjs (runs via plain `node`, no
// TS build) as well as by constants/permissions.ts, which re-exports it with
// app-facing types.
export const Permissions = /** @type {const} */ ({
  usersList: "users.list",
  usersCreate: "users.create",
  usersUpdate: "users.update",
  usersDelete: "users.delete",
  employeesList: "employees.list",
  employeesCreate: "employees.create",
  employeesUpdate: "employees.update",
  employeesDelete: "employees.delete",
  rolesList: "roles.list",
  rolesCreate: "roles.create",
  rolesUpdate: "roles.update",
  rolesDelete: "roles.delete",
  lessonsList: "lessons.list",
  lessonsRestore: "lessons.restore",
  lessonsDelete: "lessons.delete",
  creditPackagesList: "credit-packages.list",
  creditPackagesCreate: "credit-packages.create",
  creditPackagesUpdate: "credit-packages.update",
  creditPackagesDelete: "credit-packages.delete",
  auditLogsList: "audit-logs.list",
  generationEventsList: "generation-events.list",
  templatesList: "templates.list",
  templatesCreate: "templates.create",
  templatesUpdate: "templates.update",
  templatesDelete: "templates.delete",
  schemaList: "schema.list",
  schemaCreate: "schema.create",
  schemaDelete: "schema.delete",
  settingsList: "settings.list",
  settingsUpdate: "settings.update",
});

export const PERMISSIONS = Object.values(Permissions);

export async function seedPermissions(sql) {
  const insertedPermissions = await sql`
    INSERT INTO permissions (key)
    VALUES ${sql(PERMISSIONS.map((key) => [key]))}
    ON CONFLICT (key) DO NOTHING
    RETURNING key
  `;
  console.log(
    insertedPermissions.length
      ? `Inserted permissions: ${insertedPermissions.map((p) => p.key).join(", ")}`
      : "Permissions already present — nothing to do."
  );

  // Drops permissions removed from `Permissions` above (e.g. from a deleted
  // feature). Cascades to role_permissions so no role keeps a dangling key.
  const prunedPermissions = await sql`
    DELETE FROM permissions
    WHERE key NOT IN ${sql(PERMISSIONS)}
    RETURNING key
  `;
  if (prunedPermissions.length) {
    console.log(`Pruned stale permissions: ${prunedPermissions.map((p) => p.key).join(", ")}`);
  }
}
