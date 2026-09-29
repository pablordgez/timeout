import type { Action, Config, GameState } from '../../core/types';
import { shuffle } from '../../core/random';

export type Variant = 'klondike' | 'spider' | 'freecell' | 'pyramid';
export interface Card { id: number; rank: number; suit: number; up: boolean }
export interface Place { zone: 'tableau' | 'stock' | 'waste' | 'foundation' | 'cell' | 'pyramid'; index: number; offset?: number }
export interface SolitaireState extends GameState {
  variant: Variant; tableau: Card[][]; stock: Card[]; waste: Card[];
  foundations: Card[][]; cells: (Card | null)[]; pyramid: (Card | null)[];
  removed: Card[]; completed: Card[][]; history: Snapshot[]; hint?: Action;
}
type Snapshot = Omit<SolitaireState, 'history'>;
export const red = (card: Card) => card.suit === 1 || card.suit === 2;
export const rankLabel = (rank: number) => ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank];
export const suitLabel = (suit: number) => ['♠', '♥', '♦', '♣'][suit];
const clone = <T,>(value: T): T => structuredClone(value);
function deck(suits = 4, copies = 1): Card[] {
  let id = 0;
  const result: Card[] = [];
  for (let copy = 0; copy < copies; copy++) for (let suit = 0; suit < suits; suit++) for (let rank = 1; rank <= 13; rank++) result.push({ id: id++, suit, rank, up: false });
  return result;
}
export function createSolitaire(config: Config, seed: number): SolitaireState {
  const variant = (config.variant || 'klondike') as Variant;
  const suits = [1, 2, 4].includes(Number(config.suits)) ? Number(config.suits) : 1;
  const shuffled = shuffle(variant === 'spider' ? deck(suits, 8 / suits) : deck(), seed);
  const state: SolitaireState = { variant, rng: shuffled.seed, status: 'playing', moves: 0, score: 0, stock: shuffled.items, waste: [], tableau: [], foundations: [[], [], [], []], cells: [null, null, null, null], pyramid: [], removed: [], completed: [], history: [] };
  if (variant === 'pyramid') {
    for (let i = 0; i < 28; i++) state.pyramid.push({ ...state.stock.pop()!, up: true });
  } else {
    const columns = variant === 'spider' ? 10 : variant === 'freecell' ? 8 : 7;
    for (let i = 0; i < columns; i++) {
      const count = variant === 'spider' ? (i < 4 ? 6 : 5) : variant === 'freecell' ? (i < 4 ? 7 : 6) : i + 1;
      state.tableau.push(Array.from({ length: count }, (_, j) => ({ ...state.stock.pop()!, up: variant === 'freecell' || j === count - 1 })));
    }
  }
  return state;
}
function pile(state: SolitaireState, place: Place): Card[] {
  if (!place || !Number.isInteger(place.index) || place.index < 0) return [];
  switch (place.zone) {
    case 'tableau': return state.tableau[place.index] || [];
    case 'foundation': return state.foundations[place.index] || [];
    case 'stock': return place.index === 0 ? state.stock : [];
    case 'waste': return place.index === 0 ? state.waste : [];
    case 'cell': return state.cells[place.index] ? [state.cells[place.index]!] : [];
    case 'pyramid': return state.pyramid[place.index] ? [state.pyramid[place.index]!] : [];
  }
}
export function pyramidExposed(state: SolitaireState, index: number): boolean {
  if (!state.pyramid[index]) return false;
  let row = 0;
  while ((row + 1) * (row + 2) / 2 <= index) row++;
  if (row === 6) return true;
  return !state.pyramid[index + row + 1] && !state.pyramid[index + row + 2];
}
export function movableRun(cards: Card[], sameSuit = false): boolean {
  return cards.length > 0 && cards.every((card, i) => card.up && (i === 0 || cards[i - 1].rank === card.rank + 1 && (sameSuit ? cards[i - 1].suit === card.suit : red(cards[i - 1]) !== red(card))));
}
export function freecellCapacity(state: SolitaireState, to: Place): number {
  const emptyCells = state.cells.filter(card => !card).length;
  const emptyColumns = state.tableau.filter((cards, index) => cards.length === 0 && !(to.zone === 'tableau' && to.index === index)).length;
  return (emptyCells + 1) * 2 ** emptyColumns;
}
export function canMove(state: SolitaireState, from: Place, to: Place): boolean {
  if (state.variant === 'pyramid' || !from || !to || from.zone === to.zone && from.index === to.index) return false;
  if (!Number.isInteger(to.index) || to.index < 0) return false;
  if (!['tableau', 'waste', 'cell', 'foundation'].includes(from.zone)) return false;
  if (from.zone === 'waste' && state.variant !== 'klondike' || from.zone === 'cell' && state.variant !== 'freecell' || from.zone === 'foundation' && state.variant === 'spider') return false;
  const origin = pile(state, from);
  const offset = from.offset ?? origin.length - 1;
  if (!Number.isInteger(offset) || offset < 0 || offset >= origin.length || from.zone !== 'tableau' && offset !== origin.length - 1) return false;
  const run = origin.slice(offset);
  if (!movableRun(run, state.variant === 'spider')) return false;
  if (state.variant === 'freecell' && run.length > freecellCapacity(state, to)) return false;
  if (to.zone === 'foundation') {
    if (state.variant === 'spider' || to.index >= 4 || run.length !== 1) return false;
    const destination = state.foundations[to.index];
    return !destination.length ? run[0].rank === 1 : destination.at(-1)!.suit === run[0].suit && destination.at(-1)!.rank + 1 === run[0].rank;
  }
  if (to.zone === 'cell') return state.variant === 'freecell' && to.index < 4 && !state.cells[to.index] && run.length === 1;
  if (to.zone !== 'tableau' || to.index >= state.tableau.length) return false;
  const destination = state.tableau[to.index];
  if (!destination.length) return state.variant !== 'klondike' || run[0].rank === 13;
  const last = destination.at(-1)!;
  return last.up && last.rank === run[0].rank + 1 && (state.variant === 'spider' || red(last) !== red(run[0]));
}
function removeFrom(state: SolitaireState, from: Place, count = 1): Card[] {
  if (from.zone === 'cell') { const card = state.cells[from.index]!; state.cells[from.index] = null; return [card]; }
  if (from.zone === 'pyramid') { const card = state.pyramid[from.index]!; state.pyramid[from.index] = null; return [card]; }
  const cards = pile(state, from).splice(-count);
  if (from.zone === 'tableau' && state.tableau[from.index].length) state.tableau[from.index].at(-1)!.up = true;
  return cards;
}
function pairCard(state: SolitaireState, place?: Place): Card | null {
  if (!place || place.zone !== 'pyramid' && place.zone !== 'waste') return null;
  if (place.zone === 'pyramid' && !pyramidExposed(state, place.index)) return null;
  return pile(state, place).at(-1) || null;
}
export function canPair(state: SolitaireState, first: Place, second?: Place): boolean {
  const a = pairCard(state, first);
  if (!a || state.variant !== 'pyramid') return false;
  if (!second) return a.rank === 13;
  if (first.zone === second.zone && first.index === second.index) return false;
  const b = pairCard(state, second);
  return !!b && a.rank + b.rank === 13;
}
function settle(state: SolitaireState) {
  if (state.variant === 'spider') {
    for (const cards of state.tableau) {
      // Removing one sequence can expose another completed sequence.
      while (cards.length >= 13) {
        const sequence = cards.slice(-13);
        if (sequence[0].rank !== 13 || !movableRun(sequence, true)) break;
        state.completed.push(cards.splice(-13));
        if (cards.length) cards.at(-1)!.up = true;
      }
    }
    state.score = state.completed.length * 100;
    if (state.completed.length === 8) state.status = 'won';
  } else if (state.variant === 'pyramid') {
    state.score = state.removed.length * 5;
    if (state.pyramid.every(card => !card)) state.status = 'won';
  } else {
    state.score = state.foundations.reduce((sum, cards) => sum + cards.length * 10, 0);
    if (state.foundations.every(cards => cards.length === 13)) state.status = 'won';
  }
}
export function findHint(state: SolitaireState): Action | null {
  if (state.status !== 'playing') return null;
  if (state.variant === 'pyramid') {
    const choices: Place[] = [...state.pyramid.flatMap((_, index) => pyramidExposed(state, index) ? [{ zone: 'pyramid' as const, index }] : []), ...(state.waste.length ? [{ zone: 'waste' as const, index: 0 }] : [])];
    for (const first of choices) {
      if (canPair(state, first)) return { type: 'pair', first };
      for (const second of choices) if (canPair(state, first, second)) return { type: 'pair', first, second };
    }
    return state.stock.length ? { type: 'draw' } : null;
  }
  const sources: Place[] = [];
  state.tableau.forEach((cards, index) => cards.forEach((card, offset) => { if (card.up) sources.push({ zone: 'tableau', index, offset }); }));
  if (state.waste.length && state.variant === 'klondike') sources.push({ zone: 'waste', index: 0 });
  if (state.variant === 'freecell') state.cells.forEach((card, index) => { if (card) sources.push({ zone: 'cell', index }); });
  const targets: Place[] = [...(state.variant !== 'spider' ? state.foundations.map((_, index) => ({ zone: 'foundation' as const, index })) : []), ...state.tableau.map((_, index) => ({ zone: 'tableau' as const, index }))];
  // Prioritize revealing hidden cards and foundation progress, avoiding pointless moves to empty columns.
  const candidates: { action: Action; priority: number }[] = [];
  for (const from of sources) for (const to of targets) if (canMove(state, from, to)) {
    const offset = from.offset ?? 0;
    if (to.zone === 'tableau' && !state.tableau[to.index].length && from.zone === 'tableau' && offset === 0) continue;
    const reveal = from.zone === 'tableau' && offset > 0 && !state.tableau[from.index][offset - 1].up;
    const sameSuit = to.zone === 'tableau' && state.tableau[to.index].at(-1)?.suit === pile(state, from)[from.offset ?? pile(state, from).length - 1]?.suit;
    candidates.push({ action: { type: 'move', from, to }, priority: (to.zone === 'foundation' ? 100 : 0) + (reveal ? 90 : 0) + (sameSuit ? 20 : 0) });
  }
  candidates.sort((a, b) => b.priority - a.priority);
  if (candidates.length) return candidates[0].action;
  if (state.variant === 'freecell') {
    for (const from of sources) for (let index = 0; index < 4; index++) if (canMove(state, from, { zone: 'cell', index })) return { type: 'move', from, to: { zone: 'cell', index } };
  }
  if (state.variant === 'klondike' && (state.stock.length || state.waste.length) || state.variant === 'spider' && state.stock.length && state.tableau.every(cards => cards.length)) return { type: 'draw' };
  return null;
}
export function solitaireReducer(state: SolitaireState, action: Action, config: Config): SolitaireState {
  if (action.type === 'undo') {
    if (!state.history.length) return { ...state, message: 'nothing-to-undo' };
    return { ...clone(state.history.at(-1)!), history: state.history.slice(0, -1), hint: undefined, message: undefined } as SolitaireState;
  }
  if (action.type === 'hint') { const hint = findHint(state); return { ...state, hint: hint || undefined, message: hint ? 'hint' : 'no-hint' }; }
  if (state.status !== 'playing') return state;
  const next = clone(state);
  next.hint = undefined;
  next.message = undefined;
  if (action.type === 'move') {
    if (!canMove(state, action.from, action.to)) return { ...state, message: 'invalid-move' };
    const origin = pile(state, action.from);
    const count = origin.length - (action.from.offset ?? origin.length - 1);
    const cards = removeFrom(next, action.from, count);
    if (action.to.zone === 'cell') next.cells[action.to.index] = cards[0];
    else pile(next, action.to).push(...cards);
  } else if (action.type === 'pair') {
    if (!canPair(state, action.first, action.second)) return { ...state, message: 'invalid-pair' };
    next.removed.push(...removeFrom(next, action.first));
    if (action.second) next.removed.push(...removeFrom(next, action.second));
  } else if (action.type === 'draw') {
    if (state.variant === 'freecell') return state;
    if (state.variant === 'spider') {
      if (!state.stock.length) return { ...state, message: 'empty-stock' };
      if (state.tableau.some(cards => !cards.length)) return { ...state, message: 'fill-columns' };
      for (const cards of next.tableau) cards.push({ ...next.stock.pop()!, up: true });
    } else if (state.stock.length) {
      const count = state.variant === 'klondike' && Number(config.draw) === 3 ? 3 : 1;
      for (let i = 0; i < count && next.stock.length; i++) next.waste.push({ ...next.stock.pop()!, up: true });
    } else if (state.variant === 'klondike' && state.waste.length) {
      next.stock = next.waste.reverse().map(card => ({ ...card, up: false })); next.waste = [];
    } else return { ...state, message: 'empty-stock' };
  } else return state;
  const { history: _history, ...snapshot } = state;
  next.history = [...state.history.slice(-199), clone(snapshot)];
  next.moves++;
  settle(next);
  return next;
}

export function allCards(state: SolitaireState): Card[] {
  return [...state.stock, ...state.waste, ...state.tableau.flat(), ...state.foundations.flat(), ...state.cells.filter((card): card is Card => !!card), ...state.pyramid.filter((card): card is Card => !!card), ...state.removed, ...state.completed.flat()];
}
