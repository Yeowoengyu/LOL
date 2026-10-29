import { build } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve, extname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const mimeTypes = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
};
const asDataUrl = async (path) => {
  const bytes = await readFile(path);
  const mime = mimeTypes[extname(path)];
  if (!mime) throw new Error(`Unsupported asset: ${path}`);
  return `data:${mime};base64,${bytes.toString("base64")}`;
};

// A classic IIFE script works when the HTML is opened directly from disk.
// Vite library mode embeds imported fonts rather than writing URL dependencies.
const result = await build({
  root,
  configFile: false,
  plugins: [react()],
  publicDir: false,
  logLevel: "warn",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  build: {
    write: false,
    minify: "esbuild",
    lib: {
      entry: resolve(root, "src/main.tsx"),
      name: "DraftLab",
      formats: ["iife"],
      fileName: "draft-lab",
    },
  },
});
const outputs = (Array.isArray(result) ? result : [result]).flatMap(
  (r) => r.output,
);
const scripts = outputs.filter((o) => o.type === "chunk");
if (scripts.length !== 1 || scripts[0].imports.length) {
  throw new Error("Standalone export must have one self-contained script.");
}
let css = outputs
  .filter((o) => o.type === "asset" && o.fileName.endsWith(".css"))
  .map((o) => o.source.toString())
  .join("\n");
if (!css) throw new Error("Missing standalone stylesheet.");
css = css.replaceAll(
  "/draft-cover.jpg",
  await asDataUrl(resolve(root, "public/draft-cover.jpg")),
);
const externalCssUrls = [...css.matchAll(/url\(["']?([^"')]+)["']?\)/g)]
  .map((m) => m[1])
  .filter((url) => !url.startsWith("data:"));
if (externalCssUrls.length) {
  throw new Error(`Non-embedded CSS assets: ${externalCssUrls.join(", ")}`);
}
const portraits = {};
for (const file of await readdir(resolve(root, "public/champions"))) {
  if (!file.endsWith(".png")) continue;
  portraits[file.slice(0, -4)] = await asDataUrl(
    resolve(root, "public/champions", file),
  );
}
const favicon = await asDataUrl(resolve(root, "public/favicon.svg"));
const code = scripts[0].code.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#0b1018">
<title>DRAFT LAB — 롤 밴픽 시뮬레이터</title>
<link rel="icon" href="${favicon}">
<style>${css}</style>
</head>
<body>
<div id="root"></div>
<script>window.__DRAFT_LAB_PORTRAITS__=${JSON.stringify(portraits)};</script>
<script>${code}</script>
</body>
</html>
`;
const output = resolve(root, "artifacts/draft-lab.html");
await mkdir(dirname(output), { recursive: true });
await writeFile(output, html);
console.log(
  `Exported ${output} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MiB, ${Object.keys(portraits).length} embedded portraits).`,
);
