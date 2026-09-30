import {
  readFile,
  writeFile,
  mkdir,
  readdir,
  stat,
  access,
} from "node:fs/promises";
import { resolve, relative } from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { zipSync, unzipSync, strToU8 } from "fflate";

const root = resolve("."),
  version = JSON.parse(await readFile("package.json", "utf8")).version;
const git = (args, cwd = root) =>
  execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
if (git(["status", "--porcelain"]))
  throw Error("Commit the verified source before packaging a release.");
await access("dist/index.html");
await access("dist-portable/index.html");
const output = resolve("artifacts", version);
await mkdir(output, { recursive: true });
const sourceRoot = resolve(".cache/stockfish-source");
try {
  await access(resolve(sourceRoot, ".git"));
} catch {
  await mkdir(resolve(".cache"), { recursive: true });
  git([
    "clone",
    "--depth",
    "1",
    "--branch",
    "v19.0.0",
    "--recurse-submodules",
    "https://github.com/nmrugg/stockfish.js.git",
    sourceRoot,
  ]);
}
const expected = "9cb3e5066d48f1a35d792afeda36eff37ae60570";
if (git(["rev-parse", "HEAD"], sourceRoot) !== expected)
  throw Error("Unexpected Stockfish source revision");
const network = "nn-61e7af4bb97d.nnue",
  networkPath = resolve(sourceRoot, "src", network);
try {
  await access(networkPath);
} catch {
  const r = await fetch("https://tests.stockfishchess.org/api/nn/" + network);
  if (!r.ok) throw Error("Unable to download corresponding Stockfish network");
  await writeFile(networkPath, Buffer.from(await r.arrayBuffer()));
}
const networkBytes = await readFile(networkPath);
if (
  !createHash("sha256")
    .update(networkBytes)
    .digest("hex")
    .startsWith("61e7af4bb97d")
)
  throw Error("Stockfish network hash mismatch");
const sourceBytes = execFileSync(
  "git",
  ["archive", "--format=zip", "--prefix", `timeout-${version}/`, "HEAD"],
  { cwd: root, maxBuffer: 100 * 1024 * 1024 },
);
const sourceFiles = unzipSync(sourceBytes);
const sfArchive = execFileSync("git", ["archive", "--format=zip", "HEAD"], {
  cwd: sourceRoot,
  maxBuffer: 100 * 1024 * 1024,
});
for (const [path, bytes] of Object.entries(unzipSync(sfArchive)))
  sourceFiles[`timeout-${version}/vendor-source/stockfish.js-19.0.0/${path}`] =
    bytes;
sourceFiles[
  `timeout-${version}/vendor-source/stockfish.js-19.0.0/src/${network}`
] = networkBytes;
sourceFiles[`timeout-${version}/vendor-source/BUILD.md`] = strToU8(
  "Stockfish source revision " +
    expected +
    "\nInstall Emscripten 3.1.7 and make, then inside stockfish.js-19.0.0 run:\nnode build.js --lite --single-threaded --no-split\nThe included nn-61e7af4bb97d.nnue is the embedded Lite network.\nTimeout uses upstream release binaries with hashes in licenses/stockfish-manifest.json.\nTimeout: npm ci; npm run build. See README.md and docs/verification.md.\n",
);
async function tree(directory, prefix = "") {
  const files = {};
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name),
      key = prefix + entry.name;
    if (entry.isDirectory()) Object.assign(files, await tree(path, key + "/"));
    else if (entry.isFile()) files[key] = new Uint8Array(await readFile(path));
  }
  return files;
}
for (const name of [
  "react",
  "react-dom",
  "scheduler",
  "chess.js",
  "idb",
  "workbox-core",
  "workbox-routing",
  "workbox-precaching",
  "workbox-strategies",
  "workbox-window",
  "@fontsource/ibm-plex-sans",
  "@fontsource/ibm-plex-mono",
])
  Object.assign(
    sourceFiles,
    await tree(
      resolve("node_modules", name),
      `timeout-${version}/vendor-source/npm/${name}/`,
    ),
  );
const licenseFiles = await tree(resolve("licenses"), "licenses/");
licenseFiles.LICENSE = new Uint8Array(await readFile("LICENSE"));
const web = { ...(await tree(resolve("dist"))), ...licenseFiles };
web["README.txt"] = strToU8(
  "Timeout " +
    version +
    "\nServe this directory with HTTPS or localhost. Wait for Available offline before disconnecting. No hosting was published by this release.\nCorresponding source: timeout-" +
    version +
    "-source.zip\n",
);
const portable = {
  ...licenseFiles,
  "timeout.html": new Uint8Array(await readFile("dist-portable/index.html")),
  "README.txt": strToU8(
    "Open timeout.html directly in a modern desktop browser. Storage under file:// depends on your browser. Export saved data before moving the file.\nCorresponding source: timeout-" +
      version +
      "-source.zip\n",
  ),
};
const assets = [
  ["web.zip", web],
  ["portable.zip", portable],
  ["source.zip", sourceFiles],
];
const manifest = {
  version,
  commit: git(["rev-parse", "HEAD"]),
  createdAt: new Date().toISOString(),
  stockfishSource: expected,
  files: [],
};
for (const [suffix, files] of assets) {
  const file = `timeout-${version}-${suffix}`,
    bytes = zipSync(files, { level: 6 });
  await writeFile(resolve(output, file), bytes);
  manifest.files.push({
    file,
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
  console.log(file, bytes.length);
}
const html = await readFile('dist-portable/index.html');
const htmlFile = `timeout-${version}.html`;
await writeFile(resolve(output, htmlFile), html);
manifest.files.push({ file: htmlFile, bytes: html.length, sha256: createHash('sha256').update(html).digest('hex') });
await writeFile(
  resolve(output, "manifest.json"),
  JSON.stringify(manifest, null, 2),
);
console.log("Release prepared:", relative(root, output));
