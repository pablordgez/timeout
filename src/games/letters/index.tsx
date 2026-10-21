import { useEffect, useState } from 'react';
import type { Action, Config, GameDefinition, GameViewProps, Locale } from '../../core/types';
import { difficulty, labels, select, tr } from '../../core/types';
import { loadLexicon, words } from '../../core/lexicon';
import { createLetters, createLettersSync, evaluatePlacement, lettersReducer, premiums, boardWithPlacements, tileAlphabet, type LetterTile, type LettersState } from './engine';
import { evaluatePlacement as evaluatePractice, lettersReducer as practiceReducer } from './rules';
import { botVocabulary, type BotPosition } from './bot';
import LettersWorker from './bot.worker?worker&inline';
import './letters.css';

let worker: Worker | undefined;
let requestId = 0;
const initialized = new Set<string>();
export async function lettersBot(state: LettersState, config: Config): Promise<Action> {
  await loadLexicon(state.language);
  worker ||= new LettersWorker();
  const target = worker;
  const id = ++requestId;
  const position: BotPosition = { board: state.board, rack: state.players[state.turn].rack, language: state.language, bagCount: state.bag.length, rng: state.rng ^ state.moves, difficulty: String(config.difficulty || 'medium') };
  const list = initialized.has(state.language) ? undefined : botVocabulary(words[state.language]);
  initialized.add(state.language);
  return new Promise((resolve,reject) => {
    const timeout = setTimeout(() => { target.removeEventListener('message',listener); initialized.clear(); if (worker===target) { target.terminate();worker=undefined; } reject(new Error('Letter bot timed out')); },20000);
    function listener(event: MessageEvent) {
      if (event.data.id !== id) return;
      clearTimeout(timeout); target.removeEventListener('message',listener);
      if(event.data.error) reject(new Error(event.data.error)); else resolve(event.data.action);
    }
    target.addEventListener('message',listener);
    target.postMessage({id,position,words:list});
  });
}
const errors:Record<string,[string,string]> = {
  empty:['Coloca al menos una ficha.','Place at least one tile.'], 'too-many':['Solo puedes colocar las siete fichas de tu atril.','You can play only the seven tiles on your rack.'],
  outside:['La casilla está fuera del tablero.','That square is outside the board.'], occupied:['La casilla o ficha ya está ocupada.','That square or tile is already occupied.'],
  rack:['Esa ficha no está en tu atril.','That tile is not on your rack.'], blank:['Elige la letra del comodín.','Choose a letter for the blank.'],
  line:['Todas las fichas nuevas deben estar en una misma fila o columna.','All new tiles must be in one row or column.'], gap:['La palabra no puede tener huecos.','Words cannot contain gaps.'],
  center:['La primera palabra debe cubrir la estrella central.','The first word must cover the centre star.'], connected:['La jugada debe conectar con las fichas del tablero.','The move must connect with existing board tiles.'],
  short:['Forma una palabra de al menos dos fichas.','Form a word of at least two tiles.'], 'recall-first':['Retira las fichas provisionales antes de pasar o cambiar.','Recall provisional tiles before passing or exchanging.'],
  'exchange-bag':['Se necesitan al menos siete fichas en la bolsa para cambiar.','At least seven tiles must remain in the bag to exchange.'],
  'exchange-select':['Selecciona las fichas que quieres cambiar.','Select the tiles you want to exchange.'],
};
function explainError(error:string|undefined,locale:Locale) {
  if(!error)return '';
  if(error.startsWith('word:')) return tr(locale, `«${error.slice(5)}» no está en el léxico incluido.`, `“${error.slice(5)}” is not in the included lexicon.`);
  if(error.startsWith('digraph:'))return tr(locale, `«${error.slice(8)}» requiere fichas CH, LL o RR indivisibles.`, `“${error.slice(8)}” requires indivisible CH, LL or RR tiles.`);
  return errors[error]?.[locale==='es'?0:1] || error;
}
function Tile({tile,blank=false}:{tile:LetterTile;blank?:boolean}) { return <span className={`letters-tile ${blank||tile.value===0?'letters-blank':''}`}><strong>{tile.letter||'◇'}</strong><small>{tile.value}</small></span>; }
interface BoardProps extends GameViewProps<LettersState> { practice?: boolean }
function LettersBoard({state:s,dispatch,locale:l,config:c,paused,practice}:BoardProps) {
  const [selected,setSelected]=useState<number|null>(null);
  const [blank,setBlank]=useState('A');
  const [exchange,setExchange]=useState<number[]>([]);
  const [exchangeMode,setExchangeMode]=useState(false);
  useEffect(()=>{setSelected(null);setExchange([]);setExchangeMode(false);},[s.turn,s.moves]);
  const player=s.players[s.turn];
  const dictionary=practice?new Set(['cat','at','cats','bat','car','art','tar']):undefined;
  const preview=practice?evaluatePractice(s,s.pending,dictionary):evaluatePlacement(s,s.pending);
  const board=boardWithPlacements(s,s.pending);
  const humanTurn=practice||s.turn<Math.min(Number(c.humans)||1,s.players.length);
  const active=s.status==='playing'&&!paused&&humanTurn;
  function choose(id:number) {
    if(exchangeMode) {setExchange(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);return;}
    if(s.pending.some(p=>p.tileId===id))dispatch({type:'RECALL',tileId:id});
    setSelected(selected===id?null:id);
  }
  function place(index:number) {
    const pending=s.pending.find(p=>p.row*15+p.col===index);
    if(pending) {dispatch({type:'RECALL',tileId:pending.tileId});setSelected(pending.tileId);return;}
    if(selected===null||s.board[index])return;
    const tile=player.rack.find(tile=>tile.id===selected)!;
    dispatch({type:'PLACE',row:Math.floor(index/15),col:index%15,tileId:selected,...(!tile.letter?{letter:blank}:{})});
    setSelected(null);
  }
  return <div className="letters-game">
    <div className="letters-scores">{s.players.map((player,i)=><div key={i} className={i===s.turn?'letters-active':''}><strong>{tr(l,'Jugador','Player')} {i+1}{i>=Math.min(Number(c.humans)||1,s.players.length)?' · BOT':''}</strong><span>{player.points} {tr(l,'puntos','points')} · {player.rack.length} {tr(l,'fichas','tiles')}</span></div>)}</div>
    <p className="letters-help">{tr(l,'Selecciona una ficha del atril y toca una casilla. Toca una ficha provisional para recuperarla.', 'Select a rack tile, then a square. Tap a provisional tile to recall it.')}</p>
    <p className="letters-scroll-help">{tr(l,'↔ Desliza el tablero para ver todas las columnas.', '↔ Swipe the board to see every column.')}</p>
    <div className="letters-board-scroll"><div className="letters-board" role="group" aria-label={tr(l,'Tablero de 15 por 15','15 by 15 board')}>
      {board.map((tile,index)=>{const premium=premiums[index];const pending=s.pending.some(p=>p.row*15+p.col===index);return <button key={index} type="button" className={`letters-cell letters-${premium||'plain'} ${pending?'letters-pending':''}`} disabled={!active||exchangeMode||!!s.board[index]} onClick={()=>place(index)} aria-label={`${tr(l,'Fila','Row')} ${Math.floor(index/15)+1}, ${tr(l,'columna','column')} ${index%15+1}: ${tile?`${tile.letter} ${tile.value}`:premium||(index===112?tr(l,'estrella central','centre star'):tr(l,'vacía','empty'))}`}>{tile?<Tile tile={tile}/>:<span>{index===112?'★':premium}</span>}</button>})}
    </div></div>
    <div className="letters-legend"><span className="letters-DL">DL · {tr(l,'doble letra','double letter')}</span><span className="letters-TL">TL · {tr(l,'triple letra','triple letter')}</span><span className="letters-DW">DW · {tr(l,'doble palabra','double word')}</span><span className="letters-TW">TW · {tr(l,'triple palabra','triple word')}</span></div>
    {s.status==='playing'?<>
      <div className="letters-rack" aria-label={humanTurn?tr(l,'Tu atril','Your rack'):tr(l,'Atril oculto del bot','Hidden bot rack')}>{humanTurn?player.rack.map(tile=><button key={tile.id} disabled={!active} aria-pressed={exchangeMode?exchange.includes(tile.id):selected===tile.id} aria-label={`${tile.letter||tr(l,'Comodín','Blank')}, ${tile.value} ${tr(l,'puntos','points')}`} className={`${selected===tile.id||exchange.includes(tile.id)?'letters-selected':''} ${s.pending.some(p=>p.tileId===tile.id)?'letters-used':''}`} onClick={()=>choose(tile.id)}><Tile tile={tile}/></button>):player.rack.map((_,index)=><span className="letters-hidden-tile" key={index} aria-hidden="true">···</span>)}</div>
      {selected!==null&&!player.rack.find(tile=>tile.id===selected)?.letter&&<label className="letters-blank-choice">{tr(l,'El comodín representa','Blank represents')} <select className="sd-select" value={blank} onChange={event=>setBlank(event.target.value)}>{tileAlphabet(s.language).map(letter=><option key={letter}>{letter}</option>)}</select><small>{tr(l,'Siempre vale 0 puntos.','Always worth 0 points.')}</small></label>}
      <div className="letters-actions">
        {exchangeMode?<><button className="sd-button" disabled={!active||!exchange.length} onClick={()=>dispatch({type:'EXCHANGE',ids:exchange})}>{tr(l,'Cambiar seleccionadas','Exchange selected')} ({exchange.length})</button><button className="sd-button" onClick={()=>{setExchangeMode(false);setExchange([]);}}>{tr(l,'Cancelar','Cancel')}</button></>:<>
          <button disabled={!active||!preview.valid} className="letters-confirm" onClick={()=>dispatch({type:'PLAY'})}>{tr(l,'Confirmar palabra','Confirm word')}{preview.valid?` · +${preview.score}`:''}</button>
          <button className="sd-button" disabled={!active||!s.pending.length} onClick={()=>{dispatch({type:'RECALL'});setSelected(null);}}>{tr(l,'Retirar fichas','Recall tiles')}</button>
          <button className="sd-button" disabled={!active||!!s.pending.length||s.bag.length<7} onClick={()=>{setExchangeMode(true);setSelected(null);}}>{tr(l,'Cambiar fichas','Exchange tiles')}</button>
          <button className="sd-button" disabled={!active||!!s.pending.length} onClick={()=>dispatch({type:'PASS'})}>{tr(l,'Pasar','Pass')}</button>
        </>}
        <span>{tr(l,'Bolsa','Bag')}: {s.bag.length} · {tr(l,'Turnos sin puntos','Scoreless turns')}: {s.scoreless}/6</span>
      </div>
      <div className="letters-preview" role="status">{!humanTurn?tr(l,'Turno del bot. Su atril permanece oculto.','Bot’s turn. Its rack stays hidden.'):s.message?explainError(s.message,l):s.pending.length?preview.valid?<><strong>+{preview.score}</strong> {preview.words.map(word=>`${word.word}: ${word.score}`).join(' · ')}{preview.bingo?` · ${tr(l,'Siete fichas','Seven tiles')}: +50`:''}</>:explainError(preview.error,l):tr(l,'Tu turno. Forma una palabra conectada al tablero.','Your turn. Build a word connected to the board.')}</div>
    </>:<div className="letters-results"><h3>{tr(l,'Partida terminada','Game over')}</h3><p>{s.winner?.length===1?tr(l,`Gana el jugador ${s.winner[0]+1}.`,`Player ${s.winner[0]+1} wins.`):tr(l,'Empate.','Draw.')}</p><p>{tr(l,'Las fichas restantes ya se han descontado de las puntuaciones.','Remaining rack values have been deducted from the scores.')}</p>{s.players.map((player,i)=><p key={i}>{tr(l,'Jugador','Player')} {i+1}: {player.rack.map(tile=>tile.letter||'◇').join(' · ')||'—'}</p>)}</div>}
    {!!s.log.length&&<details className="letters-log"><summary>{tr(l,'Últimos turnos y puntuaciones','Recent turns and scores')}</summary><ol>{s.log.map((entry,i)=><li key={i}>{tr(l,'Jugador','Player')} {entry.player+1}: {entry.type==='play'?`${entry.words.join(', ')} · +${entry.score}`:entry.type==='pass'?tr(l,'pasa','passes'):tr(l,'cambia fichas','exchanges tiles')}</li>)}</ol></details>}
  </div>;
}
function practiceState() {
  const s=createLettersSync({language:'en',players:2},11);
  s.players[0].rack=[{id:1000,letter:'C',value:3},{id:1001,letter:'A',value:1},{id:1002,letter:'T',value:1},{id:1003,letter:'S',value:1},{id:1004,letter:'B',value:3},{id:1005,letter:'R',value:1},{id:1006,letter:'',value:0}];
  s.players[1].rack=[{id:1010,letter:'S',value:1},{id:1011,letter:'A',value:1},{id:1012,letter:'T',value:1},{id:1013,letter:'B',value:3},{id:1014,letter:'R',value:1},{id:1015,letter:'C',value:3},{id:1016,letter:'',value:0}];
  s.bag=[];
  return s;
}
function LettersView(props:GameViewProps<LettersState>) {
  const {state:s,locale:l}=props;
  const [lexiconReady,setLexiconReady]=useState(words[s.language].length>0);
  useEffect(()=>{let live=true;setLexiconReady(words[s.language].length>0);loadLexicon(s.language).then(()=>{if(live)setLexiconReady(true);});return()=>{live=false;};},[s.language]);
  if(!lexiconReady)return <p role="status">{tr(l,'Cargando el léxico local…','Loading local lexicon…')}</p>;
  return <section><p className="letters-language">{tr(l,'Léxico de juego','Game lexicon')}: {s.language==='es'?'Español':'English'} · {tr(l,'Wikcionario abierto; no es un diccionario oficial de competición.','Open Wiktionary; this is not an official tournament dictionary.')}</p>
    {s.language!==l&&<p className="letters-language-notice">{tr(l,'Esta partida usa palabras y fichas inglesas.','This game uses Spanish words and tiles.')}</p>}
    <LettersBoard {...props}/>
  </section>;
}
export const letters:GameDefinition<LettersState>={
  id:'letters',name:labels('Letras en juego','Word tiles'),description:labels('Forma palabras con tus fichas y suma puntos.','Build words with your tiles and score points.'),category:'words',icon:'Aa',version:1,
  defaults:{language:'es',players:2,humans:1,difficulty:'medium'},options:[select('language','Idioma del léxico y fichas','Lexicon and tile language',[['es','Español','Spanish'],['en','Inglés','English']],'es'),select('players','Jugadores','Players',[[2,'2','2'],[3,'3','3'],[4,'4','4']],2),select('humans','Jugadores humanos','Human players',[[1,'1','1'],[2,'2','2'],[3,'3','3'],[4,'4','4']],1),{...difficulty,visibleWhen:c=>Number(c.humans)<(c.mode==='pairs'?4:Number(c.players))}],
  create:createLetters,practice:()=>practiceState(),reducer:lettersReducer,View:LettersView,bot:lettersBot,getTurn:(s,c)=>s.status!=='playing'?null:{player:s.turn,bot:s.turn>=Math.min(s.players.length,Number(c.humans)||1),hidden:true},
  guide:[
    {title:labels('Construye y conecta','Build and connect'),text:labels('La primera palabra debe cruzar la estrella. Coloca todas las fichas nuevas en una línea continua y conecta con las palabras existentes. Selecciona una ficha y toca una casilla; confirma cuando la vista previa sea válida.','The first word must cross the star. Place all new tiles in a continuous line and connect to existing words. Select a tile, then a square; confirm when the preview is valid.'),diagram:'C A T\n  R\n  T',action:{type:'PLACE',row:7,col:7,tileId:1000}},
    {title:labels('Multiplicadores y comodines','Premiums and blanks'),text:labels('DL/TL aumentan la letra; DW/TW multiplican la palabra. Solo se aplican a las fichas nuevas. Los comodines valen 0, incluso sobre multiplicadores. Siete fichas dan una bonificación de 50.','DL/TL increase the letter; DW/TW multiply the word. Only newly placed tiles receive premiums. Blanks score 0, including on premiums. Seven tiles earn a 50-point bonus.'),diagram:'(3 + 1 + 1) × 2 = 10\n7 fichas → +50'},
    {title:labels('Atril, bolsa y final','Rack, bag and ending'),text:labels('Puedes pasar o cambiar con al menos siete fichas en la bolsa. Tras seis turnos sin puntuar, o al vaciar un atril con la bolsa vacía, se ajustan las puntuaciones por las fichas restantes. La guía del tablero ofrece una práctica independiente.','Pass or exchange when at least seven tiles remain in the bag. Six scoreless turns, or an empty rack with an empty bag, end the game. Remaining tiles adjust the scores. The board guide includes independent practice.'),diagram:'Bolsa 0 + atril 0 → final\n6 turnos sin puntos → final',action:{type:'PASS',demo:true}},
  ],summarize:s=>({points:s.players[0].points,language:s.language,players:s.players.length,turns:s.moves}),
};
export default letters;
