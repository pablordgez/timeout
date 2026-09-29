import { baseState, type Action, type Config, type GameState } from '../../core/types';
import { random, shuffle } from '../../core/random';

export type Card = number;
export const rank = (card: Card) => card % 13 + 2;
export const suit = (card: Card) => Math.floor(card / 13);
export const cardLabel = (card: Card) => `${['2','3','4','5','6','7','8','9','10','J','Q','K','A'][card % 13]}${['♣','♦','♥','♠'][suit(card)]}`;
export function compareHands(a: number[], b: number[]) { for (let i = 0; i < Math.max(a.length,b.length); i++) { const d=(a[i]??0)-(b[i]??0); if(d)return d; } return 0; }
export function evaluateFive(cards: Card[]): number[] {
  const ranks = cards.map(rank).sort((a,b)=>b-a);
  const counts = new Map<number,number>(); ranks.forEach(r=>counts.set(r,(counts.get(r)??0)+1));
  const groups = [...counts.entries()].sort((a,b)=>b[1]-a[1]||b[0]-a[0]);
  const unique = [...new Set(ranks)]; if(unique.includes(14))unique.push(1);
  let straight = 0; for(let i=0;i<=unique.length-5;i++)if(unique[i]-unique[i+4]===4){straight=unique[i];break;}
  const flush = cards.every(c=>suit(c)===suit(cards[0]));
  if(flush&&straight)return [8,straight];
  if(groups[0][1]===4)return [7,groups[0][0],groups[1][0]];
  if(groups[0][1]===3&&groups[1][1]===2)return [6,groups[0][0],groups[1][0]];
  if(flush)return [5,...ranks]; if(straight)return [4,straight];
  if(groups[0][1]===3)return [3,groups[0][0],...groups.slice(1).map(g=>g[0])];
  if(groups[0][1]===2&&groups[1][1]===2)return [2,...groups.slice(0,2).map(g=>g[0]).sort((a,b)=>b-a),groups[2][0]];
  if(groups[0][1]===2)return [1,groups[0][0],...groups.slice(1).map(g=>g[0])];
  return [0,...ranks];
}
export function evaluate(cards: Card[]): number[] {
  let best: number[]=[];
  for(let a=0;a<cards.length-4;a++)for(let b=a+1;b<cards.length-3;b++)for(let c=b+1;c<cards.length-2;c++)for(let d=c+1;d<cards.length-1;d++)for(let e=d+1;e<cards.length;e++) {
    const hand=evaluateFive([cards[a],cards[b],cards[c],cards[d],cards[e]]); if(compareHands(hand,best)>0)best=hand;
  }
  return best;
}
export interface Player { stack:number; hole:Card[]; folded:boolean; allIn:boolean; bet:number; total:number; actedAt:number }
export interface PokerState extends GameState { players:Player[]; deck:Card[]; board:Card[]; dealer:number; turn:number; street:'preflop'|'flop'|'turn'|'river'|'showdown'; highest:number; lastRaise:number; pending:number[]; handNumber:number; results:{player:number; amount:number}[]; log:{es:string;en:string}[]; }
const next = (players:Player[],after:number,eligible:(p:Player)=>boolean) => {for(let j=1;j<=players.length;j++){const i=(after+j)%players.length;if(eligible(players[i]))return i;}return -1;};
const alive = (p:Player)=>!p.folded;
const available = (p:Player)=>!p.folded&&!p.allIn;
const log=(s:PokerState,es:string,en:string)=>{s.log=[...s.log.slice(-7),{es,en}];};
const pay=(p:Player,amount:number)=>{const actual=Math.min(amount,p.stack);p.stack-=actual;p.bet+=actual;p.total+=actual;p.allIn=p.stack===0;};

export function sidePots(players:Player[],board:Card[],dealer:number): {player:number;amount:number}[] {
  const payouts=players.map(()=>0); const levels=[...new Set(players.map(p=>p.total).filter(Boolean))].sort((a,b)=>a-b);let lower=0;
  for(const level of levels){const contributors=players.map((p,i)=>({p,i})).filter(({p})=>p.total>=level);const amount=(level-lower)*contributors.length;lower=level;
    const eligible=contributors.filter(({p})=>!p.folded);if(!eligible.length)continue;
    let winners=[eligible[0].i];let best=evaluate([...eligible[0].p.hole,...board]);
    for(const {p,i} of eligible.slice(1)){const hand=evaluate([...p.hole,...board]);const cmp=compareHands(hand,best);if(cmp>0){best=hand;winners=[i];}else if(cmp===0)winners.push(i);}
    const each=Math.floor(amount/winners.length);winners.forEach(i=>payouts[i]+=each);
    winners.sort((a,b)=>((a-dealer-1+players.length)%players.length)-((b-dealer-1+players.length)%players.length));
    for(let odd=0;odd<amount%winners.length;odd++)payouts[winners[odd]]++;
  }
  return payouts.flatMap((amount,player)=>amount?[{player,amount}]:[]);
}
function finishHand(s:PokerState) {
  const contestants=s.players.map((p,i)=>({p,i})).filter(({p})=>!p.folded);
  s.results=contestants.length===1?[{player:contestants[0].i,amount:s.players.reduce((n,p)=>n+p.total,0)}]:sidePots(s.players,s.board,s.dealer);
  s.results.forEach(({player,amount})=>s.players[player].stack+=amount);s.street='showdown';s.pending=[];s.turn=-1;
  s.score=s.players[0].stack;log(s,`Mano ${s.handNumber} terminada.`, `Hand ${s.handNumber} finished.`);
  const survivors=s.players.filter(p=>p.stack>0);if(survivors.length===1){s.status=s.players[0].stack>0?'won':'lost';}
}
function advance(s:PokerState) {
  if(s.players.filter(alive).length===1){finishHand(s);return;}
  if(s.pending.length){s.turn=next(s.players,s.turn,(p)=>available(p)&&s.pending.includes(s.players.indexOf(p)));return;}
  if(s.street==='river'){finishHand(s);return;}
  s.deck.shift(); // Burn card, just as at a physical table.
  const n=s.street==='preflop'?3:1;s.board.push(...s.deck.splice(0,n));s.street=s.street==='preflop'?'flop':s.street==='flop'?'turn':'river';
  s.players.forEach(p=>{p.bet=0;p.actedAt=-1;});s.highest=0;s.lastRaise=20;s.pending=s.players.map((p,i)=>available(p)?i:-1).filter(i=>i>=0);
  if(s.pending.length<=1){s.pending=[];advance(s);return;}
  s.turn=next(s.players,s.dealer,available);log(s,`Mesa: ${s.street}.`,`Board: ${s.street}.`);
}
function startHand(s:PokerState,rotate:boolean) {
  if(rotate)s.dealer=next(s.players,s.dealer,p=>p.stack>0);
  const shuffled=shuffle(Array.from({length:52},(_,i)=>i),s.rng);s.deck=shuffled.items;s.rng=shuffled.seed;s.board=[];s.results=[];s.street='preflop';s.handNumber++;s.highest=20;s.lastRaise=20;
  s.players.forEach(p=>{p.hole=[];p.folded=p.stack===0;p.allIn=false;p.bet=0;p.total=0;p.actedAt=-1;});
  for(let c=0;c<2;c++){let i=s.dealer;for(let j=0;j<s.players.filter(alive).length;j++){i=next(s.players,i,alive);s.players[i].hole.push(s.deck.shift()!);}}
  const headsUp=s.players.filter(alive).length===2;const sb=headsUp?s.dealer:next(s.players,s.dealer,alive);const bb=next(s.players,sb,alive);pay(s.players[sb],10);pay(s.players[bb],20);
  s.pending=s.players.map((p,i)=>available(p)?i:-1).filter(i=>i>=0);s.turn=bb;
  log(s,`Mano ${s.handNumber} · ciegas 10/20`,`Hand ${s.handNumber} · blinds 10/20`);
  // A lone player facing an all-in still gets the opportunity to call or fold.
  if(s.pending.length===1&&s.players[s.pending[0]].bet>=s.players[bb].bet){s.pending=[];advance(s);}else advance(s);
}
export function createPoker(config:Config,seed:number):PokerState {
  const n=Math.max(2,Math.min(6,Number(config.players)||2));const s={...baseState(seed),players:Array.from({length:n},()=>({stack:1000,hole:[],folded:false,allIn:false,bet:0,total:0,actedAt:-1})),deck:[],board:[],dealer:0,turn:0,street:'preflop',highest:20,lastRaise:20,pending:[],handNumber:0,results:[],log:[]} as PokerState;startHand(s,false);return s;
}
export const canRaise = (s:PokerState,p:Player) => p.actedAt<0||s.highest-p.actedAt>=s.lastRaise;
export function pokerReducer(state:PokerState,action:Action):PokerState {
  if(state.status!=='playing')return state;
  if(action.type==='NEXT_HAND'&&state.street==='showdown'){const s=structuredClone(state);startHand(s,true);return s;}
  if(state.street==='showdown'||!['FOLD','CALL','RAISE','ALL_IN'].includes(action.type))return state;
  const s=structuredClone(state);const p=s.players[s.turn];if(!p||!available(p))return state;
  const owed=Math.max(0,s.highest-p.bet);let raising=false;let target=0;
  if(action.type==='FOLD')p.folded=true;
  else if(action.type==='CALL')pay(p,owed);
  else {
    target=action.type==='ALL_IN'?p.bet+p.stack:Math.floor(Number(action.amount));
    if(!Number.isFinite(target)||target<=p.bet||target>p.bet+p.stack)return state;
    if(target<=s.highest){if(target!==p.bet+p.stack)return state;pay(p,target-p.bet);}
    else {
      if(!canRaise(s,p))return state;
      const increase=target-s.highest;if(increase<s.lastRaise&&target!==p.bet+p.stack)return state;
      pay(p,target-p.bet);raising=true;if(increase>=s.lastRaise)s.lastRaise=increase;s.highest=target;
    }
  }
  p.actedAt=s.highest;s.moves++;log(s,`J${s.turn+1}: ${action.type==='FOLD'?'retirada':raising?`sube a ${target}`:owed?`iguala ${Math.min(owed,p.bet)}`:'pasa'}.`,`P${s.turn+1}: ${action.type==='FOLD'?'fold':raising?`raises to ${target}`:owed?'calls':'checks'}.`);
  s.pending=s.pending.filter(i=>i!==s.turn&&available(s.players[i]));
  if(raising)for(let i=0;i<s.players.length;i++)if(i!==s.turn&&available(s.players[i])&&s.players[i].bet<s.highest&&!s.pending.includes(i))s.pending.push(i);
  advance(s);return s;
}

// Opponents' actual hole cards and the actual deck are deliberately never read.
export function pokerBot(s:PokerState,config:Config):Action|null {
  const p=s.players[s.turn];if(!p||s.street==='showdown')return null;
  const diff=String(config.difficulty);const trials=diff==='hard'?160:diff==='medium'?70:20;
  const own=p.hole;const known=new Set([...own,...s.board]);const unseen=Array.from({length:52},(_,i)=>i).filter(c=>!known.has(c));const opponents=s.players.filter(x=>!x.folded).length-1;let wins=0;let seed=s.rng;
  for(let k=0;k<trials;k++){const sample=shuffle(unseen,seed);seed=sample.seed;const deck=sample.items;const board=[...s.board,...deck.splice(0,5-s.board.length)];const ownRank=evaluate([...own,...board]);let win=true,ties=0;
    for(let j=0;j<opponents;j++){const other=evaluate([...deck.splice(0,2),...board]);const c=compareHands(ownRank,other);if(c<0){win=false;break;}if(c===0)ties++;}if(win)wins+=1/(ties+1);
  }
  const equity=wins/trials;const pot=s.players.reduce((a,b)=>a+b.total,0);const owed=Math.max(0,s.highest-p.bet);const price=Math.min(owed,p.stack)/(pot+Math.min(owed,p.stack)||1);const [noise]=random(seed);
  if(owed&&equity+(diff==='easy'?(noise-.5)*.35:0)<price+(diff==='hard'?0:.06))return {type:'FOLD'};
  if(equity>.65&&canRaise(s,p)&&p.stack>owed+s.lastRaise&&noise>(diff==='easy'?.65:.25))return {type:'RAISE',amount:Math.min(p.bet+p.stack,s.highest+Math.max(s.lastRaise,Math.floor(pot*.55)))};
  return {type:'CALL'};
}
