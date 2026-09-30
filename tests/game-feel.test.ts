import { describe, expect, it } from "vitest";
import fs from "node:fs";
import zlib from "node:zlib";
import {
  botAccuracy,
  botProfile,
  exactAnswer,
  trivia,
} from "../src/games/trivia";
import { botDelay, nextStep } from "../src/core/feel";
import { wordBand } from "../src/core/vocabulary";
import { arcadeReducer, createArcade } from "../src/games/arcade/engines";
import { generateFamiliar } from "../src/games/crossword/familiar";
import { prepareEntries, scanSlots } from "../src/games/crossword/generator";
import { createState, crosswordReducer } from "../src/games/crossword/engine";
import { vocabularyOrder } from "../src/core/vocabulary";

describe("human-paced bots and open answers", () => {
  it("accepts exact answers with accents, whitespace and case, keeping Ñ and internal punctuation distinct", () => {
    expect(exactAnswer("  ÓRBITA  ", "órbita")).toBe(true);
    expect(exactAnswer("Nueva   York.", "Nueva York")).toBe(true);
    expect(exactAnswer("nino", "niño")).toBe(false);
    expect(exactAnswer("314", "3.14")).toBe(false);
    expect(exactAnswer("", "")).toBe(false);
  });
  it("grades exact human answers immediately and keeps equivalent or bot answers visible", async () => {
    const c = { ...trivia.defaults, language: "es" };
    let s = await trivia.create(c, 15);
    s = trivia.reducer(s, { type: "ROLL" }, c);
    s = trivia.reducer(s, { type: "MOVE", node: s.destinations[0] }, c);
    const answer = s.question!.a;
    const result = trivia.reducer(s, { type: "ANSWER", answer }, c);
    expect(result.phase).toBe("roll");
    expect(result.players[0].correct).toBe(1);
    expect(result.lastAnswer.es).toContain(answer);
    expect(
      trivia.reducer(
        s,
        { type: "ANSWER", answer: "Una respuesta equivalente" },
        c,
      ).phase,
    ).toBe("reveal");
    const bot = { ...s, turn: 1 };
    expect(trivia.reducer(bot, { type: "ANSWER", answer }, c).phase).toBe(
      "reveal",
    );
  });
  it("builds reproducible hidden profiles with moderate strengths and occasional weaknesses", async () => {
    const profiles = Array.from({ length: 120 }, (_, seed) =>
      botProfile(seed + 1, 1),
    );
    expect(profiles.some((p) => p.weakness === -1)).toBe(true);
    expect(profiles.some((p) => p.weakness >= 0)).toBe(true);
    expect(
      new Set(profiles.map((p) => p.skills.join(","))).size,
    ).toBeGreaterThan(20);
    expect(botProfile(7, 1)).toEqual(botProfile(7, 1));
    expect(botProfile(7, 1)).not.toEqual(botProfile(8, 1));
    const s = await trivia.create(trivia.defaults, 7);
    const chances = Array.from({ length: 6 }, (_, category) =>
      botAccuracy(
        {
          ...s,
          question: {
            id: "test",
            category,
            q: "Question",
            a: "Answer",
            lang: "es",
          },
        },
        { difficulty: "hard" },
      ),
    );
    expect(Math.max(...chances) - Math.min(...chances)).toBeCloseTo(0.12);
    const weak = profiles.find((p) => p.weakness >= 0)!;
    s.players[0] = { ...s.players[0], ...weak };
    s.question = {
      id: "test",
      category: weak.weakness,
      q: "Question",
      a: "Answer",
      lang: "es",
    };
    expect(botAccuracy(s, { difficulty: "medium" })).toBeLessThan(0.52);
    const before = botAccuracy(s, { difficulty: "hard" });
    s.players[0].streak = 20;
    expect(botAccuracy(s, { difficulty: "hard" })).toBeCloseTo(before - 0.12);
    expect(JSON.parse(JSON.stringify(s)).players[0].skills).toEqual(
      weak.skills,
    );
  });
  it("keeps question and reveal phases readable and teaches the next action in every game", () => {
    expect(
      botDelay({ botSpeed: "slow" }, { phase: "reveal" } as any),
    ).toBeGreaterThan(
      botDelay({ botSpeed: "normal" }, { phase: "reveal" } as any),
    );
    expect(
      botDelay({ botSpeed: "normal" }, { phase: "reveal" } as any),
    ).toBeGreaterThan(
      botDelay({ botSpeed: "normal" }, { phase: "roll" } as any),
    );
    for (const id of [
      "solitaire",
      "ring",
      "crossword",
      "letters",
      "chess",
      "poker",
      "domino",
      "runner",
      "flappy",
      "sudoku",
      "wordle",
      "blocks",
      "billiards",
      "trivia",
      "snake",
      "breakout",
    ])
      expect(
        nextStep(id, { status: "playing" } as any, "es").length,
      ).toBeGreaterThan(15);
  });
});
describe("forgiving but deterministic action physics", () => {
  it("allows short jumps, rejects held auto-jumps and buffers a press just before landing", () => {
    let s = createArcade("runner", {}, 1);
    s = arcadeReducer(s, { type: "JUMP" }, {});
    expect(
      arcadeReducer(s, { type: "JUMP", repeat: true }, {}).jumpBuffer,
    ).toBe(0);
    s = arcadeReducer(s, { type: "JUMP", down: false }, {});
    expect(s.vy).toBe(260);
    Object.assign(s, { y: 1, vy: -200 });
    s = arcadeReducer(s, { type: "JUMP" }, {});
    s = arcadeReducer(s, { type: "TICK", dt: 1 / 120 }, {});
    expect(s.vy).toBe(560);
  });
  it("waits for a deliberate launch after losing a ball", () => {
    let s = createArcade("breakout", {}, 1);
    Object.assign(s, { y: 449, vy: 300, x: 0 });
    s = arcadeReducer(s, { type: "TICK", dt: 0.05 }, {});
    expect(s.serve).toBe(true);
    const before = s.y;
    s = arcadeReducer(s, { type: "TICK", dt: 0.5 }, {});
    expect(s.y).toBe(before);
    s = arcadeReducer(s, { type: "JUMP" }, {});
    expect(s.serve).toBe(false);
  });
  it("bounds pipe jumps and provides larger openings on easy mode", () => {
    for (const difficulty of ["easy", "medium", "hard"]) {
      let s = createArcade("flappy", { difficulty }, 3);
      const gaps: number[] = [];
      for (let i = 0; i < 8; i++) {
        Object.assign(s, { spawn: 0, y: 200, vy: 0, pipes: [] });
        s = arcadeReducer(s, { type: "TICK", dt: 1 / 120 }, {});
        gaps.push(s.pipes[0].gap);
        expect(s.pipes[0].half).toBe(
          difficulty === "easy" ? 95 : difficulty === "hard" ? 72 : 83,
        );
      }
      expect(gaps.every((g, i) => !i || Math.abs(g - gaps[i - 1]) <= 90)).toBe(
        true,
      );
    }
  });
});
describe("playable crossword vocabulary", () => {
  it.each(["es", "en"] as const)(
    "keeps seeded %s generation varied and its difficulty bands ordered",
    (locale) => {
      const raw = JSON.parse(
        zlib
          .gunzipSync(fs.readFileSync(`src/data/${locale}.json.gz`))
          .toString(),
      );
      const entries = prepareEntries(raw),
        scores: number[] = [];
      for (const difficulty of ["easy", "hard"]) {
        const bands: number[] = [],
          answers = new Set<string>();
        for (const seed of [1, 87, 2401]) {
          const p = generateFamiliar(9, entries, seed, locale, difficulty)!;
          expect(p).not.toBeNull();
          for (const slot of p.slots)
            bands.push(wordBand({ w: slot.word, g: slot.clue }, locale));
          answers.add(p.slots.map((s) => s.word).join(","));
        }
        expect(answers.size).toBe(3);
        scores.push(bands.reduce((a, b) => a + b, 0) / bands.length);
      }
      expect(scores[0]).toBeLessThan(scores[1]);
      const easy = raw.filter(
        (w: any) => w.g && w.w.length >= 3 && wordBand(w, locale) < 2,
      );
      const alphabet =
        locale === "es"
          ? "abcdefghijklmnñopqrstuvwxyz"
          : "abcdefghijklmnopqrstuvwxyz";
      for (const letter of alphabet) {
        const choices = easy.filter((w: any) => w.w.includes(letter));
        expect(
          vocabularyOrder(choices, locale, "easy", 87)[0],
          `easy ring ${locale}: ${letter}`,
        ).toBeDefined();
      }
    },
    120000,
  );
  it.each(["es", "en"] as const)(
    "builds connected valid %s puzzles at all sizes and bands, without obscure easy words",
    (locale) => {
      const entries = prepareEntries(
        JSON.parse(
          zlib
            .gunzipSync(fs.readFileSync(`src/data/${locale}.json.gz`))
            .toString(),
        ),
      );
      for (const size of [9, 11, 13])
        for (const difficulty of ["easy", "medium", "hard"]) {
          const p = generateFamiliar(size, entries, 127, locale, difficulty)!;
          expect(p, `${locale} ${size} ${difficulty}`).not.toBeNull();
          expect(p.slots.length).toBeGreaterThanOrEqual(6);
          const actual = scanSlots(p.mask, size).filter(
            (s) => s.cells.length > 1,
          );
          expect(actual.map((s) => s.cells.join(",")).sort()).toEqual(
            p.slots.map((s) => s.cells.join(",")).sort(),
          );
          expect(new Set(p.slots.map((s) => s.word)).size).toBe(p.slots.length);
          const seen = new Set([p.mask.indexOf(true)]),
            queue = [...seen];
          for (const cell of queue)
            for (const n of [
              cell - size,
              cell + size,
              cell % size > 0 ? cell - 1 : -1,
              cell % size < size - 1 ? cell + 1 : -1,
            ])
              if (p.mask[n] && !seen.has(n)) {
                seen.add(n);
                queue.push(n);
              }
          expect(seen.size).toBe(p.mask.filter(Boolean).length);
          if (difficulty === "easy")
            for (const slot of p.slots)
              expect(
                wordBand({ w: slot.word, g: slot.clue }, locale),
              ).toBeLessThan(2);
          let s = createState(p, 1);
          for (const slot of p.slots) {
            s = crosswordReducer(s, { type: "SLOT", id: slot.id });
            s = crosswordReducer(s, { type: "PASTE", value: slot.word });
          }
          expect(s.status).toBe("won");
        }
    },
    120000,
  );
});
