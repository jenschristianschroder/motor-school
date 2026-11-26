import {clamp,COUNT,DECISION,FENCE,H,LIMIT,DT,movement,stepWorld} from './pasture.mjs';

// The actor scores steering options from flock geometry. Intercepts and
// compass directions are available to every model, including the foundation.
const names=['Drive the flock','Gather the stray','Flank left','Flank right','Ease pressure','Work the gate','Stand'];
const compass=Array.from({length:8},(_,i)=>movement(Math.cos(i*Math.PI/4),Math.sin(i*Math.PI/4),.83));
export const ACTIONS=names.length+compass.length,INPUTS=18;
export function foundation(){
  const actor=Array(ACTIONS*INPUTS).fill(0);
  [.50,.12,-.22,-.22,-.1,1.14,-1,...compass.map(()=>-2.5)].forEach((bias,i)=>actor[i*INPUTS]=bias);
  actor[INPUTS+1]=.69;actor[4*INPUTS+9]=.9;actor[5*INPUTS+2]=.35;
  return {actor,critic:Array(INPUTS).fill(0)};
}
export function validModel(p){
  return p&&Array.isArray(p.actor)&&p.actor.length===ACTIONS*INPUTS&&Array.isArray(p.critic)&&p.critic.length===INPUTS&&
    p.actor.every(v=>Number.isFinite(v)&&Math.abs(v)<1e4)&&p.critic.every(v=>Number.isFinite(v)&&Math.abs(v)<1e4);
}
export function copyPolicy(p){return {actor:p.actor.slice(),critic:p.critic.slice()};}
function approach(dog,targetX,targetY,focus,pace,route=true){
  const tx=clamp(targetX,2.3,FENCE-2.1),ty=clamp(targetY,2.3,H-2.3);
  let dx=tx-dog.x,dy=ty-dog.y;
  const d=Math.hypot(dx,dy);
  if(route&&d>5){
    const fx=focus.x-dog.x,fy=focus.y-dog.y,along=(fx*dx+fy*dy)/(d*d);
    const cross=dx*fy-dy*fx,clearance=Math.abs(cross)/d;
    if(along>.075&&along<1.02&&clearance<7.3){
      const side=cross>=0?-1:1,amount=(7.4-clearance)*1.48;
      dx=dx/d*7.8-side*dy/d*amount;dy=(ty-dog.y)/d*7.8+side*(tx-dog.x)/d*amount;
      if(dog.y<5&&dy<0||dog.y>H-5&&dy>0)dy=-dy;
    }
  }
  return movement(dx,dy,pace*clamp(d/3.3,0,1));
}
export function observe(w){
  const live=w.sheep.filter(s=>!s.inPen);
  if(!live.length)return {f:Array(INPUTS).fill(0),moves:Array.from({length:ACTIONS},()=>({x:0,y:0}))};
  // A local majority keeps one remote stray from displacing the core.
  let core=live[0],best=-Infinity;
  for(const s of live){
    let density=0;for(const o of live){const dx=s.x-o.x,dy=s.y-o.y;density+=1/(1+(dx*dx+dy*dy)/65);}
    if(density>best){best=density;core=s;}
  }
  let cx=0,cy=0,n=0,stress=0,vx=0,vy=0;
  for(const s of live){
    const dx=s.x-core.x,dy=s.y-core.y;
    if(dx*dx+dy*dy<215){cx+=s.x;cy+=s.y;n++;}
    stress+=s.stress;vx+=s.vx;vy+=s.vy;
  }
  cx/=n;cy/=n;stress/=live.length;
  let stray=live[0],spread=-1,blocked=live[0],edge=-Infinity;
  for(const s of live){
    const rad=Math.hypot(s.x-cx,s.y-cy);if(rad>spread){spread=rad;stray=s;}
    const near=s.x-.55*Math.abs(w.gate-s.y);if(near>edge){edge=near;blocked=s;}
  }
  const center={x:cx,y:cy},d=w.dog,forward=movement(FENCE+1-cx,w.gate-cy),side={x:-forward.y,y:forward.x};
  const dogX=d.x-cx,dogY=d.y-cy,distance=Math.hypot(dogX,dogY);
  const dot=dogX*forward.x+dogY*forward.y,sidePos=dogX*side.x+dogY*side.y;
  const far=movement(stray.x-cx,stray.y-cy);
  const towardsGate=movement(FENCE+1-blocked.x,w.gate-blocked.y);
  const f=[1,clamp((spread-7)/22,0,1.5),clamp((cx-44)/28,-1.5,1.5),(12-w.opening)/5,
    clamp(1-distance/22,-1,1),clamp(dot/17,-1,1),clamp(sidePos/18,-1,1),clamp(Math.abs(w.gate-cy)/17,0,1.5),
    live.length/COUNT,stress,clamp((Math.hypot(stray.x-d.x,stray.y-d.y)-distance)/20,-1,1),
    clamp((FENCE-stray.x)/50,0,1.5),clamp((w.gate-cy)/22,-1,1),vx/(live.length*6),vy/(live.length*6),
    (d.x-40)/40,(d.y-H/2)/(H/2),w.tick*DT/LIMIT];
  const behind=(space,flank,pace)=>approach(d,cx-forward.x*space+side.x*flank,cy-forward.y*space+side.y*flank,center,pace);
  const moves=[behind(7.9,0,.91),
    spread>5?approach(d,stray.x+far.x*7.4,stray.y+far.y*7.4,stray,1):behind(10,0,.76),
    behind(10,-8,.93),behind(10,8,.93),behind(16.7,0,.62),
    approach(d,blocked.x-towardsGate.x*8.7,blocked.y-towardsGate.y*8.7,blocked,.81),{x:0,y:0},...compass];
  return {f,moves};
}
export function dot(a,b,offset=0){
  let v=0;for(let j=0;j<b.length;j++)v+=a[offset+j]*b[j];return v;
}
export function distribution(model,f){
  const logits=new Float64Array(ACTIONS);let max=-Infinity;
  for(let a=0;a<ACTIONS;a++){logits[a]=dot(model.actor,f,a*INPUTS);max=Math.max(max,logits[a]);}
  let total=0;for(let a=0;a<ACTIONS;a++){logits[a]=Math.exp(logits[a]-max);total+=logits[a];}
  for(let a=0;a<ACTIONS;a++)logits[a]/=total;
  return logits;
}
export function choose(model,obs,random){
  const probs=distribution(model,obs.f);
  if(random){let r=random();for(let a=0;a<ACTIONS;a++){r-=probs[a];if(r<=0)return {a,probs};}return {a:ACTIONS-1,probs};}
  let a=0;for(let i=1;i<ACTIONS;i++)if(probs[i]>probs[a])a=i;
  return {a,probs};
}
export function coachSample(obs,move){
  // Store soft action labels. A well matched intercept and a compass heading
  // can both explain a human steering sample.
  const err=obs.moves.map(m=>(m.x-move.x)**2+(m.y-move.y)**2);
  const min=Math.min(...err),soft=err.map(e=>Math.exp(-(e-min)*10)),total=soft.reduce((a,b)=>a+b,0);
  return {f:obs.f.map(v=>+v.toFixed(3)),y:soft.map(v=>+(v/total).toFixed(4))};
}
export const actionName=a=>names[a]||'Follow a heading';
export function newPilot(){return {remaining:0,move:{x:0,y:0},action:6};}
export function pilotStep(world,model,pilot){
  if(pilot.remaining<=0){
    const obs=observe(world);pilot.action=choose(model,obs).a;pilot.move=obs.moves[pilot.action];pilot.remaining=DECISION;
  }
  pilot.remaining--;return stepWorld(world,pilot.move);
}
