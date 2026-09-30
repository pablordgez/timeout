import type { Action, Config, GameState, Locale } from '../../core/types';
import { shuffle } from '../../core/random';
export const normalize = (word: string) => word.toLowerCase().normalize('NFD').replace(/n\u0303/g,'ñ').replace(/[\u0300-\u036f]/g,'').normalize('NFC');

export interface LetterTile { id: number; letter: string; value: number }
export interface Placement { row: number; col: number; tileId: number; letter?: string }
export interface WordScore { word: string; score: number; cells: number[]; multiplier: number }
export interface Evaluation { valid: boolean; error?: string; score: number; words: WordScore[]; bingo: number }
export interface LetterPlayer { rack: LetterTile[]; points: number }
export interface LettersState extends GameState {
  language: Locale; board: (LetterTile | null)[]; bag: LetterTile[]; players: LetterPlayer[]; turn: number;
  pending: Placement[]; scoreless: number; log: { player: number; score: number; words: string[]; type: string }[];
  winner?: number[]; ending?: string; last?: Evaluation;
}
export const distributions: Record<Locale, [string, number, number][]> = {
  es: [['A',12,1],['E',12,1],['O',9,1],['I',6,1],['S',6,1],['N',5,1],['R',5,1],['U',5,1],['L',4,1],['D',5,2],['T',4,1],['C',4,3],['G',2,2],['B',2,3],['M',2,3],['P',2,3],['H',2,4],['F',1,4],['V',1,4],['Y',1,4],['CH',1,5],['LL',1,8],['Q',1,5],['RR',1,8],['Ñ',1,8],['J',1,8],['X',1,8],['Z',1,10],['',2,0]],
  en: [['A',9,1],['B',2,3],['C',2,3],['D',4,2],['E',12,1],['F',2,4],['G',3,2],['H',2,4],['I',9,1],['J',1,8],['K',1,5],['L',4,1],['M',2,3],['N',6,1],['O',8,1],['P',2,3],['Q',1,10],['R',6,1],['S',4,1],['T',6,1],['U',4,1],['V',2,4],['W',2,4],['X',1,8],['Y',2,4],['Z',1,10],['',2,0]],
};
export function tileAlphabet(language: Locale) { return distributions[language].map(([letter]) => letter).filter(Boolean).sort((a,b) => a.localeCompare(b,language)); }
export function tokenizeWord(word: string, language: Locale): string[] {
  const canonical = normalize(word).toUpperCase();
  if (!/^[A-ZÑ]+$/.test(canonical)) return [];
  return language === 'es' ? canonical.match(/CH|LL|RR|[A-ZÑ]/g) || [] : canonical.match(/[A-Z]/g) || [];
}
export function makeBag(language: Locale) {
  let id = 0;
  return distributions[language].flatMap(([letter, count, value]) => Array.from({ length: count }, () => ({ id: id++, letter, value })));
}
export type Premium = 'TW' | 'DW' | 'TL' | 'DL' | '';
export const premiums: Premium[] = Array.from({ length: 225 }, () => '');
function premium(name: Premium, cells: [number, number][]) { cells.forEach(([row,col]) => premiums[row * 15 + col] = name); }
premium('TW', [[0,0],[0,7],[0,14],[7,0],[7,14],[14,0],[14,7],[14,14]]);
premium('DW', [[1,1],[2,2],[3,3],[4,4],[1,13],[2,12],[3,11],[4,10],[7,7],[10,4],[11,3],[12,2],[13,1],[10,10],[11,11],[12,12],[13,13]]);
premium('TL', [[1,5],[1,9],[5,1],[5,5],[5,9],[5,13],[9,1],[9,5],[9,9],[9,13],[13,5],[13,9]]);
premium('DL', [[0,3],[0,11],[2,6],[2,8],[3,0],[3,7],[3,14],[6,2],[6,6],[6,8],[6,12],[7,3],[7,11],[8,2],[8,6],[8,8],[8,12],[11,0],[11,7],[11,14],[12,6],[12,8],[14,3],[14,11]]);
export function createLettersSync(config: Config, seed: number): LettersState {
  const language: Locale = config.language === 'en' ? 'en' : 'es';
  const count = Math.max(2, Math.min(4, Number(config.players) || 2));
  const result = shuffle(makeBag(language), seed);
  const bag = result.items;
  const players = Array.from({ length: count }, () => ({ rack: bag.splice(-7), points: 0 }));
  return { language, rng: result.seed, status: 'playing', score: 0, moves: 0, board: Array.from({ length: 225 }, () => null), bag, players, turn: 0, pending: [], scoreless: 0, log: [] };
}
const position = (row: number, col: number) => row >= 0 && row < 15 && col >= 0 && col < 15 ? row * 15 + col : -1;
function error(reason: string): Evaluation { return { valid: false, error: reason, score: 0, words: [], bingo: 0 }; }
export function boardWithPlacements(state: Pick<LettersState,'board'|'players'|'turn'|'language'>, placements: Placement[]): (LetterTile | null)[] {
  const board = state.board.slice();
  for (const p of placements) {
    const tile = state.players[state.turn].rack.find(t => t.id === p.tileId);
    if (tile && position(p.row,p.col) >= 0) board[position(p.row,p.col)] = { ...tile, letter: tile.letter || (p.letter || '').toUpperCase() };
  }
  return board;
}
export function evaluatePlacement(state: Pick<LettersState,'board'|'players'|'turn'|'language'>, placements: Placement[], dictionary: Set<string> = new Set()): Evaluation {
  if (!placements.length) return error('empty');
  if (placements.length > 7) return error('too-many');
  const rack = state.players[state.turn].rack;
  const placed = new Set<number>(); const ids = new Set<number>();
  for (const p of placements) {
    if (!Number.isInteger(p.row) || !Number.isInteger(p.col) || position(p.row,p.col) < 0) return error('outside');
    const index = position(p.row,p.col);
    if (placed.has(index) || state.board[index] || ids.has(p.tileId)) return error('occupied');
    const tile = rack.find(tile => tile.id === p.tileId);
    if (!tile) return error('rack');
    if (!tile.letter && !tileAlphabet(state.language).includes((p.letter || '').toUpperCase())) return error('blank');
    placed.add(index); ids.add(p.tileId);
  }
  const sameRow = placements.every(p => p.row === placements[0].row);
  const sameCol = placements.every(p => p.col === placements[0].col);
  if (!sameRow && !sameCol) return error('line');
  const board = boardWithPlacements(state, placements);
  if (placements.length > 1) {
    const coord = placements.map(p => sameRow ? p.col : p.row);
    for (let n = Math.min(...coord); n <= Math.max(...coord); n++) if (!board[position(sameRow ? placements[0].row : n, sameRow ? n : placements[0].col)]) return error('gap');
  }
  const emptyBoard = state.board.every(tile => !tile);
  if (emptyBoard && !placed.has(112)) return error('center');
  if (!emptyBoard && !placements.some(p => [[p.row-1,p.col],[p.row+1,p.col],[p.row,p.col-1],[p.row,p.col+1]].some(([row,col]) => position(row,col) >= 0 && !!state.board[position(row,col)]))) return error('connected');
  const wordLines: number[][] = [];
  const known = new Set<string>();
  for (const p of placements) for (const [dr,dc] of [[0,1],[1,0]]) {
    let row = p.row; let col = p.col;
    while (position(row-dr,col-dc) >= 0 && board[position(row-dr,col-dc)]) { row-=dr; col-=dc; }
    const cells: number[] = [];
    while (position(row,col) >= 0 && board[position(row,col)]) { cells.push(position(row,col)); row+=dr; col+=dc; }
    if (cells.length < 2) continue;
    const key = cells.join(','); if (!known.has(key)) { wordLines.push(cells); known.add(key); }
  }
  if (!wordLines.length) return error('short');
  const words: WordScore[] = [];
  for (const cells of wordLines) {
    const tokens = cells.map(index => board[index]!.letter);
    const word = tokens.join('');
    if (!dictionary.has(normalize(word))) return error(`word:${word}`);
    if (state.language === 'es' && tokenizeWord(word,'es').join('|') !== tokens.join('|')) return error(`digraph:${word}`);
    let total = 0; let multiplier = 1;
    for (const index of cells) {
      const tile = board[index]!;
      const p = placed.has(index) ? premiums[index] : '';
      total += tile.value * (p === 'DL' ? 2 : p === 'TL' ? 3 : 1);
      if (p === 'DW') multiplier *= 2;
      if (p === 'TW') multiplier *= 3;
    }
    words.push({ word, score: total * multiplier, cells, multiplier });
  }
  const bingo = placements.length === 7 ? 50 : 0;
  return { valid: true, score: words.reduce((sum,word) => sum + word.score,0) + bingo, words, bingo };
}
export const rackValue = (rack: LetterTile[]) => rack.reduce((sum,tile) => sum + tile.value, 0);
export function finishLetters(state: LettersState, finishingPlayer?: number): LettersState {
  const remaining = state.players.map(player => rackValue(player.rack));
  const next: LettersState = { ...state, players: state.players.map((player,i) => ({ ...player, points: player.points - remaining[i] })), pending: [], ending: finishingPlayer === undefined ? 'scoreless' : 'empty-rack' };
  if (finishingPlayer !== undefined) next.players[finishingPlayer].points += remaining.reduce((sum,value,i) => sum + (i === finishingPlayer ? 0 : value),0);
  const best = Math.max(...next.players.map(player => player.points));
  next.winner = next.players.flatMap((player,index) => player.points === best ? [index] : []);
  next.score = next.players[0].points;
  next.status = next.winner.length > 1 ? 'draw' : next.winner[0] === 0 ? 'won' : 'lost';
  return next;
}
function advance(state: LettersState, type: string, score: number, words: string[], finishingPlayer?: number): LettersState {
  const next = { ...state, pending: [], moves: state.moves + 1, scoreless: score > 0 ? 0 : state.scoreless + 1, message: undefined, log: [...state.log.slice(-49), { player: state.turn, type, score, words }] };
  next.score = next.players[0].points;
  if (finishingPlayer !== undefined || next.scoreless >= 6) return finishLetters(next,finishingPlayer);
  next.turn = (next.turn+1) % next.players.length;
  return next;
}
export function commitLetters(state: LettersState, placements: Placement[], dictionary?: Set<string>): LettersState {
  const evaluation = evaluatePlacement(state, placements, dictionary);
  if (!evaluation.valid) return { ...state, message: evaluation.error };
  const used = new Set(placements.map(p => p.tileId));
  const bag = state.bag.slice();
  const players = state.players.map(player => ({ ...player, rack: player.rack.slice() }));
  const current = players[state.turn];
  current.rack = current.rack.filter(tile => !used.has(tile.id));
  current.points += evaluation.score;
  while (current.rack.length < 7 && bag.length) current.rack.push(bag.pop()!);
  const next = { ...state, board: boardWithPlacements(state,placements), players, bag, last: evaluation };
  return advance(next, 'play', evaluation.score, evaluation.words.map(word => word.word), !bag.length && !current.rack.length ? state.turn : undefined);
}
export function lettersReducer(state: LettersState, action: Action, _config: Config, dictionary: Set<string> = new Set()): LettersState {
  if (state.status !== 'playing') return state;
  if (action.type === 'PLACE') {
    const p: Placement = { row: action.row, col: action.col, tileId: action.tileId, letter: action.letter };
    const tile = state.players[state.turn].rack.find(t => t.id === p.tileId);
    if (!tile || !Number.isInteger(p.row) || !Number.isInteger(p.col) || position(p.row,p.col) < 0 || state.board[position(p.row,p.col)]) return { ...state, message: 'occupied' };
    if (!tile.letter && !tileAlphabet(state.language).includes((p.letter || '').toUpperCase())) return { ...state, message: 'blank' };
    const pending = state.pending.filter(old => old.tileId !== p.tileId && (old.row !== p.row || old.col !== p.col));
    return { ...state, pending: [...pending,p], message: undefined };
  }
  if (action.type === 'RECALL') return { ...state, pending: action.tileId === undefined ? [] : state.pending.filter(p => p.tileId !== action.tileId), message: undefined };
  if (action.type === 'PLAY') return commitLetters(state, action.placements || state.pending, dictionary);
  if (action.type === 'PASS') {
    if (state.pending.length) return { ...state, message: 'recall-first' };
    return advance(state,'pass',0,[]);
  }
  if (action.type === 'EXCHANGE') {
    if (state.pending.length) return { ...state, message: 'recall-first' };
    if (state.bag.length < 7) return { ...state, message: 'exchange-bag' };
    const ids = new Set<number>(action.ids || []);
    const rack = state.players[state.turn].rack;
    if (!ids.size || ids.size > rack.length || [...ids].some(id => !rack.some(tile => tile.id === id))) return { ...state, message: 'exchange-select' };
    const bag = state.bag.slice();
    const replacement = bag.splice(-ids.size);
    // Draw first, then return selected tiles: exchanged tiles cannot immediately return.
    const returned = rack.filter(tile => ids.has(tile.id));
    const shuffled = shuffle([...bag,...returned],state.rng);
    const players = state.players.map((player,i) => i === state.turn ? { ...player, rack: [...rack.filter(tile => !ids.has(tile.id)),...replacement] } : player);
    return advance({ ...state, bag: shuffled.items, rng: shuffled.seed, players, last: undefined },'exchange',0,[]);
  }
  return state;
}

export function letterTiles(state: LettersState): LetterTile[] { return [...state.bag, ...state.players.flatMap(player => player.rack), ...state.board.filter((tile): tile is LetterTile => !!tile)]; }
