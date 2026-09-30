import { describe, it, expect } from "vitest";
import {
  emptyData,
  validateSave,
  mergeData,
  conflicts,
  type Session,
} from "../src/core/storage";
const session: Session = {
  id: "1",
  gameId: "snake",
  gameVersion: 1,
  config: {},
  locale: "es",
  state: { status: "playing", rng: 1, score: 0, moves: 0 },
  startedAt: "2026-09-30T00:00:00Z",
  updatedAt: "2026-09-30T00:00:00Z",
  elapsed: 1,
};
describe("save interchange", () => {
  it("round trips and merges without duplicate ids", () => {
    const a = emptyData();
    a.sessions = [session];
    const b = validateSave(JSON.parse(JSON.stringify(a)));
    expect(mergeData(a, b).sessions).toHaveLength(1);
    expect(conflicts(a, b)).toBe(0);
  });
  it("preserves local conflicts unless explicitly replaced", () => {
    const a = emptyData(),
      b = emptyData();
    a.sessions = [session];
    b.sessions = [{ ...session, state: { ...session.state, score: 40 } }];
    expect(conflicts(a, b)).toBe(1);
    expect(mergeData(a, b).sessions[0].state.score).toBe(0);
    expect(mergeData(a, b, true).sessions[0].state.score).toBe(40);
  });
  it("rejects invalid numbers, duplicate sessions and unknown versions", () => {
    expect(() => validateSave({ ...emptyData(), version: 2 })).toThrow();
    expect(() =>
      validateSave({ ...emptyData(), sessions: [session, session] }),
    ).toThrow();
    expect(() =>
      validateSave({ ...emptyData(), sessions: [{ ...session, elapsed: -1 }] }),
    ).toThrow();
  });
});
