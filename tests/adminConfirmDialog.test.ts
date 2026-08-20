import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

function tsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const file = path.join(directory, entry);
    return statSync(file).isDirectory() ? tsxFiles(file) : file.endsWith(".tsx") ? [file] : [];
  });
}

test("admin actions use the branded confirmation dialog instead of native confirm", () => {
  const adminDirectory = path.join(process.cwd(), "app", "admin");
  const nativeConfirmFiles = tsxFiles(adminDirectory).filter((file) =>
    /\b(?:window\.)?confirm\s*\(/.test(readFileSync(file, "utf8")),
  );

  assert.deepEqual(nativeConfirmFiles, []);

  const layout = readFileSync(path.join(adminDirectory, "layout.tsx"), "utf8");
  assert.match(layout, /<AdminConfirmProvider>/);
});
