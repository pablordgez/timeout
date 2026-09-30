import { baseState, type Action, type Config, type GameState } from '../../core/types';
import { random } from '../../core/random';
export interface ArcadeState extends GameState { kind:string; clock:number; elapsed:number; [key:string]:any }
const effect=(s:ArcadeState,type:string,x:number,y:number,value=0,full=.35)=>{s.effect={type,x,y,value,left:full,full};};
function drawRandom(s:ArcadeState){const [v,rng]=random(s.rng);s.rng=rng;return v;}
export function createArcade(kind:string,c:Config,seed:number):ArcadeState {
 const s:ArcadeState={...baseState(seed),kind,clock:0,elapsed:0,difficulty:String(c.difficulty||'medium')};
 if(kind==='snake'){Object.assign(s,{snake:[[8,10],[7,10],[6,10]],direction:[1,0],queued:[1,0],food:[0,0],period:c.speed==='fast'?.075:c.speed==='slow'?.18:.12});placeFood(s);}
 if(kind==='runner')Object.assign(s,{y:0,vy:0,obstacles:[],spawn:1.7,speed:220,distance:0,jumpBuffer:0});
 if(kind==='flappy')Object.assign(s,{y:200,vy:0,pipes:[],spawn:1.3,lastGap:220});
 if(kind==='breakout')Object.assign(s,{x:360,y:340,vx:150,vy:-260,paddle:360,input:0,lives:3,level:1,bricks:brickField(1),serve:false});
 return s;
}
function placeFood(s:ArcadeState){const free:number[][]=[];for(let y=0;y<20;y++)for(let x=0;x<20;x++)if(!s.snake.some((p:number[])=>p[0]===x&&p[1]===y))free.push([x,y]);if(!free.length){s.status='won';return;}s.food=free[Math.floor(drawRandom(s)*free.length)];}
function brickField(level:number){return Array.from({length:50},(_,i)=>({x:45+(i%10)*63,y:52+Math.floor(i/10)*24,hp:level>2&&i<20?2:1}));}
function snakeFrame(s:ArcadeState){s.clock+=1/120;if(s.clock+1e-9<s.period)return;s.clock=Math.max(0,s.clock-s.period);s.direction=s.queued;const head=[s.snake[0][0]+s.direction[0],s.snake[0][1]+s.direction[1]];const eat=head[0]===s.food[0]&&head[1]===s.food[1];const body=eat?s.snake:s.snake.slice(0,-1);if(head.some(n=>n<0||n>=20)||body.some((p:number[])=>p[0]===head[0]&&p[1]===head[1])){s.status='lost';effect(s,'impact',s.snake[0][0],s.snake[0][1]);return;}s.snakeFrom=s.snake.map((p:number[])=>[...p]);s.snake.unshift(head);if(eat){s.score+=10;effect(s,'eat',head[0],head[1],10);placeFood(s);}else s.snake.pop();s.moves++;}
function runnerFrame(s:ArcadeState){
 const dt=1/120,easy=s.difficulty==='easy',hard=s.difficulty==='hard';
 s.speed=(easy?185:hard?250:220)+Math.min(easy?145:hard?200:190,s.elapsed*(easy?1.8:hard?3.2:2.5));s.distance=(s.distance||0)+s.speed*dt;
 s.jumpBuffer=Math.max(0,(s.jumpBuffer||0)-dt);const airborne=s.y>0;s.vy-=1450*dt;s.y=Math.max(0,s.y+s.vy*dt);
 if(!s.y){s.vy=0;if(airborne)effect(s,'land',100,380,0,.22);if(s.jumpBuffer>0){s.vy=560;s.jumpBuffer=0;effect(s,'jump',100,380,0,.22);}}
 s.spawn-=dt;if(s.spawn<=0){const w=24+drawRandom(s)*(hard?25:18),h=30+drawRandom(s)*(hard?32:easy?18:25);s.obstacles.push({x:740,w,h,variant:Math.floor(drawRandom(s)*3),passed:false});s.spawn=(w+s.speed*(easy?1.15:hard?.92:1.03)+drawRandom(s)*s.speed*.45)/s.speed;}
 for(const o of s.obstacles){o.x-=s.speed*dt;if(o.x<110&&o.x+o.w>87&&s.y<o.h-5){s.status='lost';effect(s,'impact',100,355-s.y,0,.4);}if(!o.passed&&o.x+o.w<85){o.passed=true;s.moves++;}}
 s.obstacles=s.obstacles.filter((o:any)=>o.x+o.w>0);const old=s.score;s.score=Math.floor(s.elapsed*10);if(s.status==='playing'&&Math.floor(s.score/100)>Math.floor(old/100))effect(s,'milestone',360,100,s.score,.9);
}
function flappyFrame(s:ArcadeState){
 const dt=1/120,easy=s.difficulty==='easy',hard=s.difficulty==='hard',speed=easy?125:hard?175:150,half=easy?95:hard?72:83;s.gapHalf=half;
 s.vy=Math.min(430,s.vy+800*dt);s.y+=s.vy*dt;s.spawn-=dt;
 if(s.spawn<=0){const reach=easy?55:hard?90:72,gap=Math.max(half+38,Math.min(440-half-38,(s.lastGap||220)+(drawRandom(s)*2-1)*reach));s.lastGap=gap;s.pipes.push({x:740,gap,half,scored:false});s.spawn=(easy?260:hard?220:240)/speed;}
 for(const p of s.pipes){p.x-=speed*dt;const radius=p.half??half;if(p.x+58<138&&!p.scored){p.scored=true;s.score++;s.moves++;effect(s,'coin',150,s.y,1);}if(p.x<160&&p.x+58>140&&(s.y-10<p.gap-radius||s.y+10>p.gap+radius)){s.status='lost';effect(s,'impact',150,s.y);}}
 s.pipes=s.pipes.filter((p:any)=>p.x>-60);if(s.y<12||s.y>428){s.status='lost';effect(s,'impact',150,Math.max(12,Math.min(428,s.y)));}
}
function breakoutFrame(s:ArcadeState){
 const dt=1/120;s.paddle=Math.max(55,Math.min(665,s.paddle+s.input*480*dt));if(s.serve){s.x=s.paddle;s.y=386;return;}
 const oldX=s.x,oldY=s.y;s.x+=s.vx*dt;s.y+=s.vy*dt;
 if(s.x<8){s.x=8;s.vx=Math.abs(s.vx);effect(s,'bounce',s.x,s.y,0,.14);}if(s.x>712){s.x=712;s.vx=-Math.abs(s.vx);effect(s,'bounce',s.x,s.y,0,.14);}if(s.y<8){s.y=8;s.vy=Math.abs(s.vy);effect(s,'bounce',s.x,s.y,0,.14);}
 if(s.vy>0&&oldY<=389&&s.y>=389&&Math.abs(s.x-s.paddle)<63){const a=(s.x-s.paddle)/63*1.1,speed=Math.min(s.difficulty==='easy'?440:560,Math.hypot(s.vx,s.vy)+7);s.vx=Math.sin(a)*speed;s.vy=-Math.cos(a)*speed;s.y=389;effect(s,'paddle',s.x,398,0,.18);}
 for(const b of s.bricks){if(!b.hp||s.x+7<b.x||s.x-7>b.x+58||s.y+7<b.y||s.y-7>b.y+18)continue;b.hp--;s.score+=10;effect(s,'shatter',b.x+29,b.y+9,10,.3);if(oldX+7<=b.x||oldX-7>=b.x+58)s.vx=-s.vx;else s.vy=-s.vy;s.x=oldX;s.y=oldY;break;}
 if(s.y>450){s.lives--;s.trail=[];effect(s,'impact',s.paddle,398,0,.5);if(!s.lives)s.status='lost';else Object.assign(s,{x:s.paddle,y:386,vx:150,vy:-260,serve:true});}
 if(s.bricks.every((b:any)=>!b.hp)){s.level++;s.bricks=brickField(s.level);Object.assign(s,{x:s.paddle,y:386,vx:150,vy:-260,serve:true,trail:[]});effect(s,'milestone',360,250,s.level,1);}
}
export function arcadeReducer(state:ArcadeState,a:Action,_c:Config):ArcadeState {
 if(state.status!=='playing')return state;if(!['TICK','RELEASE','LEFT','RIGHT','UP','DOWN','JUMP','POINTER','POINTER_MOVE','POINTER_UP'].includes(a.type))return state;
 const s:ArcadeState=structuredClone(state);if(a.type==='RELEASE'){s.input=0;s.jumpBuffer=0;delete s.pointer;return s;}
 if(s.kind==='snake'&&a.down!==false){const dirs:Record<string,number[]>={LEFT:[-1,0],RIGHT:[1,0],UP:[0,-1],DOWN:[0,1]},d=dirs[a.type];if(d&&d[0]!==-s.direction[0]&&d[1]!==-s.direction[1])s.queued=d;}
 if(s.kind==='snake'){if(a.type==='POINTER')s.pointer=[a.x,a.y];if(a.type==='POINTER_UP')delete s.pointer;if(a.type==='POINTER_MOVE'&&a.down&&s.pointer){const dx=a.x-s.pointer[0],dy=a.y-s.pointer[1];if(Math.max(Math.abs(dx),Math.abs(dy))>=30){const d=Math.abs(dx)>Math.abs(dy)?[Math.sign(dx),0]:[0,Math.sign(dy)];if(d[0]!==-s.direction[0]&&d[1]!==-s.direction[1])s.queued=d;s.pointer=[a.x,a.y];}}}
 if(s.kind==='runner'&&['JUMP','POINTER'].includes(a.type)&&a.down!==false&&!a.repeat){if(s.y===0){s.vy=560;effect(s,'jump',100,380,0,.25);}else s.jumpBuffer=.1;}
 if(s.kind==='runner'&&((a.type==='JUMP'&&a.down===false)||a.type==='POINTER_UP')&&s.vy>260)s.vy=260;
 if(s.kind==='flappy'&&['JUMP','POINTER'].includes(a.type)&&a.down!==false&&!a.repeat){s.vy=-285;effect(s,'flap',150,s.y,0,.2);}
 if(s.kind==='breakout'){if(a.type==='LEFT')s.input=a.down===false?0:-1;if(a.type==='RIGHT')s.input=a.down===false?0:1;if(['POINTER','POINTER_MOVE'].includes(a.type))s.paddle=Math.max(55,Math.min(665,a.x));if(s.serve&&['JUMP','POINTER'].includes(a.type)&&a.down!==false&&!a.repeat){s.serve=false;effect(s,'paddle',s.x,s.y,0,.2);}}
 if(a.type!=='TICK')return s;s.accumulator=(s.accumulator||0)+Math.max(0,Math.min(1,Number(a.dt)||0));
 while(s.accumulator+1e-9>=1/120&&s.status==='playing'){s.accumulator-=1/120;s.elapsed+=1/120;if(s.effect){s.effect.left=Math.max(0,s.effect.left-1/120);if(!s.effect.left)delete s.effect;}if(s.kind==='snake')snakeFrame(s);if(s.kind==='runner')runnerFrame(s);if(s.kind==='flappy')flappyFrame(s);if(s.kind==='breakout')breakoutFrame(s);if((s.kind==='flappy'||s.kind==='breakout')&&Math.floor(s.elapsed*60)!==Math.floor((s.elapsed-1/120)*60))s.trail=[...(s.trail||[]),[s.kind==='flappy'?150:s.x,s.y]].slice(-9);}
 return s;
}
