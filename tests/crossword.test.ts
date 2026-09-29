import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import zlib from 'node:zlib';
import { generate, normalizeAnswer, prepareEntries, scanSlots, solveMask, template, validMask, type Entry } from '../src/games/crossword/generator';
import { createState, crosswordReducer } from '../src/games/crossword/engine';
const corpus=(locale:string)=>prepareEntries(JSON.parse(zlib.gunzipSync(fs.readFileSync(`src/data/${locale}.json.gz`)).toString()));
describe('crossword templates and solver',()=>{
 it.each([9,11,13])('creates a connected symmetric %i template with no short entries',size=>{const m=template(size,123);expect(validMask(m,size)).toBe(true);expect(m).toEqual([...m].reverse());expect(m.filter(Boolean).length).toBeGreaterThanOrEqual(size*size*.68);expect(scanSlots(m,size).every(s=>s.cells.length>=3)).toBe(true);});
 it('rejects disconnected masks and entries shorter than three',()=>{expect(validMask([true,false,false,false,false,false,false,false,true],3)).toBe(false);});
 it('solves matching across/down words without repeated entries',()=>{const entries=['abc','def','ghi','adg','beh','cfi'].map(w=>({w,g:w+' clue'}));const p=solveMask(Array(9).fill(true),3,entries,10)!;expect(p).not.toBeNull();expect(new Set(p.slots.map(s=>s.word)).size).toBe(6);for(const slot of p.slots)expect(slot.cells.map(i=>p.solution[i]).join('')).toBe(slot.word);});
 it('reports an unsatisfiable lexicon instead of creating invalid fill',()=>{expect(solveMask(Array(9).fill(true),3,[{w:'abc',g:'clue'}],1,20)).toBeNull();});
 it.each(['es','en'])('fills all requested sizes with the actual %s lexicon',locale=>{const entries=corpus(locale);for(const size of [9,11,13])for(const seed of [78233,892]){const p=generate(size,entries,seed,12);expect(p,`${locale} ${size} seed ${seed}`).not.toBeNull();if(p){const words=new Set(entries.map(e=>e.w));for(const slot of p.slots){expect(words.has(slot.word)).toBe(true);expect(slot.clue.length).toBeGreaterThan(0);expect(slot.cells.map(i=>p.solution[i]).join('')).toBe(slot.word);}expect(new Set(p.slots.map(s=>s.word)).size).toBe(p.slots.length);expect(p.mask.map((v,i)=>!v||!!p.solution[i]).every(Boolean)).toBe(true);}}},120000);
});
describe('crossword input and saves',()=>{
 const puzzle=()=>solveMask(Array(9).fill(true),3,['abc','def','ghi','adg','beh','cfi'].map(w=>({w,g:w+' clue'})),10)!;
 it('preserves Ñ while normalizing accented answers',()=>{expect(normalizeAnswer('ÁrBÓL')).toBe('arbol');expect(normalizeAnswer('NiÑO')).toBe('niño');expect(normalizeAnswer('NiNO')).toBe('nino');});
 it('filters giveaway clues and deduplicates normalized answers',()=>{const entries=prepareEntries([{w:'Árbol',g:'Vegetal leñoso.'},{w:'arbol',g:'Planta con tronco.',p:'noun'},{w:'mar',g:'Masa de agua del mar.'},{w:'yo-yo',g:'Juguete.'}]);expect(entries).toEqual([{w:'arbol',g:'Planta con tronco.',p:'noun'}]);});
 it('fills with paste, shares crossing letters and wins only on the solution',()=>{let s=createState(puzzle(),9);for(const slot of s.puzzle.slots.filter(v=>v.direction==='across')){s=crosswordReducer(s,{type:'SLOT',id:slot.id});s=crosswordReducer(s,{type:'PASTE',value:slot.word});}expect(s.status).toBe('won');expect(s.score).toBe(90);});
 it('records hints and checks without erasing incorrect entries',()=>{let s=createState(puzzle(),9);s=crosswordReducer(s,{type:'INPUT',value:'x'});s=crosswordReducer(s,{type:'CHECK'});expect(s.board[0]).toBe('x');expect(s.checks).toBe(1);s=crosswordReducer(s,{type:'CELL',index:0});s=crosswordReducer(s,{type:'HINT'});expect(s.board[0]).toBe(s.puzzle.solution[0]);expect(s.hints).toBe(1);});
 it('backspace clears a letter then steps backwards along the active entry',()=>{let s=createState(puzzle(),9);s=crosswordReducer(s,{type:'INPUT',value:'x'});expect(s.selected).toBe(1);s=crosswordReducer(s,{type:'BACKSPACE'});expect(s.selected).toBe(0);expect(s.board[0]).toBe('');});
 it('reproduces the same seeded fill and saves actual puzzle content',()=>{const a=puzzle(),b=puzzle();expect(a).toEqual(b);const s=createState(a,9);expect(JSON.parse(JSON.stringify(s))).toEqual(s);});
});
