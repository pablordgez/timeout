import { describe, expect, it } from 'vitest';
import { allCards, canMove, canPair, createSolitaire, findHint, freecellCapacity, pyramidExposed, solitaireReducer, type Card, type SolitaireState, type Variant } from '../src/games/solitaire/engine';

const card = (rank: number, suit = 0, id = rank + suit * 13, up = true): Card => ({ id, rank, suit, up });
function fixture(variant: Variant): SolitaireState {
  const state = createSolitaire({ variant }, 22);
  return { ...state, tableau: Array.from({ length: variant === 'spider' ? 10 : variant === 'freecell' ? 8 : 7 }, () => []), stock: [], waste: [], foundations: [[], [], [], []], cells: [null, null, null, null], pyramid: Array.from({ length: 28 }, () => null), history: [] };
}
const col = (index: number, offset?: number) => ({ zone: 'tableau' as const, index, offset });
const home = (index: number) => ({ zone: 'foundation' as const, index });
const cell = (index: number) => ({ zone: 'cell' as const, index });
const pyramid = (index: number) => ({ zone: 'pyramid' as const, index });

describe('Solitaire dealing and conservation', () => {
  it.each(['klondike', 'freecell', 'pyramid', 'spider'] as Variant[])('%s deals reproducibly with every card present exactly once', variant => {
    for (let seed = 1; seed <= 30; seed++) {
      const config = { variant, suits: 4 };
      const state = createSolitaire(config, seed);
      expect(state).toEqual(createSolitaire(config, seed));
      expect(allCards(state)).toHaveLength(variant === 'spider' ? 104 : 52);
      expect(new Set(allCards(state).map(c => c.id)).size).toBe(variant === 'spider' ? 104 : 52);
      if (variant === 'klondike') { expect(state.tableau.map(c => c.length)).toEqual([1, 2, 3, 4, 5, 6, 7]); expect(state.stock).toHaveLength(24); }
      if (variant === 'spider') { expect(state.tableau.map(c => c.length)).toEqual([6, 6, 6, 6, 5, 5, 5, 5, 5, 5]); expect(state.stock).toHaveLength(50); }
      if (variant === 'freecell') { expect(state.stock).toHaveLength(0); expect(state.tableau.map(c => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6]); expect(state.tableau.flat().every(c => c.up)).toBe(true); }
      if (variant === 'pyramid') { expect(state.stock).toHaveLength(24); expect(state.pyramid).toHaveLength(28); }
    }
  });
  it.each([1, 2, 4])('Spider has balanced %s-suit distributions', suits => {
    const cards = allCards(createSolitaire({ variant: 'spider', suits }, 5));
    for (let suit = 0; suit < suits; suit++) for (let rank = 1; rank <= 13; rank++) expect(cards.filter(c => c.suit === suit && c.rank === rank)).toHaveLength(8 / suits);
  });
  it.each(['klondike', 'freecell', 'pyramid', 'spider'] as Variant[])('hint-driven %s actions preserve cards and undo restores the exact state', variant => {
    const config = { variant, draw: 3, suits: 2 };
    let state = createSolitaire(config, 173);
    const ids = allCards(state).map(c => c.id).sort((a, b) => a - b);
    for (let step = 0; step < 100; step++) {
      const hint = findHint(state);
      if (!hint) break;
      const previous = state;
      state = solitaireReducer(state, hint, config);
      expect(state.moves).toBe(previous.moves + 1);
      expect(allCards(state).map(c => c.id).sort((a, b) => a - b)).toEqual(ids);
      expect(solitaireReducer(state, { type: 'undo' }, config)).toEqual({ ...previous, hint: undefined, message: undefined });
    }
  });
});

describe('Klondike legal moves and stock', () => {
  it('moves alternating descending groups, flips uncovered cards, and forbids invalid transfers', () => {
    const state = fixture('klondike');
    state.tableau[0] = [card(9, 2, 0, false), card(6, 1, 1), card(5, 0, 2)];
    state.tableau[1] = [card(7, 3, 3)];
    expect(canMove(state, col(0, 1), col(1))).toBe(true);
    expect(canMove(state, col(0, 0), col(1))).toBe(false);
    expect(canMove(state, col(0, 1), col(2))).toBe(false);
    const next = solitaireReducer(state, { type: 'move', from: col(0, 1), to: col(1) }, {});
    expect(next.tableau[0]).toEqual([card(9, 2, 0, true)]);
    expect(next.tableau[1].map(c => c.rank)).toEqual([7, 6, 5]);
    expect(solitaireReducer(state, { type: 'move', from: col(0, 0), to: col(1) }, {}).tableau).toEqual(state.tableau);
  });
  it('accepts only kings in empty columns and same-suit ascending homes', () => {
    const state = fixture('klondike');
    state.tableau[0] = [card(13, 0), card(12, 1)];
    state.waste = [card(1, 2), card(2, 3)];
    expect(canMove(state, col(0, 0), col(1))).toBe(true);
    expect(canMove(state, col(0, 1), col(1))).toBe(false);
    expect(canMove(state, { zone: 'waste', index: 0, offset: 0 }, home(0))).toBe(false);
    state.tableau[2] = [card(1, 2)];
    expect(canMove(state, col(2), home(0))).toBe(true);
    state.foundations[0] = [card(1, 2)];
    state.tableau[2] = [card(2, 1)];
    expect(canMove(state, col(2), home(0))).toBe(false);
    state.tableau[2] = [card(2, 2)];
    expect(canMove(state, col(2), home(0))).toBe(true);
  });
  it('draw-three recycling restores order, and a short last draw stays playable', () => {
    let state = fixture('klondike');
    state.stock = [card(1), card(2), card(3), card(4)];
    state = solitaireReducer(state, { type: 'draw' }, { draw: 3 });
    expect(state.waste.map(c => c.rank)).toEqual([4, 3, 2]);
    state = solitaireReducer(state, { type: 'draw' }, { draw: 3 });
    expect(state.waste.at(-1)?.rank).toBe(1);
    state = solitaireReducer(state, { type: 'draw' }, { draw: 3 });
    expect(state.stock.map(c => c.rank)).toEqual([1, 2, 3, 4]);
    expect(state.stock.every(c => !c.up)).toBe(true);
    expect(state.waste).toHaveLength(0);
    state = solitaireReducer(state, { type: 'draw' }, { draw: 3 });
    expect(state.waste.map(c => c.rank)).toEqual([4, 3, 2]);
  });
  it('wins only after completing all four homes', () => {
    const state = fixture('klondike');
    state.foundations = Array.from({ length: 4 }, (_, suit) => Array.from({ length: suit === 0 ? 12 : 13 }, (_, rank) => card(rank + 1, suit)));
    state.tableau[0] = [card(13, 0)];
    const next = solitaireReducer(state, { type: 'move', from: col(0), to: home(0) }, {});
    expect(next.status).toBe('won'); expect(next.score).toBe(520);
  });
});

describe('Spider', () => {
  it('builds any suit but transfers only same-suit runs', () => {
    const state = fixture('spider');
    state.tableau[0] = [card(6, 0), card(5, 1)]; state.tableau[1] = [card(7, 2)];
    expect(canMove(state, col(0, 0), col(1))).toBe(false);
    expect(canMove(state, col(0, 1), col(2))).toBe(true);
    state.tableau[0][1].suit = 0;
    expect(canMove(state, col(0, 0), col(1))).toBe(true);
  });
  it('forbids dealing with empty columns, deals ten and can undo', () => {
    const state = createSolitaire({ variant: 'spider' }, 34);
    const next = solitaireReducer(state, { type: 'draw' }, {});
    expect(next.stock).toHaveLength(40);
    expect(next.tableau.map(c => c.length)).toEqual([7, 7, 7, 7, 6, 6, 6, 6, 6, 6]);
    state.tableau[0] = [];
    const invalid = solitaireReducer(state, { type: 'draw' }, {});
    expect(invalid.message).toBe('fill-columns'); expect(invalid.stock).toHaveLength(50);
  });
  it('removes complete same-suit sequences and detects the eighth completion', () => {
    const state = fixture('spider');
    state.tableau[0] = Array.from({ length: 12 }, (_, i) => card(13 - i, 0));
    state.tableau[1] = [card(1, 0)];
    state.completed = Array.from({ length: 7 }, () => []);
    const next = solitaireReducer(state, { type: 'move', from: col(1), to: col(0) }, {});
    expect(next.tableau[0]).toHaveLength(0); expect(next.completed[7]).toHaveLength(13); expect(next.status).toBe('won');
    expect(next.score).toBe(800);
  });
});

describe('FreeCell', () => {
  it('limits groups to cells and auxiliary columns, excluding empty destination', () => {
    const state = fixture('freecell');
    state.cells = [card(1), card(2), card(3), card(4)];
    state.tableau = Array.from({ length: 8 }, (_, i) => [card(7, i % 2 === 0 ? 1 : 0, 50 + i)]);
    state.tableau[0] = [card(6, 1), card(5, 0), card(4, 1)];
    expect(freecellCapacity(state, col(1))).toBe(1);
    expect(canMove(state, col(0, 0), col(1))).toBe(false);
    state.cells[0] = null; expect(freecellCapacity(state, col(1))).toBe(2);
    state.tableau[2] = []; expect(freecellCapacity(state, col(1))).toBe(4);
    state.tableau[1] = [card(7, 0)]; expect(canMove(state, col(0, 0), col(1))).toBe(true);
    expect(freecellCapacity(state, col(2))).toBe(2);
    expect(canMove(state, col(0, 0), col(2))).toBe(false);
  });
  it('puts single cards in cells and permits arbitrary ranks in empty columns', () => {
    const state = fixture('freecell'); state.tableau[0] = [card(6, 1), card(5, 0)];
    expect(canMove(state, col(0, 0), cell(0))).toBe(false);
    expect(canMove(state, col(0, 1), cell(0))).toBe(true);
    const next = solitaireReducer(state, { type: 'move', from: col(0, 1), to: cell(0) }, {});
    expect(next.cells[0]?.rank).toBe(5);
    expect(canMove(next, cell(0), col(1))).toBe(true);
    expect(canMove(next, col(0), cell(0))).toBe(false);
  });
});

describe('Pyramid', () => {
  it('exposes a parent only when both covering cards are removed', () => {
    const state = createSolitaire({ variant: 'pyramid' }, 7);
    expect(pyramidExposed(state, 0)).toBe(false);
    expect(pyramidExposed(state, 21)).toBe(true);
    state.pyramid[21] = null;
    expect(pyramidExposed(state, 15)).toBe(false);
    state.pyramid[22] = null;
    expect(pyramidExposed(state, 15)).toBe(true);
  });
  it('requires sum 13, accepts a king alone and never pairs a card with itself', () => {
    const state = fixture('pyramid'); state.pyramid[21] = card(6); state.pyramid[22] = card(7, 1); state.pyramid[23] = card(13);
    expect(canPair(state, pyramid(21), pyramid(22))).toBe(true);
    expect(canPair(state, pyramid(21), pyramid(21))).toBe(false);
    expect(canPair(state, pyramid(23))).toBe(true);
    let next = solitaireReducer(state, { type: 'pair', first: pyramid(21), second: pyramid(22) }, {});
    expect(next.removed).toHaveLength(2); expect(next.status).toBe('playing');
    next = solitaireReducer(next, { type: 'pair', first: pyramid(23) }, {});
    expect(next.status).toBe('won');
  });
  it('pairs with the waste, leaves remaining stock at victory, and does not recycle', () => {
    const state = fixture('pyramid'); state.pyramid[0] = card(1); state.waste = [card(12, 1)]; state.stock = [card(5)];
    const next = solitaireReducer(state, { type: 'pair', first: pyramid(0), second: { zone: 'waste', index: 0 } }, {});
    expect(next.status).toBe('won'); expect(next.stock).toHaveLength(1);
    const exhausted = { ...state, stock: [] };
    expect(solitaireReducer(exhausted, { type: 'draw' }, {}).waste).toEqual(state.waste);
  });
});
