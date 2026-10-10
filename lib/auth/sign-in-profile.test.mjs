// Unit tests for the pure provisioning decision logic — no database needed.
// Run with: pnpm test  (Node's built-in test runner; the .ts import is
// handled by Node's type stripping).

import { test } from "node:test";
import assert from "node:assert/strict";
import { decideNewUserProfile } from "./sign-in-profile.ts";

const identity = { id: "auth-uuid-1", email: "teacher@example.com", fullName: "Full Name" };

test("new identity with free email and teacher role → provision as active teacher", () => {
  const decision = decideNewUserProfile({
    identity,
    emailOwnerId: undefined,
    teacherRoleId: "role-teacher-uuid",
  });
  assert.equal(decision.action, "provision");
  assert.deepEqual(decision.values, {
    id: "auth-uuid-1",
    email: "teacher@example.com",
    name: "Full Name",
    roleId: "role-teacher-uuid",
    creditsBalance: 0,
    active: true,
  });
});

test("missing full name falls back to the email as display name", () => {
  const decision = decideNewUserProfile({
    identity: { ...identity, fullName: null },
    emailOwnerId: undefined,
    teacherRoleId: "role-teacher-uuid",
  });
  assert.equal(decision.action, "provision");
  assert.equal(decision.values.name, "teacher@example.com");
});

test("email owned by a DIFFERENT identity → reject, never auto-link", () => {
  const decision = decideNewUserProfile({
    identity,
    emailOwnerId: "another-auth-uuid",
    teacherRoleId: "role-teacher-uuid",
  });
  assert.deepEqual(decision, {
    action: "reject",
    reason: "email_registered_to_other_identity",
  });
});

test("email owned by the SAME identity is not treated as a conflict", () => {
  const decision = decideNewUserProfile({
    identity,
    emailOwnerId: "auth-uuid-1",
    teacherRoleId: "role-teacher-uuid",
  });
  assert.equal(decision.action, "provision");
});

test("identity without an email → reject with missing_email", () => {
  const decision = decideNewUserProfile({
    identity: { ...identity, email: null },
    emailOwnerId: undefined,
    teacherRoleId: "role-teacher-uuid",
  });
  assert.deepEqual(decision, { action: "reject", reason: "missing_email" });
});

test("teacher role absent from roles table → reject with teacher_role_missing", () => {
  const decision = decideNewUserProfile({
    identity,
    emailOwnerId: undefined,
    teacherRoleId: undefined,
  });
  assert.deepEqual(decision, { action: "reject", reason: "teacher_role_missing" });
});

test("email-conflict check wins over missing role (conflict is the security-relevant fact)", () => {
  const decision = decideNewUserProfile({
    identity,
    emailOwnerId: "another-auth-uuid",
    teacherRoleId: undefined,
  });
  assert.deepEqual(decision, {
    action: "reject",
    reason: "email_registered_to_other_identity",
  });
});
