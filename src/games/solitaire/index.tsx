import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import type { Action, Config, GameDefinition, GameViewProps, Locale } from '../../core/types';
import { labels, select, tr } from '../../core/types';
import { canMove, canPair, createSolitaire, movableRun, pyramidExposed, rankLabel, red, solitaireReducer, suitLabel, type Card, type Place, type SolitaireState, type Variant } from './engine';
import './solitaire.css';

const names = { klondike: 'Klondike', spider: 'Spider', freecell: 'FreeCell', pyramid: 'Pirámide' };
const messages: Record<string, [string, string]> = {
  'invalid-move': ['Ese movimiento no es válido. Consulta la guía o prueba otra columna.', 'That move is not legal. Read the guide or try another column.'],
  'invalid-pair': ['Solo puedes retirar cartas libres que sumen 13.', 'Only exposed cards totalling 13 can be removed.'],
  'nothing-to-undo': ['No hay movimientos que deshacer.', 'There are no moves to undo.'],
  'empty-stock': ['El mazo está agotado.', 'The stock is empty.'],
  'fill-columns': ['Ocupa todas las columnas antes de repartir otra fila.', 'Fill every column before dealing another row.'],
  'no-hint': ['No hay movimientos útiles evidentes. Puedes deshacer y buscar otra ruta.', 'No useful moves are apparent. Undo and explore another route.'],
  hint: ['Las cartas y el destino sugeridos están marcados. La pista no garantiza resolver la partida.', 'The suggested cards and destination are outlined. Hints do not guarantee a solution.'],
};
function samePlace(a?: Place | null, b?: Place | null) { return !!a && !!b && a.zone === b.zone && a.index === b.index; }
function cardName(card: Card, locale: Locale) {
  const suits = locale === 'es' ? ['picas', 'corazones', 'diamantes', 'tréboles'] : ['spades', 'hearts', 'diamonds', 'clubs'];
  return `${rankLabel(card.rank)} ${suits[card.suit]}`;
}
interface BoardProps { state: SolitaireState; dispatch: (action: Action) => void; locale: Locale; paused: boolean; compact?: boolean }
interface CardDrag { pointerId:number; from:Place; cards:Card[]; startX:number; startY:number; x:number; y:number; offsetX:number; offsetY:number; width:number; height:number; overlap:number; moved:boolean; target:Place|null }
function Board({ state, dispatch, locale, paused, compact }: BoardProps) {
  const [selection, setSelection] = useState<Place | null>(null);
  const boardRef=useRef<HTMLDivElement>(null);
  const pointerRef=useRef<CardDrag|null>(null);
  const captureRef=useRef<HTMLButtonElement|null>(null);
  const [drag,setDrag]=useState<CardDrag|null>(null);
  const suppressClick=useRef(false);
  function cancelDrag() {
    const current=pointerRef.current;
    pointerRef.current=null;setDrag(null);
    const captured=captureRef.current;captureRef.current=null;
    if(captured&&current) { try { if(captured.hasPointerCapture(current.pointerId))captured.releasePointerCapture(current.pointerId); } catch { /* Pointer may already have been cancelled by the browser. */ } }
  }
  useEffect(() => { setSelection(null); cancelDrag(); }, [state.moves, state.variant, paused]);
  useEffect(()=>{
    const cancel=()=>{if(pointerRef.current?.moved)suppressClick.current=true;cancelDrag();};
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){cancel();setSelection(null);}};
    window.addEventListener('blur',cancel);window.addEventListener('keydown',key);
    return()=>{window.removeEventListener('blur',cancel);window.removeEventListener('keydown',key);};
  },[]);
  const hint = state.hint;
  const hintSource: Place | undefined = hint?.from || hint?.first;
  const hintTarget: Place | undefined = hint?.to || hint?.second;
  const disabled = paused || state.status !== 'playing';
  const activeSource=drag?.moved?drag.from:selection;
  function legalTarget(from:Place,to:Place) { return state.variant==='pyramid'?canPair(state,from,to):canMove(state,from,to); }
  function hitTarget(x:number,y:number):Place|null {
    const hit=document.elementFromPoint(x,y)?.closest<HTMLElement>('[data-sol-zone]');
    if(!hit||!boardRef.current?.contains(hit))return null;
    return {zone:hit.dataset.solZone as Place['zone'],index:Number(hit.dataset.solIndex)};
  }
  function beginDrag(event:ReactPointerEvent<HTMLButtonElement>,from:Place,card:Card) {
    if(disabled||event.button!==0||!event.isPrimary||!card.up)return;
    const cards=from.zone==='tableau'?state.tableau[from.index].slice(from.offset):[card];
    if(state.variant==='pyramid') { if(from.zone==='pyramid'&&!pyramidExposed(state,from.index))return; }
    else if(!movableRun(cards,state.variant==='spider'))return;
    const rect=event.currentTarget.getBoundingClientRect();
    const overlap=parseFloat(getComputedStyle(boardRef.current!).getPropertyValue('--sol-overlap'))||27;
    pointerRef.current={pointerId:event.pointerId,from,cards,startX:event.clientX,startY:event.clientY,x:event.clientX,y:event.clientY,offsetX:event.clientX-rect.left,offsetY:event.clientY-rect.top,width:rect.width,height:rect.height,overlap,moved:false,target:null};
    suppressClick.current=false;captureRef.current=event.currentTarget;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveDrag(event:ReactPointerEvent<HTMLButtonElement>) {
    const current=pointerRef.current;
    if(!current||current.pointerId!==event.pointerId||disabled)return;
    const moved=current.moved||Math.hypot(event.clientX-current.startX,event.clientY-current.startY)>6;
    if(!moved)return;
    event.preventDefault();
    const next={...current,moved:true,x:event.clientX,y:event.clientY,target:hitTarget(event.clientX,event.clientY)};
    pointerRef.current=next;setDrag(next);setSelection(null);
    // Scroll wide boards near their edges without making a touch gesture move the page.
    const scroll=boardRef.current?.querySelector<HTMLElement>('.sol-scroll');
    if(scroll) {const bounds=scroll.getBoundingClientRect();const edge=28;if(event.clientX>bounds.right-edge)scroll.scrollLeft+=18;else if(event.clientX<bounds.left+edge)scroll.scrollLeft-=18;}
  }
  function endDrag(event:ReactPointerEvent<HTMLButtonElement>,cancelled=false) {
    const current=pointerRef.current;
    if(!current||current.pointerId!==event.pointerId)return;
    pointerRef.current=null;setDrag(null);captureRef.current=null;
    if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);
    if(!current.moved)return;
    suppressClick.current=true;event.preventDefault();setSelection(null);
    if(cancelled||disabled)return;
    const target=hitTarget(event.clientX,event.clientY);
    if(state.variant==='pyramid'&&canPair(state,current.from)&&boardRef.current?.contains(document.elementFromPoint(event.clientX,event.clientY)))dispatch({type:'pair',first:current.from});
    else if(target&&legalTarget(current.from,target))dispatch(state.variant==='pyramid'?{type:'pair',first:current.from,second:target}:{type:'move',from:current.from,to:target});
  }
  function choose(place: Place, card?: Card, pointerClick=false) {
    if(pointerClick&&suppressClick.current){suppressClick.current=false;return;}
    suppressClick.current=false;
    if (disabled || card && !card.up) return;
    if (state.variant === 'pyramid') {
      if (!card || place.zone === 'pyramid' && !pyramidExposed(state, place.index)) return;
      if (card.rank === 13) { dispatch({ type: 'pair', first: place }); setSelection(null); return; }
      if (selection && !samePlace(selection, place)) { dispatch({ type: 'pair', first: selection, second: place }); setSelection(null); }
      else setSelection(samePlace(selection, place) ? null : place);
      return;
    }
    if (selection && !samePlace(selection, place)) {
      dispatch({ type: 'move', from: selection, to: { zone: place.zone, index: place.index } }); setSelection(null);
    } else if (card) {
      setSelection(samePlace(selection, place) && selection?.offset === place.offset ? null : place);
    }
  }
  function cardButton(card: Card, place: Place, style?: CSSProperties, unavailable = false) {
    const selected = samePlace(activeSource, place) && (activeSource?.offset === undefined || place.offset === undefined || place.offset >= activeSource.offset);
    const suggested = samePlace(hintSource, place) && (hintSource?.offset === undefined || place.offset === undefined || place.offset >= hintSource.offset) || samePlace(hintTarget, place);
    const target = !!activeSource && legalTarget(activeSource, place);
    const over=drag?.moved&&samePlace(drag.target,place)&&target;
    const dragging=drag?.moved&&samePlace(drag.from,place)&&(drag.from.offset===undefined||place.offset===undefined||place.offset>=drag.from.offset);
    return <button key={card.id} type="button" style={style}
      data-sol-zone={place.zone} data-sol-index={place.index} data-sol-offset={place.offset}
      className={`sol-card ${card.up ? '' : 'sol-back'} ${card.up && red(card) ? 'sol-red' : ''} ${selected ? 'sol-selected' : ''} ${suggested ? 'sol-suggested' : ''} ${target ? 'sol-target' : ''} ${over?'sol-drop-ready':''} ${dragging?'sol-drag-source':''} ${unavailable ? 'sol-covered' : ''}`}
      disabled={disabled || !card.up || unavailable}
      aria-label={card.up ? `${cardName(card, locale)} · ${place.zone === 'tableau' ? tr(locale, 'columna', 'column') : place.zone === 'foundation' ? tr(locale, 'base', 'home') : place.zone === 'cell' ? tr(locale, 'celda', 'cell') : place.zone === 'pyramid' ? tr(locale, 'pirámide', 'pyramid') : tr(locale, 'descarte', 'waste')} ${place.index + 1}${selected ? tr(locale, ', seleccionada', ', selected') : ''}` : tr(locale, 'Carta boca abajo', 'Face-down card')}
      aria-pressed={selected} onClick={event => choose(place, card,event.detail>0)}
      onPointerDown={event=>beginDrag(event,place,card)} onPointerMove={moveDrag} onPointerUp={event=>endDrag(event)} onPointerCancel={event=>endDrag(event,true)}
      onLostPointerCapture={()=>{if(pointerRef.current){pointerRef.current=null;setDrag(null);}}} onDragStart={event=>event.preventDefault()}>
      {card.up ? <><span className="sol-corner">{rankLabel(card.rank)}<small>{suitLabel(card.suit)}</small></span><span className="sol-center">{suitLabel(card.suit)}</span><span className="sol-corner sol-bottom">{rankLabel(card.rank)}<small>{suitLabel(card.suit)}</small></span></> : <span aria-hidden="true">···</span>}
    </button>;
  }
  function empty(place: Place, text: string) {
    const highlighted = samePlace(hintTarget, place) || activeSource && legalTarget(activeSource, place);
    const over=drag?.moved&&samePlace(drag.target,place)&&highlighted;
    return <button type="button" data-sol-zone={place.zone} data-sol-index={place.index} className={`sol-slot ${highlighted ? 'sol-target' : ''} ${over?'sol-drop-ready':''}`} disabled={disabled} onClick={event => choose(place,undefined,event.detail>0)} aria-label={text}>{text}</button>;
  }
  function drawButton() {
    return <button className={`sol-card sol-stock ${hint?.type === 'draw' ? 'sol-suggested' : ''}`} disabled={disabled || !state.stock.length && (state.variant !== 'klondike' || !state.waste.length)} onClick={() => { dispatch({ type: 'draw' }); setSelection(null); }} aria-label={tr(locale, 'Robar o reciclar el mazo', 'Draw or recycle the stock')}>
      <span aria-hidden="true">{state.stock.length ? '···' : state.variant === 'klondike' ? '↻' : '∅'}</span><small>{state.stock.length}</small>
    </button>;
  }
  const instruction = state.variant === 'pyramid'
    ? tr(locale, 'Arrastra una carta libre sobre otra que sume 13, o pulsa las dos. Los reyes se retiran solos.', 'Drag an exposed card onto another totalling 13, or select both. Kings are removed alone.')
    : tr(locale, 'Arrastra una carta o grupo al destino marcado. También puedes pulsar una carta y después su destino.', 'Drag a card or group to an outlined destination. You can also select a card, then its destination.');
  return <div ref={boardRef} className={`sol-board ${compact ? 'sol-compact' : ''} ${drag?.moved?'sol-is-dragging':''}`}>
    <p className="sol-instruction">{instruction}</p>
    <p className="sol-scroll-help">{tr(locale,'↔ Desliza el tablero para ver todas las columnas.', '↔ Swipe the board to see every column.')}</p>
    <div className="sol-scroll">
      <div className={`sol-top sol-top-${state.variant}`}>
        {state.variant !== 'freecell' && <div className="sol-pile"><span className="sol-label">{tr(locale, 'Mazo', 'Stock')}</span>{drawButton()}</div>}
        {(state.variant === 'klondike' || state.variant === 'pyramid') && <div className="sol-pile"><span className="sol-label">{tr(locale, 'Descarte', 'Waste')} · {state.waste.length}</span>
          <div className="sol-waste">{state.waste.length ? state.waste.slice(-3).map((card, index, cards) => cardButton(card, { zone: 'waste', index: 0 }, { left: `${index * 17}px`, zIndex: index + 1 }, index !== cards.length - 1)) : empty({ zone: 'waste', index: 0 }, '—')}</div>
        </div>}
        {state.variant === 'freecell' && <div className="sol-cell-group">{state.cells.map((card, index) => <div className="sol-pile" key={index}><span className="sol-label">{tr(locale, 'Celda', 'Cell')} {index + 1}</span>{card ? cardButton(card, { zone: 'cell', index }) : empty({ zone: 'cell', index }, '○')}</div>)}</div>}
        {(state.variant === 'klondike' || state.variant === 'freecell') && <div className="sol-foundation-group">{state.foundations.map((cards, index) => <div className="sol-pile" key={index}><span className="sol-label">{tr(locale, 'Base', 'Home')} {index + 1}</span>{cards.length ? cardButton(cards.at(-1)!, { zone: 'foundation', index }) : empty({ zone: 'foundation', index }, 'A')}</div>)}</div>}
        {state.variant === 'spider' && <div className="sol-progress"><strong>{state.completed.length} / 8</strong><span>{tr(locale, 'secuencias completas', 'completed sequences')}</span><span className="sol-sequence-icons" aria-hidden="true">{Array.from({ length: 8 }, (_, i) => i < state.completed.length ? '●' : '○').join(' ')}</span></div>}
      </div>
      {state.variant === 'pyramid' ? <div className="sol-pyramid">{Array.from({ length: 7 }, (_, row) => <div className="sol-pyramid-row" key={row}>{Array.from({ length: row + 1 }, (_, col) => {
        const index = row * (row + 1) / 2 + col; const card = state.pyramid[index];
        return <div className="sol-pyramid-cell" key={index}>{card ? cardButton(card, { zone: 'pyramid', index }, undefined, !pyramidExposed(state, index)) : <span className="sol-cleared" aria-label={tr(locale, 'Carta retirada', 'Removed card')}>·</span>}</div>;
      })}</div>)}</div> : <div className={`sol-tableau sol-columns-${state.tableau.length}`}>
        {state.tableau.map((cards, index) => <div className="sol-column" key={index}>
          <span className="sol-label">{index + 1}</span>
          <div className="sol-column-cards" style={{ height: `calc(var(--sol-height) + ${Math.max(0, cards.length - 1)} * var(--sol-overlap))` }}>
            {empty({ zone: 'tableau', index }, tr(locale, 'Libre', 'Empty'))}
            {cards.map((card, offset) => cardButton(card, { zone: 'tableau', index, offset }, { top: `calc(${offset} * var(--sol-overlap))`, zIndex: offset + 1 }))}
          </div>
        </div>)}
      </div>}
    </div>
    <div className="sol-tools">
      <button disabled={paused || !state.history.length} onClick={() => dispatch({ type: 'undo' })}>{tr(locale, '↶ Deshacer', '↶ Undo')}</button>
      <button disabled={disabled} onClick={() => dispatch({ type: 'hint' })}>{tr(locale, '◇ Pista', '◇ Hint')}</button>
      {selection && <button onClick={() => setSelection(null)}>{tr(locale, 'Cancelar selección', 'Clear selection')}</button>}
      <span>{tr(locale, 'Movimientos', 'Moves')}: {state.moves} · {tr(locale, 'Puntos', 'Points')}: {state.score}</span>
    </div>
    <p className="sol-message" role="status">{state.status === 'won' ? tr(locale, '¡Solitario completado!', 'Solitaire complete!') : state.message && messages[state.message] ? messages[state.message][locale === 'es' ? 0 : 1] : '\u00a0'}</p>
    {drag?.moved&&createPortal(<div className={`sol-drag-ghost ${drag.target&&legalTarget(drag.from,drag.target)?'sol-ghost-valid':''}`} aria-hidden="true" style={{left:drag.x-drag.offsetX,top:drag.y-drag.offsetY,width:drag.width,height:drag.height+(drag.cards.length-1)*drag.overlap,'--sol-width':`${drag.width}px`,'--sol-height':`${drag.height}px`,'--sol-overlap':`${drag.overlap}px`} as CSSProperties}>
      {drag.cards.map((card,index)=><div key={card.id} className={`sol-card ${red(card)?'sol-red':''}`} style={{position:'absolute',top:index*drag.overlap,zIndex:index+1}}><span className="sol-corner">{rankLabel(card.rank)}<small>{suitLabel(card.suit)}</small></span><span className="sol-center">{suitLabel(card.suit)}</span><span className="sol-corner sol-bottom">{rankLabel(card.rank)}<small>{suitLabel(card.suit)}</small></span></div>)}
    </div>,document.body)}
  </div>;
}

const rules: Record<Variant, [string, string][]> = {
  klondike: [
    ['Construye cuatro bases por palo, del as al rey. En las columnas, baja un valor alternando rojo y negro.', 'Build four home piles by suit, from ace to king. Tableau columns descend by rank, alternating red and black.'],
    ['Puedes mover grupos ordenados. Solo un rey, solo o con su grupo, puede ocupar una columna vacía. Al liberar una carta tapada, se gira automáticamente.', 'Ordered groups can move together. Only a king, alone or with its group, can fill an empty column. Newly uncovered cards turn face up.'],
    ['Roba una o tres cartas según la configuración; solo la superior del descarte está disponible. Recicla el descarte cuando se agote el mazo, sin límite de vueltas. Puedes devolver cartas desde las bases.', 'Draw one or three cards according to your setting; only the top waste card is available. Recycle the waste when the stock empties, with unlimited passes. Home cards can return to the tableau.'],
  ],
  spider: [
    ['Forma ocho secuencias completas del rey al as del mismo palo. Se retiran automáticamente al completarlas.', 'Build eight complete same-suit sequences from king to ace. Completed sequences are removed automatically.'],
    ['Puedes colocar una carta sobre otra de valor inmediatamente superior, de cualquier palo. Solo los grupos consecutivos del mismo palo se trasladan juntos. Cualquier carta o grupo válido puede llenar un hueco.', 'Place a card on the next higher rank, regardless of suit. Only consecutive same-suit groups move together. Any card or valid group can fill an empty column.'],
    ['El mazo reparte diez cartas, una por columna. Todas las columnas deben estar ocupadas antes de repartir. Con dos o cuatro palos tendrás que separar los grupos mezclados.', 'The stock deals ten cards, one per column. Every column must contain a card before dealing. With two or four suits, mixed groups need separating.'],
  ],
  freecell: [
    ['Todas las cartas están visibles. Construye las cuatro bases por palo del as al rey y las columnas alternando color en orden descendente.', 'Every card is visible. Build the four homes by suit from ace to king, and tableau columns in descending rank with alternating colours.'],
    ['Las cuatro celdas guardan una carta cada una. Una columna vacía acepta cualquier carta. Mantener espacios libres es esencial.', 'Each of the four free cells holds one card. Any card can fill an empty column. Keeping spaces free is essential.'],
    ['Para mover un grupo, debe poder trasladarse carta a carta: capacidad = (celdas libres + 1) × 2 elevado a columnas libres. Si el destino está vacío, no cuenta como columna auxiliar.', 'A group must be movable one card at a time: capacity = (free cells + 1) × 2 to the power of free columns. An empty destination does not count as an auxiliary column.'],
  ],
  pyramid: [
    ['Retira pares que sumen 13: A vale 1, J 11, Q 12 y K 13. Los reyes se retiran solos.', 'Remove pairs totalling 13: A is 1, J is 11, Q is 12 and K is 13. Kings are removed alone.'],
    ['Una carta de la pirámide está libre cuando las dos cartas que la cubren ya se han retirado. Puedes combinar dos cartas libres o una libre con la superior del descarte.', 'A pyramid card is exposed when both cards covering it have been removed. Pair two exposed cards, or one exposed card with the top waste card.'],
    ['Roba una carta cada vez. En esta variante hay una sola vuelta del mazo; puedes deshacer. Ganas al vaciar la pirámide aunque sobren cartas en el mazo.', 'Draw one card at a time. This variant allows one stock pass; you can undo. Clear the pyramid to win, even if stock cards remain.'],
  ],
};

function practice(variant: Variant): SolitaireState {
  const s = createSolitaire({ variant, suits: 1 }, 17);
  s.tableau = []; s.stock = []; s.waste = []; s.pyramid = []; s.cells = [null, null, null, null];
  let id = 0;
  const c = (rank: number, suit: number, up = true): Card => ({ id: id++, rank, suit, up });
  if (variant === 'klondike') { s.tableau = [[c(7, 0, false), c(6, 1), c(5, 0)], [c(7, 3)], [], [], [], [], []]; s.waste = [c(1, 2)]; }
  if (variant === 'spider') { s.tableau = [[c(7, 0, false), c(6, 0), c(5, 0)], [c(7, 1)], [], [], [], [], [], [], [], []]; }
  if (variant === 'freecell') { s.tableau = [[c(6, 1), c(5, 0)], [c(7, 3)], [c(1, 2)], [], [], [], [], []]; }
  if (variant === 'pyramid') { s.pyramid = Array.from({ length: 28 }, () => null); s.pyramid[21] = c(6, 0); s.pyramid[22] = c(7, 1); s.pyramid[23] = c(13, 3); s.pyramid[15] = c(1, 1); s.waste = [c(12, 0)]; }
  return s;
}
function SolitaireView(props: GameViewProps<SolitaireState>) {
  const { state, config, locale, paused } = props;
  const [demo, setDemo] = useState<SolitaireState | null>(null);
  useEffect(() => setDemo(null), [state.variant]);
  return <section className="solitaire">
    <div className="sol-meta"><strong>{state.variant === 'pyramid' ? tr(locale, 'Pirámide', 'Pyramid') : names[state.variant]}</strong>
      <span>{state.variant === 'klondike' ? tr(locale, `Robo de ${config.draw || 1}`, `Draw ${config.draw || 1}`) : state.variant === 'spider' ? tr(locale, `${config.suits || 1} palo(s)`, `${config.suits || 1} suit(s)`) : tr(locale, 'Baraja de 52 cartas', '52-card deck')}</span>
    </div>
    <Board {...props} />
    <details className="sol-guide"><summary>{tr(locale, 'Cómo jugar · guía visual y práctica', 'How to play · visual guide and practice')}</summary>
      <ol>{rules[state.variant].map(([es, en], i) => <li key={i}>{tr(locale, es, en)}</li>)}</ol>
      <div className="sol-rule-diagram" aria-label={tr(locale, 'Ejemplo de una jugada válida', 'Example of a legal move')}>
        {state.variant === 'pyramid' ? <><span>6♠ + 7♥</span><b>→</b><span>13 ✓</span><span>K♣ → ✓</span></> : <><span className={state.variant === 'spider' ? '' : 'sol-red'}>{state.variant === 'spider' ? '6♠' : '6♥'}</span><span>5♠</span><b>→</b><span>7♣</span><small>{state.variant === 'spider' ? tr(locale, 'Grupos del mismo palo', 'Same-suit groups') : tr(locale, 'Orden descendente · alterna colores', 'Descending rank · alternate colours')}</small></>}
      </div>
      <p>{tr(locale, 'Prueba los controles en un tablero de práctica. No cambia tu partida ni tus estadísticas.', 'Try the controls on a practice board. Your saved game and statistics are unaffected.')}</p>
      <button onClick={() => setDemo(practice(state.variant))}>{demo ? tr(locale, 'Reiniciar práctica', 'Reset practice') : tr(locale, 'Abrir práctica interactiva', 'Open interactive practice')}</button>
      {demo && <div className="sol-demo"><p>{state.variant === 'pyramid' ? tr(locale, 'Ejercicio: empareja 6 y 7, retira el rey y combina el as liberado con la dama del descarte.', 'Exercise: pair 6 with 7, remove the king and pair the newly exposed ace with the waste queen.') : state.variant === 'spider' ? tr(locale, 'Ejercicio: mueve el 6 con el 5 sobre el 7. Se libera una carta tapada. Prueba después a mover grupos a columnas vacías.', 'Exercise: move the 6 and 5 onto the 7. This uncovers a hidden card. Then try moving groups into empty columns.') : tr(locale, 'Ejercicio: mueve el 6 con el 5 sobre el 7; después coloca el as en una base. En FreeCell puedes guardar una carta en una celda.', 'Exercise: move the 6 and 5 onto the 7, then place the ace in a home. In FreeCell, try keeping a card in a cell.')}</p><Board state={demo} dispatch={action => setDemo(current => current ? solitaireReducer(current, action, config) : null)} locale={locale} paused={false} compact /><button onClick={() => setDemo(null)}>{tr(locale, 'Cerrar práctica', 'Close practice')}</button></div>}
    </details>
    {paused && <p className="sol-paused">{tr(locale, 'Partida en pausa. Reanuda para jugar.', 'Game paused. Resume to play.')}</p>}
  </section>;
}

export const solitaire: GameDefinition<SolitaireState> = {
  id: 'solitaire', name: labels('Solitarios', 'Solitaire'), icon: '♠', category: 'cards', version: 1,
  description: labels('Cuatro clásicos de cartas, a tu ritmo.', 'Four classic card games at your own pace.'),
  defaults: { variant: 'klondike', draw: 1, suits: 1 },
  options: [select('variant', 'Variante', 'Variant', [['klondike', 'Klondike', 'Klondike'], ['spider', 'Spider', 'Spider'], ['freecell', 'FreeCell', 'FreeCell'], ['pyramid', 'Pirámide', 'Pyramid']], 'klondike'), select('draw', 'Klondike: cartas por robo', 'Klondike: cards per draw', [[1, 'Una', 'One'], [3, 'Tres', 'Three']], 1,c=>c.variant==='klondike'), select('suits', 'Spider: número de palos', 'Spider: number of suits', [[1, 'Uno', 'One'], [2, 'Dos', 'Two'], [4, 'Cuatro', 'Four']], 1,c=>c.variant==='spider')],
  create: createSolitaire, reducer: solitaireReducer, View: SolitaireView,
  guide: [
    { title: labels('Klondike', 'Klondike'), text: labels(rules.klondike.map(rule => rule[0]).join(' '), rules.klondike.map(rule => rule[1]).join(' ')), diagram: 'A → 2 → 3 … K   |   7♣ → 6♥ → 5♠', action: { type: 'hint' } },
    { title: labels('Spider', 'Spider'), text: labels(rules.spider.map(rule => rule[0]).join(' '), rules.spider.map(rule => rule[1]).join(' ')), diagram: 'K♠ → Q♠ → J♠ … A♠   × 8' },
    { title: labels('FreeCell', 'FreeCell'), text: labels(rules.freecell.map(rule => rule[0]).join(' '), rules.freecell.map(rule => rule[1]).join(' ')), diagram: '○ ○ ○ ○   |   (celdas + 1) × 2^columnas' },
    { title: labels('Pirámide', 'Pyramid'), text: labels(rules.pyramid.map(rule => rule[0]).join(' '), rules.pyramid.map(rule => rule[1]).join(' ')), diagram: 'A + Q = 13   |   6 + 7 = 13   |   K = 13' },
  ],
  summarize: (state, config) => ({ variant: state.variant, draw: Number(config.draw || 1), suits: Number(config.suits || 1), completed: state.completed.length }),
};
export default solitaire;
