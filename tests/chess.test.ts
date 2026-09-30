import { describe,it,expect } from 'vitest';
import { canClaimDraw,chessReducer,claimableMoves,createChess,loadChess,migrateChess,positionKey,repetitionCount,type ChessState } from '../src/games/chess/engine';
const cfg={humans:2};
const move=(s:ChessState,from:string,to:string,promotion?:string)=>chessReducer(s,{type:'MOVE',from,to,promotion},cfg);
const knights='4k1n1/8/8/8/8/8/8/4K1N1 w - - 0 1';
const cycle=(s:ChessState)=>move(move(move(move(s,'g1','f3'),'g8','f6'),'f3','g1'),'f6','g8');
describe('chess special rules and local player results',()=>{
 it('rejects illegal moves and never modifies terminal games',()=>{
  const s=createChess(cfg,17),illegal=move(s,'e2','e5');expect(illegal.fen).toBe(s.fen);expect(illegal.moves).toBe(0);
  const resigned=chessReducer(s,{type:'RESIGN'},cfg);expect(resigned.status).toBe('lost');expect(resigned.winner).toBe('b');expect(move(resigned,'e2','e4')).toBe(resigned);expect(chessReducer(resigned,{type:'DRAW'},cfg)).toBe(resigned);
 });
 it('records black mate as a loss for the primary White player',()=>{
  let s=createChess(cfg,1);s=move(s,'f2','f3');s=move(s,'e7','e5');s=move(s,'g2','g4');s=move(s,'d8','h4');expect(s.status).toBe('lost');expect(s.winner).toBe('b');expect(s.endReason).toBe('checkmate');expect(s.score).toBe(0);
 });
 it('records resignation from Black as a White victory, and bare-king winner as a draw',()=>{
  let s=createChess(cfg,1);s=move(s,'e2','e4');s=chessReducer(s,{type:'RESIGN'},cfg);expect(s.status).toBe('won');expect(s.winner).toBe('w');
  const bare=createChess(cfg,1,'4k3/8/8/8/8/8/8/4K2R w - - 0 1');const resigned=chessReducer(bare,{type:'RESIGN'},cfg);expect(resigned.status).toBe('draw');
 });
 it('supports both castling sides and forbids castling through check or without rights',()=>{
  const s=createChess(cfg,1,'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');const king=move(s,'e1','g1'),queen=move(s,'e1','c1');expect(loadChess(king).get('f1')?.type).toBe('r');expect(loadChess(queen).get('d1')?.type).toBe('r');
  const attacked=createChess(cfg,1,'r3kr1r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');expect(move(attacked,'e1','g1').fen).toBe(attacked.fen);
  const noRights=createChess(cfg,1,'r3k2r/8/8/8/8/8/8/R3K2R w - - 0 1');expect(move(noRights,'e1','g1').fen).toBe(noRights.fen);
 });
 it('executes immediate en passant and rejects a delayed capture',()=>{
  const s=createChess(cfg,1,'4k3/8/8/3pP3/8/8/8/4K2R w - d6 0 1');const taken=move(s,'e5','d6');expect(loadChess(taken).get('d5')).toBeUndefined();expect(loadChess(taken).get('d6')?.color).toBe('w');
  const delayed=move(move(s,'e1','d1'),'e8','d8');expect(move(delayed,'e5','d6').fen).toBe(delayed.fen);
 });
 it('canonicalizes phantom and pinned EP squares but preserves a legal capture',()=>{
  const phantom='4k3/8/8/3p4/8/8/8/4K2R w - d6 0 1';expect(positionKey(phantom)).toBe(positionKey(phantom.replace('d6','-')));
  const pinned='k3r3/8/8/3pP3/8/8/8/4K2R w - d6 0 1';expect(positionKey(pinned)).toBe(positionKey(pinned.replace('d6','-')));
  const legal='4k3/8/8/3pP3/8/8/8/4K2R w - d6 0 1';expect(positionKey(legal)).not.toBe(positionKey(legal.replace('d6','-')));
  const rights='r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';expect(positionKey(rights)).not.toBe(positionKey(rights.replace('KQkq','-')));
 });
 it('requires a promotion choice and accepts each legal underpromotion',()=>{
  for(const promotion of ['q','r','b','n']){const s=createChess(cfg,1,'7k/P7/8/8/8/8/8/7K w - - 0 1');const pending=move(s,'a7','a8');expect(pending.fen).toBe(s.fen);expect(pending.promotion).toEqual({from:'a7',to:'a8'});expect(pending.moves).toBe(0);const promoted=chessReducer(pending,{type:'PROMOTE',promotion},cfg);expect(loadChess(promoted).get('a8')?.type).toBe(promotion);expect(promoted.moves).toBe(1);}
 });
 it('lets threefold be claimed rather than forcing it and forces fivefold including a custom initial position',()=>{
  let s=createChess(cfg,1,knights);s=cycle(cycle(s));expect(s.status).toBe('playing');expect(repetitionCount(s)).toBe(3);expect(canClaimDraw(s)).toBe(true);
  const claimed=chessReducer(s,{type:'CLAIM'},cfg);expect(claimed.endReason).toBe('claim-repetition');s=cycle(cycle(s));expect(s.status).toBe('draw');expect(s.endReason).toBe('fivefold');
 });
 it('supports a valid intended-move repetition claim without executing that move',()=>{
  let s=cycle(createChess(cfg,1,knights));s=move(move(move(s,'g1','f3'),'g8','f6'),'f3','g1');expect(canClaimDraw(s)).toBe(false);expect(canClaimDraw(s,{from:'f6',to:'g8'})).toBe(true);expect(claimableMoves(s)).toContain('Ng8');
  const claimed=chessReducer(s,{type:'CLAIM',san:'Ng8'},cfg);expect(claimed.status).toBe('draw');expect(claimed.fen).toBe(s.fen);expect(claimed.moves).toBe(s.moves);
  expect(chessReducer(s,{type:'CLAIM',from:'f6',to:'f5'},cfg).status).toBe('playing');
 });
 it('supports current and intended 50-move claims and automatic 75 moves',()=>{
  let s=createChess(cfg,1,'4k3/8/8/8/8/8/8/R3K3 w - - 99 50');expect(canClaimDraw(s)).toBe(false);expect(canClaimDraw(s,{from:'a1',to:'a2'})).toBe(true);const claimed=chessReducer(s,{type:'CLAIM',from:'a1',to:'a2'},cfg);expect(claimed.endReason).toBe('claim-fifty-moves');expect(claimed.fen).toBe(s.fen);
  s=move(s,'a1','a2');expect(s.status).toBe('playing');expect(canClaimDraw(s)).toBe(true);expect(chessReducer(s,{type:'CLAIM'},cfg).endReason).toBe('claim-fifty-moves');
  const seventyFive=move(createChess(cfg,1,'4k3/8/8/8/8/8/8/R3K3 w - - 149 75'),'a1','a2');expect(seventyFive.endReason).toBe('seventy-five-moves');
 });
 it('resets reversible counters on a pawn move or capture and prioritizes mate on move 75',()=>{
  const pawn=move(createChess(cfg,1,'4k3/8/8/8/8/8/P7/R3K3 w - - 149 75'),'a2','a3');expect(pawn.status).toBe('playing');expect(pawn.fen.split(' ')[4]).toBe('0');
  const capture=move(createChess(cfg,1,'4k3/8/8/8/8/8/n7/R3K3 w - - 149 75'),'a1','a2');expect(capture.status).toBe('playing');expect(capture.fen.split(' ')[4]).toBe('0');
  const mate=move(createChess(cfg,1,'7k/5K2/5Q2/8/8/8/8/8 w - - 149 75'),'f6','g7');expect(mate.status).toBe('won');expect(mate.endReason).toBe('checkmate');
 });
 it('detects stalemate and material draws without using the 50-move automatic shortcut',()=>{
  expect(createChess(cfg,1,'7k/5K2/6Q1/8/8/8/8/8 b - - 0 1').endReason).toBe('stalemate');expect(createChess(cfg,1,'7k/8/8/8/8/8/8/KB6 w - - 0 1').endReason).toBe('material');
 });
 it('requires actual acceptance of a draw offer and preserves the board on decline',()=>{
  const s=createChess(cfg,1),offered=chessReducer(s,{type:'OFFER_DRAW'},cfg);expect(offered.status).toBe('playing');expect(offered.drawOffer).toBe('w');expect(move(offered,'e2','e4')).toBe(offered);
  const declined=chessReducer(offered,{type:'DECLINE_DRAW'},cfg);expect(declined.drawOffer).toBeNull();expect(declined.fen).toBe(s.fen);expect(chessReducer(offered,{type:'ACCEPT_DRAW'},cfg).endReason).toBe('agreement');
 });
 it('rebuilds repetition history and corrects old black-mate results during migration',()=>{
  let s=cycle(cycle(createChess(cfg,1,knights)));const saved=JSON.parse(JSON.stringify(s));delete saved.positionCounts;delete saved.initialFen;const migrated=migrateChess(saved);expect(repetitionCount(migrated)).toBe(3);expect(canClaimDraw(migrated)).toBe(true);
  s=createChess(cfg,1);s=move(move(move(move(s,'f2','f3'),'e7','e5'),'g2','g4'),'d8','h4');const old={...s,status:'won'} as ChessState;expect(migrateChess(old).status).toBe('lost');expect(migrateChess(old).winner).toBe('b');
 });
});
