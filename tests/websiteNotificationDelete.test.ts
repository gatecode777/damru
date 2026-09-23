import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const profile = readFileSync(join(projectRoot, "app/(website)/my-profile/page.tsx"), "utf8");
const route = readFileSync(join(projectRoot, "app/api/notifications/bulk-delete/route.ts"), "utf8");
const service = readFileSync(join(projectRoot, "lib/notifications/notificationService.ts"), "utf8");
const mobileApi = readFileSync(join(projectRoot, "mobile-app/src/services/notificationsApi.ts"), "utf8");
const mobileScreen = readFileSync(join(projectRoot, "mobile-app/src/app/notifications.tsx"), "utf8");
const confirmDialog = readFileSync(join(projectRoot, "components/website/ConfirmDialog.tsx"), "utf8");

test("notification delete is ownership-scoped in the service layer", () => {
  assert.match(service, /export async function deleteNotifications/);
  assert.match(service, /Notification\.deleteMany\(\{ _id: \{ \$in: validIds \}, userId \}\)/);
});

test("bulk-delete API route requires auth and rate-limits", () => {
  assert.match(route, /getUserFromCookie\(req\)/);
  assert.match(route, /RATE_LIMITS\.notificationDelete/);
  assert.match(route, /export async function DELETE/);
});

test("website my-profile notifications tab has single and multi-select delete", () => {
  assert.match(profile, /function handleDeleteSingleNotif\(id:string\)/);
  assert.match(profile, /function handleDeleteSelectedNotifs\(\)/);
  assert.match(profile, /notifSelectMode\?"Cancel":"Select"/);
  assert.match(profile, /fetch\("\/api\/notifications\/bulk-delete",\{method:"DELETE"/);
});

test("website delete flows share one global ConfirmDialog instead of native confirm() popups", () => {
  // Bug: notification/address/account delete each used the browser's native
  // confirm() — an inconsistent, unstyled "localhost:3000 says" dialog.
  // Fixed: one shared modal (matching the admin panel's ConfirmDialog
  // pattern) driven by a single askConfirm() call site.
  assert.match(profile, /import ConfirmDialog from "@\/components\/website\/ConfirmDialog"/);
  assert.match(profile, /function askConfirm\(title:string,description:string,onConfirm:\(\)=>void\)/);
  assert.match(profile, /<ConfirmDialog[\s\S]*?open=\{!!confirmDialog\}/);
  assert.match(profile, /askConfirm\("Delete notification"/);
  assert.match(profile, /askConfirm\("Delete notifications"/);
  assert.match(profile, /askConfirm\("Delete address"/);
  assert.match(profile, /askConfirm\("Delete account"/);
  assert.doesNotMatch(profile, /\bconfirm\("Delete/);
  assert.match(confirmDialog, /export default function ConfirmDialog/);
  assert.match(confirmDialog, /role="alertdialog"/);
});

test("mobile notifications screen has single and multi-select delete wired to the same endpoint", () => {
  assert.match(mobileApi, /deleteNotifications = \(ids: string\[\]\)/);
  assert.match(mobileApi, /\/api\/notifications\/bulk-delete/);
  assert.match(mobileScreen, /function handleDeleteSingle\(id: string\)/);
  assert.match(mobileScreen, /function handleDeleteSelected\(\)/);
  assert.match(mobileScreen, /selectMode \? "Cancel" : "Select"/);
});
