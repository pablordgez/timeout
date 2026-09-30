import { Chess } from "chess.js";
import type { Session } from "./storage";
import type { GameDefinition } from "./types";

/** Validate imported game payloads before they can reach views or workers. */
export function validateGameSession(
  session: Session,
  game: GameDefinition,
): void {
  const fail = () => {
    throw Error(`Invalid game data: ${game.id}`);
  };
  const require = (condition: unknown) => {
    if (!condition) fail();
  };
  const array = (v: any, n?: number): any[] => {
    require(Array.isArray(v) && (n === undefined || v.length === n));
    return v;
  };
  const ints = (v: any, min: number, max: number, n?: number) =>
    array(v, n).every((x) => Number.isInteger(x) && x >= min && x <= max);
  const text = (v: any) => typeof v === "string";
  const num = (v: any) => Number.isFinite(v);
  const s = session.state;
  require(
    session.gameVersion <= game.version &&
      (session.gameVersion === game.version || game.migrate),
  );
  for (const option of game.options)
    require(option.values.some((v) => v.value === session.config[option.key]));
  if (session.config.language !== undefined)
    require(["es", "en"].includes(String(session.config.language)));
  if (session.config.humans && session.config.players)
    require(
      Number(session.config.humans) <=
        (game.playerCount?.(session.config) ??
          (game.id === "domino" && session.config.mode === "pairs"
            ? 4
            : Number(session.config.players))),
    );
  require(
    Number.isInteger(s.moves) &&
      s.moves >= 0 &&
      Number.isInteger(s.rng) &&
      s.rng >= 0 &&
      s.rng <= 0xffffffff,
  );
  const turn = (players: any[]) =>
    require(Number.isInteger(s.turn) && s.turn >= 0 && s.turn < players.length);
  switch (game.id) {
    case "solitaire": {
      require(
        ["klondike", "spider", "freecell", "pyramid"].includes(s.variant),
      );
      const card = (c: any) =>
        c &&
        Number.isInteger(c.id) &&
        Number.isInteger(c.rank) &&
        c.rank >= 1 &&
        c.rank <= 13 &&
        Number.isInteger(c.suit) &&
        c.suit >= 0 &&
        c.suit < 4 &&
        typeof c.up === "boolean";
      const piles = [
        ...array(s.tableau),
        ...array(s.foundations, 4),
        ...array(s.completed),
        array(s.stock),
        array(s.waste),
        array(s.removed),
        array(s.cells, 4).filter(Boolean),
        array(s.pyramid).filter(Boolean),
      ];
      const cards = piles.flatMap((p) => array(p));
      require(
        cards.every(card) &&
          cards.length === (s.variant === "spider" ? 104 : 52) &&
          new Set(cards.map((c) => c.id)).size === cards.length,
      );
      array(s.history);
      break;
    }
    case "sudoku":
      require(
        ints(s.puzzle, 0, 9, 81) &&
          ints(s.board, 0, 9, 81) &&
          ints(s.solution, 1, 9, 81),
      );
      require(
        array(s.notes, 81).every((n) => ints(n, 1, 9)) &&
          Number.isInteger(s.selected) &&
          s.selected >= 0 &&
          s.selected < 81 &&
          s.rating &&
          num(s.rating.level) &&
          text(s.rating.technique),
      );
      require(
        array(s.undo).every(
          (u) =>
            ints(u.board, 0, 9, 81) &&
            array(u.notes, 81).every((n) => ints(n, 1, 9)),
        ),
      );
      break;
    case "wordle":
      require(
        ["es", "en"].includes(s.language) &&
          /^[a-zñ]{5}$/.test(s.target) &&
          array(s.guesses).length <= 6 &&
          s.guesses.every((w: any) => text(w) && w.length === 5),
      );
      require(array(s.marks, s.guesses.length).every((m) => ints(m, 0, 2, 5)));
      break;
    case "ring":
      require(
        ["es", "en"].includes(s.language) &&
          array(s.questions, s.language === "es" ? 27 : 26).every(
            (q) =>
              q &&
              text(q.w) &&
              text(q.g) &&
              text(q.letter) &&
              ["pending", "passed", "correct", "wrong"].includes(q.result),
          ),
      );
      require(
        Number.isInteger(s.index) &&
          s.index >= 0 &&
          s.index < s.questions.length &&
          num(s.remaining) &&
          s.remaining >= 0 &&
          num(s.duration),
      );
      array(s.answers);
      break;
    case "crossword": {
      const p = s.puzzle;
      require(p && [9, 11, 13].includes(p.size));
      const n = p.size * p.size;
      require(
        array(p.mask, n).every((v) => typeof v === "boolean") &&
          array(p.solution, n).every(text) &&
          array(s.board, n).every((v) => text(v) && v.length <= 1),
      );
      require(
        array(p.slots).length > 0 &&
          p.slots.every(
            (v: any) =>
              v &&
              text(v.word) &&
              text(v.clue) &&
              ["across", "down"].includes(v.direction) &&
              ints(v.cells, 0, n - 1) &&
              v.cells.length === v.word.length &&
              v.cells.every(
                (cell: number, i: number) => p.solution[cell] === v.word[i],
              ),
          ),
      );
      require(
        Number.isInteger(s.selected) &&
          p.mask[s.selected] &&
          ["across", "down"].includes(s.direction),
      );
      break;
    }
    case "letters": {
      require(["es", "en"].includes(s.language));
      const tile = (t: any) =>
        t &&
        Number.isInteger(t.id) &&
        text(t.letter) &&
        num(t.value) &&
        t.value >= 0;
      const board = array(s.board, 225);
      require(board.every((t) => t === null || tile(t)));
      const players = array(s.players, Number(session.config.players));
      turn(players);
      require(
        players.every(
          (p) =>
            p &&
            num(p.points) &&
            array(p.rack).length <= 7 &&
            p.rack.every(tile),
        ) && array(s.bag).every(tile),
      );
      const tiles = [
        ...board.filter(Boolean),
        ...s.bag,
        ...players.flatMap((p) => p.rack),
      ];
      require(
        tiles.length === 100 && new Set(tiles.map((t) => t.id)).size === 100,
      );
      array(s.pending);
      array(s.log);
      break;
    }
    case "chess": {
      require(
        text(s.fen) &&
          text(s.pgn) &&
          array(s.log).every(text) &&
          text(s.selected),
      );
      const c = new Chess(s.fen);
      if (s.pgn) {
        const replay = new Chess();
        replay.loadPgn(s.pgn);
        require(replay.fen() === c.fen());
      }
      break;
    }
    case "poker": {
      const players = array(s.players, Number(session.config.players));
      if (s.street !== "showdown") turn(players);
      else require(s.turn === -1);
      require(
        players.every(
          (p) =>
            p &&
            num(p.stack) &&
            p.stack >= 0 &&
            ints(p.hole, 0, 51) &&
            num(p.total) &&
            num(p.bet) &&
            typeof p.folded === "boolean",
        ),
      );
      require(
        ints(s.deck, 0, 51) &&
          ints(s.board, 0, 51) &&
          s.board.length <= 5 &&
          ["preflop", "flop", "turn", "river", "showdown"].includes(s.street),
      );
      array(s.pending);
      array(s.results);
      array(s.log);
      break;
    }
    case "domino": {
      const hands = array(
        s.hands,
        session.config.mode === "pairs" ? 4 : Number(session.config.players),
      );
      turn(hands);
      require(
        hands.every((h) => ints(h, 0, 27)) &&
          ints(s.stock, 0, 27) &&
          array(s.chain).every(
            (t) =>
              t &&
              Number.isInteger(t.id) &&
              t.id >= 0 &&
              t.id < 28 &&
              Number.isInteger(t.left) &&
              Number.isInteger(t.right) &&
              t.left >= 0 &&
              t.left <= 6 &&
              t.right >= 0 &&
              t.right <= 6,
          ),
      );
      const tiles = [
        ...hands.flat(),
        ...s.stock,
        ...s.chain.map((t: any) => t.id),
      ];
      require(
        tiles.length === 28 &&
          new Set(tiles).size === 28 &&
          ["play", "roundover"].includes(s.phase),
      );
      array(s.points);
      array(s.winners);
      break;
    }
    case "billiards":
      require(
        array(s.balls, 16).every(
          (b) =>
            b &&
            Number.isInteger(b.id) &&
            b.id >= 0 &&
            b.id < 16 &&
            ["x", "y", "vx", "vy"].every((k) => num(b[k])) &&
            typeof b.pocketed === "boolean",
        ),
      );
      require(
        new Set(s.balls.map((b: any) => b.id)).size === 16 &&
          ["aim", "moving", "break-choice"].includes(s.phase) &&
          num(s.turn) &&
          num(s.angle) &&
          num(s.power) &&
          s.event &&
          text(s.event.es) &&
          text(s.event.en),
      );
      array(s.groups, 2);
      array(s.fouls, 2);
      array(s.shots, 2);
      break;
    case "trivia": {
      const players = array(s.players, Number(session.config.players));
      turn(players);
      require(
        players.every(
          (p) =>
            p &&
            text(p.name) &&
            num(p.position) &&
            array(p.tokens, 6).every((v) => typeof v === "boolean"),
        ) && array(s.decks, 6).every((d) => array(d).every(text)),
      );
      require(
        array(s.pool).length > 0 &&
          s.pool.every(
            (q: any) =>
              q &&
              text(q.id) &&
              text(q.q) &&
              text(q.a) &&
              Number.isInteger(q.category) &&
              q.category >= 0 &&
              q.category < 6,
          ) &&
          ["roll", "move", "question", "reveal"].includes(s.phase),
      );
      require(
        ["roll", "move"].includes(s.phase) ||
          (s.question && text(s.question.q) && text(s.question.a)),
      );
      array(s.destinations);
      break;
    }
    case "blocks":
      require(
        array(s.board, 20).every((r) =>
          array(r, 10).every((v) => v === null || "IOTSZJL".includes(v)),
        ) &&
          "IOTSZJL".includes(s.piece) &&
          array(s.queue).every((v) => "IOTSZJL".includes(v)) &&
          ["modern", "classic"].includes(s.profile),
      );
      require(
        [
          "x",
          "y",
          "rotation",
          "frame",
          "accumulator",
          "elapsed",
          "gravity",
          "lock",
          "delay",
          "das",
          "nesSeed",
        ].every((k) => num(s[k])) &&
          s.input &&
          ["left", "right", "down"].every(
            (k) => typeof s.input[k] === "boolean",
          ),
      );
      array(s.pending);
      break;
    case "snake":
      require(
        s.kind === "snake" &&
          array(s.snake).length > 0 &&
          s.snake.every((p: any) => ints(p, 0, 19, 2)) &&
          ints(s.food, 0, 19, 2) &&
          ints(s.direction, -1, 1, 2) &&
          ints(s.queued, -1, 1, 2) &&
          num(s.period),
      );
      break;
    case "runner":
      require(
        s.kind === "runner" &&
          num(s.y) &&
          num(s.vy) &&
          num(s.speed) &&
          array(s.obstacles).every(
            (o) => o && num(o.x) && num(o.w) && num(o.h),
          ),
      );
      break;
    case "flappy":
      require(
        s.kind === "flappy" &&
          num(s.y) &&
          num(s.vy) &&
          array(s.pipes).every(
            (p) => p && num(p.x) && num(p.gap) && typeof p.scored === "boolean",
          ),
      );
      break;
    case "breakout":
      require(
        s.kind === "breakout" &&
          ["x", "y", "vx", "vy", "paddle", "input", "lives", "level"].every(
            (k) => num(s[k]),
          ) &&
          array(s.bricks).every((b) => b && num(b.x) && num(b.y) && num(b.hp)),
      );
      break;
    default:
      fail();
  }
}
