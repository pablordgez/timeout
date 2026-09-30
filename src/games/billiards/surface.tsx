import { useCallback,useEffect,useRef,useState,type PointerEvent } from 'react';
import { CanvasBoard } from '../../ui/shared';
import { tr,type Action,type GameViewProps } from '../../core/types';
import { pockets,permittedTargets,type PoolState } from './engine';
import { dragShot,type Point } from './preview';
interface Gesture{pointer:number;start:Point;current:Point;angle:number;power:number;distance:number}
type Draw=(ctx:CanvasRenderingContext2D,s:PoolState,colors:Record<string,string>)=>void;
/** Drag state belongs to the UI. A cancelled or saved drag is never a pending shot. */
export function PoolSurface({state:s,dispatch,config:c,locale:l,paused,draw}:GameViewProps<PoolState>&{draw:Draw}){
 const wrapper=useRef<HTMLDivElement>(null),gesture=useRef<Gesture|null>(null),[power,setPower]=useState<number|null>(null);
 const ready=!paused&&s.phase==='aim'&&s.status==='playing'&&(c.mode==='practice'||s.turn<Number(c.humans||1));
 const cancel=useCallback(()=>{const g=gesture.current;gesture.current=null;setPower(null);if(g&&wrapper.current?.hasPointerCapture(g.pointer))wrapper.current.releasePointerCapture(g.pointer);},[]);
 useEffect(()=>{if(!ready)cancel();},[ready,cancel]);
 useEffect(()=>{window.addEventListener('blur',cancel);const hidden=()=>{if(document.visibilityState==='hidden')cancel();},escape=(event:KeyboardEvent)=>{if(event.key==='Escape')cancel();};document.addEventListener('visibilitychange',hidden);window.addEventListener('keydown',escape);return()=>{window.removeEventListener('blur',cancel);document.removeEventListener('visibilitychange',hidden);window.removeEventListener('keydown',escape);};},[cancel]);
 const paint=useCallback((ctx:CanvasRenderingContext2D,state:PoolState,colors:Record<string,string>)=>{const g=gesture.current;draw(ctx,g?{...state,angle:g.angle,power:g.power,pull:g.distance}:state,colors);},[draw]);
 const filteredDispatch=useCallback((a:Action)=>{if(!['POINTER','POINTER_MOVE','POINTER_UP'].includes(a.type))dispatch(a);},[dispatch]);
 const point=(e:PointerEvent<HTMLDivElement>):Point=>{const bounds=wrapper.current!.querySelector('canvas')!.getBoundingClientRect();return {x:(e.clientX-bounds.left)*720/bounds.width,y:(e.clientY-bounds.top)*400/bounds.height};};
 const begin=(e:PointerEvent<HTMLDivElement>)=>{
  if(!ready||e.button!==0||gesture.current)return;e.preventDefault();const p=point(e);
  if(s.inHand){dispatch({type:'PLACE',...p});return;}
  const pocket=pockets.findIndex(([x,y])=>Math.hypot(x-p.x,y-p.y)<27);if(pocket>=0&&!s.breakShot){dispatch({type:'CALL_POCKET',pocket});return;}
  const cue=s.balls.find(b=>b.id===0)!;const angle=Math.hypot(p.x-cue.x,p.y-cue.y)>28?Math.atan2(p.y-cue.y,p.x-cue.x):s.angle;
  gesture.current={pointer:e.pointerId,start:p,current:p,angle,power:s.power,distance:0};wrapper.current!.setPointerCapture(e.pointerId);dispatch({type:'AIM',angle});setPower(0);
 };
 const move=(e:PointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!ready||!g||g.pointer!==e.pointerId)return;e.preventDefault();const current=point(e),shot=dragShot(g.start,current);gesture.current={...g,current,...shot};setPower(shot.distance>=8?Math.round(shot.power/11):0);
 };
 const end=(e:PointerEvent<HTMLDivElement>)=>{
  const g=gesture.current;if(!g||g.pointer!==e.pointerId)return;e.preventDefault();const p=point(e),shot=dragShot(g.start,p);cancel();if(!ready)return;
  if(shot.distance>=8){dispatch({type:'SHOOT',angle:shot.angle,power:shot.power});return;}
  // A tap selects a legal target or numbered pocket; empty cloth simply aims.
  const pocket=pockets.findIndex(([x,y])=>Math.hypot(x-p.x,y-p.y)<27);if(pocket>=0&&!s.breakShot){dispatch({type:'CALL_POCKET',pocket});return;}
  const target=s.balls.find(b=>!b.pocketed&&b.id&&Math.hypot(b.x-p.x,b.y-p.y)<20&&permittedTargets(s,c).includes(b.id));if(target&&!s.breakShot)dispatch({type:'CALL_BALL',id:target.id});
 };
 return <><div ref={wrapper} className="pool-surface" data-phase={s.phase} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={cancel} onLostPointerCapture={cancel}><CanvasBoard state={s} dispatch={filteredDispatch} paused={paused} draw={paint} width={720} height={400}/></div><p className="pool-drag-help" aria-live="polite">{power===null?tr(l,'Arrastra hacia atrás desde la blanca y suelta para tirar. Toca la mesa para apuntar.','Pull back from the cue ball and release to shoot. Tap the cloth to aim.'):`${tr(l,'Potencia del tirón','Drag power')}: ${power}% · ${tr(l,'Suelta para tirar','Release to shoot')}`}</p></>;
}
