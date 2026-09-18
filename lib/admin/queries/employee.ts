import "server-only";
import { eq, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, roles } from "@/database/schema";

// "teacher" is the self-provisioned learner-side role; "admin" is the
// protected super-admin system role — neither is a manageable "employee".
const NON_EMPLOYEE_ROLES = ["teacher", "admin"];

export type EmployeeListItem = {
  id: string;
  name: string;
  email: string;
  roleId: string;
  roleName: string;
  roleTitle: string;
  active: boolean;
  createdAt: Date;
};

// Staff accounts managed via the Employees UI — any custom staff role
// created via the Roles UI, excluding the "teacher" and "admin" system roles.
export async function getEmployees(): Promise<EmployeeListItem[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleId: users.roleId,
      roleName: roles.name,
      roleTitle: roles.title,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(notInArray(roles.name, NON_EMPLOYEE_ROLES))
    .orderBy(users.createdAt);

  return rows;
}

export type AssignableRole = { id: string; name: string; title: string };

// Roles an employee can be assigned — any custom staff role, excluding the
// "teacher" and "admin" system roles (self-provisioned / super-admin only).
export async function getAssignableRoles(): Promise<AssignableRole[]> {
  const rows = await db
    .select({ id: roles.id, name: roles.name, title: roles.title })
    .from(roles)
    .where(notInArray(roles.name, NON_EMPLOYEE_ROLES))
    .orderBy(roles.title);

  return rows;
}
