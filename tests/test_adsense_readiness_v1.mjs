import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const publisher = 'ca-pub-2476023536699107';
const contentPages = ['guides.html', 'guide-evernote-migration.html', 'guide-data-safety.html'];
const slots = ['2605987155', '1314026134', '6353660478', '3173902712'];

for (const page of contentPages) {
  const html = read(page);
  assert.match(html, new RegExp(`name="google-adsense-account" content="${publisher}"`), `${page}: publisher meta missing`);
  assert.ok(html.includes(`pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`), `${page}: AdSense loader missing`);
  assert.ok(html.includes('Advertisements'), `${page}: allowed ad label missing`);
  assert.ok((html.match(/<p[ >]/g) || []).length >= 5, `${page}: insufficient original explanatory content`);
}

const allContent = contentPages.map(read).join('\n');
for (const slot of slots) assert.ok(allContent.includes(`data-ad-slot="${slot}"`), `ad slot ${slot} not used`);
assert.equal(new Set(slots).size, 4, 'slot IDs must be unique');

const appFiles = fs.readdirSync(root).filter((name) => /^노트앱_v\d+\.html$/.test(name));
for (const page of ['index.html', ...appFiles]) {
  const html = read(page);
  assert.ok(!/adsbygoogle|googlesyndication|google-adsense-account|data-ad-slot/i.test(html), `${page}: ads are prohibited in the private editor/entrypoint`);
}

const css = read('guides.css');
assert.match(css, /\.ad-zone\s*\{[^}]*margin:\s*64px auto/s, 'desktop safety spacing missing');
assert.match(css, /min-height:\s*280px/, 'layout shift reservation missing');
assert.match(css, /\.ad-zone\.feed\s*\{[^}]*height:\s*auto/s, 'in-feed height must remain flexible');

const privacy = read('privacy.html');
for (const phrase of ['Google AdSense', '쿠키', 'IP 주소', 'partner-sites', '개인 노트 편집기']) {
  assert.ok(privacy.includes(phrase), `privacy disclosure missing: ${phrase}`);
}

const forbidden = [/광고를 클릭/i, /click (?:our|the) ads/i, /광고 클릭.{0,20}(?:지원|도와)/i];
for (const pattern of forbidden) assert.ok(!pattern.test(allContent), `incentivized-click language found: ${pattern}`);

const readiness = JSON.parse(read('adsense-readiness.json'));
assert.equal(readiness.siteStatus, 'GETTING_READY', 'must not claim Google approval before READY');
assert.equal(readiness.adsTxtStatus, 'AUTHORIZED');
assert.equal(readiness.editorAds, false);
assert.equal(readiness.adUnits.length, 4);
assert.match(readiness.externalBlocker, /READY/);
assert.ok(!fs.existsSync(path.join(root, 'ads.txt')), 'do not create a misleading project-path ads.txt; the approved domain-root file is authoritative');

console.log(`ADSENSE_READINESS_RESULT pages=${contentPages.length} units=${slots.length} editorFiles=${appFiles.length} status=${readiness.siteStatus}`);
