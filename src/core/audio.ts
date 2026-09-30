import type { Action, GameState } from './types';

export type SoundCue='ui'|'card'|'move'|'place'|'jump'|'flap'|'eat'|'bounce'|'clear'|'success'|'failure'|'coin'|'roll'|'error';
type Tone={frequency:number;end?:number;duration:number;delay?:number;wave?:OscillatorType;gain?:number};
const tones:Record<SoundCue,Tone[]>={
 ui:[{frequency:650,end:520,duration:.035,gain:.4}],
 card:[{frequency:380,end:190,duration:.055,wave:'triangle',gain:.6}],
 move:[{frequency:280,end:360,duration:.035,wave:'triangle',gain:.35}],
 place:[{frequency:190,end:90,duration:.065,wave:'triangle',gain:.8}],
 jump:[{frequency:180,end:560,duration:.12,wave:'triangle',gain:.6}],
 flap:[{frequency:650,end:330,duration:.075,gain:.5}],
 eat:[{frequency:660,duration:.055,wave:'triangle',gain:.6},{frequency:900,duration:.08,delay:.055,wave:'triangle',gain:.6}],
 bounce:[{frequency:480,end:280,duration:.035,wave:'triangle',gain:.55}],
 clear:[{frequency:480,duration:.065,gain:.6},{frequency:640,duration:.075,delay:.06,gain:.6},{frequency:960,duration:.12,delay:.13,gain:.5}],
 success:[{frequency:520,duration:.1,gain:.5},{frequency:690,duration:.11,delay:.085,gain:.5},{frequency:880,duration:.18,delay:.18,gain:.5}],
 failure:[{frequency:360,end:280,duration:.12,wave:'triangle',gain:.55},{frequency:190,end:110,duration:.2,delay:.1,wave:'triangle',gain:.45}],
 coin:[{frequency:1100,duration:.05,gain:.35},{frequency:1500,end:1200,duration:.11,delay:.045,gain:.35}],
 roll:[{frequency:170,end:280,duration:.035,wave:'triangle',gain:.55},{frequency:210,end:150,duration:.035,delay:.055,wave:'triangle',gain:.5},{frequency:290,duration:.04,delay:.11,wave:'triangle',gain:.4}],
 error:[{frequency:130,end:100,duration:.09,wave:'triangle',gain:.55}]
};
let enabled=false,context:AudioContext|null=null,master:GainNode|null=null;
const lastCue=new Map<SoundCue,number>();
let lastGlobal=-Infinity,pending:SoundCue|null=null,resuming:Promise<void>|null=null;
const throttle:Partial<Record<SoundCue,number>>={move:80,bounce:55,place:70,ui:80,card:80,clear:180,success:350,failure:350};
function getContext(){if(!enabled||typeof window==='undefined')return null;if(context&&context.state!=='closed')return context;const Constructor=window.AudioContext||(window as any).webkitAudioContext;if(!Constructor)return null;try{context=new Constructor();master=context!.createGain();master.gain.value=.085;master.connect(context!.destination);return context;}catch{return null;}}
export function setSoundEnabled(value:boolean){enabled=!!value;if(!enabled){pending=null;lastCue.clear();lastGlobal=-Infinity;}if(master&&context){try{master.gain.setTargetAtTime(enabled?0.085:0,context.currentTime,.01);}catch{/* Unsupported audio never interrupts settings. */}}}
export async function unlockAudio():Promise<void>{const ctx=getContext();if(!ctx)return;if(ctx.state==='suspended'){try{await ctx.resume();}catch{/* Audio permission never interrupts a game. */}}}
function synthesize(cue:SoundCue){try{if(!enabled||!context||context.state!=='running'||!master)return;for(const tone of tones[cue]){const start=context.currentTime+(tone.delay||0),end=start+tone.duration;const oscillator=context.createOscillator(),envelope=context.createGain();oscillator.type=tone.wave||'sine';oscillator.frequency.setValueAtTime(tone.frequency,start);if(tone.end)oscillator.frequency.exponentialRampToValueAtTime(tone.end,end);envelope.gain.setValueAtTime(.0001,start);envelope.gain.exponentialRampToValueAtTime(tone.gain||.5,start+.004);envelope.gain.exponentialRampToValueAtTime(.0001,end);oscillator.connect(envelope);envelope.connect(master);oscillator.onended=()=>{oscillator.disconnect();envelope.disconnect();};oscillator.start(start);oscillator.stop(end+.015);}}catch{/* Sound failure never changes gameplay. */}}
/** Lazy, original oscillator cues: no fetched assets and no frame-rate-dependent buzz. */
export function playSound(cue:SoundCue){if(!enabled||!tones[cue])return;const now=performance.now();if(now-(lastCue.get(cue)??-Infinity)<(throttle[cue]??100)||now-lastGlobal<20)return;const ctx=getContext();if(!ctx)return;lastCue.set(cue,now);lastGlobal=now;if(ctx.state==='running'){synthesize(cue);return;}pending=cue;if(!resuming)resuming=unlockAudio().then(()=>{const queued=pending;pending=null;if(queued)synthesize(queued);}).finally(()=>{resuming=null;});}

const amount=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const length=(v:unknown)=>Array.isArray(v)?v.length:0;
const total=(v:unknown)=>Array.isArray(v)?v.reduce((sum,n)=>sum+amount(n),0):0;
const changedPair=(a:any,b:any)=>Array.isArray(a)&&Array.isArray(b)&&(a[0]!==b[0]||a[1]!==b[1]);
/** Pure event detection; steady clocks, gravity, friction and held controls are silent. */
export function soundForTransition(id:string,p:GameState,n:GameState,a:Action):SoundCue|null{
 if(p===n||a.type==='RELEASE')return null;
 if(p.status==='playing'&&n.status!=='playing')return n.status==='lost'?'failure':'success';
 if(id==='snake'){if(n.score>p.score)return 'eat';if(changedPair(p.queued,n.queued)&&a.down!==false)return 'move';return null;}
 if(id==='runner'){if(['JUMP','POINTER'].includes(a.type)&&p.y===0&&n.vy>0)return 'jump';if(Math.floor(n.score/100)>Math.floor(p.score/100))return 'coin';return null;}
 if(id==='flappy'){if(['JUMP','POINTER'].includes(a.type)&&n.vy<p.vy)return 'flap';if(n.score>p.score)return 'coin';return null;}
 if(id==='breakout'){if(n.level>p.level)return 'clear';if(n.lives<p.lives)return 'error';if(n.score>p.score||amount(p.vx)*amount(n.vx)<0||amount(p.vy)*amount(n.vy)<0)return 'bounce';return null;}
 if(id==='blocks'){if(n.lines>p.lines)return 'clear';if(n.moves>p.moves)return 'place';if(n.hold!==p.hold||n.rotation!==p.rotation||(n.x!==p.x&&n.piece===p.piece))return 'move';return null;}
 if(id==='billiards'){
  if(total(n.fouls)>total(p.fouls))return 'error';
  if(p.phase==='aim'&&n.phase==='moving')return 'place';
  if(Array.isArray(p.balls)&&Array.isArray(n.balls)){let collision=false;for(const ball of n.balls){const old=p.balls.find((b:any)=>b.id===ball.id);if(!old)continue;if(!old.pocketed&&ball.pocketed)return ball.id===0?'error':'coin';if(old.pocketed||ball.pocketed)continue;const before=Math.hypot(old.vx,old.vy),after=Math.hypot(ball.vx,ball.vy);if((Math.abs(old.vx)>15&&old.vx*ball.vx<0)||(Math.abs(old.vy)>15&&old.vy*ball.vy<0)||(ball.id!==0&&after>before+25))collision=true;}if(collision)return 'bounce';}return null;
 }
 if(id==='solitaire'){if(length(n.completed)>length(p.completed))return 'clear';if(n.moves>p.moves)return 'card';if(a.type==='HINT'||a.type==='UNDO')return 'ui';return null;}
 if(id==='chess'){if(length(n.log)>length(p.log))return /x|=/.test(String(n.log.at(-1)))?'place':'move';if(n.selected!==p.selected)return 'ui';return null;}
 if(id==='domino'){if(p.phase!=='roundover'&&n.phase==='roundover')return 'clear';if(length(n.chain)>length(p.chain))return 'place';if(length(n.stock)<length(p.stock)||n.round>p.round)return 'card';return null;}
 if(id==='poker'){if(p.street!=='showdown'&&n.street==='showdown')return 'clear';if(n.handNumber>p.handNumber||length(n.board)>length(p.board))return 'card';if(n.moves>p.moves)return ['RAISE','ALL_IN','CALL'].includes(a.type)?'coin':'card';return null;}
 if(id==='letters'){if(n.last?.valid===false&&n.last!==p.last)return 'error';if(length(n.log)>length(p.log))return n.last?.bingo?'clear':n.last?.score>0?'coin':'ui';if(length(n.pending)>length(p.pending))return 'place';return null;}
 if(id==='trivia'){if(a.type==='GRADE')return a.correct?'coin':'error';if(p.phase==='roll'&&n.phase==='move')return 'roll';if(n.moves>p.moves)return 'move';if(p.phase==='question'&&n.phase==='reveal')return 'ui';return null;}
 if(id==='ring'){if(['ANSWER','REVEAL'].includes(a.type))return n.score>p.score?'coin':'error';if(n.index!==p.index)return 'move';return null;}
 if(id==='wordle'){if(a.type==='GUESS'&&n.message&&length(n.guesses)===length(p.guesses))return 'error';if(length(n.guesses)>length(p.guesses))return 'place';return null;}
 if(id==='sudoku'){if(n.mistakes>p.mistakes)return 'error';if(n.hints>p.hints)return 'coin';if(n.moves>p.moves)return 'place';if(a.type==='NOTES'||a.type==='UNDO')return 'ui';return null;}
 if(id==='crossword'){if(n.hints>p.hints)return 'coin';if(n.moves>p.moves)return 'place';if(a.type==='CHECK'&&n.check!==p.check)return 'ui';return null;}
 return null;
}
