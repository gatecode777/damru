import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const profileScreen = readFileSync(join(projectRoot, "mobile-app/src/app/(tabs)/profile.tsx"), "utf8");
const websiteProfilePage = readFileSync(join(projectRoot, "app/(website)/my-profile/page.tsx"), "utf8");
const websiteCss = readFileSync(join(projectRoot, "styles/website/myprofile.css"), "utf8");

test("mobile coupon card shows icon, name, detail, validity, and Copy + Shop Now actions", () => {
  assert.match(profileScreen, /styles\.couponCard/);
  assert.match(profileScreen, /Ionicons name="pricetag"/);
  assert.match(profileScreen, /styles\.couponName/);
  assert.match(profileScreen, /styles\.couponDetail/);
  assert.match(profileScreen, /styles\.couponValidity/);
  assert.match(profileScreen, /copiedCode === c\.code \? "Copied!" : "Copy"/);
  assert.match(profileScreen, /router\.push\("\/menu"\)/);
});

test("mobile coupon redesign did not touch the shared list-card styles used by address/orders tabs", () => {
  // couponCard etc. are new, standalone style keys — listItemCard/codeBadge/copyLink
  // must remain untouched since the address and orders tabs still use them.
  assert.match(profileScreen, /listItemCard: \{/);
  assert.match(profileScreen, /codeBadge: \{/);
  assert.match(profileScreen, /copyLink: \{/);
});

test("website coupon rows keep the compact desktop layout, becoming a card only in a small-screen media query", () => {
  assert.match(websiteProfilePage, /className="profile__coupon-row"/);
  assert.match(websiteProfilePage, /className="profile__coupon-info"/);
  // Class name stays "-row", not renamed to "-card" — desktop is unchanged;
  // only a @media block transforms it into a stacked card on small screens.
  assert.doesNotMatch(websiteProfilePage, /profile__coupon-card|profile__coupon-list/);
  assert.match(websiteCss, /\.profile__coupon-row \{[\s\S]*?padding: 14px 0;/);
  assert.doesNotMatch(websiteCss, /\.profile__coupon-card \{/);
  assert.match(websiteCss, /@media \(max-width: 640px\) \{[\s\S]*?\.profile__coupon-row \{[\s\S]*?flex-direction: column;/);
});

test("website coupon actions (Copy + Shop Now) are shared between the Coupons tab and Rewards tab", () => {
  assert.match(websiteCss, /\.profile__coupon-actions \{/);
  assert.match(websiteCss, /\.profile__coupon-btn \{/);
  const actionUsages = websiteProfilePage.match(/className="profile__coupon-actions"/g) ?? [];
  assert.equal(actionUsages.length, 2, "expected both the Coupons tab and Rewards tab's Active Coupons to use the shared actions wrapper");
});
