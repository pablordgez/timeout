import { baseState, type Action, type Config, type GameState } from '../../core/types';
import { random } from '../../core/random';

export interface ArcadeState extends GameState { kind:string; clock:number; elapsed:number; [key:string]:any }
function drawRandom(s:ArcadeState){const [v,rng]=random(s.rng);s.rng=rng;return v;}
export function createArcade(kind:string,c:Config,seed:number):ArcadeState {
  const s:ArcadeState={...baseState(seed),kind,clock:0,elapsed:0};
  if(kind==='snake'){Object.assign(s,{snake:[[8,10],[7,10],[6,10]],direction:[1,0],queued:[1,0],food:[0,0],period: c.speed==='fast'?0.075:c.speed==='slow'?0.18:0.12});placeFood(s);}
  if(kind==='runner')Object.assign(s,{y:0,vy:0,obstacles:[],spawn:1.3,speed:220});
  if(kind==='flappy')Object.assign(s,{y:200,vy:0,pipes:[],spawn:1.3});
  if(kind==='breakout')Object.assign(s,{x:360,y:340,vx:150,vy:-260,paddle:360,input:0,lives:3,level:1,bricks:brickField(1)});
  return s;
}
function placeFood(s:ArcadeState){const free:number[][]=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!s.snake.some((p:number[])=>p[0]===x&&p[1]===y))free.push([x,y]);if(!free.length){s.status='won';return;}s.food=free[Math.floor(drawRandom(s)*free.length)];}
function brickField(level:number){return Array.from({length:50},(_,i)=>({x:45+(i%10)*63,y:52+Math.floor(i/10)*24,hp:level>2&&i<20?2:1}));}
function snakeFrame(s:ArcadeState){s.clock+=1/120;if(s.clock+1e-9<s.period)return;s.clock-=s.period;s.direction=s.queued;const head=[s.snake[0][0]+s.direction[0],s.snake[0][1]+s.direction[1]];const eat=head[0]===s.food[0]&&head[1]===s.food[1];const body=eat?s.snake:s.snake.slice(0,-1);if(head.some(n=>n<0||n>=20)||body.some((p:number[])=>p[0]===head[0]&&p[1]===head[1])){s.status='lost';return;}s.snake.unshift(head);if(eat){s.score+=10;placeFood(s);}else s.snake.pop();s.moves++;}
function runnerFrame(s:ArcadeState){const dt=1/120;s.speed=220+Math.min(230,s.elapsed*3);s.vy-=1450*dt;s.y=Math.max(0,s.y+s.vy*dt);if(!s.y)s.vy=0;s.spawn-=dt;if(s.spawn<=0){s.obstacles.push({x:740,w:24+drawRandom(s)*25,h:30+drawRandom(s)*35});s.spawn=1.2+drawRandom(s)*0.8;}for(const o of s.obstacles){o.x-=s.speed*dt;if(o.x<111&&o.x+o.w>85&&s.y<o.h-3)s.status='lost';}s.obstacles=s.obstacles.filter((o:any)=>o.x+o.w>0);s.score=Math.floor(s.elapsed*10);}
function flappyFrame(s:ArcadeState){const dt=1/120;s.vy+=800*dt;s.y+=s.vy*dt;s.spawn-=dt;if(s.spawn<=0){s.pipes.push({x:740,gap:105+drawRandom(s)*220,scored:false});s.spawn=1.55;}for(const p of s.pipes){p.x-=150*dt;if(p.x+58<150&&!p.scored){p.scored=true;s.score++;}if(p.x<163&&p.x+58>137&&(s.y-12<p.gap-72||s.y+12>p.gap+72))s.status='lost';}s.pipes=s.pipes.filter((p:any)=>p.x>-60);if(s.y<12||s.y>428)s.status='lost';}
function breakoutFrame(s:ArcadeState){const dt=1/120;s.paddle=Math.max(55,Math.min(665,s.paddle+s.input*480*dt));const oldX=s.x,oldY=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;if(s.x<8){s.x=8;s.vx=Math.abs(s.vx);}if(s.x>712){s.x=712;s.vx=-Math.abs(s.vx);}if(s.y<8){s.y=8;s.vy=Math.abs(s.vy);}if(s.vy>0&&oldY<=389&&s.y>=389&&Math.abs(s.x-s.paddle)<63){const a=(s.x-s.paddle)/63*1.1;const speed=Math.min(560,Math.hypot(s.vx,s.vy)+7);s.vx=Math.sin(a)*speed;s.vy=-Math.cos(a)*speed;s.y=389;}
  for(const b of s.bricks){if(!b.hp||s.x+7<b.x||s.x-7>b.x+58||s.y+7<b.y||s.y-7>b.y+18)continue;b.hp--;s.score+=10;if(oldX+7<=b.x||oldX-7>=b.x+58)s.vx=-s.vx;else s.vy=-s.vy;s.x=oldX;s.y=oldY;break;}
  if(s.y>450){s.lives--;if(!s.lives)s.status='lost';else{Object.assign(s,{x:s.paddle,y:340,vx:150,vy:-260});}}
  if(s.bricks.every((b:any)=>!b.hp)){s.level++;s.bricks=brickField(s.level);Object.assign(s,{x:s.paddle,y:340,vx:150,vy:-260});}
}
export function arcadeReducer(state:ArcadeState,a:Action,_c:Config):ArcadeState {
  if(state.status!=='playing')return state;
  const s:ArcadeState=structuredClone(state);
  if(a.type==='RELEASE'){s.input=0;return s;}
  if(s.kind==='snake'&&a.down!==false){const dirs:Record<string,number[]>={LEFT:[-1,0],RIGHT:[1,0],UP:[0,-1],DOWN:[0,1]};const d=dirs[a.type];if(d&&d[0]!==-s.direction[0]&&d[1]!==-s.direction[1])s.queued=d;}
  if(s.kind==='runner'&&['JUMP','POINTER'].includes(a.type)&&a.down!==false&&s.y===0)s.vy=560;
  if(s.kind==='flappy'&&['JUMP','POINTER'].includes(a.type)&&a.down!==false&&!a.repeat)s.vy=-285;
  if(s.kind==='breakout'){if(a.type==='LEFT')s.input=a.down===false?0:-1;if(a.type==='RIGHT')s.input=a.down===false?0:1;if(['POINTER','POINTER_MOVE'].includes(a.type))s.paddle=Math.max(55,Math.min(665,a.x));}
  if(a.type!=='TICK')return s;
  s.accumulator=(s.accumulator||0)+Math.max(0,Math.min(1,Number(a.dt)||0));
  while(s.accumulator+1e-9>=1/120&&s.status==='playing'){s.accumulator-=1/120;s.elapsed+=1/120;if(s.kind==='snake')snakeFrame(s);if(s.kind==='runner')runnerFrame(s);if(s.kind==='flappy')flappyFrame(s);if(s.kind==='breakout')breakoutFrame(s);}
  return s;
}
