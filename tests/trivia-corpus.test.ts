import { describe, expect, it } from "vitest";
import { trivia, migrateTrivia } from "../src/games/trivia";
import imported from "../src/data/trivia-es.json";
import attribution from "../licenses/trivia-es.json";
import { emptyData, validateSave } from "../src/core/storage";

describe("Spanish trivia corpus", () => {
  it("provides 500 standalone questions with unique IDs and broad category decks", async () => {
    const state = await trivia.create(
      { ...trivia.defaults, language: "es" },
      17,
    );
    expect(state.pool).toHaveLength(500);
    expect(imported).toHaveLength(440);
    expect(new Set(state.pool.map((q) => q.id)).size).toBe(500);
    expect(
      new Set(state.pool.map((q) => q.q.toLocaleLowerCase("es"))).size,
    ).toBe(500);
    for (const q of state.pool) {
      expect(q.lang).toBe("es");
      expect(q.q.length).toBeGreaterThan(10);
      expect(q.a.length).toBeGreaterThan(0);
      expect(q.category).toBeGreaterThanOrEqual(0);
      expect(q.category).toBeLessThan(6);
      expect(q.q).not.toMatch(
        /de (estos|estas|los siguientes|las siguientes)|actualmente|récord/i,
      );
    }
    state.decks.forEach((deck) =>
      expect(deck.length).toBeGreaterThanOrEqual(50),
    );
    expect(attribution.license).toBe("CC-BY-4.0");
    expect(attribution.questions).toBe(imported.length);
    expect(attribution.verification.map((q) => q.id)).toEqual(
      imported.map((q) => q.id),
    );
    expect(
      attribution.verification.every((q) => q.url.startsWith("https://")),
    ).toBe(true);
  });
  it("exhausts each category before repeating a question", async () => {
    const config = { ...trivia.defaults, language: "es", humans: 2 };
    for (let category = 0; category < 6; category++) {
      let state = await trivia.create(config, 91);
      const node = 1 + category * 7;
      const count = state.decks[category].length;
      const seen = new Set<string>();
      for (let i = 0; i < count; i++) {
        state = trivia.reducer(
          { ...state, phase: "move", destinations: [node] },
          { type: "MOVE", node },
          config,
        );
        expect(seen.has(state.question!.id)).toBe(false);
        seen.add(state.question!.id);
      }
      expect(state.decks[category]).toHaveLength(0);
      state = trivia.reducer(
        { ...state, phase: "move", destinations: [node] },
        { type: "MOVE", node },
        config,
      );
      expect(seen.has(state.question!.id)).toBe(true);
    }
  });
  it("upgrades an existing 60-question match without losing its active question or reintroducing consumed cards", async () => {
    const config = { ...trivia.defaults, language: "es" };
    const state = await trivia.create(config, 18);
    const original = state.pool.filter((q) => !q.id.startsWith("es-sgk-"));
    const active = original[0],
      answered = original[1];
    const old = {
      ...state,
      phase: "question" as const,
      question: active,
      answer: "Mi respuesta",
      pool: original,
      decks: state.decks.map((deck) =>
        deck.filter(
          (id) =>
            original.some((q) => q.id === id) &&
            id !== active.id &&
            id !== answered.id,
        ),
      ),
    };
    const migrated = migrateTrivia(old);
    expect(migrated.pool).toHaveLength(500);
    expect(migrated.question).toEqual(active);
    expect(migrated.answer).toBe("Mi respuesta");
    expect(migrated.players).toEqual(old.players);
    expect(migrated.decks.flat()).toHaveLength(498);
    expect(new Set(migrated.decks.flat()).size).toBe(498);
    expect(migrated.decks.flat()).not.toContain(active.id);
    expect(migrated.decks.flat()).not.toContain(answered.id);
    expect(migrateTrivia(migrated)).toEqual(migrated);
    const save = {
      ...emptyData(),
      sessions: [
        {
          id: "trivia-test",
          gameId: "trivia",
          gameVersion: 3,
          config,
          locale: "es" as const,
          state: migrated,
          startedAt: "2026-10-01T00:00:00Z",
          updatedAt: "2026-10-01T00:00:00Z",
          elapsed: 0,
        },
      ],
    };
    expect(
      validateSave(JSON.parse(JSON.stringify(save))).sessions[0].state,
    ).toEqual(migrated);
  });
  it("keeps the English corpus and ongoing English decks unchanged", async () => {
    const state = await trivia.create(
      { ...trivia.defaults, language: "en" },
      17,
    );
    expect(state.pool).toHaveLength(500);
    expect(migrateTrivia(state)).toEqual(state);
  });
});
