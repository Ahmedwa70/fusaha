// Grants every permission to the admin role. Must run after seedRoles and
// seedPermissions.
export async function seedRolePermissions(sql) {
  const [adminRole] = await sql`SELECT id FROM roles WHERE name = 'admin' LIMIT 1`;
  if (!adminRole) {
    throw new Error("admin role not found after seeding roles");
  }

  const allPermissions = await sql`SELECT id FROM permissions`;
  const grantedPermissions = await sql`
    INSERT INTO role_permissions (role_id, permission_id)
    VALUES ${sql(allPermissions.map((p) => [adminRole.id, p.id]))}
    ON CONFLICT (role_id, permission_id) DO NOTHING
    RETURNING permission_id
  `;
  console.log(
    grantedPermissions.length
      ? `Granted ${grantedPermissions.length} permission(s) to admin role.`
      : "Admin role already has all permissions — nothing to do."
  );
}
