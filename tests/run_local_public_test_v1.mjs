import fs from "node:fs";
import crypto from "node:crypto";
import http from "node:http";
import path from "node:path";
import {pathToFileURL, fileURLToPath} from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const requested = process.argv[2];
if (!requested || !/^[a-z0-9_.-]+\.mjs$/i.test(requested)) throw new Error("test filename required");
const testPath = path.join(here, requested);
if (!fs.existsSync(testPath)) throw new Error(`test missing: ${requested}`);
const version = process.env.NOTEPLUS_VERSION || "v15";
const appName = fs.readdirSync(root).find(name => name.endsWith(`_${version}.html`));
if (!appName) throw new Error(`${version} app missing`);

const types = new Map([[".html", "text/html; charset=utf-8"], [".js", "text/javascript; charset=utf-8"], [".json", "application/json; charset=utf-8"], [".svg", "image/svg+xml"], [".png", "image/png"], [".zip", "application/zip"]]);
const server = http.createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname);
  const target = path.resolve(root, "." + (pathname === "/" ? `/${appName}` : pathname));
  if (!target.startsWith(root + path.sep) && target !== root) { response.writeHead(403).end(); return; }
  fs.readFile(target, (error, bytes) => {
    if (error) { response.writeHead(404).end(); return; }
    response.writeHead(200, {"content-type": types.get(path.extname(target).toLowerCase()) || "application/octet-stream", "cache-control": "no-store"});
    response.end(bytes);
  });
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
process.env.NOTEPLUS_PUBLIC_URL = `http://127.0.0.1:${port}/`;
process.env.NOTEPLUS_APP_FILE = encodeURIComponent(appName);
process.env.NOTEPLUS_VERSION = version;
process.env.NOTEPLUS_EXPECTED_SHA = process.env.NOTEPLUS_EXPECTED_SHA || crypto.createHash("sha256").update(fs.readFileSync(path.join(root, appName))).digest("hex").toUpperCase();
try {
  await import(pathToFileURL(testPath).href + `?local=${Date.now()}`);
} finally {
  await new Promise(resolve => server.close(resolve));
}
