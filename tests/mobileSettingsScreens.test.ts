import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const notifApi = readFileSync(join(projectRoot, "mobile-app/src/services/notificationsApi.ts"), "utf8");
const notifSettingsScreen = readFileSync(join(projectRoot, "mobile-app/src/app/notification-settings.tsx"), "utf8");
const changePasswordScreen = readFileSync(join(projectRoot, "mobile-app/src/app/change-password.tsx"), "utf8");
const settingsScreen = readFileSync(join(projectRoot, "mobile-app/src/app/settings.tsx"), "utf8");
const profileTabs = readFileSync(join(projectRoot, "mobile-app/src/components/profile/ProfileNavigationTabs.tsx"), "utf8");
const profileScreen = readFileSync(join(projectRoot, "mobile-app/src/app/(tabs)/profile.tsx"), "utf8");
const userMeRoute = readFileSync(join(projectRoot, "app/api/user/me/route.ts"), "utf8");
const homeHeader = readFileSync(join(projectRoot, "mobile-app/src/components/home/HomeHeader.tsx"), "utf8");

test("notification preferences screen wires the previously-unused API client functions", () => {
  // Bug: getNotificationPreferences/updateNotificationPreferences were defined
  // in notificationsApi.ts but never called anywhere in the mobile app.
  assert.match(notifApi, /export const getNotificationPreferences/);
  assert.match(notifApi, /export const updateNotificationPreferences/);
  assert.match(notifSettingsScreen, /getNotificationPreferences\(\)/);
  assert.match(notifSettingsScreen, /updateNotificationPreferences\(\{ \[key\]: value \}\)/);
});

test("notification preference toggles save instantly with optimistic rollback, no Save button", () => {
  assert.match(notifSettingsScreen, /onValueChange=\{\(value\) => handleToggle\(row\.key, value\)\}/);
  assert.match(notifSettingsScreen, /setQueryData<\{ preferences: NotificationPreferences \} \| undefined>/);
  assert.match(notifSettingsScreen, /if \(previous\) queryClient\.setQueryData\(PREFERENCE_KEY, previous\)/);
  assert.doesNotMatch(notifSettingsScreen, /Save Preferences|onPress=\{handleSave\}/);
});

test("change-password screen reuses the website's existing changePassword action, not a new endpoint", () => {
  assert.match(userMeRoute, /action === "changePassword"/);
  assert.match(changePasswordScreen, /patch\("\/api\/user\/me", \{ action: "changePassword", currentPassword: current, newPassword \}\)/);
});

test("Settings hub links to both new screens and a Delete Account stub matching the website's", () => {
  assert.match(settingsScreen, /route: "\/change-password"/);
  assert.match(settingsScreen, /route: "\/notification-settings"/);
  assert.match(settingsScreen, /Account deletion unavailable/);
});

test("Settings is reachable from the Profile nav and navigates away rather than rendering inline", () => {
  assert.match(profileTabs, /"overview" \| "rewards" \| "address" \| "orders" \| "payment" \| "coupons" \| "help" \| "settings"/);
  assert.match(profileScreen, /tab === "settings" \? router\.push\("\/settings"\) : setActiveTab\(tab\)/);
});

test("unread notification badge already exists on the header bell — not rebuilt as a bottom-nav badge", () => {
  // HomeHeader already polls unread count and badges the bell icon; this is the
  // native equivalent of the website's dropdown preview. No bottom-nav tab for
  // notifications exists, so the badge correctly lives on the header icon instead.
  assert.match(homeHeader, /getUnreadCount/);
  assert.match(homeHeader, /queryKeys\.notifications\.unreadCount\(\)/);
  assert.match(homeHeader, /router\.push\('\/notifications'\)/);
});
