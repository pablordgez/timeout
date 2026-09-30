import type { Action, GameState } from "./types";
import { soundForTransition, type SoundCue } from "./audio";

export type SoundPart = {
  frequency?: number;
  end?: number;
  wave?: OscillatorType;
  noise?: BiquadFilterType;
  filter?: number;
  duration: number;
  delay?: number;
  attack?: number;
  gain: number;
};
const tone = (
  frequency: number,
  duration = 0.06,
  gain = 0.35,
  delay = 0,
  end?: number,
  wave: OscillatorType = "triangle",
): SoundPart => ({ frequency, end, duration, gain, delay, wave });
const noise = (
  filter: number,
  duration: number,
  gain: number,
  delay = 0,
  type: BiquadFilterType = "bandpass",
): SoundPart => ({ noise: type, filter, duration, gain, delay, attack: 0.004 });

/** Original Foley recipes. Different actions move different materials, even with the same outcome. */
export function soundRecipe(game: string, event: string): SoundPart[] {
  if (event.includes("+"))
    return event.split("+").flatMap((part, i) =>
      soundRecipe(game, part).map((sound) => ({
        ...sound,
        delay: (sound.delay || 0) + i * 0.14,
      })),
    );
  if (game === "solitaire" || game === "poker") {
    const paper: Record<string, SoundPart[]> = {
      "card-lift": [noise(2300, 0.055, 0.7), noise(900, 0.025, 0.2, 0.03)],
      "card-slide": [noise(1700, 0.12, 0.65), tone(105, 0.035, 0.3, 0.075, 65)],
      "card-draw": [
        noise(3100, 0.045, 0.65),
        noise(1800, 0.07, 0.6, 0.055),
        tone(140, 0.035, 0.2, 0.11, 75),
      ],
      "card-deal": [0, 0.065, 0.13].flatMap((d) => [
        noise(2900, 0.04, 0.55, d),
        tone(130, 0.025, 0.2, d + 0.03, 80),
      ]),
      "card-flip": [noise(3900, 0.045, 0.65), noise(1200, 0.055, 0.45, 0.055)],
      "card-home": [
        noise(1900, 0.09, 0.65),
        tone(115, 0.07, 0.45, 0.065, 70),
        tone(720, 0.08, 0.13, 0.12),
      ],
      "card-recycle": [
        noise(650, 0.19, 0.65),
        noise(2900, 0.11, 0.65, 0.07),
        tone(90, 0.045, 0.4, 0.19),
      ],
      "card-remove": [
        noise(2600, 0.09, 0.7),
        tone(430, 0.055, 0.18, 0.08, 680),
      ],
      undo: [noise(1450, 0.13, 0.55), noise(3200, 0.045, 0.4, 0.09)],
      reject: [noise(900, 0.07, 0.45), tone(85, 0.055, 0.35, 0.035)],
      select: [noise(game === "poker" ? 3900 : 3400, 0.03, 0.3)],
      control: [noise(2600, 0.035, 0.25)],
      "chips-check": [tone(630, 0.035, 0.45, 0, 360), noise(3600, 0.025, 0.2)],
      "chips-call": [
        tone(930, 0.05, 0.45, 0, 520),
        tone(720, 0.05, 0.4, 0.04, 410),
        noise(4200, 0.05, 0.3),
      ],
      "chips-raise": [0, 0.035, 0.075, 0.12].map((d, i) =>
        tone(1250 - i * 110, 0.045, 0.4, d, 640 - i * 65),
      ),
      "chips-all-in": [
        noise(4100, 0.2, 0.55),
        ...[0, 0.03, 0.06, 0.1, 0.15, 0.2].map((d, i) =>
          tone(1500 - i * 130, 0.055, 0.4, d, 700 - i * 50),
        ),
      ],
      "card-fold": [noise(2100, 0.15, 0.6), tone(100, 0.04, 0.2, 0.1, 65)],
    };
    if (paper[event]) return paper[event];
  }
  if (game === "billiards") {
    const pool: Record<string, SoundPart[]> = {
      "cue-strike": [noise(1900, 0.018, 0.7), tone(320, 0.045, 0.6, 0, 110)],
      "ball-hit": [tone(880, 0.025, 0.7, 0, 430), noise(4700, 0.018, 0.35)],
      "rail-hit": [tone(140, 0.055, 0.65, 0, 75), noise(600, 0.035, 0.35)],
      pocket: [
        tone(150, 0.08, 0.5, 0, 70),
        tone(90, 0.12, 0.4, 0.07, 40),
        noise(800, 0.09, 0.4, 0.035),
      ],
      place: [noise(650, 0.05, 0.45), tone(125, 0.04, 0.4)],
      aim: [tone(520, 0.018, 0.12)],
      power: [tone(340, 0.025, 0.2, 0, 480)],
      "call-ball": [tone(900, 0.03, 0.3)],
      "call-pocket": [tone(600, 0.04, 0.3, 0, 750)],
      cancel: [noise(850, 0.06, 0.2)],
    };
    if (pool[event]) return pool[event];
  }
  if (["domino", "chess", "letters"].includes(game)) {
    const wood = game === "chess" ? 160 : game === "domino" ? 240 : 320;
    if (["tile-place", "place", "move"].includes(event))
      return [
        noise(game === "domino" ? 2400 : 1300, 0.035, 0.4),
        tone(wood, 0.055, 0.5, 0, wood * 0.55),
      ];
    if (event === "draw")
      return [
        noise(1800, 0.075, 0.4),
        tone(wood * 1.8, 0.04, 0.35, 0.035, wood),
        tone(wood, 0.035, 0.25, 0.09),
      ];
    if (event === "select")
      return [tone(wood * 2, 0.025, 0.18), noise(2300, 0.02, 0.12)];
    if (event === "reject")
      return [
        tone(wood * 0.6, 0.055, 0.3, 0, wood * 0.35),
        noise(550, 0.04, 0.25),
      ];
  }
  const profiles: Record<string, [number, OscillatorType, number]> = {
    solitaire: [210, "triangle", 1600],
    poker: [390, "triangle", 3400],
    domino: [170, "sine", 1100],
    chess: [235, "triangle", 650],
    letters: [360, "triangle", 2200],
    trivia: [620, "sine", 2900],
    crossword: [460, "triangle", 4200],
    sudoku: [730, "sine", 3100],
    wordle: [540, "triangle", 3800],
    ring: [880, "sine", 2300],
    runner: [145, "triangle", 700],
    flappy: [950, "sine", 2400],
    snake: [320, "square", 1800],
    breakout: [690, "square", 3500],
    blocks: [195, "triangle", 900],
    billiards: [430, "sine", 1500],
  };
  const [base, wave, band] = profiles[game] ?? [500, "triangle", 2200];
  const note = (ratio: number, duration = 0.07, delay = 0, gain = 0.32) =>
    tone(base * ratio, duration, gain, delay, undefined, wave);
  if (["failure", "reject", "error"].includes(event))
    return [
      noise(band / 2, 0.06, 0.3),
      tone(base * 0.8, 0.12, 0.3, 0.025, base * 0.42, wave),
    ];
  if (event === "success")
    return [
      note(1, 0.09),
      note(1.25, 0.11, 0.085),
      note(1.5, 0.22, 0.18),
      noise(band, 0.15, 0.12),
    ];
  if (["clear", "complete", "category"].includes(event))
    return [
      noise(band, 0.065, 0.25),
      note(1, 0.08),
      note(1.5, 0.1, 0.07),
      note(2, 0.15, 0.13),
    ];
  if (event === "roll")
    return [0, 0.035, 0.09, 0.15, 0.23].flatMap((d, i) => [
      noise(1000 + i * 130, 0.025, 0.25, d),
      tone(175 + i * 25, 0.02, 0.32, d),
    ]);
  if (event === "jump")
    return [noise(700, 0.065, 0.32), tone(150, 0.13, 0.38, 0, 470)];
  if (event === "land")
    return [tone(90, 0.08, 0.6, 0, 42), noise(380, 0.08, 0.4)];
  if (event === "flap")
    return [
      noise(1600, 0.055, 0.5),
      noise(2700, 0.045, 0.25, 0.035),
      tone(900, 0.045, 0.16, 0, 650),
    ];
  if (event === "short-jump") return [noise(900, 0.045, 0.25)];
  if (event === "buffer") return [note(1.4, 0.025, 0, 0.15)];
  if (event === "eat")
    return [note(1.8, 0.045), note(2.4, 0.08, 0.045), noise(band, 0.035, 0.3)];
  if (event === "rotate") return [note(0.85, 0.035), note(1.25, 0.04, 0.025)];
  if (event === "hold")
    return [noise(band, 0.065, 0.3), note(1.3, 0.06), note(0.75, 0.06, 0.045)];
  if (event === "hard-drop")
    return [noise(500, 0.09, 0.55), tone(95, 0.11, 0.6, 0, 40)];
  if (event === "soft-drop") return [note(0.7, 0.028, 0, 0.2)];
  if (["tile-place", "place", "lock"].includes(event))
    return [
      noise(band, 0.035, 0.35),
      tone(base, 0.06, 0.48, 0, base * 0.45, wave),
    ];
  if (event === "capture")
    return [noise(band, 0.07, 0.45), note(0.75, 0.055), note(0.55, 0.07, 0.03)];
  if (event === "promote")
    return [note(1, 0.07), note(1.5, 0.09, 0.06), note(2, 0.13, 0.12)];
  if (event === "check") return [note(1.6, 0.08), note(1.6, 0.08, 0.12)];
  if (event === "brick")
    return [noise(band, 0.07, 0.4), note(1.7, 0.055), note(2.1, 0.04, 0.025)];
  if (event === "paddle")
    return [note(0.8, 0.045), noise(band / 2, 0.025, 0.2)];
  if (event === "bounce") return [note(1.3, 0.03)];
  if (event === "note") return [note(1.5, 0.027, 0, 0.17)];
  if (["erase", "cancel", "undo", "pass"].includes(event))
    return [
      noise(band, 0.035, 0.17),
      tone(base * 1.2, 0.055, 0.2, 0, base * 0.7, wave),
    ];
  if (event === "write")
    return [noise(band, 0.025, 0.18), note(1.1, 0.018, 0, 0.14)];
  if (event === "reveal") return [note(0.8, 0.07), note(1.2, 0.09, 0.06)];
  if (event === "hint") return [note(1.2, 0.06), note(1.8, 0.11, 0.05)];
  if (["coin", "score", "correct"].includes(event))
    return [note(1.5, 0.045), note(2, 0.09, 0.04)];
  if (event === "move")
    return [noise(band, 0.025, 0.2), note(0.9, 0.035, 0, 0.22)];
  // A stable small pitch difference between controls; variation on repeats is applied at synthesis.
  const offset = [...event].reduce((n, c) => n + c.charCodeAt(0), 0) % 7;
  return [note(0.9 + offset * 0.045, 0.025, 0, 0.16), noise(band, 0.016, 0.1)];
}

/** Every intentional command receives feedback. Clock, pointer preview and held repeats stay quiet. */
export function soundEventForTransition(
  id: string,
  p: GameState,
  n: GameState,
  a: Action,
): { event: string; cue: SoundCue | null } | null {
  const cue = soundForTransition(id, p, n, a),
    type = a.type.toUpperCase();
  if (
    ["CLOCK", "RELEASE", "POINTER_MOVE", "POINTER_UP"].includes(type) ||
    a.repeat
  )
    return null;
  if (type === "TICK") {
    if (!cue) return null;
    const effect = n.effect?.type;
    const event =
      id === "breakout"
        ? effect === "shatter"
          ? "brick"
          : effect === "paddle"
            ? "paddle"
            : cue
        : id === "billiards" && cue === "bounce"
          ? n.balls?.some((b: any) => {
              const old = p.balls?.find((v: any) => v.id === b.id);
              return (
                old &&
                !b.pocketed &&
                Math.hypot(b.vx, b.vy) > Math.hypot(old.vx, old.vy) + 25
              );
            })
            ? "ball-hit"
            : "rail-hit"
          : id === "billiards" && cue === "coin"
            ? "pocket"
            : cue;
    return { event, cue };
  }
  if (a.down === false)
    return id === "runner" && type === "JUMP" && n.vy < p.vy
      ? { event: "short-jump", cue: null }
      : null;
  if (cue === "failure" || cue === "success") return { event: cue, cue };
  if (cue === "error") return { event: "reject", cue };
  let event: string | undefined;
  if (id === "solitaire") {
    if (type === "DRAW")
      event = p.stock?.length
        ? p.variant === "spider"
          ? "card-deal"
          : "card-draw"
        : "card-recycle";
    if (type === "MOVE")
      event = a.to?.zone === "foundation" ? "card-home" : "card-slide";
    if (type === "PAIR") event = "card-remove";
    if (type === "UNDO") event = p.history?.length ? "undo" : "reject";
    if (type === "HINT") event = n.hint ? "hint" : "reject";
    if (["MOVE", "PAIR", "DRAW"].includes(type) && n.moves === p.moves)
      event = "reject";
    if (
      type === "MOVE" &&
      event !== "reject" &&
      n.tableau?.some((pile: any[]) =>
        pile.some(
          (card) =>
            card.up &&
            p.tableau?.flat().some((old: any) => old.id === card.id && !old.up),
        ),
      )
    )
      event += "+card-flip";
    if (cue === "clear") event = "card-remove+clear";
  }
  if (id === "poker") {
    if (type === "CALL")
      event =
        p.highest > (p.players?.[p.turn]?.bet ?? 0)
          ? "chips-call"
          : "chips-check";
    if (type === "RAISE") event = "chips-raise";
    if (type === "ALL_IN") event = "chips-all-in";
    if (type === "FOLD") event = "card-fold";
    if (type === "NEXT_HAND") event = "card-recycle+card-deal";
    if (event && n === p) event = "reject";
    if (event && n.board?.length > p.board?.length) event += "+card-deal";
  }
  if (id === "billiards")
    event = (
      {
        SHOOT: "cue-strike",
        PLACE: "place",
        AIM: "aim",
        POWER: "power",
        CALL_BALL: "call-ball",
        CALL_POCKET: "call-pocket",
        BREAK_CHOICE: "control",
      } as Record<string, string>
    )[type];
  if (
    id === "billiards" &&
    ((type === "SHOOT" && n.phase !== "moving") ||
      (type === "PLACE" && n.inHand))
  )
    event = "reject";
  if (id === "domino")
    event = (
      {
        PLAY: "tile-place",
        DRAW: "draw",
        PASS: "pass",
        NEXT_ROUND: "draw",
      } as Record<string, string>
    )[type];
  if (id === "chess")
    event =
      cue === "place"
        ? "capture"
        : type === "PROMOTE"
          ? "promote"
          : cue === "move"
            ? String(n.log?.at(-1)).includes("+")
              ? "check"
              : "move"
            : undefined;
  if (id === "letters")
    event = (
      {
        PLACE: "tile-place",
        RECALL: "erase",
        PASS: "pass",
        EXCHANGE: "draw",
        PLAY:
          n.last?.valid === false
            ? "reject"
            : n.last?.bingo
              ? "complete"
              : "score",
      } as Record<string, string>
    )[type];
  if (
    id === "letters" &&
    n.message &&
    [
      "occupied",
      "blank",
      "recall-first",
      "exchange-bag",
      "exchange-select",
    ].includes(n.message)
  )
    event = "reject";
  if (id === "sudoku")
    event =
      type === "NUMBER"
        ? a.value === 0
          ? "erase"
          : p.noteMode
            ? "note"
            : "write"
        : type === "NOTES"
          ? "note"
          : undefined;
  if (id === "crossword")
    event = (
      {
        INPUT: a.value ? "write" : "erase",
        PASTE: "write",
        BACKSPACE: "erase",
        CHECK: "check",
        DIR: "rotate",
        ARROW: "select",
      } as Record<string, string>
    )[type];
  if (id === "blocks")
    event = (
      {
        CW: "rotate",
        CCW: "rotate",
        HOLD: "hold",
        HARD: "hard-drop",
        DOWN: "soft-drop",
        LEFT: "move",
        RIGHT: "move",
      } as Record<string, string>
    )[type];
  if (id === "runner" && ["JUMP", "POINTER"].includes(type))
    event = n.vy > p.vy ? "jump" : "buffer";
  if (id === "trivia" && type === "ANSWER")
    event = n.phase === "reveal" ? "reveal" : "correct";
  if (["HINT", "UNDO", "PASS", "REVEAL"].includes(type) && !event)
    event = type.toLowerCase();
  if (
    event &&
    n === p &&
    !["SELECT", "CELL", "SLOT", "ARROW", "AIM", "POWER"].includes(type)
  )
    event = "reject";
  if (!event)
    event =
      cue ??
      (["SELECT", "CELL", "SLOT"].includes(type)
        ? "select"
        : "control-" + type.toLowerCase());
  return { event, cue };
}
