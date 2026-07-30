import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const files = fs.readdirSync(here).filter(name => name.endsWith(".mjs"));
const versionPinned = [];
for (const name of files) {
  const source = fs.readFileSync(path.join(here, name), "utf8");
  if (/node_modules\/\.pnpm\/playwright-core@/i.test(source)) versionPinned.push(name);
}
assert.deepEqual(versionPinned, [], "test harnesses must not pin an installed Playwright package version");

const fallback = "C:/Users/User/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright-core";
const resolved = process.env.NOTEPLUS_PLAYWRIGHT || fallback;
assert.equal(fs.existsSync(resolved), true, `Playwright runtime not found: ${resolved}`);
console.log(`PASS Playwright runtime resolution without installed-version pin: ${resolved}`);
