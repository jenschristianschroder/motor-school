import {PARTS, clamp, lerp} from './brain.mjs';

export const METRE = 106;
export const COURSES = [
  {name:'First steps', description:'Teach Pip to walk 2 metres on its own.', target:2, time:10, terrain:'Flat floor', kind:'flat'},
  {name:'Step up', description:'Guide Pip over a low step and past the 2.4 metre flag.', target:2.4, time:12, terrain:'Raised step', kind:'step'},
  {name:'Uphill', description:'Teach Pip to climb the incline and reach the 3 metre flag.', target:3, time:14, terrain:'Incline', kind:'hill'}
];
export const GROUND_STEP = 105, STEP_HEIGHT = 12;
export function groundAt(x, course) {
  if (course.kind === 'step') return x >= GROUND_STEP ? -STEP_HEIGHT : 0;
  if (course.kind === 'hill') return -clamp((x - 55) * 0.135, 0, 34);
  return 0;
}
export const neutral = () => Object.fromEntries(PARTS.map(k => [k,{x:0,y:0}]));
const limits = {
  nearFoot:[-44,46,-42,7], farFoot:[-44,46,-42,7],
  nearHand:[-44,35,-58,15], farHand:[-30,52,-58,15],
  belly:[-27,27,-12,19], back:[-27,28,-14,22], head:[-22,24,-19,16]
};
export function bounded(part,x,y) {
  const [minX,maxX,minY,maxY] = limits[part];
  return {x:clamp(x,minX,maxX), y:clamp(y,minY,maxY)};
}
const point = (x,y) => ({x,y});
const midpoint = (a,b) => point((a.x+b.x)/2,(a.y+b.y)/2);
export function bend(a,b,l1,l2,side) {
  const dx=b.x-a.x, dy=b.y-a.y, span=Math.hypot(dx,dy) || 0.001;
  const d=clamp(span,Math.abs(l1-l2)+0.01,l1+l2-0.01);
  const along=(l1*l1-l2*l2+d*d)/(2*d);
  const across=Math.sqrt(Math.max(0,l1*l1-along*along))*side;
  return point(a.x+(dx*along-dy*across)/span, a.y+(dy*along+dx*across)/span);
}
function reach(from,to,maxLength) {
  const dx=to.x-from.x, dy=to.y-from.y, ratio=Math.min(1,maxLength/(Math.hypot(dx,dy)||1));
  return point(from.x+dx*ratio,from.y+dy*ratio);
}
const footKeys = ['nearFoot','farFoot'];
export class Robot {
  constructor(course=COURSES[0]) { this.reset(course); }
  reset(course=this.course) {
    this.course=course; this.x=0; this.y=-69; this.vx=0; this.vy=0;
    this.pos=neutral(); this.vel=neutral(); this.tilt=0.035; this.spin=0;
    this.solutions=[1,1]; this.previousFeet=this.feet();
    this.outOfBalance=0; this.fallen=false; this.fallTime=0;
  }
  feet() {
    return footKeys.map((key,i) => {
      const p=this.pos[key], hipX=i ? -6:6;
      const raw=point((i?-20:14)+p.x,61+p.y-this.pos.belly.y*0.37);
      const ankle=reach(point(hipX,0),raw,68);
      return point(ankle.x,ankle.y+8);
    });
  }
  step(dt, targets, active) {
    for (const key of PARTS) {
      const p=this.pos[key], v=this.vel[key], t=targets[key] || {x:0,y:0};
      const aim=bounded(key,t.x,t.y);
      for (const axis of ['x','y']) {
        v[axis]+=((aim[axis]-p[axis])*410-v[axis]*31)*dt;
        p[axis]+=v[axis]*dt;
      }
    }
    const feet=this.feet();
    this.vy=Math.min(this.vy+490*dt,230);
    const nextY=this.y+this.vy*dt;
    let traction=0, support=0, centre=0;
    const before=this.solutions;
    this.solutions=feet.map((f,i) => {
      const ground=groundAt(this.x+f.x,this.course);
      const c=clamp((nextY+f.y-ground+3.8)/4.1,0,1);
      const grip=Math.min(before[i],c);
      traction-=grip*(f.x-this.previousFeet[i].x)/dt;
      support+=grip; centre+=grip*f.x;
      return c;
    });
    if (active && !this.fallen) {
      if (support > 0.015) {
        let targetSpeed=traction/support;
        if (this.course.kind==='hill' && this.x>55 && this.x<308) targetSpeed*=0.86;
        this.vx=lerp(this.vx,targetSpeed,1-Math.exp(-30*Math.min(1,support)*dt));
      } else this.vx*=Math.exp(-0.65*dt);
      this.vx=clamp(this.vx,-125,140);
      if (this.course.kind==='step') {
        for (let i=0;i<feet.length;i++) {
          const oldX=this.x+this.previousFeet[i].x, newX=this.x+feet[i].x+this.vx*dt;
          if (oldX<GROUND_STEP && newX>=GROUND_STEP && nextY+feet[i].y>-STEP_HEIGHT+0.8) {
            this.vx=Math.min(this.vx,(GROUND_STEP-0.1-this.x-feet[i].x)/dt);
          }
        }
      }
      this.x=clamp(this.x+this.vx*dt,-2*METRE,(this.course.target+0.7)*METRE);
    } else this.vx=0;
    const floor=Math.min(...feet.map(f=>groundAt(this.x+f.x,this.course)-f.y));
    this.y=Math.min(floor,nextY);
    if (nextY>=floor) this.vy=Math.min(0,this.vy)*0.3;
    // A damped balance reflex holds the upper body over the supporting foot.
    // Large upper-body motions can push its centre of mass beyond recovery.
    const p=this.pos, com=p.belly.x*0.48+p.back.x*0.4+p.head.x*0.21+
      (p.nearHand.x+p.farHand.x)*0.065;
    const imbalance=support>0.08 ? com-centre/support : com;
    let want=0.035+clamp(imbalance*0.004,-0.28,0.28)+p.belly.x*0.008+p.back.x*0.008-this.vx*0.0013;
    if (active && Math.abs(imbalance)>37 && Math.abs(want)>0.37) this.outOfBalance+=dt;
    else this.outOfBalance=Math.max(0,this.outOfBalance-1.6*dt);
    if (this.outOfBalance>0.58) this.fallen=true;
    if (this.fallen) { this.fallTime+=dt; want=Math.sign(want || 1)*1.33; }
    this.spin+=((want-this.tilt)*54-this.spin*8.5)*dt;
    this.tilt+=this.spin*dt;
    this.previousFeet=feet;
  }
  skeleton() {
    const p=this.pos, feet=this.feet();
    const hip=point(this.x,this.y), tilt=this.tilt;
    const bodyPoint=(x,y) => point(hip.x+x*Math.cos(tilt)-y*Math.sin(tilt), hip.y+x*Math.sin(tilt)+y*Math.cos(tilt));
    const belly=bodyPoint(p.belly.x*0.44,-11+p.belly.y*0.40);
    const chest=bodyPoint(1+p.belly.x*0.35+p.back.x*0.64,-33+p.back.y*0.58+p.belly.y*0.22);
    const bodyAngle=Math.atan2(chest.x-hip.x,hip.y-chest.y);
    const headAngle=clamp(bodyAngle+p.head.x*0.023,-1.45,1.45);
    const head=point(chest.x+Math.sin(bodyAngle)*24+p.head.x*0.65,
      chest.y-Math.cos(bodyAngle)*26+p.head.y*0.64);
    const limbs={};
    for (let i=0;i<2;i++) {
      const side=i?'far':'near', handMotion=p[side+'Hand'];
      const foot=point(hip.x+feet[i].x,hip.y+feet[i].y-8);
      const socket=point(hip.x+(i?-6:6),hip.y+1);
      const knee=bend(socket,foot,36,34,-1);
      const sx=i?-11:12;
      const shoulder=point(chest.x+sx*Math.cos(bodyAngle),chest.y+sx*Math.sin(bodyAngle)-3);
      const hand=reach(shoulder,point(chest.x+(i?-35:31)+handMotion.x,
        chest.y+(i?31:39)+handMotion.y),53);
      const elbow=bend(shoulder,hand,26,28,i?1:-1);
      limbs[side]={socket,knee,foot,shoulder,elbow,hand};
    }
    return {hip,belly,chest,head,bodyAngle,headAngle,...limbs};
  }
}
export function handles(s) {
  // Exposed feet, palms and the three torso handles get first pick. Limbs
  // can also be grabbed along their length for touch and pointer input.
  const list=[
    ['nearFoot',s.near.foot,12],['farFoot',s.far.foot,12],
    ['nearHand',s.near.hand,11],['farHand',s.far.hand,11],
    ['head',s.head,18],['belly',s.belly,11],['back',s.chest,14]
  ];
  for (const side of ['near','far']) {
    const limb=s[side], foot=side+'Foot', hand=side+'Hand';
    list.push([foot,limb.knee,10],[foot,midpoint(limb.knee,limb.foot),9],
      [foot,midpoint(limb.socket,limb.knee),10],[hand,limb.elbow,10],
      [hand,midpoint(limb.shoulder,limb.elbow),9],[hand,midpoint(limb.elbow,limb.hand),9]);
  }
  return list;
}
export function pick(s,pos,touchPad=0) {
  let best=null, bestRatio=1;
  for (const [key,p,r] of handles(s)) {
    const d=Math.hypot(p.x-pos.x,p.y-pos.y)/(r+touchPad);
    if (d<bestRatio) { bestRatio=d; best={key,p}; }
  }
  return best;
}
