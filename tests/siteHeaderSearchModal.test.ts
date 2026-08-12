import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

const projectRoot = process.cwd();
const header = readFileSync(join(projectRoot, "components/website/SiteHeader.tsx"), "utf8");
const styles = readFileSync(join(projectRoot, "styles/website/header.css"), "utf8");

test("website header opens an accessible menu search dialog", () => {
  assert.match(header, /className="menu-search-overlay"/);
  assert.match(header, /role="dialog"/);
  assert.match(header, /aria-modal="true"/);
  assert.match(header, /aria-labelledby="menu-search-title"/);
  assert.match(header, /event\.key === "Escape"/);
  assert.match(header, /event\.target === event\.currentTarget/);
});

test("menu search includes discovery and responsive dialog states", () => {
  assert.match(header, /What are you craving\?/);
  assert.match(header, /Popular searches/);
  assert.match(header, /SearchResultsDropdown|renderSearchResults/);
  assert.match(styles, /\.menu-search-modal\s*\{/);
  assert.match(styles, /@media \(max-width: 767px\)[\s\S]*\.menu-search-overlay/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
});
