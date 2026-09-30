import { Chess, type Color, type Square } from 'chess.js';
import { baseState, type Action, type Config, type GameState } from '../../core/types';
export type EndReason='checkmate'|'stalemate'|'material'|'fivefold'|'seventy-five-moves'|'claim-repetition'|'claim-fifty-moves'|'agreement'|'resignation'|null;
export interface ChessState extends GameState {fen:string;pgn:string;initialFen:string;selected:string;promotion?:{from:string;to:string};lastMove:string[];log:string[];positionCounts:Record<string,number>;winner:Color|null;endReason:EndReason;drawOffer:Color|null}
const square=(value:unknown):value is Square=>typeof value==='string'&&/^[a-h][1-8]$/.test(value);
const opposite=(color:Color):Color=>color==='w'?'b':'w';
export function loadChess(s:Pick<ChessState,'fen'|'pgn'>):Chess {const c=new Chess();if(s.pgn)c.loadPgn(s.pgn);else c.load(s.fen);return c;}
// Canonical FEN only retains en passant when the capture is legal, including king safety.
export const positionKey=(fen:string)=>new Chess(fen).fen().split(' ').slice(0,4).join(' ');
export function historyCounts(c:Chess):Record<string,number>{const history=c.history({verbose:true}),counts:Record<string,number>={};for(const fen of [history[0]?.before??c.fen(),...history.map(m=>m.after)]){const key=positionKey(fen);counts[key]=(counts[key]??0)+1;}return counts;}
export function repetitionCount(s:ChessState,c=loadChess(s)){return (s.positionCounts??historyCounts(c))[positionKey(c.fen())]??1;}
const halfMoves=(c:Chess)=>Number(c.fen().split(' ')[4]);
function finish(s:ChessState,reason:EndReason,winner:Color|null):ChessState {
 const messages:Record<NonNullable<EndReason>,string>={checkmate:`Jaque mate: ganan ${winner==='w'?'blancas':'negras'} / Checkmate: ${winner==='w'?'White':'Black'} wins`,stalemate:'Tablas por ahogado / Draw by stalemate',material:'Tablas por material insuficiente / Draw by insufficient material',fivefold:'Tablas automáticas: cinco repeticiones / Automatic draw: fivefold repetition','seventy-five-moves':'Tablas automáticas: 75 movimientos / Automatic draw: 75 moves','claim-repetition':'Tablas reclamadas: triple repetición / Draw claimed: threefold repetition','claim-fifty-moves':'Tablas reclamadas: 50 movimientos / Draw claimed: 50 moves',agreement:'Tablas por acuerdo / Draw by agreement',resignation:winner?`Abandono: ganan ${winner==='w'?'blancas':'negras'} / Resignation: ${winner==='w'?'White':'Black'} wins`:'Abandono sin posibilidad de mate: tablas / Resignation with no possible mate: draw'};
 return {...s,status:winner?winner==='w'?'won':'lost':'draw',winner,endReason:reason,score:winner==='w'?1:winner==='b'?0:.5,drawOffer:null,selected:'',promotion:undefined,message:reason?messages[reason]:undefined};
}
function automaticEnd(s:ChessState,c:Chess):ChessState {
 // FIDE 9.6.2: checkmate takes precedence over a 150th reversible half move.
 if(c.isCheckmate())return finish(s,'checkmate',opposite(c.turn()));if(c.isStalemate())return finish(s,'stalemate',null);if(c.isInsufficientMaterial())return finish(s,'material',null);if(repetitionCount(s,c)>=5)return finish(s,'fivefold',null);if(halfMoves(c)>=150)return finish(s,'seventy-five-moves',null);return s;
}
export function createChess(_config:Config,seed:number,fen?:string):ChessState {const c=new Chess(fen),initial=c.fen();return automaticEnd({...baseState(seed),fen:initial,initialFen:initial,pgn:c.pgn(),selected:'',lastMove:[],log:[],positionCounts:{[positionKey(initial)]:1},winner:null,endReason:null,drawOffer:null},c);}
function claimReason(s:ChessState,c:Chess,intended=false):EndReason {const occurrences=(s.positionCounts??historyCounts(c))[positionKey(c.fen())]??0;if(occurrences+(intended?1:0)>=3)return 'claim-repetition';if(halfMoves(c)>=100)return 'claim-fifty-moves';return null;}
export function canClaimDraw(s:ChessState,intended?:{from:string;to:string;promotion?:string}|string):boolean {if(s.status!=='playing'||s.drawOffer)return false;const c=loadChess(s);if(!intended)return !!claimReason(s,c);try{c.move(intended);return !!claimReason(s,c,true);}catch{return false;}}
export function claimableMoves(s:ChessState):string[]{if(s.status!=='playing'||s.drawOffer)return [];const c=loadChess(s),legal=c.moves(),result:string[]=[];for(const san of legal){c.move(san);if(claimReason(s,c,true))result.push(san);c.undo();}return result;}
export function chessReducer(s:ChessState,a:Action,_config:Config):ChessState {
 if(s.status!=='playing')return s;const c=loadChess(s);
 if(a.type==='DRAW'||a.type==='OFFER_DRAW')return s.drawOffer?s:{...s,drawOffer:c.turn(),selected:'',message:'Oferta de tablas: debe aceptar el rival / Draw offered: opponent must accept'};
 if(a.type==='ACCEPT_DRAW')return s.drawOffer?finish(s,'agreement',null):s;
 if(a.type==='DECLINE_DRAW')return s.drawOffer?{...s,drawOffer:null,message:'Oferta rechazada / Draw offer declined'}:s;
 if(s.drawOffer)return s;
 if(a.type==='RESIGN'){const winner=opposite(c.turn()),nonKings=c.board().flat().filter(p=>p&&p.color===winner&&p.type!=='k');return finish(s,'resignation',c.isInsufficientMaterial()||!nonKings.length?null:winner);}
 if(a.type==='CLAIM'){
  const reason=claimReason(s,c);if(reason)return finish(s,reason,null);const intended=a.san||(square(a.from)&&square(a.to)?{from:a.from,to:a.to,promotion:a.promotion}:null);
  if(intended)try{c.move(intended);const beforeMove=claimReason(s,c,true);if(beforeMove)return finish(s,beforeMove,null);}catch{/* Illegal intended moves cannot support claims. */}
  return {...s,message:'No se cumplen las condiciones para reclamar tablas / Draw claim conditions are not met'};
 }
 if(a.type==='CANCEL_PROMOTION')return s.promotion?{...s,promotion:undefined}:s;
 if(a.type==='SELECT'){
  if(!square(a.square)||s.promotion)return s;const piece=c.get(a.square);
  if(s.selected&&s.selected!==a.square){const possible=c.moves({square:s.selected as Square,verbose:true}).filter(m=>m.to===a.square);if(possible.length)return chessReducer(s,{type:'MOVE',from:s.selected,to:a.square},_config);}
  return {...s,selected:piece?.color===c.turn()?a.square:'',message:undefined};
 }
 if(a.type==='MOVE'||a.type==='PROMOTE'){
  if(a.type==='PROMOTE'&&!s.promotion)return s;const from=a.from??s.promotion?.from,to=a.to??s.promotion?.to;
  if(!square(from)||!square(to))return {...s,message:'Movimiento ilegal / Illegal move'};
  const candidates=c.moves({square:from,verbose:true}).filter(m=>m.to===to);if(!candidates.length)return {...s,message:'Movimiento ilegal / Illegal move'};
  if(candidates.some(m=>m.promotion)&&!a.promotion)return {...s,promotion:{from,to}};
  if(a.promotion&&!['q','r','b','n'].includes(a.promotion))return {...s,message:'Promoción ilegal / Illegal promotion'};
  try{const m=c.move({from,to,promotion:a.promotion}),key=positionKey(c.fen()),counts={...(s.positionCounts??historyCounts(loadChess(s)))};counts[key]=(counts[key]??0)+1;return automaticEnd({...s,fen:c.fen(),pgn:c.pgn(),positionCounts:counts,selected:'',promotion:undefined,lastMove:[from,to],log:[...s.log,m.san],moves:s.moves+1,message:c.isCheck()?'Jaque / Check':undefined},c);}catch{return {...s,message:'Movimiento ilegal / Illegal move'};}
 }
 return s;
}
export function migrateChess(old:ChessState):ChessState {const c=loadChess(old),history=c.history({verbose:true});const s:ChessState={...old,fen:c.fen(),initialFen:history[0]?.before??c.fen(),positionCounts:historyCounts(c),winner:null,endReason:null,drawOffer:null};if(old.status==='draw')return {...s,score:.5};if(c.isCheckmate())return finish(s,'checkmate',opposite(c.turn()));if(old.status==='lost')return finish(s,'resignation',opposite(c.turn()));return automaticEnd(s,c);}
