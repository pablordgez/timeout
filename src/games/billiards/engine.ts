import { baseState, type Action, type Config, type GameState } from '../../core/types';
import { random, shuffle } from '../../core/random';
export const R=8, LEFT=30, RIGHT=690, TOP=30, BOTTOM=370, HEAD=195;
export const pockets=[[LEFT,TOP],[360,TOP],[RIGHT,TOP],[LEFT,BOTTOM],[360,BOTTOM],[RIGHT,BOTTOM]];
export interface Ball {id:number;x:number;y:number;vx:number;vy:number;pocketed:boolean}
export interface Shot {shooter:number;first:number|null;pocketed:{id:number;pocket:number}[];railAfter:boolean;railBalls:number[];calledBall:number;calledPocket:number;wasBreak:boolean;onEight:boolean;age:number;crossedHead:boolean;behindHead:boolean}
export interface PoolState extends GameState {balls:Ball[];turn:number;phase:'aim'|'moving'|'break-choice';groups:('solid'|'stripe'|null)[];breakShot:boolean;inHand:boolean;behindHead:boolean;angle:number;power:number;calledBall:number;calledPocket:number;shot:Shot|null;accumulator:number;fouls:number[];shots:number[];winner:number|null;event:{es:string;en:string};breakChoice:{foul:boolean;eight:boolean;illegal:boolean;shooter:number}|null}
export const groupOf=(id:number)=>id>0&&id<8?'solid':id>8?'stripe':null;
export const leftInGroup=(s:PoolState,g:string|null)=>s.balls.filter(b=>!b.pocketed&&groupOf(b.id)===g&&b.id!==0&&b.id!==8);
const distance=(a:{x:number;y:number},b:{x:number;y:number})=>Math.hypot(a.x-b.x,a.y-b.y);
function rack(seed:number):{balls:Ball[];seed:number}{
  const shuffled=shuffle([2,3,4,5,6,7,9,10,11,12,13,14],seed);const ids=[1,...shuffled.items];ids.splice(4,0,8);ids.push(15);
  // The bottom two corners must be from different groups.
  const corner=ids[10];if(groupOf(corner)===groupOf(ids[14])){const index=ids.findIndex((id,i)=>i!==4&&i!==14&&groupOf(id)!==groupOf(ids[14]));[ids[10],ids[index]]=[ids[index],ids[10]];}
  const balls:Ball[]=[{id:0,x:170,y:200,vx:0,vy:0,pocketed:false}];let index=0;
  for(let row=0;row<5;row++)for(let col=0;col<=row;col++)balls.push({id:ids[index++],x:495+row*(R*2+.12)*Math.sqrt(3)/2,y:200+(col-row/2)*(R*2+.12),vx:0,vy:0,pocketed:false});
  return {balls,seed:shuffled.seed};
}
export function createPool(c:Config,seed:number):PoolState {const r=rack(seed);return {...baseState(r.seed),balls:r.balls,turn:0,phase:'aim',groups:[null,null],breakShot:true,inHand:true,behindHead:true,angle:0,power:950,calledBall:1,calledPocket:2,shot:null,accumulator:0,fouls:[0,0],shots:[0,0],winner:null,event:{es:'Coloca la blanca detrás de la línea y realiza el saque.',en:'Place the cue ball behind the head string and break.'},breakChoice:null};}
export function validPlacement(s:PoolState,x:number,y:number){return Number.isFinite(x)&&Number.isFinite(y)&&x>=LEFT+R&&x<=RIGHT-R&&y>=TOP+R&&y<=BOTTOM-R&&(!s.behindHead||x<HEAD)&&pockets.every(([px,py])=>Math.hypot(x-px,y-py)>22)&&s.balls.every(b=>b.id===0||b.pocketed||Math.hypot(b.x-x,b.y-y)>=R*2+.1);}
export function permittedTargets(s:PoolState,c:Config){if(c.mode==='practice')return s.balls.filter(b=>b.id&& !b.pocketed).map(b=>b.id);const own=s.groups[s.turn];const target=own&&leftInGroup(s,own).length===0?[8]:s.balls.filter(b=>!b.pocketed&&b.id!==0&&b.id!==8&&(!own||groupOf(b.id)===own)).map(b=>b.id);return target;}
function respot(s:PoolState,id:number){const b=s.balls.find(b=>b.id===id)!;b.pocketed=false;b.vx=0;b.vy=0;for(let k=0;k<100;k++){b.x=495+(k%20)*R*2.1;b.y=200-Math.floor(k/20)*R*2.1;if(b.x>RIGHT-R)b.x=495-(k%20)*R*2.1;if(s.balls.every(other=>other===b||other.pocketed||distance(b,other)>R*2+.05))return;}b.x=170;b.y=100;}
function cueInHand(s:PoolState,behind:boolean){const cue=s.balls.find(b=>b.id===0)!;cue.pocketed=false;cue.vx=0;cue.vy=0;s.inHand=true;s.behindHead=behind;for(let y=100;y<340;y+=20)for(let x=100;x<(behind?HEAD:650);x+=20)if(validPlacement(s,x,y)){cue.x=x;cue.y=y;return;}}
function win(s:PoolState,player:number){s.winner=player;s.status=player===0?'won':'lost';s.score=s.status==='won'?1000:0;s.event={es:`Jugador ${player+1} gana la partida.`,en:`Player ${player+1} wins the game.`};}
export function adjudicate(s:PoolState,c:Config){
  const shot=s.shot!;const practice=c.mode==='practice';const scratch=shot.pocketed.some(b=>b.id===0);const objects=shot.pocketed.filter(b=>b.id>0);const own=s.groups[shot.shooter];
  const wrong=shot.first===null||(!practice&&!shot.wasBreak&&(own?(shot.onEight?shot.first!==8:groupOf(shot.first)!==own):shot.first===8));
  const headFoul=!shot.wasBreak&&shot.behindHead&&!shot.crossedHead;
  const illegalBreak=shot.wasBreak&&!objects.length&&shot.railBalls.filter(id=>id!==0).length<4;
  const foul=scratch||wrong||headFoul||(!shot.wasBreak&&!objects.length&&!shot.railAfter);
  const called=objects.some(p=>p.id===shot.calledBall&&p.pocket===shot.calledPocket);
  const eight=objects.some(p=>p.id===8);s.shots[shot.shooter]++;s.moves++;s.phase='aim';s.accumulator=0;
  if(foul)s.fouls[shot.shooter]++;
  if(practice){s.score=Math.max(0,s.balls.filter(b=>b.id&&b.pocketed).length*100-s.fouls[0]*25);if(foul)cueInHand(s,false);s.breakShot=false;s.event=foul?{es:'Falta. Coloca de nuevo la blanca y continúa.',en:'Foul. Place the cue ball and continue.'}:{es:'Continúa la práctica.',en:'Continue practicing.'};if(s.balls.filter(b=>b.id&& !b.pocketed).length===0){s.status='won';s.winner=0;}return;}
  if(shot.wasBreak&&(illegalBreak||foul||eight)){
    s.phase='break-choice';s.breakChoice={foul,eight,illegal:illegalBreak,shooter:shot.shooter};s.turn=(foul||illegalBreak)?1-shot.shooter:shot.shooter;s.event={es:'Saque especial: elige aceptar la mesa (la 8 se repone) o volver a montar.',en:'Break decision: accept the table (8 is spotted) or re-rack.'};return;
  }
  if(eight){win(s,!foul&&shot.onEight&&called?shot.shooter:1-shot.shooter);return;}
  if(shot.wasBreak){s.breakShot=false;if(!objects.length)s.turn=1-shot.shooter;s.event={es:'Saque legal. La mesa sigue abierta.',en:'Legal break. The table remains open.'};return;}
  if(foul){s.turn=1-shot.shooter;cueInHand(s,false);s.event={es:'Falta: blanca en mano para el rival.',en:'Foul: opponent has ball in hand.'};return;}
  if(!own&&called&&groupOf(shot.calledBall)){s.groups[shot.shooter]=groupOf(shot.calledBall);s.groups[1-shot.shooter]=groupOf(shot.calledBall)==='solid'?'stripe':'solid';}
  if(!called||groupOf(shot.calledBall)!==s.groups[shot.shooter])s.turn=1-shot.shooter;
  s.event={es:called?'Bola anunciada embocada.':'No entra la bola anunciada: cambia el turno.',en:called?'Called ball pocketed.':'Called ball missed: turn passes.'};
}
function step(s:PoolState,dt:number){
  const shot=s.shot!;shot.age+=dt;const active=s.balls.filter(b=>!b.pocketed);
  for(const b of active){b.x+=b.vx*dt;b.y+=b.vy*dt;const speed=Math.hypot(b.vx,b.vy);const next=Math.max(0,speed-120*dt);if(speed){b.vx*=next/speed;b.vy*=next/speed;}if(b.id===0&&b.x>=HEAD)shot.crossedHead=true;
    const pocket=pockets.findIndex(([x,y])=>Math.hypot(b.x-x,b.y-y)<18);
    if(pocket>=0){b.pocketed=true;b.vx=0;b.vy=0;shot.pocketed.push({id:b.id,pocket});continue;}
    let rail=false;if(b.x<LEFT+R){b.x=LEFT+R;b.vx=Math.abs(b.vx)*.83;rail=true;}if(b.x>RIGHT-R){b.x=RIGHT-R;b.vx=-Math.abs(b.vx)*.83;rail=true;}if(b.y<TOP+R){b.y=TOP+R;b.vy=Math.abs(b.vy)*.83;rail=true;}if(b.y>BOTTOM-R){b.y=BOTTOM-R;b.vy=-Math.abs(b.vy)*.83;rail=true;}
    if(rail){if(!shot.railBalls.includes(b.id))shot.railBalls.push(b.id);if(shot.first!==null)shot.railAfter=true;}
  }
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++){
    const a=active[i],b=active[j];if(a.pocketed||b.pocketed)continue;let dx=b.x-a.x,dy=b.y-a.y;const length=Math.hypot(dx,dy);if(length>=2*R||length===0)continue;dx/=length;dy/=length;
    const overlap=2*R-length;a.x-=dx*overlap/2;a.y-=dy*overlap/2;b.x+=dx*overlap/2;b.y+=dy*overlap/2;const v=(a.vx-b.vx)*dx+(a.vy-b.vy)*dy;
    if(v<=0)continue;const impulse=v*.97;a.vx-=impulse*dx;a.vy-=impulse*dy;b.vx+=impulse*dx;b.vy+=impulse*dy;
    if(shot.first===null&&(a.id===0||b.id===0))shot.first=a.id===0?b.id:a.id;
  }
}
export function poolReducer(state:PoolState,a:Action,c:Config):PoolState {
  if(state.status!=='playing')return state;
  if(a.type==='TICK'){
    if(state.phase!=='moving'||!Number.isFinite(a.dt)||a.dt<=0)return state;const s=structuredClone(state);s.accumulator+=Math.min(.1,a.dt);
    const steps=Math.floor((s.accumulator+1e-10)*240);s.accumulator=Math.max(0,s.accumulator-steps/240);
    for(let i=0;i<steps;i++){step(s,1/240);if(s.balls.every(b=>b.pocketed||Math.hypot(b.vx,b.vy)<2)||s.shot!.age>=15){s.balls.forEach(b=>{b.vx=0;b.vy=0;});adjudicate(s,c);break;}}return s;
  }
  if(state.phase==='moving')return state;
  if(state.phase==='break-choice'){
    if(a.type!=='BREAK_CHOICE')return state;const s=structuredClone(state);const choice=s.breakChoice!;
    if(a.choice==='accept'){if(choice.eight)respot(s,8);s.breakShot=false;s.phase='aim';if(choice.foul)cueInHand(s,true);s.event={es:'Mesa aceptada. Continúa la partida.',en:'Table accepted. Continue playing.'};}
    else if(a.choice==='rerack'||a.choice==='other'){const r=rack(s.rng);s.balls=r.balls;s.rng=r.seed;s.groups=[null,null];s.breakShot=true;s.inHand=true;s.behindHead=true;s.phase='aim';if(a.choice==='other')s.turn=choice.shooter;s.event={es:'Nuevo saque. Blanca detrás de la línea.',en:'New break. Cue ball behind the head string.'};}
    else return state;s.breakChoice=null;s.calledBall=1;return s;
  }
  if(a.type==='PLACE'||(a.type==='POINTER'&&state.inHand)){
    const x=Number(a.x),y=Number(a.y);if(!validPlacement(state,x,y))return {...state,event:{es:'Elige un espacio libre dentro de la mesa y de la zona permitida.',en:'Choose empty cloth within the table and permitted area.'}};const s=structuredClone(state);const cue=s.balls.find(b=>b.id===0)!;cue.x=x;cue.y=y;cue.pocketed=false;s.inHand=false;s.event={es:'Blanca colocada. Apunta y dispara.',en:'Cue ball placed. Aim and shoot.'};return s;
  }
  if(a.type==='POINTER'||a.type==='POINTER_MOVE'||a.type==='AIM'){
    if(a.type==='POINTER_MOVE'&&!a.down)return state;const s=structuredClone(state),cue=s.balls.find(b=>b.id===0)!;s.angle=a.type==='AIM'?Number(a.angle):Math.atan2(a.y-cue.y,a.x-cue.x);if(!Number.isFinite(s.angle))return state;return s;
  }
  if(a.type==='POWER'){const n=Number(a.power);return Number.isFinite(n)?{...state,power:Math.max(80,Math.min(1100,n))}:state;}
  if(a.type==='CALL_BALL'){const id=Number(a.id);return permittedTargets(state,c).includes(id)?{...state,calledBall:id}:state;}
  if(a.type==='CALL_POCKET'){const p=Number(a.pocket);return Number.isInteger(p)&&p>=0&&p<6?{...state,calledPocket:p}:state;}
  if(a.type==='SHOOT'){
    if(state.inHand)return state;const s=structuredClone(state);const angle=Number(a.angle??s.angle),power=Number(a.power??s.power),ball=Number(a.calledBall??s.calledBall),pocket=Number(a.calledPocket??s.calledPocket);
    if(!Number.isFinite(angle)||!Number.isFinite(power)||power<80||power>1100||(!s.breakShot&&!permittedTargets(s,c).includes(ball))||!Number.isInteger(pocket)||pocket<0||pocket>5)return state;
    const cue=s.balls.find(b=>b.id===0)!;if(cue.pocketed)return state;cue.vx=Math.cos(angle)*power;cue.vy=Math.sin(angle)*power;s.angle=angle;s.power=power;s.calledBall=ball;s.calledPocket=pocket;s.phase='moving';s.shot={shooter:s.turn,first:null,pocketed:[],railAfter:false,railBalls:[],calledBall:ball,calledPocket:pocket,wasBreak:s.breakShot,onEight:!!s.groups[s.turn]&&leftInGroup(s,s.groups[s.turn]).length===0,age:0,crossedHead:cue.x>=HEAD,behindHead:s.behindHead};s.behindHead=false;s.accumulator=0;return s;
  }
  return state;
}
function segmentClear(s:PoolState,a:{x:number;y:number},b:{x:number;y:number},ignore:number[]){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy;return s.balls.every(ball=>{if(ball.pocketed||ignore.includes(ball.id))return true;const t=Math.max(0,Math.min(1,((ball.x-a.x)*dx+(ball.y-a.y)*dy)/(len||1)));return Math.hypot(ball.x-a.x-t*dx,ball.y-a.y-t*dy)>R*2.05;});}
export function poolBot(s:PoolState,c:Config):Action|null {
  if(s.phase==='moving')return null;if(s.phase==='break-choice')return {type:'BREAK_CHOICE',choice:'accept'};
  if(s.inHand){for(let y=200;y<340;y+=20)for(let x=150;x<(s.behindHead?HEAD:650);x+=20)if(validPlacement(s,x,y))return {type:'PLACE',x,y};for(let y=60;y<340;y+=18)for(let x=60;x<(s.behindHead?HEAD:650);x+=18)if(validPlacement(s,x,y))return {type:'PLACE',x,y};return null;}
  if(s.breakShot)return {type:'SHOOT',angle:0,power:1100};
  const cue=s.balls.find(b=>b.id===0)!;const targets=permittedTargets(s,c);const candidates:{ball:number;pocket:number;angle:number;power:number;cost:number}[]=[];
  for(const id of targets){const b=s.balls.find(b=>b.id===id)!;for(let p=0;p<6;p++){const [px,py]=pockets[p],d=Math.hypot(px-b.x,py-b.y);const ghost={x:b.x-(px-b.x)/d*2*R,y:b.y-(py-b.y)/d*2*R};const clear=segmentClear(s,cue,ghost,[0,id])&&segmentClear(s,b,{x:px,y:py},[0,id]);const travel=distance(cue,ghost)+d;const aim=Math.atan2(ghost.y-cue.y,ghost.x-cue.x);const cut=Math.cos(aim-Math.atan2(py-b.y,px-b.x));candidates.push({ball:id,pocket:p,angle:aim,power:Math.min(1050,Math.sqrt(240*travel)/Math.max(.35,cut)+70),cost:travel+(clear?0:2000)+(cut<.35?2000:0)});}}
  candidates.sort((a,b)=>a.cost-b.cost);const best=candidates[0];if(!best)return null;const [r]=random(s.rng+s.moves*9871);const error=c.difficulty==='hard'?.008:c.difficulty==='easy'?.10:.035;return {type:'SHOOT',angle:best.angle+(r-.5)*2*error,power:best.power,calledBall:best.ball,calledPocket:best.pocket};
}
