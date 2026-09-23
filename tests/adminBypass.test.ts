import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { adminBypassesPermissions } from "../lib/adminPermissions";

/**
 * Regression coverage for the Phase 3 admin-permission-bypass fix. The
 * critical requirement: existing production "admin" accounts with no stored
 * `isSuperAdmin` value (created before the flag existed) must keep full
 * access — only an explicit `false` downgrades them to permission-enforced.
 */
test("super_admin always bypasses, regardless of isSuperAdmin flag", () => {
  assert.equal(adminBypassesPermissions("super_admin", undefined), true);
  assert.equal(adminBypassesPermissions("super_admin", false), true);
  assert.equal(adminBypassesPermissions("super_admin", true), true);
});

test("legacy admin accounts (isSuperAdmin undefined) keep full access", () => {
  assert.equal(adminBypassesPermissions("admin", undefined), true);
});

test("admin explicitly granted isSuperAdmin:true bypasses", () => {
  assert.equal(adminBypassesPermissions("admin", true), true);
});

test("admin explicitly downgraded to isSuperAdmin:false is permission-enforced", () => {
  assert.equal(adminBypassesPermissions("admin", false), false);
});

test("moderator never bypasses", () => {
  assert.equal(adminBypassesPermissions("moderator", undefined), false);
  assert.equal(adminBypassesPermissions("moderator", true), false);
});
