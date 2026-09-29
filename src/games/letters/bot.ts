import type { Action, Locale } from '../../core/types';
import { random } from '../../core/random';
import { evaluatePlacement, normalize, tokenizeWord, type LetterTile, type Placement, type LettersState } from './rules';

// The bot's input deliberately has no bag contents or opponents' racks.
export interface BotPosition { board: (LetterTile | null)[]; rack: LetterTile[]; language: Locale; bagCount: number; rng: number; difficulty: string }
interface Node { next: Map<string,Node>; terminal: boolean }
interface Candidate { placements: Placement[]; score: number; merit: number }
export interface BotDictionary { root: Node; set: Set<string>; alphabet: string[] }
export function botVocabulary(entries: {w:string;g:string}[],limit=120000): string[] {
  return entries.filter(entry=>entry.g&&entry.w.length>=2&&entry.w.length<=15).sort((a,b)=>a.w.length-b.w.length).slice(0,limit).map(entry=>entry.w);
}
export function buildBotDictionary(input: string[], language: Locale): BotDictionary {
  const root: Node = { next: new Map(), terminal: false };
  const set = new Set<string>(); const alphabet = new Set<string>();
  for (const source of input) {
    const word = normalize(source); const tokens = tokenizeWord(word,language);
    if (tokens.length < 2 || tokens.length > 15 || tokens.join('').toLowerCase() !== word) continue;
    set.add(word);
    let node = root;
    for (const token of tokens) {
      alphabet.add(token);
      if (!node.next.has(token)) node.next.set(token,{ next:new Map(),terminal:false });
      node = node.next.get(token)!;
    }
    node.terminal = true;
  }
  return { root, set, alphabet:[...alphabet] };
}
function acceptableCross(tokens: string[], dictionary: BotDictionary, language: Locale) {
  if (tokens.length < 2) return true;
  const word = tokens.join('');
  return dictionary.set.has(normalize(word)) && (language !== 'es' || tokenizeWord(word,language).join('|') === tokens.join('|'));
}
export function findLetterMoves(position: BotPosition, dictionary: BotDictionary, budgetMs = 800): Candidate[] {
  const { board, rack, language } = position;
  const fake: Pick<LettersState,'board'|'players'|'turn'|'language'> = { board, players:[{ rack, points:0 }],turn:0,language };
  const deadline = performance.now() + Math.max(20,budgetMs);
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const emptyBoard = board.every(tile => !tile);
  let calls = 0; let expired = false;
  function tileAt(row:number,col:number) { return row < 0 || row > 14 || col < 0 || col > 14 ? null : board[row*15+col]; }
  const anchors = new Set<number>();
  for (let row=0;row<15;row++) for (let col=0;col<15;col++) if (!tileAt(row,col) && (emptyBoard ? row===7 && col===7 : !!tileAt(row-1,col)||!!tileAt(row+1,col)||!!tileAt(row,col-1)||!!tileAt(row,col+1))) anchors.add(row*15+col);
  for (const vertical of [false,true]) {
    const checks = new Map<number,Set<string>>();
    for (const index of Array.from({length:225},(_,i)=>i)) {
      if (board[index]) continue;
      const row = Math.floor(index/15); const col = index%15;
      const dr=vertical?0:1; const dc=vertical?1:0;
      const before:string[]=[]; const after:string[]=[];
      for (let r=row-dr,c=col-dc;tileAt(r,c);r-=dr,c-=dc) before.unshift(tileAt(r,c)!.letter);
      for (let r=row+dr,c=col+dc;tileAt(r,c);r+=dr,c+=dc) after.push(tileAt(r,c)!.letter);
      checks.set(index,new Set(dictionary.alphabet.filter(letter=>acceptableCross([...before,letter,...after],dictionary,language))));
    }
    const lines = Array.from({length:15},(_,i)=>i).sort((a,b)=>Math.abs(a-7)-Math.abs(b-7));
    for (const line of lines) {
      if (expired) break;
      const indexAt=(n:number)=>vertical?n*15+line:line*15+n;
      const lineAnchors=Array.from({length:15},(_,i)=>i).filter(i=>anchors.has(indexAt(i)));
      if (!lineAnchors.length) continue;
      const starts=Array.from({length:15},(_,i)=>i).filter(start=>!(start>0&&board[indexAt(start-1)])&&lineAnchors.some(anchor=>anchor>=start&&Array.from({length:anchor-start+1},(_,i)=>indexAt(start+i)).filter(i=>!board[i]).length<=rack.length));
      // Start near anchors to produce a valid answer quickly before exploring longer prefixes.
      starts.sort((a,b)=>Math.min(...lineAnchors.map(x=>Math.abs(x-a)))-Math.min(...lineAnchors.map(x=>Math.abs(x-b))));
      for (const start of starts) {
        if (expired) break;
        function search(n:number,node:Node,available:LetterTile[],placed:Placement[],connected:boolean) {
          calls++;
          if ((calls&127)===0 && performance.now()>deadline) { expired=true; return; }
          if (expired) return;
          if (node.terminal && placed.length && connected && n-start>=2 && (n===15||!board[indexAt(n)])) {
            const key=placed.map(p=>`${p.row}:${p.col}:${p.tileId}:${p.letter||''}`).join('|');
            if (!seen.has(key)) {
              seen.add(key);
              const evaluation=evaluatePlacement(fake,placed,dictionary.set);
              if (evaluation.valid) {
                const remaining=available.filter(tile=>tile.letter);
                const vowels=remaining.filter(tile=>'AEIOU'.includes(tile.letter)).length;
                const leave = remaining.reduce((sum,tile)=>sum-tile.value*.25,0) - Math.abs(vowels-(remaining.length-vowels))*.6;
                candidates.push({placements:placed.map(p=>({...p})),score:evaluation.score,merit:evaluation.score+leave});
                if (candidates.length>150) { candidates.sort((a,b)=>b.merit-a.merit);candidates.length=100; }
              }
            }
          }
          if (n>=15 || !connected&&!lineAnchors.some(anchor=>anchor>=n)) return;
          const index=indexAt(n);const existing=board[index];
          if (existing) { const child=node.next.get(existing.letter);if(child)search(n+1,child,available,placed,connected);return; }
          if (!available.length) return;
          const usedFaces=new Set<string>();
          for (let i=0;i<available.length;i++) {
            const tile=available[i];
            if(usedFaces.has(tile.letter))continue;usedFaces.add(tile.letter);
            const letters=tile.letter?[tile.letter]:[...node.next.keys()];
            for (const letter of letters) {
              const child=node.next.get(letter);if(!child||!checks.get(index)!.has(letter))continue;
              const next=available.slice();next.splice(i,1);
              const p:Placement={row:vertical?n:line,col:vertical?line:n,tileId:tile.id,...(!tile.letter?{letter}:{})};
              search(n+1,child,next,[...placed,p],connected||anchors.has(index));
              if(expired)return;
            }
          }
        }
        search(start,dictionary.root,rack,[],false);
      }
    }
    if(expired)break;
  }
  return candidates.sort((a,b)=>b.merit-a.merit);
}
export function chooseLetterBotAction(position:BotPosition,dictionary:BotDictionary,budgetMs?:number):Action {
  const candidates=findLetterMoves(position,dictionary,budgetMs??(position.difficulty==='hard'?1300:position.difficulty==='easy'?350:700));
  if(candidates.length) {
    const [roll]=random(position.rng);
    const index=position.difficulty==='hard'?0:position.difficulty==='easy'?Math.floor(roll*candidates.length):Math.floor(roll*Math.min(8,candidates.length));
    return {type:'PLAY',placements:candidates[index].placements};
  }
  const exchange=position.rack.filter(tile=>tile.letter).map(tile=>tile.id);
  if(position.bagCount>=7&&exchange.length) return {type:'EXCHANGE',ids:exchange};
  return {type:'PASS'};
}
