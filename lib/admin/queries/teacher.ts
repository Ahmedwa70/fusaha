import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, roles } from "@/database/schema";

export type TeacherListItem = {
  id: string;
  name: string;
  email: string;
  roleName: string;
  creditsBalance: number;
  active: boolean;
  createdAt: Date;
};

export async function getTeachers(): Promise<TeacherListItem[]> {
  const rows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      roleName: roles.name,
      creditsBalance: users.creditsBalance,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .innerJoin(roles, eq(users.roleId, roles.id))
    .where(eq(roles.name, "teacher"))
    .orderBy(users.createdAt);

  return rows;
}
