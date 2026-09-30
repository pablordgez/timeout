import { baseState, type Action, type Config, type GameState } from '../../core/types';
import { normalizeAnswer, type Puzzle } from './generator';
export interface CrosswordState extends GameState {puzzle:Puzzle;board:string[];selected:number;direction:'across'|'down';hints:number;checks:number;check:boolean}
export function createState(puzzle:Puzzle,seed:number):CrosswordState{return {...baseState(seed),puzzle,board:Array(puzzle.mask.length).fill(''),selected:puzzle.mask.indexOf(true),direction:puzzle.slots.find(slot=>slot.cells.includes(puzzle.mask.indexOf(true)))?.direction||'across',hints:0,checks:0,check:false};}
export function currentSlot(s:CrosswordState){return s.puzzle.slots.find(slot=>slot.direction===s.direction&&slot.cells.includes(s.selected))||s.puzzle.slots.find(slot=>slot.cells.includes(s.selected))!;}
export function crosswordReducer(s:CrosswordState,a:Action,_config?:Config):CrosswordState{
 if(a.type==='CELL'&&s.puzzle.mask[a.index])return {...s,selected:a.index,direction:a.toggle&&a.index===s.selected?(s.direction==='across'?'down':'across'):s.direction};
 if(a.type==='SLOT'){const slot=s.puzzle.slots.find(v=>v.id===a.id);return slot?{...s,selected:slot.cells.find(i=>!s.board[i])??slot.cells[0],direction:slot.direction}:s;}
 if(a.type==='ARROW'){const size=s.puzzle.size;let x=s.selected%size,y=Math.floor(s.selected/size);const d:Record<string,[number,number]>={left:[-1,0],right:[1,0],up:[0,-1],down:[0,1]};const [dx,dy]=d[a.direction]||[0,0];if(!dx&&!dy)return s;for(let n=0;n<size;n++){x+=dx;y+=dy;if(x<0||x>=size||y<0||y>=size)break;const i=y*size+x;if(s.puzzle.mask[i])return {...s,selected:i,direction:dy?'down':'across'};}return s;}
 if(s.status!=='playing')return s;
 if(a.type==='CHECK')return {...s,check:!s.check,checks:s.check?s.checks:s.checks+1};
 if(a.type!=='INPUT'&&a.type!=='HINT'&&a.type!=='BACKSPACE'&&a.type!=='PASTE')return s;
 const board=[...s.board];let selected=s.selected;const slot=currentSlot(s);const at=slot.cells.indexOf(selected);let hints=s.hints;
 if(a.type==='HINT'){if(board[selected]===s.puzzle.solution[selected])selected=slot.cells.find(i=>board[i]!==s.puzzle.solution[i])??s.puzzle.mask.findIndex((v,i)=>v&&board[i]!==s.puzzle.solution[i]);if(selected<0)return s;board[selected]=s.puzzle.solution[selected];hints++;}
 if(a.type==='BACKSPACE'){if(!board[selected]&&at>0)selected=slot.cells[at-1];board[selected]='';}
 if(a.type==='INPUT'){const i=Number.isInteger(a.index)?a.index:selected;if(!s.puzzle.mask[i])return s;const value=normalizeAnswer(String(a.value||''));if(value&&!/^[a-zñ]$/.test(value))return s;board[i]=value;selected=value?(slot.cells[slot.cells.indexOf(i)+1]??i):i;}
 if(a.type==='PASTE'){const value=normalizeAnswer(String(a.value)).replace(/[^a-zñ]/g,'');const start=value.length===slot.cells.length?0:at;for(let j=0;j<value.length&&start+j<slot.cells.length;j++)board[slot.cells[start+j]]=value[j];selected=slot.cells[Math.min(slot.cells.length-1,start+value.length)];}
 const won=s.puzzle.mask.every((v,i)=>!v||board[i]===s.puzzle.solution[i]);return {...s,board,selected,hints,moves:s.moves+1,status:won?'won':'playing',score:won?Math.max(0,s.puzzle.mask.filter(Boolean).length*10-hints*20):0};
}
