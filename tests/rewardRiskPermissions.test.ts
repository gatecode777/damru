import "./setup";
import { test } from "node:test";
import assert from "node:assert/strict";
import { connectDB } from "../lib/mongodb";
import { getAdminPerms } from "../lib/adminPermissions";
import Admin from "../models/Admin";

const modulePermissions = (rewards: { view: boolean; create: boolean; edit: boolean; delete: boolean }) => ({ rewards });

test("reward risk permission matrix distinguishes customers, viewers, editors and super admins", async () => {
  await connectDB();
  const suffix = `${Date.now()}-${Math.random()}`;
  const [withoutRewards, viewer, editor, superAdmin] = await Admin.create([
    {
      name: "No rewards permission",
      email: `risk-none-${suffix}@example.test`,
      password: "test",
      role: "moderator",
      permissions: modulePermissions({ view: false, create: false, edit: false, delete: false }),
    },
    {
      name: "Rewards viewer",
      email: `risk-view-${suffix}@example.test`,
      password: "test",
      role: "moderator",
      permissions: modulePermissions({ view: true, create: false, edit: false, delete: false }),
    },
    {
      name: "Rewards editor",
      email: `risk-edit-${suffix}@example.test`,
      password: "test",
      role: "moderator",
      permissions: modulePermissions({ view: true, create: false, edit: true, delete: false }),
    },
    {
      name: "Rewards super admin",
      email: `risk-super-${suffix}@example.test`,
      password: "test",
      role: "super_admin",
      permissions: modulePermissions({ view: false, create: false, edit: false, delete: false }),
    },
  ]);

  try {
    const customer = await getAdminPerms(`customer-${suffix}@example.test`);
    const none = await getAdminPerms(withoutRewards.email);
    const view = await getAdminPerms(viewer.email);
    const edit = await getAdminPerms(editor.email);
    const root = await getAdminPerms(superAdmin.email);

    assert.equal(customer.email, undefined);
    assert.equal(customer.can("rewards", "view"), false);
    assert.equal(none.can("rewards", "view"), false);
    assert.equal(view.can("rewards", "view"), true);
    assert.equal(view.can("rewards", "edit"), false);
    assert.equal(edit.can("rewards", "view"), true);
    assert.equal(edit.can("rewards", "edit"), true);
    assert.equal(root.can("rewards", "view"), true);
    assert.equal(root.can("rewards", "edit"), true);
  } finally {
    await Admin.deleteMany({ _id: { $in: [withoutRewards._id, viewer._id, editor._id, superAdmin._id] } });
  }
});
