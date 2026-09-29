import { describe, expect, it } from 'vitest';
import { buildBotDictionary, botVocabulary, chooseLetterBotAction, findLetterMoves, type BotPosition } from '../src/games/letters/bot';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { cwd } from 'node:process';
import { boardWithPlacements, commitLetters, createLettersSync, distributions, evaluatePlacement, finishLetters, letterTiles, lettersReducer, makeBag, premiums, tokenizeWord, type LetterTile, type LettersState, type Placement } from '../src/games/letters/rules';

const t=(id:number,letter:string,value=1):LetterTile=>({id,letter,value});
const p=(row:number,col:number,tileId:number,letter?:string):Placement=>({row,col,tileId,...(letter?{letter}:{})});
function fixture(language:'es'|'en'='en'):LettersState { return {...createLettersSync({language,players:2},51),bag:[],players:[{rack:[],points:0},{rack:[],points:0}]}; }
const lex=(...words:string[])=>new Set(words.map(w=>w.toLowerCase()));
const tileAt=(state:LettersState,row:number,col:number,tile:LetterTile)=>{state.board[row*15+col]=tile;};
describe('Tile bags and Spanish tokenization',()=>{
  it.each(['es','en'] as const)('%s uses exactly 100 unique physical tiles and two blanks',language=>{
    const bag=makeBag(language);expect(bag).toHaveLength(100);expect(new Set(bag.map(t=>t.id)).size).toBe(100);expect(bag.filter(t=>!t.letter)).toHaveLength(2);
    expect(distributions[language].reduce((n,[,count])=>n+count,0)).toBe(100);
  });
  it('deals reproducibly without dropping any tiles for two to four players',()=>{
    for(const language of ['es','en'])for(const players of [2,3,4]){
      const state=createLettersSync({language,players},11);expect(state).toEqual(createLettersSync({language,players},11));
      expect(state.players).toHaveLength(players);expect(state.players.every(p=>p.rack.length===7)).toBe(true);expect(state.bag).toHaveLength(100-7*players);expect(letterTiles(state)).toHaveLength(100);
    }
  });
  it('keeps ñ distinct, strips accents and consumes CH, LL, RR as single tiles',()=>{
    expect(tokenizeWord('chillón','es')).toEqual(['CH','I','LL','O','N']);expect(tokenizeWord('perro','es')).toEqual(['P','E','RR','O']);expect(tokenizeWord('año','es')).toEqual(['A','Ñ','O']);
  });
  it('places premium squares symmetrically with a double-word centre',()=>{
    expect(premiums[112]).toBe('DW');expect(premiums.filter(p=>p==='TW')).toHaveLength(8);expect(premiums.filter(p=>p==='DW')).toHaveLength(17);
    for(let i=0;i<225;i++)expect(premiums[i]).toBe(premiums[224-i]);
  });
});
describe('Move legality and scoring',()=>{
  it('requires first word across centre and scores double word',()=>{
    const state=fixture();state.players[0].rack=[t(1,'C',3),t(2,'A'),t(3,'T')];
    expect(evaluatePlacement(state,[p(0,0,1),p(0,1,2),p(0,2,3)],lex('cat')).error).toBe('center');
    const result=evaluatePlacement(state,[p(7,6,1),p(7,7,2),p(7,8,3)],lex('cat'));expect(result.valid).toBe(true);expect(result.score).toBe(10);expect(result.words[0].multiplier).toBe(2);
  });
  it('rejects diagonal placements, gaps, disconnected words, duplicate IDs and occupied cells',()=>{
    const state=fixture();state.players[0].rack=[t(1,'A'),t(2,'T')];
    expect(evaluatePlacement(state,[p(7,7,1),p(8,8,2)],lex('at')).error).toBe('line');
    expect(evaluatePlacement(state,[p(7,6,1),p(7,8,2)],lex('at')).error).toBe('gap');
    expect(evaluatePlacement(state,[p(7,7,1),p(7,8,1)],lex('aa')).error).toBe('occupied');
    tileAt(state,7,7,t(8,'C',3));
    expect(evaluatePlacement(state,[p(0,0,1),p(0,1,2)],lex('at')).error).toBe('connected');
    expect(evaluatePlacement(state,[p(7,7,1),p(7,8,2)],lex('at')).error).toBe('occupied');
  });
  it('does not wrap horizontally from one row to another',()=>{
    const state=fixture();state.players[0].rack=[t(1,'T')];tileAt(state,7,14,t(5,'A'));tileAt(state,8,0,t(6,'A'));
    const result=evaluatePlacement(state,[p(8,1,1)],lex('at'));expect(result.valid).toBe(true);expect(result.words).toHaveLength(1);expect(result.words[0].word).toBe('AT');
  });
  it('reuses existing tiles without reusing their premium',()=>{
    const state=fixture();tileAt(state,7,7,t(3,'A'));tileAt(state,7,8,t(4,'T'));state.players[0].rack=[t(1,'C',3)];
    const result=evaluatePlacement(state,[p(7,6,1)],lex('cat'));expect(result.score).toBe(5);
  });
  it('multiplies simultaneous word bonuses and adds 50 for seven tiles',()=>{
    const state=fixture();tileAt(state,0,0,t(10,'A'));state.players[0].rack=Array.from({length:7},(_,i)=>t(i+1,'A'));
    const result=evaluatePlacement(state,Array.from({length:7},(_,i)=>p(0,i+1,i+1)),lex('aaaaaaaa'));
    expect(result.valid).toBe(true);expect(result.words[0].score).toBe(27);expect(result.bingo).toBe(50);expect(result.score).toBe(77);
    const multi=fixture();tileAt(multi,0,1,t(10,'A'));multi.players[0].rack=Array.from({length:7},(_,i)=>t(i+1,'A'));
    const coords=[0,2,3,4,5,6,7];const multiplied=evaluatePlacement(multi,coords.map((col,i)=>p(0,col,i+1)),lex('aaaaaaaa'));
    expect(multiplied.words[0].multiplier).toBe(9);expect(multiplied.score).toBe(131);
  });
  it('scores every cross-word and applies a new tile letter bonus in both directions',()=>{
    const state=fixture();state.players[0].rack=[t(1,'C',3),t(2,'T')];
    tileAt(state,2,7,t(20,'A'));tileAt(state,1,6,t(21,'A'));
    // Both (2,6) and (2,8) are DL: horizontal CAT = 6+1+2, vertical AC = 1+6.
    const result=evaluatePlacement(state,[p(2,6,1),p(2,8,2)],lex('cat','ac'));
    expect(result.valid).toBe(true);expect(result.words.map(w=>w.word)).toEqual(['CAT','AC']);expect(result.score).toBe(16);
    expect(evaluatePlacement(state,[p(2,6,1),p(2,8,2)],lex('cat')).error).toBe('word:AC');
  });
  it('allows single-tile moves forming two words and scores word premium twice',()=>{
    const state=fixture();tileAt(state,7,6,t(10,'A'));tileAt(state,6,7,t(11,'A'));state.players[0].rack=[t(1,'T')];
    const result=evaluatePlacement(state,[p(7,7,1)],lex('at'));expect(result.valid).toBe(true);expect(result.words).toHaveLength(2);expect(result.score).toBe(8);
  });
  it('scores assigned blanks as zero and validates their chosen letter',()=>{
    const state=fixture();state.players[0].rack=[t(1,'',0),t(2,'A'),t(3,'T')];
    const result=evaluatePlacement(state,[p(7,6,1,'C'),p(7,7,2),p(7,8,3)],lex('cat'));expect(result.valid).toBe(true);expect(result.score).toBe(4);
    expect(evaluatePlacement(state,[p(7,6,1),p(7,7,2),p(7,8,3)],lex('cat')).error).toBe('blank');
    expect(boardWithPlacements(state,[p(7,6,1,'C')])[111]).toEqual(t(1,'C',0));
  });
  it('validates all words against provided open lexicon and rejects malformed digraph segmentation',()=>{
    const state=fixture('es');state.players[0].rack=[t(1,'CH',5),t(2,'A'),t(3,'L')];
    expect(evaluatePlacement(state,[p(7,6,1),p(7,7,2),p(7,8,3)],lex('chal')).score).toBe(14);
    state.players[0].rack=[t(1,'C',3),t(2,'H',4),t(3,'A'),t(4,'L')];
    expect(evaluatePlacement(state,[p(7,5,1),p(7,6,2),p(7,7,3),p(7,8,4)],lex('chal')).error).toBe('digraph:CHAL');
  });
});
describe('Turns, conservation and game ending',()=>{
  it('commits a legal play, refills rack and leaves invalid play reversible',()=>{
    const state=createLettersSync({language:'en'},7);state.players[0].rack=[t(500,'C',3),t(501,'A'),t(502,'T')];
    state.pending=[p(7,6,500),p(7,7,501),p(7,8,502)];
    const result=commitLetters(state,state.pending,lex('cat'));expect(result.turn).toBe(1);expect(result.players[0].points).toBe(10);expect(result.players[0].rack).toHaveLength(7);expect(result.pending).toHaveLength(0);
    const bad=commitLetters(state,state.pending,new Set());expect(bad.board).toEqual(state.board);expect(bad.pending).toEqual(state.pending);expect(bad.players).toEqual(state.players);expect(bad.turn).toBe(0);expect(bad.moves).toBe(0);
  });
  it('supports repositioning and recalling provisional tiles without changing rack contents',()=>{
    const state=fixture();state.players[0].rack=[t(1,'C',3)];
    const a=lettersReducer(state,{type:'PLACE',tileId:1,row:7,col:7},{});expect(a.pending).toHaveLength(1);expect(a.players[0].rack).toEqual(state.players[0].rack);
    const b=lettersReducer(a,{type:'PLACE',tileId:1,row:7,col:8},{});expect(b.pending).toEqual([p(7,8,1)]);
    expect(lettersReducer(b,{type:'RECALL'},{}).pending).toHaveLength(0);
    expect(lettersReducer(b,{type:'PASS'},{}).turn).toBe(0);
  });
  it('exchange draws before returning selected tiles and preserves all 100 IDs',()=>{
    const state=createLettersSync({language:'es'},10);const ids=state.players[0].rack.slice(0,3).map(t=>t.id);
    const next=lettersReducer(state,{type:'EXCHANGE',ids},{});expect(next.turn).toBe(1);expect(next.players[0].rack).toHaveLength(7);expect(next.players[0].rack.some(t=>ids.includes(t.id))).toBe(false);
    expect(next.bag).toHaveLength(state.bag.length);expect(letterTiles(next).map(t=>t.id).sort((a,b)=>a-b)).toEqual(letterTiles(state).map(t=>t.id).sort((a,b)=>a-b));
    state.bag=state.bag.slice(0,6);expect(lettersReducer(state,{type:'EXCHANGE',ids},{}).message).toBe('exchange-bag');
  });
  it('six consecutive scoreless turns subtract every rack, with no transfer bonus',()=>{
    let state=fixture();state.players[0]={rack:[t(1,'Z',10)],points:20};state.players[1]={rack:[t(2,'A')],points:18};
    for(let i=0;i<6;i++)state=lettersReducer(state,{type:'PASS'},{});
    expect(state.status).toBe('lost');expect(state.winner).toEqual([1]);expect(state.players.map(p=>p.points)).toEqual([10,17]);expect(state.ending).toBe('scoreless');
  });
  it('a successful positive-scoring move resets consecutive scoreless turns',()=>{
    const state=fixture();state.scoreless=5;state.players[0].rack=[t(1,'A'),t(2,'T')];state.bag=[t(50,'A')];
    const next=commitLetters(state,[p(7,7,1),p(7,8,2)],lex('at'));expect(next.status).toBe('playing');expect(next.scoreless).toBe(0);
  });
  it('rack-empty with empty bag transfers remaining values to finisher and determines winner',()=>{
    const state=fixture();state.players[0].rack=[t(1,'A'),t(2,'T')];state.players[1]={rack:[t(3,'Z',10),t(4,'Q',10)],points:25};
    const next=commitLetters(state,[p(7,7,1),p(7,8,2)],lex('at'));expect(next.status).toBe('won');expect(next.players.map(p=>p.points)).toEqual([24,5]);expect(next.ending).toBe('empty-rack');
  });
  it('tracks tied final scores as a draw',()=>{
    const state=fixture();state.players[0].points=12;state.players[1].points=12;expect(finishLetters(state).status).toBe('draw');
  });
});
describe('Legal bot generation with public information only',()=>{
  function botPosition(state:LettersState,difficulty='hard'):BotPosition{return {board:state.board,rack:state.players[state.turn].rack,language:state.language,bagCount:state.bag.length,rng:state.rng,difficulty};}
  it('finds first moves through centre and respects blank assignments',()=>{
    const state=fixture();state.players[0].rack=[t(1,'',0),t(2,'A'),t(3,'T')];
    const dictionary=buildBotDictionary(['cat','at','bat','cart'],'en');const moves=findLetterMoves(botPosition(state),dictionary,300);
    expect(moves.length).toBeGreaterThan(0);for(const move of moves){expect(evaluatePlacement(state,move.placements,dictionary.set).valid).toBe(true);expect(move.placements.some(p=>p.row===7&&p.col===7)).toBe(true);}
    const action=chooseLetterBotAction(botPosition(state),dictionary,300);expect(action.type).toBe('PLAY');expect(evaluatePlacement(state,action.placements,dictionary.set).valid).toBe(true);
  });
  it('finds crossing moves and rejects cross-words not in dictionary',()=>{
    const state=fixture();tileAt(state,7,6,t(30,'C',3));tileAt(state,7,7,t(31,'A'));tileAt(state,7,8,t(32,'T'));
    state.players[0].rack=[t(1,'R'),t(2,'T'),t(3,'S'),t(4,'B',3),t(5,'A')];
    const dictionary=buildBotDictionary(['cat','cats','art','at','tar','bat','bar','rat','rats','star'],'en');
    const moves=findLetterMoves(botPosition(state),dictionary,500);expect(moves.length).toBeGreaterThan(0);
    for(const move of moves)expect(evaluatePlacement(state,move.placements,dictionary.set).valid).toBe(true);
  });
  it('uses Spanish composite tiles and never splits digraphs',()=>{
    const state=fixture('es');state.players[0].rack=[t(1,'CH',5),t(2,'A'),t(3,'L'),t(4,'LL',8),t(5,'O')];
    const dictionary=buildBotDictionary(['chal','llano','hola'],'es');const moves=findLetterMoves(botPosition(state),dictionary,300);expect(moves.length).toBeGreaterThan(0);
    for(const move of moves)expect(evaluatePlacement(state,move.placements,dictionary.set).valid).toBe(true);
  });
  it('passes with no move and exchanges only when seven tiles remain',()=>{
    const state=fixture();state.players[0].rack=[t(1,'Z',10)];const dictionary=buildBotDictionary(['cat'],'en');
    expect(chooseLetterBotAction(botPosition(state),dictionary,100).type).toBe('PASS');state.bag=Array.from({length:7},(_,i)=>t(20+i,'A'));
    expect(chooseLetterBotAction(botPosition(state),dictionary,100)).toEqual({type:'EXCHANGE',ids:[1]});
  });
  it('all difficulty levels return legal moves without inspecting opponent racks',()=>{
    const state=fixture();state.players[0].rack=[t(1,'C',3),t(2,'A'),t(3,'T'),t(4,'S'),t(5,'R')];
    const dictionary=buildBotDictionary(['cat','at','cats','art','car','tar','rat','rats','star'],'en');
    for(const level of ['easy','medium','hard']) {const action=chooseLetterBotAction(botPosition(state,level),dictionary,300);expect(action.type).toBe('PLAY');expect(evaluatePlacement(state,action.placements,dictionary.set).valid).toBe(true);}
  });
  it.each(['es','en'] as const)('plays legal turns with the actual bundled %s corpus',language=>{
    const entries=JSON.parse(gunzipSync(readFileSync(`${cwd()}/src/data/${language}.json.gz`)).toString()) as {w:string;g:string}[];
    const vocabulary=botVocabulary(entries);expect(vocabulary.length).toBeGreaterThan(10000);expect(vocabulary.length).toBeLessThanOrEqual(120000);
    const dictionary=buildBotDictionary(vocabulary,language);
    let state=createLettersSync({language},86);let plays=0;
    for(let i=0;i<8;i++) {
      const action=chooseLetterBotAction(botPosition(state),dictionary,100);
      if(action.type==='PLAY'){expect(evaluatePlacement(state,action.placements,dictionary.set).valid).toBe(true);plays++;}
      const next=lettersReducer(state,action,{},dictionary.set);expect(next.moves).toBe(state.moves+1);expect(letterTiles(next)).toHaveLength(100);expect(new Set(letterTiles(next).map(t=>t.id)).size).toBe(100);state=next;
    }
    expect(plays).toBeGreaterThan(0);
  },20000);
});
