import { baseState, type Action, type Config, type GameState } from '../../core/types';
import { shuffle } from '../../core/random';
export type Tile = [number,number];
export const tiles:Tile[]=Array.from({length:7},(_,a)=>Array.from({length:7-a},(_,b)=>[a,a+b] as Tile)).flat();
export const pipSum=(hand:number[])=>hand.reduce((n,id)=>n+tiles[id][0]+tiles[id][1],0);
export interface DominoState extends GameState { hands:number[][]; stock:number[]; chain:{id:number;left:number;right:number}[]; turn:number; passes:number; phase:'play'|'roundover'; points:number[]; round:number; winners:number[]; opening:number; event:{es:string;en:string}; }
export function legalEnds(s:DominoState,id:number):('left'|'right')[] {
  if(!s.chain.length)return id===s.opening?['right']:[];
  const [a,b]=tiles[id];const l=s.chain[0].left,r=s.chain[s.chain.length-1].right;const ends:('left'|'right')[]=[];
  if(a===l||b===l)ends.push('left');if(a===r||b===r)ends.push('right');return ends;
}
export const legalTiles=(s:DominoState,player=s.turn)=>s.hands[player].filter(id=>legalEnds(s,id).length>0);
function deal(s:DominoState){
  const d=shuffle(tiles.map((_,i)=>i),s.rng);s.rng=d.seed;s.hands=s.hands.map(()=>d.items.splice(0,7));s.stock=d.items;s.chain=[];s.passes=0;s.phase='play';s.winners=[];s.round++;
  const all=s.hands.flat();const doubles=all.filter(id=>tiles[id][0]===tiles[id][1]);s.opening=doubles.length?doubles.sort((a,b)=>tiles[b][0]-tiles[a][0])[0]:all.sort((a,b)=>pipSum([b])-pipSum([a])||b-a)[0];s.turn=s.hands.findIndex(h=>h.includes(s.opening));
  s.event={es:`Ronda ${s.round}. Abre la ficha ${tiles[s.opening].join('–')}.`,en:`Round ${s.round}. Open with ${tiles[s.opening].join('–')}.`};
}
export function createDomino(c:Config,seed:number):DominoState {
  const n=c.mode==='pairs'?4:Math.max(2,Math.min(4,Number(c.players)||2));const s={...baseState(seed),hands:Array.from({length:n},()=>[]),stock:[],chain:[],turn:0,passes:0,phase:'play',points:Array(n).fill(0),round:0,winners:[],opening:-1,event:{es:'',en:''}} as DominoState;deal(s);return s;
}
export function roundWinners(s:DominoState,c:Config,finisher=-1):number[] {
  if(c.mode==='pairs'){
    if(finisher>=0)return [finisher%2,finisher%2+2];
    const a=pipSum(s.hands[0])+pipSum(s.hands[2]),b=pipSum(s.hands[1])+pipSum(s.hands[3]);return a===b?[]:a<b?[0,2]:[1,3];
  }
  if(finisher>=0)return [finisher];const sums=s.hands.map(pipSum),min=Math.min(...sums);const winners=sums.flatMap((sum,i)=>sum===min?[i]:[]);return winners.length===1?winners:[];
}
function endRound(s:DominoState,c:Config,finisher=-1){
  s.phase='roundover';s.winners=roundWinners(s,c,finisher);
  const points=s.hands.reduce((sum,h,i)=>sum+(s.winners.includes(i)?0:pipSum(h)),0);
  s.winners.forEach(i=>s.points[i]+=points);s.score=s.points[0];
  s.event=s.winners.length?{es:`${finisher<0?'Cierre':'Dominó'}: ${s.winners.map(i=>`J${i+1}`).join(' + ')} gana ${points} puntos.`,en:`${finisher<0?'Blocked':'Domino'}: ${s.winners.map(i=>`P${i+1}`).join(' + ')} wins ${points} points.`}:{es:'Cierre empatado. Nadie puntúa.',en:'Blocked tie. No points awarded.'};
  if(s.points.some(p=>p>=Number(c.target||100)))s.status=s.winners.includes(0)?'won':'lost';
}
export function dominoReducer(state:DominoState,a:Action,c:Config):DominoState {
  if(state.status!=='playing')return state;
  if(a.type==='NEXT_ROUND'&&state.phase==='roundover'){const s=structuredClone(state);deal(s);return s;}
  if(state.phase!=='play')return state;
  if(a.type==='PLAY'){
    const id=Number(a.id);const end=a.end as 'left'|'right';if(!state.hands[state.turn].includes(id)||!legalEnds(state,id).includes(end))return state;
    const s=structuredClone(state);const [x,y]=tiles[id];const endpoint=end==='left'?s.chain[0]?.left:s.chain.at(-1)?.right;
    const tile=!s.chain.length?{id,left:x,right:y}:end==='left'?{id,left:x===endpoint?y:x,right:endpoint!}:{id,left:endpoint!,right:x===endpoint?y:x};
    if(end==='left')s.chain.unshift(tile);else s.chain.push(tile);s.hands[s.turn]=s.hands[s.turn].filter(i=>i!==id);s.passes=0;s.moves++;
    s.event={es:`J${s.turn+1} coloca ${x}–${y}.`,en:`P${s.turn+1} plays ${x}–${y}.`};
    if(!s.hands[s.turn].length)endRound(s,c,s.turn);else s.turn=(s.turn+1)%s.hands.length;return s;
  }
  if(a.type==='DRAW'){
    if(c.mode==='pairs'||!state.stock.length||legalTiles(state).length)return state;
    const s=structuredClone(state);s.hands[s.turn].push(s.stock.shift()!);s.moves++;s.event={es:'Ficha robada. Colócala si encaja; si no, sigue robando.',en:'Tile drawn. Play it if it fits; otherwise keep drawing.'};return s;
  }
  if(a.type==='PASS'){
    if(legalTiles(state).length||(state.stock.length&&c.mode!=='pairs'))return state;
    const s=structuredClone(state);s.moves++;s.passes++;s.event={es:`J${s.turn+1} pasa.`,en:`P${s.turn+1} passes.`};
    if(s.passes===s.hands.length)endRound(s,c);else s.turn=(s.turn+1)%s.hands.length;return s;
  }
  return state;
}
export function dominoBot(s:DominoState,c:Config):Action|null {
  if(s.phase!=='play')return null;const legal=legalTiles(s);if(!legal.length)return {type:s.stock.length&&c.mode!=='pairs'?'DRAW':'PASS'};
  const own=s.hands[s.turn];const frequency=Array(7).fill(0);own.forEach(id=>tiles[id].forEach(p=>frequency[p]++));
  const choices=legal.flatMap(id=>legalEnds(s,id).map(end=>{const [a,b]=tiles[id];const exposed=!s.chain.length?b:end==='left'?(a===s.chain[0].left?b:a):(a===s.chain.at(-1)!.right?b:a);return {id,end,value:pipSum([id])+(c.difficulty==='hard'?frequency[exposed]*3+(a===b?2:0):0)};}));
  if(c.difficulty!=='easy')choices.sort((a,b)=>b.value-a.value);return {type:'PLAY',id:choices[0].id,end:choices[0].end};
}
