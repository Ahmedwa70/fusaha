// name = slug, title = display name shown in the admin panel, isSystem =
// protected from edit/delete in the Roles UI (see actions/roles.ts).
const ROLES = [
  { name: "teacher", title: "معلّم", isSystem: true },
  { name: "admin", title: "مدير النظام", isSystem: true },
];

export async function seedRoles(sql) {
  const insertedRoles = await sql`
    INSERT INTO roles (name, title, is_system)
    VALUES ${sql(ROLES.map((r) => [r.name, r.title, r.isSystem]))}
    ON CONFLICT (name) DO UPDATE SET title = excluded.title, is_system = excluded.is_system
    RETURNING name
  `;
  console.log(`Upserted roles: ${insertedRoles.map((r) => r.name).join(", ")}`);
}
