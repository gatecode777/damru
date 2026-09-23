import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const provider = readFileSync(join(projectRoot, "lib/rewards/RewardsProvider.tsx"), "utf8");
const profile = readFileSync(join(projectRoot, "app/(website)/my-profile/page.tsx"), "utf8");
const header = readFileSync(join(projectRoot, "components/website/SiteHeader.tsx"), "utf8");

test("RewardsProvider surfaces a dashboard API error instead of discarding it", () => {
  // Bug: refresh() used to call setError("") unconditionally, even on the
  // branch where rewardApi.getDashboard() returned { error }. That meant a
  // real failure (401/500) was silently swallowed and the UI had no signal
  // to distinguish "still loading" from "failed forever".
  assert.match(provider, /if \("error" in data && data\.error\) \{\s*setDashboard\(null\);\s*setError\(data\.error\);/);
  assert.match(provider, /\} catch \{\s*setDashboard\(null\);\s*setError\("Could not load Damru rewards\."\);/);
});

test("my-profile wallet card distinguishes loading, error, signed-out, and loaded states", () => {
  // Bug: the wallet card rendered "Loading your wallet…" whenever
  // !rewardsDashboard was true, with no separate branch for "loading finished
  // but failed" — so a real error looked identical to an infinite spinner.
  assert.match(profile, /loading: rewardsLoading, error: rewardsError, refresh: refreshRewards \} = useRewards\(\)/);
  assert.match(profile, /\{rewardsLoading \? \(/);
  assert.match(profile, /\) : rewardsError \? \(/);
  assert.match(profile, /\) : !rewardsDashboard \? \(/);
  assert.match(profile, /onClick=\{\(\)=>refreshRewards\(\)\}/);
});

test("header coin balance reads the same shared RewardsProvider as the rewards page", () => {
  // Confirms the header isn't wired to a second, independent data source —
  // it consumes the same context, so fixing RewardsProvider fixes both
  // reported symptoms (stuck wallet page + missing header balance) at once.
  assert.match(header, /import \{ useRewards \} from "@\/lib\/rewards\/RewardsProvider"/);
  assert.match(header, /const \{ dashboard: rewardsDashboard \} = useRewards\(\)/);
  assert.match(header, /rewardsDashboard && \(/);
});
