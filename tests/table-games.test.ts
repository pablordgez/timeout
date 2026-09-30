import { describe, expect, it } from 'vitest';
import { canRaise, cardLabel, compareHands, createPoker, evaluate, pokerBot, pokerReducer, sidePots, type Player, type PokerState } from '../src/games/poker/engine';
import { createDomino, dominoBot, dominoReducer, legalEnds, legalTiles, pipSum, roundWinners, tiles } from '../src/games/domino/engine';
import { adjudicate, createPool, poolBot, poolReducer, validPlacement, type PoolState, type Shot } from '../src/games/billiards/engine';
import {dragShot,previewShot} from '../src/games/billiards/preview';

const card=(rank:number,suit=0)=>suit*13+rank-2;
const player=(total:number,hole:number[],folded=false):Player=>({stack:0,hole,folded,allIn:true,bet:total,total,actedAt:-1});
describe('Hold’em evaluator and pot accounting',()=>{
  it('recognizes the ace-low straight and compares it below a six-high straight',()=>{
    const wheel=[card(14),card(2,1),card(3,2),card(4,3),card(5)];const six=[card(2),card(3,1),card(4,2),card(5,3),card(6)];
    expect(evaluate(wheel)).toEqual([4,5]);expect(compareHands(evaluate(six),evaluate(wheel))).toBeGreaterThan(0);
  });
  it('chooses a full house from two trips in seven cards',()=>{expect(evaluate([card(14),card(14,1),card(14,2),card(13),card(13,1),card(13,2),card(2)])).toEqual([6,14,13]);});
  it('uses five cards rather than six for flushes and gives quads the right kicker',()=>{
    expect(evaluate([14,13,11,9,6,4].map(r=>card(r)))).toEqual([5,14,13,11,9,6]);
    expect(evaluate([card(2),card(2,1),card(2,2),card(2,3),card(14),card(13),card(12)])).toEqual([7,2,14]);
  });
  it('splits common-board ties without using irrelevant hole cards',()=>{
    const board=[14,13,12,11,10].map(r=>card(r,3));const players=[player(101,[card(2),card(3)]),player(101,[card(4),card(5)]),player(1,[card(6),card(7)],true)];
    const result=sidePots(players,board,0);expect(result).toEqual([{player:0,amount:101},{player:1,amount:102}]);expect(result.reduce((n,p)=>n+p.amount,0)).toBe(203);
  });
  it('awards the main and side pot to different eligible winners',()=>{
    const board=[card(2),card(4,1),card(6,2),card(8,3),card(10)];const players=[player(100,[card(14),card(14,1)]),player(300,[card(13),card(13,1)]),player(300,[card(12),card(12,1)])];
    expect(sidePots(players,board,0)).toEqual([{player:0,amount:300},{player:1,amount:400}]);
  });
  it('counts folded contributions but never awards them a pot',()=>{
    const board=[card(2),card(4,1),card(6,2),card(8,3),card(10)];expect(sidePots([player(100,[card(14),card(14,1)],true),player(100,[card(13),card(13,1)])],board,0)).toEqual([{player:1,amount:200}]);
  });
  it('handles heads-up blinds and pre/post-flop action order',()=>{
    let s=createPoker({players:2},7);expect(s.dealer).toBe(0);expect(s.turn).toBe(0);expect(s.players.map(p=>p.bet)).toEqual([10,20]);
    s=pokerReducer(s,{type:'CALL'});expect(s.turn).toBe(1);s=pokerReducer(s,{type:'CALL'});expect(s.street).toBe('flop');expect(s.turn).toBe(1);expect(s.board.length).toBe(3);
  });
  it('rejects under-minimum non-all-in raises and keeps short all-ins from reopening',()=>{
    let s=createPoker({players:3},5);expect(pokerReducer(s,{type:'RAISE',amount:30})).toBe(s);
    s=pokerReducer(s,{type:'RAISE',amount:60});s.players[s.turn].stack=65-s.players[s.turn].bet;s=pokerReducer(s,{type:'ALL_IN'});
    expect(s.highest).toBe(65);expect(s.lastRaise).toBe(40);expect(canRaise(s,s.players[0])).toBe(false);expect(canRaise(s,s.players[s.turn])).toBe(true);
  });
  it('runs complete seeded tournaments without leaking, duplicating or losing chips',()=>{
    for(const seed of [7,31,89]){let s=createPoker({players:3},seed);for(let i=0;i<3000&&s.status==='playing';i++){
      const before=s.players.reduce((n,p)=>n+p.stack+(s.street==='showdown'?0:p.total),0);expect(before).toBe(3000);
      if(s.street==='showdown')s=pokerReducer(s,{type:'NEXT_HAND'});else {const a=pokerBot(s,{difficulty:'easy'});expect(a).not.toBeNull();const next=pokerReducer(s,a!);expect(next).not.toBe(s);s=next;}
      expect(s.players.every(p=>p.stack>=0&&p.bet>=0)).toBe(true);
    }expect(s.status).not.toBe('playing');expect(s.players.filter(p=>p.stack>0)).toHaveLength(1);expect(s.players.reduce((n,p)=>n+p.stack,0)).toBe(3000);}
  });
  it('bot decisions cannot depend on hidden cards or the future deck',()=>{
    const s=createPoker({players:3},61);const altered=structuredClone(s);altered.deck=[];altered.players.forEach((p,i)=>{if(i!==s.turn)p.hole=[card(14),card(14,1)];});
    expect(pokerBot(s,{difficulty:'hard'})).toEqual(pokerBot(altered,{difficulty:'hard'}));expect(cardLabel(51)).toBe('A♠');
  });
});
describe('double-six domino rules',()=>{
  it('creates exactly 28 unique tiles and conserves them during every draw and play',()=>{
    expect(new Set(tiles.map(t=>t.join('-'))).size).toBe(28);
    for(const mode of ['draw','pairs'])for(const seed of [11,23,47]){const c={mode,players:3,target:1000,difficulty:'hard'};let s=createDomino(c,seed);
      for(let n=0;n<500&&s.phase==='play';n++){const ids=[...s.hands.flat(),...s.stock,...s.chain.map(t=>t.id)];expect(ids.length).toBe(28);expect(new Set(ids).size).toBe(28);const a=dominoBot(s,c);expect(a).not.toBeNull();const next=dominoReducer(s,a!,c);expect(next).not.toBe(s);s=next;
        for(let i=1;i<s.chain.length;i++)expect(s.chain[i-1].right).toBe(s.chain[i].left);
      }expect(s.phase).toBe('roundover');
    }
  });
  it('requires the highest double to open and forbids passing a legal move',()=>{
    const c={mode:'draw',players:2};const s=createDomino(c,3);const a=dominoBot(s,c)!;expect(a.id).toBe(s.opening);expect(dominoReducer(s,{type:'PASS'},c)).toBe(s);expect(dominoReducer(s,{type:'DRAW'},c)).toBe(s);
    const illegal=s.hands[s.turn].find(id=>id!==s.opening)!;expect(legalEnds(s,illegal)).toEqual([]);
  });
  it('blocks when all players have no move and selects the lowest total',()=>{
    const c={mode:'draw',players:2};let s=createDomino(c,3);s.chain=[{id:0,left:0,right:0}];s.stock=[];s.hands=[[tiles.findIndex(t=>t[0]===1&&t[1]===1)],[tiles.findIndex(t=>t[0]===2&&t[1]===2)]];s.turn=0;
    expect(legalTiles(s)).toEqual([]);s=dominoReducer(s,{type:'PASS'},c);s=dominoReducer(s,{type:'PASS'},c);expect(s.phase).toBe('roundover');expect(s.winners).toEqual([0]);expect(s.points[0]).toBe(4);
  });
  it('compares total pips across partners and gives no score on a blocked tie',()=>{
    const s=createDomino({mode:'pairs'},10);const one=tiles.findIndex(t=>t[0]===0&&t[1]===1),two=tiles.findIndex(t=>t[0]===0&&t[1]===2);s.hands=[[one],[two],[one],[two]];expect(roundWinners(s,{mode:'pairs'})).toEqual([0,2]);
    s.hands=[[one],[two],[two],[one]];expect(roundWinners(s,{mode:'pairs'})).toEqual([]);expect(pipSum([one,two])).toBe(3);
  });
  it('finishes seeded all-bot matches with monotonic scores and finite rounds',()=>{
    for(const mode of ['draw','pairs'])for(const seed of [3,23,97]){const c={mode,players:3,target:50,difficulty:'hard'};let s=createDomino(c,seed);
      for(let i=0;i<2000&&s.status==='playing';i++){const action=s.phase==='roundover'?{type:'NEXT_ROUND'}:dominoBot(s,c);expect(action).not.toBeNull();const next=dominoReducer(s,action!,c);expect(next).not.toBe(s);expect(next.points.every((p,index)=>Number.isFinite(p)&&p>=s.points[index])).toBe(true);s=next;}
      expect(s.status).not.toBe('playing');expect(s.points.some(p=>p>=50)).toBe(true);if(mode==='pairs'){expect(s.points[0]).toBe(s.points[2]);expect(s.points[1]).toBe(s.points[3]);}
    }
  });
  it('domino strategy never consults the identities of opponents’ hidden tiles or the draw stock',()=>{
    const c={mode:'draw',players:3,difficulty:'hard'};let s=createDomino(c,61);s=dominoReducer(s,dominoBot(s,c)!,c);const masked=structuredClone(s);masked.hands.forEach((h,i)=>{if(i!==s.turn)masked.hands[i]=h.map(()=>0);});masked.stock.reverse();
    expect(dominoBot(s,c)).toEqual(dominoBot(masked,c));
  });
});
function shot(overrides:Partial<Shot>={}):Shot{return {shooter:0,first:1,pocketed:[],railAfter:true,railBalls:[1],calledBall:1,calledPocket:2,wasBreak:false,onEight:false,age:2,crossedHead:true,behindHead:false,...overrides};}
function shotState(overrides:Partial<Shot>={}):PoolState {const s=createPool({},10);s.breakShot=false;s.inHand=false;s.groups=['solid','stripe'];s.shot=shot(overrides);return s;}
describe('eight-ball adjudication and deterministic physics',()=>{
  it('maps a backwards pull to forward aim and proportional capped power',()=>{
    expect(dragShot({x:170,y:200},{x:70,y:200})).toEqual({angle:0,power:600,distance:100});expect(dragShot({x:170,y:200},{x:120,y:200}).power).toBe(300);expect(dragShot({x:170,y:200},{x:-500,y:200}).power).toBe(1100);expect(dragShot({x:170,y:200},{x:170,y:100}).angle).toBeCloseTo(Math.PI/2);
  });
  it('previews the first ball impact and transfers a straight shot to the object',()=>{
    const s=createPool({},1);const p=previewShot(s,0,800)!;expect(p.kind).toBe('ball');expect(p.ball).toBe(s.balls.find(b=>b.x===495)!.id);expect(p.contact.x).toBeCloseTo(479);expect(p.contact.y).toBeCloseTo(200);expect(p.lines.filter(l=>l.kind==='object')).toHaveLength(1);expect(p.lines[1].to.x).toBeGreaterThan(p.lines[1].from.x);
  });
  it('previews a cushion reflection and a pocket before the cushion',()=>{
    const s=createPool({},1);s.balls.filter(b=>b.id).forEach(b=>b.pocketed=true);let p=previewShot(s,0,600)!;expect(p.kind).toBe('rail');expect(p.contact.x).toBe(682);expect(p.lines[1].kind).toBe('bounce');expect(p.lines[1].to.x).toBeLessThan(p.contact.x);
    s.balls[0].x=360;p=previewShot(s,-Math.PI/2,600)!;expect(p.kind).toBe('pocket');expect(p.contact.y).toBeCloseTo(48);expect(p.lines).toHaveLength(1);
  });
  it('assigns groups only on a legal called shot, never on the break',()=>{
    const s=shotState({pocketed:[{id:1,pocket:2}]});s.groups=[null,null];adjudicate(s,{mode:'eight'});expect(s.groups).toEqual(['solid','stripe']);expect(s.turn).toBe(0);
    const b=shotState({wasBreak:true,pocketed:[{id:1,pocket:2}]});b.groups=[null,null];adjudicate(b,{mode:'eight'});expect(b.groups).toEqual([null,null]);expect(b.turn).toBe(0);
  });
  it('does not assign groups on a wrong pocket or scratch',()=>{
    for(const pocketed of [[{id:1,pocket:1}],[{id:1,pocket:2},{id:0,pocket:3}]]){const s=shotState({pocketed});s.groups=[null,null];adjudicate(s,{mode:'eight'});expect(s.groups).toEqual([null,null]);expect(s.turn).toBe(1);}
  });
  it('awards ball-in-hand on wrong first contact, scratch or no rail',()=>{
    for(const change of [{first:9},{first:null},{railAfter:false},{pocketed:[{id:0,pocket:1}]}]){const s=shotState(change);adjudicate(s,{mode:'eight'});expect(s.turn).toBe(1);expect(s.inHand).toBe(true);expect(s.fouls[0]).toBe(1);}
  });
  it('wins on the called eight after clearing the group, loses for early/wrong/foul eights',()=>{
    const good=shotState({first:8,onEight:true,calledBall:8,pocketed:[{id:8,pocket:2}]});adjudicate(good,{mode:'eight'});expect(good.status).toBe('won');
    for(const change of [{onEight:false},{pocketed:[{id:8,pocket:3}]},{pocketed:[{id:8,pocket:2},{id:0,pocket:1}]}]){const s=shotState({first:8,onEight:true,calledBall:8,pocketed:[{id:8,pocket:2}],...change});adjudicate(s,{mode:'eight'});expect(s.status).toBe('lost');}
  });
  it('allows a spotted eight on a legal break instead of ending the game',()=>{
    let s=shotState({wasBreak:true,pocketed:[{id:8,pocket:2}]});s.balls.find(b=>b.id===8)!.pocketed=true;adjudicate(s,{mode:'eight'});expect(s.phase).toBe('break-choice');expect(s.status).toBe('playing');s=poolReducer(s,{type:'BREAK_CHOICE',choice:'accept'},{mode:'eight'});expect(s.balls.find(b=>b.id===8)!.pocketed).toBe(false);expect(s.phase).toBe('aim');
  });
  it('detects an illegal break with fewer than four object balls on rails',()=>{const s=shotState({wasBreak:true,pocketed:[],railBalls:[1,2,3]});adjudicate(s,{mode:'eight'});expect(s.phase).toBe('break-choice');expect(s.turn).toBe(1);expect(s.breakChoice?.illegal).toBe(true);});
  it('rejects placing the cue over a ball, pocket or outside the kitchen',()=>{
    const s=createPool({},10);expect(validPlacement(s,150,180)).toBe(true);expect(validPlacement(s,495,200)).toBe(false);expect(validPlacement(s,30,30)).toBe(false);expect(validPlacement(s,250,180)).toBe(false);
  });
  it('preserves an in-flight shot through serialization and different display refresh rates',()=>{
    const c={mode:'eight'};let start=createPool(c,37);start=poolReducer(start,{type:'PLACE',x:170,y:200},c);start=poolReducer(start,{type:'SHOOT',power:1000,angle:0},c);
    let a=structuredClone(start),b=JSON.parse(JSON.stringify(start));for(let i=0;i<180;i++)a=poolReducer(a,{type:'TICK',dt:1/60},c);for(let i=0;i<360;i++)b=poolReducer(b,{type:'TICK',dt:1/120},c);
    for(let i=0;i<a.balls.length;i++){expect(a.balls[i].x).toBeCloseTo(b.balls[i].x,5);expect(a.balls[i].y).toBeCloseTo(b.balls[i].y,5);expect(a.balls[i].pocketed).toBe(b.balls[i].pocketed);}
  });
  it('a full-power bot break resolves and leaves all balls finite',()=>{
    const c={mode:'eight',difficulty:'hard'};let s=createPool(c,72);s=poolReducer(s,poolBot(s,c)!,c);s=poolReducer(s,poolBot(s,c)!,c);for(let i=0;i<1500&&s.phase==='moving';i++)s=poolReducer(s,{type:'TICK',dt:1/60},c);
    expect(s.phase).not.toBe('moving');expect(s.balls.every(b=>Number.isFinite(b.x)&&Number.isFinite(b.y))).toBe(true);expect(s.shots[0]).toBe(1);
  });
  it('the geometric aiming bot can actually pocket balls, not just choose legal actions',()=>{
    const c={mode:'practice',difficulty:'hard'};let s=createPool(c,72);
    for(let i=0;i<20000&&s.status==='playing'&&s.shots[0]<20;i++){
      const action=s.phase==='moving'?{type:'TICK',dt:.05}:poolBot(s,c);expect(action).not.toBeNull();const next=poolReducer(s,action!,c);expect(next).not.toBe(s);s=next;
    }
    expect(s.balls.filter(b=>b.id&&b.pocketed).length).toBeGreaterThan(4);
  });
  it('practice can shoot again after the previously called ball has been pocketed, while eight-ball still requires a valid call',()=>{
    const c={mode:'practice'};let state=createPool(c,42);
    state=poolReducer(state,{type:'PLACE',x:170,y:200},c);
    state.breakShot=false;
    state.balls.find(b=>b.id===state.calledBall)!.pocketed=true;
    const action={type:'SHOOT',angle:0,power:600};
    const practice=poolReducer(state,action,c);
    expect(practice.phase).toBe('moving');
    expect(practice.balls.find(b=>b.id===0)!.vx).toBe(600);
    expect(poolReducer(state,action,{mode:'eight'}).phase).toBe('aim');
  });
});
