import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const files = {
  "index.html": "text/html; charset=utf-8",
  "style.css": "text/css; charset=utf-8",
  "ideas.js": "text/javascript; charset=utf-8",
  "followups.js": "text/javascript; charset=utf-8",
  "plan.js": "text/javascript; charset=utf-8",
  "app.js": "text/javascript; charset=utf-8",
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([file, type]) => [
  "/" + file,
  { type, body: await readFile(new URL("dist/" + file, root), "utf8") },
])));
const source = await readFile(new URL("worker/index.mjs", root), "utf8");
const hosting = await readFile(new URL(".openai/hosting.json", root), "utf8");

await Promise.all([
  mkdir(new URL("dist/server/", root), { recursive: true }),
  mkdir(new URL("dist/.openai/", root), { recursive: true }),
]);
await Promise.all([
  writeFile(new URL("dist/server/index.js", root), "const siteAssets = " + JSON.stringify(assets) + ";\n" + source),
  writeFile(new URL("dist/.openai/hosting.json", root), hosting),
]);
