export const W=100,H=61,FENCE=79,COUNT=8,DT=.1,LIMIT=38,DECISION=5;
export const DRILLS=[
  {name:'Stray recovery',field:'Clover Meadow',hint:'Bring an isolated sheep back into the flock.'},
  {name:'Split flock',field:'Bramble Bank',hint:'Gather two small groups without scattering either.'},
  {name:'Narrow gate',field:'Willow Fold',hint:'Line up the approach and ease the pressure at the gate.'}
];
export const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const length=Math.hypot;
export function rng(seed){
  let a=seed>>>0;
  return ()=>{a=(a+0x6d2b79f5)>>>0;let n=Math.imul(a^(a>>>15),a|1);n^=n+Math.imul(n^(n>>>7),n|61);return ((n^(n>>>14))>>>0)/4294967296;};
}
export function createWorld(seed,drill=0){
  const random=rng(seed),sign=random()<.5?-1:1,gate=14+random()*33;
  const cx=36+random()*12,cy=30+sign*(1+random()*4),sheep=[];
  for(let i=0;i<COUNT;i++){
    const angle=i*2.4+random()*.45,rad=3.4+Math.sqrt(i+1)*1.65;
    let x=cx+Math.cos(angle)*rad,y=cy+Math.sin(angle)*rad;
    if(drill===0 && i===7){x=cx-15-random()*7;y=cy-sign*(13+random()*5);}
    if(drill===1){x+=(i<4?-1:1)*7;y+=(i<4?-1:1)*sign*11;}
    if(drill===2){x+=7;y+=sign*6;}
    sheep.push({x:clamp(x,6,FENCE-8),y:clamp(y,6,H-6),vx:0,vy:0,angle:random()*Math.PI*2,
      phase:random()*6.283,nerve:.88+random()*.24,stress:0,inPen:false});
  }
  const dog={x:16+random()*4,y:clamp(cy+sign*(9+random()*6),5,H-5),vx:0,vy:0,angle:0};
  return {seed:seed>>>0,drill,gate,opening:drill===2?5.8:drill===1?9.4:11.2,dog,sheep,tick:0,penned:0,stressSum:0,done:false};
}
export function copyWorld(w){return {...w,dog:{...w.dog},sheep:w.sheep.map(s=>({...s}))};}
export function score(w){return {penned:w.penned,stress:w.tick?w.stressSum/w.tick:0,seconds:w.tick*DT};}
export function compareScore(a,b){return b.penned-a.penned||a.stress-b.stress||a.seconds-b.seconds;}
export function movement(dx,dy,scale=1){
  const d=length(dx,dy)||1;
  return {x:dx/d*scale,y:dy/d*scale};
}
// The environment is deterministic after seeding. Dogs in a comparison advance
// on independent copies of one world, including each sheep's initial velocity.
export function stepWorld(w,control){
  if(w.done)return 0;
  const dog=w.dog,moveLen=Math.max(1,length(control.x,control.y));
  dog.vx+=(control.x/moveLen*14-dog.vx)*.37;dog.vy+=(control.y/moveLen*14-dog.vy)*.37;
  dog.x=clamp(dog.x+dog.vx*DT,2.1,FENCE-1.65);dog.y=clamp(dog.y+dog.vy*DT,2.1,H-2.1);
  if(length(dog.vx,dog.vy)>.6)dog.angle=Math.atan2(dog.vy,dog.vx);
  const t=w.tick*DT,flock=w.sheep;
  const dxs=new Float64Array(COUNT),dys=new Float64Array(COUNT);
  let progress=0,stress=0,arrivals=0;
  for(let i=0;i<COUNT;i++){
    const s=flock[i];if(s.inPen)continue;
    let near=0,coX=0,coY=0,alX=0,alY=0,seX=0,seY=0;
    for(let j=0;j<COUNT;j++){
      const o=flock[j];if(i===j||o.inPen)continue;
      const x=o.x-s.x,y=o.y-s.y,d2=x*x+y*y;
      if(d2>289)continue;
      near++;coX+=x;coY+=y;alX+=o.vx;alY+=o.vy;
      if(d2<17){const d=Math.sqrt(d2)||.01,away=(4.12-d)*1.65/d;seX-=x*away;seY-=y*away;}
    }
    const x=s.x-dog.x,y=s.y-dog.y,d=Math.max(.08,length(x,y)),pressure=clamp(1-d/20,0,1);
    const alarm=clamp((12-d)/11,0,1)*s.nerve;
    s.stress+=((alarm>s.stress?.14:.038)*(alarm-s.stress));
    const flee=pressure*pressure*17*s.nerve;
    let vx=x/d*flee+seX,vy=y/d*flee+seY;
    if(near){vx+=coX/near*.115+alX/near*.40;vy+=coY/near*.115+alY/near*.40;}
    vx+=Math.cos(t*.47+s.phase*4)*.45;vy+=Math.sin(t*.38+s.phase*2)*.45;
    if(s.x<5)vx+=(5-s.x)*.8;
    if(s.y<5)vy+=(5-s.y)*.8;if(s.y>H-5)vy-=(s.y-H+5)*.8;
    const offset=w.gate-s.y, gap=w.opening/2-.55;
    // Frightened sheep shy sideways at the mouth of the pen. A dog can
    // relieve that pressure by slowing, backing off or taking a wider flank.
    if(s.x>FENCE-12 && s.stress>.30){
      const shy=clamp((s.stress-.30)*3,0,1)*clamp((s.x-FENCE+12)/7,0,1);
      vx-=shy*6;vy+=shy*(s.y>=w.gate?4.3:-4.3);
    }
    if(s.x>FENCE-7){
      if(Math.abs(offset)<gap+2.8 && (pressure>.07||s.vx>1)){
        vx+=2.6;vy+=offset*.47;
      }else if(Math.abs(offset)>gap){
        vx-=Math.max(0,s.x-(FENCE-3))*.58;
        if(pressure>.09)vy+=Math.sign(offset)*.95;
      }
    }
    const cap=5.3+s.stress*3.1,factor=Math.min(1,cap/(length(vx,vy)||1));
    dxs[i]=vx*factor;dys[i]=vy*factor;
  }
  for(let i=0;i<COUNT;i++){
    const s=flock[i];
    if(s.inPen){
      const targetX=FENCE+5+(i%3)*4.7,targetY=clamp(w.gate-9+Math.floor(i/3)*8+(i%2)*1.3,4,H-4);
      s.vx+=(clamp(targetX-s.x,-2.3,2.3)-s.vx)*.11;s.vy+=(clamp(targetY-s.y,-2.3,2.3)-s.vy)*.11;
      s.x+=s.vx*DT;s.y+=s.vy*DT;s.stress*=.96;
    }else{
      const before=length(FENCE-s.x,w.gate-s.y);
      s.vx+=(dxs[i]-s.vx)*.30;s.vy+=(dys[i]-s.vy)*.30;
      let nx=clamp(s.x+s.vx*DT,2.8,FENCE+1);
      const ny=clamp(s.y+s.vy*DT,2.8,H-2.8),inGap=Math.abs(ny-w.gate)<w.opening/2-.55;
      if(!inGap&&nx>FENCE-1.12){nx=FENCE-1.12;s.vx=Math.min(s.vx,0);}
      s.x=nx;s.y=ny;
      if(s.x>=FENCE && inGap){s.inPen=true;w.penned++;arrivals++;}
      const after=s.inPen?0:length(FENCE-s.x,w.gate-s.y);
      progress+=before-after;
    }
    if(length(s.vx,s.vy)>.35)s.angle=Math.atan2(s.vy,s.vx);
    stress+=s.stress;
  }
  w.tick++;w.stressSum+=stress/COUNT;
  w.done=w.penned===COUNT||w.tick>=Math.round(LIMIT/DT);
  // Progress is signed: driving sheep away gives back the earlier reward.
  return progress*.075+arrivals*12+(arrivals&&w.penned===COUNT?24:0)-DT*(.08+.48*stress/COUNT);
}
