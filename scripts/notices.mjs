import { readFile, writeFile, mkdir } from "node:fs/promises";
const names = [
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
];
let out = "Timeout — runtime dependency notices\n\n";
const manifest = [];
for (const name of names) {
  const root = "node_modules/" + name;
  const pkg = JSON.parse(await readFile(root + "/package.json", "utf8"));
  let license = "";
  for (const file of ["LICENSE", "LICENSE.txt", "LICENSE.md", "LICENCE"]) {
    try {
      license = await readFile(root + "/" + file, "utf8");
      break;
    } catch {}
  }
  if (!license) throw Error("Missing licence: " + name);
  out += `${name} ${pkg.version} (${pkg.license})\n${pkg.repository?.url || pkg.homepage || ""}\n${license}\n\n`;
  manifest.push({
    name,
    version: pkg.version,
    license: pkg.license,
    repository: pkg.repository?.url || pkg.homepage,
  });
}
await mkdir("licenses", { recursive: true });
await writeFile("licenses/THIRD-PARTY-NOTICES.txt", out);
await writeFile(
  "licenses/dependencies.json",
  JSON.stringify(manifest, null, 2),
);
for (const [url, path] of [
  [
    "https://creativecommons.org/licenses/by-sa/4.0/legalcode.txt",
    "licenses/CC-BY-SA-4.0.txt",
  ],
]) {
  const r = await fetch(url);
  if (!r.ok) throw Error(r.status + " " + url);
  await writeFile(path, Buffer.from(await r.arrayBuffer()));
  console.log(path);
}
