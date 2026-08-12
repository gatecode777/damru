import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { getUserErrorMessage, getUserResponseError } from "../lib/getUserErrorMessage";

const websiteLayout = readFileSync("app/(website)/layout.tsx", "utf8");
const adminLayout = readFileSync("app/admin/layout.tsx", "utf8");
const toastSystem = readFileSync("components/website/Toast.tsx", "utf8");
const reservation = readFileSync("app/(website)/ReservationForm.tsx", "utf8");
const checkout = readFileSync("app/(website)/checkout/page.tsx", "utf8");
const profile = readFileSync("app/(website)/my-profile/page.tsx", "utf8");

test("one customer toast provider wraps only the website", () => {
  assert.match(websiteLayout, /<WebsiteToastProvider>/);
  assert.match(adminLayout, /<ToastProvider>/);
  assert.doesNotMatch(adminLayout, /WebsiteToastProvider/);
});

test("website errors are normalized without exposing technical details", () => {
  assert.equal(getUserResponseError({ status: 401 }), "Your session has expired. Please sign in again.");
  assert.equal(getUserResponseError({ status: 403 }), "You do not have permission to perform this action.");
  assert.equal(getUserResponseError({ status: 429 }), "Too many requests. Please try again shortly.");
  assert.equal(getUserResponseError({ status: 500 }, { error: "MongoError: secret internal detail" }), "Something went wrong. Please try again.");
  assert.equal(getUserErrorMessage(new TypeError("Failed to fetch")), "Unable to connect. Check your internet connection.");
});

test("website action pages use the shared toast API", () => {
  for (const source of [reservation, checkout, profile]) {
    assert.match(source, /useToast/);
  }
  assert.doesNotMatch(reservation, /resSlideUp|setToast/);
  assert.doesNotMatch(checkout, /\balert\(/);
});

test("website toast supports all variants, deduplication, stacking, timing, and accessibility", () => {
  for (const variant of ["success", "error", "info", "warning"]) assert.match(toastSystem, new RegExp(`${variant}:`));
  assert.match(toastSystem, /options\?\.id/);
  assert.match(toastSystem, /MAX_VISIBLE = 4/);
  assert.match(toastSystem, /role=\{item\.type === "error" \? "alert" : "status"\}/);
  assert.match(toastSystem, /aria-live="polite"/);
  assert.match(toastSystem, /@media\(max-width:600px\)/);
});
