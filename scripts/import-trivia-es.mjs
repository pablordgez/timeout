import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { unzipSync, strFromU8 } from "fflate";

const source =
  "https://figshare.com/articles/dataset/The_thousand-question_Spanish_general_knowledge_database/13041803/2";
const download = "https://ndownloader.figshare.com/files/24952217";
const expectedMd5 = "5d8a6617222bc60738c4366e438795f1";
const cache = ".cache/trivia-es-13041803-v2.xlsx";
const decode = (text) =>
  text.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, entity) => {
    if (entity.startsWith("#"))
      return String.fromCodePoint(
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : Number(entity.slice(1)),
      );
    return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[
      entity.toLowerCase()
    ];
  });
const clean = (text) => text.normalize("NFC").replace(/\s+/g, " ").trim();

// Read only the published workbook's string table and Spanish question columns.
// The pinned digest prevents a changed workbook from silently changing the selection.
export function readQuestions(bytes) {
  const zip = unzipSync(bytes);
  const xml = (name) => strFromU8(zip[name]);
  const strings = [
    ...xml("xl/sharedStrings.xml").matchAll(/<si>([\s\S]*?)<\/si>/g),
  ].map(([, item]) =>
    clean(
      [...item.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
        .map(([, text]) => decode(text))
        .join(""),
    ),
  );
  const questions = [];
  for (const [, row] of xml("xl/worksheets/sheet1.xml").matchAll(
    /<row\b[^>]*>([\s\S]*?)<\/row>/g,
  )) {
    const cells = {};
    for (const [, column, attrs, body] of row.matchAll(
      /<c\b[^>]*\br="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g,
    )) {
      const value = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      cells[column] = /\bt="s"/.test(attrs) ? strings[Number(value)] : value;
    }
    if (!cells.B || !/^\d+$/.test(cells.A || "")) continue;
    questions.push({
      sourceId: Number(cells.A),
      q: cells.B,
      a: cells.C,
      category: cells.K,
      link: cells.L,
      accuracy: Number(cells.G),
    });
  }
  if (questions.length !== 1364)
    throw Error("Unexpected Spanish workbook structure");
  return questions;
}

export async function loadQuestions() {
  await mkdir(".cache", { recursive: true });
  let bytes;
  try {
    bytes = await readFile(cache);
  } catch {
    const response = await fetch(download);
    if (!response.ok)
      throw Error(`Workbook download failed: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    await writeFile(cache, bytes);
  }
  if (createHash("md5").update(bytes).digest("hex") !== expectedMd5)
    throw Error("Spanish workbook digest mismatch");
  return { bytes, questions: readQuestions(bytes) };
}

async function main() {
  const { bytes, questions } = await loadQuestions();
  const selection = JSON.parse(
    await readFile("scripts/trivia-es-selection.json", "utf8"),
  );
  const items = selection.map(({ sourceId, category, q, a }) => {
    const original = questions.find((item) => item.sourceId === sourceId);
    if (
      !original ||
      !Number.isInteger(category) ||
      category < 0 ||
      category > 5
    )
      throw Error(`Invalid selected question ${sourceId}`);
    return {
      id: `es-sgk-${sourceId}`,
      category,
      q: q ?? original.q,
      a: a ?? original.a,
      lang: "es",
    };
  });
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw Error("Duplicate selected question ID");
  await writeFile("src/data/trivia-es.json", JSON.stringify(items) + "\n");
  await writeFile(
    "licenses/trivia-es.json",
    JSON.stringify(
      {
        title: "The thousand-question Spanish general knowledge database",
        authors: [
          "Francisco Buades-Sitjar",
          "Roger Boada",
          "Marc Guasch",
          "Pilar Ferré",
          "José Antonio Hinojosa",
          "Marc Brysbaert",
          "Jon Andoni Duñabeitia",
        ],
        source,
        doi: "10.6084/m9.figshare.13041803.v2",
        download,
        license: "CC-BY-4.0",
        sourcePublishedAt: "2020-10-02",
        sourceMd5: expectedMd5,
        sourceSha256: createHash("sha256").update(bytes).digest("hex"),
        questions: items.length,
        changes:
          "Selected standalone short-answer questions; removed distractors and research statistics; mapped categories; normalized whitespace; corrected selected wording and answers. Selection and edits: scripts/trivia-es-selection.json.",
        provenance:
          "Published by Jon Andoni Duñabeitia on Figshare under CC BY 4.0. The accompanying paper describes questions adapted from academic question banks, FunTrivia and TriviaChamp. The paper itself is not included and has a separate license.",
        verification: selection.map(({ sourceId }) => ({
          id: `es-sgk-${sourceId}`,
          url: questions.find((q) => q.sourceId === sourceId).link,
        })),
      },
      null,
      2,
    ) + "\n",
  );
  console.log(`Imported ${items.length} Spanish questions`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  await main();
