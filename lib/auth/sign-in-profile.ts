// Pure decision logic for turning a Supabase auth identity into a
// public.users profile during sign-in (OAuth callback). Kept free of
// database/alias imports so node:test can exercise every branch without a
// database. The caller owns all side effects (DB reads/writes, redirects).

export type AuthIdentity = {
  id: string;
  email: string | null;
  fullName: string | null;
};

export type ProvisionRejectReason =
  | "missing_email"
  | "teacher_role_missing"
  | "email_registered_to_other_identity";

export type ProfileDecision =
  | {
      action: "provision";
      values: {
        id: string;
        email: string;
        name: string;
        roleId: string;
        creditsBalance: number;
        active: boolean;
      };
    }
  | { action: "reject"; reason: ProvisionRejectReason };

// Decides what should happen for an auth identity that has NO public.users
// row yet. Never links an existing row: an email owned by a different
// identity is rejected, because matching on email alone would let whoever
// controls an OAuth identity take over an existing account.
export function decideNewUserProfile(args: {
  identity: AuthIdentity;
  emailOwnerId: string | null | undefined;
  teacherRoleId: string | null | undefined;
}): ProfileDecision {
  const { identity, emailOwnerId, teacherRoleId } = args;

  if (emailOwnerId && emailOwnerId !== identity.id) {
    return { action: "reject", reason: "email_registered_to_other_identity" };
  }
  if (!identity.email) {
    return { action: "reject", reason: "missing_email" };
  }
  if (!teacherRoleId) {
    return { action: "reject", reason: "teacher_role_missing" };
  }
  return {
    action: "provision",
    values: {
      id: identity.id,
      email: identity.email,
      name: identity.fullName ?? identity.email,
      roleId: teacherRoleId,
      creditsBalance: 0,
      active: true,
    },
  };
}
