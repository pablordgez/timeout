import { BOTTOM,LEFT,R,RIGHT,TOP,pockets,type PoolState } from './engine';
export interface Point{x:number;y:number}
export interface PreviewLine{from:Point;to:Point;kind:'cue'|'object'|'bounce'}
export interface ShotPreview{kind:'ball'|'rail'|'pocket';contact:Point;ball?:number;lines:PreviewLine[]}
export function dragShot(start:Point,current:Point){const dx=start.x-current.x,dy=start.y-current.y,distance=Math.hypot(dx,dy);return {angle:Math.atan2(dy,dx),power:Math.max(80,Math.min(1100,distance*6)),distance};}
function railDistance(p:Point,d:Point){const tx=d.x>0?(RIGHT-R-p.x)/d.x:d.x<0?(LEFT+R-p.x)/d.x:Infinity,ty=d.y>0?(BOTTOM-R-p.y)/d.y:d.y<0?(TOP+R-p.y)/d.y:Infinity;return {distance:Math.max(0,Math.min(tx,ty)),axis:tx<ty?'x':'y'};}
const advance=(p:Point,d:Point,distance:number)=>({x:p.x+d.x*distance,y:p.y+d.y*distance});
const continuation=(p:Point,d:Point,max:number)=>advance(p,d,Math.min(max,railDistance(p,d).distance));
function circleDistance(p:Point,d:Point,c:Point,radius:number){const x=c.x-p.x,y=c.y-p.y,t=x*d.x+y*d.y,perp=x*x+y*y-t*t;if(t<0||perp>radius*radius)return Infinity;return Math.max(0,t-Math.sqrt(radius*radius-perp));}
/** Geometric guide only: first impact and a short elastic continuation, not a guaranteed pot. */
export function previewShot(s:PoolState,angle=s.angle,power=s.power):ShotPreview|null{
 const cue=s.balls.find(b=>b.id===0&&!b.pocketed);if(!cue||!Number.isFinite(angle))return null;
 const dir={x:Math.cos(angle),y:Math.sin(angle)},rail=railDistance(cue,dir);let first=rail.distance,kind:ShotPreview['kind']='rail',ball:number|undefined;
 for(const b of s.balls){if(!b.id||b.pocketed)continue;const t=circleDistance(cue,dir,b,R*2);if(t<first){first=t;kind='ball';ball=b.id;}}
 for(const [x,y] of pockets){const t=circleDistance(cue,dir,{x,y},18);if(t<first){first=t;kind='pocket';ball=undefined;}}
 const contact=advance(cue,dir,first),lines:PreviewLine[]=[{from:{x:cue.x,y:cue.y},to:contact,kind:'cue'}];
 const reach=Math.min(220,Math.max(60,power*power/480));
 if(kind==='ball'){
  const object=s.balls.find(b=>b.id===ball)!;const normal={x:(object.x-contact.x)/(R*2),y:(object.y-contact.y)/(R*2)},dot=Math.max(0,dir.x*normal.x+dir.y*normal.y);
  if(dot>.01)lines.push({from:{x:object.x,y:object.y},to:continuation(object,normal,reach*dot),kind:'object'});
  const tangent={x:dir.x-dot*normal.x,y:dir.y-dot*normal.y},speed=Math.hypot(tangent.x,tangent.y);
  if(speed>.04){tangent.x/=speed;tangent.y/=speed;lines.push({from:contact,to:continuation(contact,tangent,reach*speed),kind:'cue'});}
 }else if(kind==='rail'){const reflected={x:rail.axis==='x'?-dir.x:dir.x,y:rail.axis==='y'?-dir.y:dir.y};lines.push({from:contact,to:continuation(contact,reflected,reach),kind:'bounce'});}
 return {kind,contact,ball,lines};
}
