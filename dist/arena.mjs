import {clamp, lerp, NAMES} from './brain.mjs';
import {METRE, groundAt, GROUND_STEP, handles} from './rig.mjs';

const INK='#23343b', STEEL='#637b82', CREAM='#fff1ce', SHADE='#bbad88',
  ORANGE='#ff7948', DARK_ORANGE='#ce5838', COOL='#91a7a6', BLUE='#3658a4';
const TAU=Math.PI*2;
function shape(c,fill,stroke,width=1.6) {
  if(fill){c.fillStyle=fill;c.fill();}
  if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.stroke();}
}
function box(c,x,y,w,h,r,fill,stroke,width) {
  c.beginPath();c.roundRect(x,y,w,h,r);shape(c,fill,stroke,width);
}
function oval(c,x,y,rx,ry,fill,stroke,width) {
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);shape(c,fill,stroke,width);
}
function line(c,points,color,width=1.5) {
  c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);
  c.strokeStyle=color;c.lineWidth=width;c.stroke();
}
function poly(c,points,fill,stroke,width=1.4) {
  c.beginPath();c.moveTo(...points[0]);for(const p of points.slice(1))c.lineTo(...p);
  c.closePath();shape(c,fill,stroke,width);
}
function at(c,x,y,a,draw) {
  c.save();c.translate(x,y);c.rotate(a);draw();c.restore();
}
function textAt(c,str,x,y,size,color,align='left',font='monospace',weight='bold') {
  c.font=weight+' '+size+'px '+font;c.fillStyle=color;c.textAlign=align;c.fillText(str,x,y);
}
function pin(c,p,r,far=false) {
  oval(c,p.x,p.y,r,r,far?'#698085':'#798d8d',INK,1.65);
  oval(c,p.x,p.y,r*.52,r*.52,far?'#a6b5ad':'#dbe1cf',INK,0.9);
  line(c,[[p.x-1.35,p.y+0.85],[p.x+1.35,p.y-0.85]],INK,0.9);
}
function strut(c,a,b,r,color,shadow,variant) {
  const len=Math.hypot(b.x-a.x,b.y-a.y),ang=Math.atan2(b.y-a.y,b.x-a.x)-Math.PI/2;
  at(c,a.x,a.y,ang,()=>{
    box(c,-r*.48,0,r*.96,len,2,STEEL,INK,1.5);
    const from=Math.min(5,len*.19), end=len-Math.min(6,len*.2), h=end-from;
    c.beginPath();c.moveTo(-r+2,from);c.quadraticCurveTo(-r-1,from+2,-r,from+5);
    c.lineTo(-r*.73,end-2);c.quadraticCurveTo(-r*.7,end+1,-r*.4,end+1);
    c.lineTo(r*.52,end+1);c.quadraticCurveTo(r*.86,end,r*.84,end-3);
    c.lineTo(r,from+4);c.quadraticCurveTo(r,from,r-3,from);c.closePath();shape(c,color,INK,1.65);
    poly(c,[[r*.5,from+1],[r-.7,from+3],[r*.7,end-2],[r*.3,end]],shadow);
    line(c,[[-r*.53,from+3],[-r*.51,from+h*.65]],'#fff3d0',1.25);
    if(variant) {
      line(c,[[-r*.68,end-4],[r*.62,end-4]],INK,1);
      line(c,[[-r*.65,end-6.3],[r*.64,end-6.3]],INK,0.6);
    }
  });
}
function boot(c,foot,far) {
  at(c,foot.x,foot.y,0,()=>{
    const fill=far?'#bdc6b2':CREAM, toe=far?'#b3724d':ORANGE;
    box(c,-5,-5,10,10,2,STEEL,INK,1.5);
    c.beginPath();c.moveTo(-8,-1);c.quadraticCurveTo(-6,-5,1,-4.5);c.lineTo(7,-2);
    c.lineTo(13.5,-0.2);c.quadraticCurveTo(17,1,17,5);c.lineTo(16,7.2);
    c.lineTo(-8,7.2);c.quadraticCurveTo(-10,4,-8,-1);c.closePath();shape(c,fill,INK,1.8);
    poly(c,[[6,-1.2],[12,0],[15.8,2.8],[16,4.2],[8.5,4.2]],toe);
    box(c,-9,4.5,26,3.6,1.5,far?'#536665':'#40545a',INK,1.3);
    for(let i=-5;i<15;i+=4) line(c,[[i,6],[i+1.3,7.6]],'#a5aa98',0.7);
  });
}
function leg(c,limb,far) {
  strut(c,limb.socket,limb.knee,7.5,far?'#a9b7a7':CREAM,far?'#778b85':SHADE,false);
  pin(c,limb.socket,5.5,far);pin(c,limb.knee,6.1,far);
  strut(c,limb.knee,limb.foot,6.7,far?'#ad805c':'#fff0cb',far?'#836f58':'#ceaf83',true);
  pin(c,limb.foot,4.4,far);boot(c,limb.foot,far);
}
function claw(c,p,ang,far) {
  at(c,p.x,p.y,ang,()=>{
    box(c,-4,-6,8,7,2,STEEL,INK,1.4);
    c.beginPath();c.moveTo(-4,-1.5);c.lineTo(-6.7,1.5);c.lineTo(-6,7.5);c.lineTo(-2,10);
    c.lineTo(0,7.6);c.lineTo(-3.3,5.5);c.lineTo(-2.3,3.4);c.lineTo(1.1,3);
    c.lineTo(3.8,5.9);c.lineTo(3.1,8.4);c.lineTo(6.1,8.4);c.lineTo(7.3,5.2);
    c.lineTo(4.4,0);c.lineTo(2.2,-2);c.closePath();shape(c,far?COOL:'#a3b5ad',INK,1.65);
    line(c,[[-4.8,3.2],[-4.3,6.6]],'#d6e4cb',1);
  });
}
function arm(c,limb,far) {
  strut(c,limb.shoulder,limb.elbow,5.8,far?'#a5b1a2':CREAM,far?'#768982':SHADE,false);
  strut(c,limb.elbow,limb.hand,6.5,far?'#c98a60':ORANGE,far?'#8f785d':DARK_ORANGE,true);
  pin(c,limb.shoulder,6,far);pin(c,limb.elbow,5,far);
  claw(c,limb.hand,Math.atan2(limb.hand.y-limb.elbow.y,limb.hand.x-limb.elbow.x)-Math.PI/2,far);
}
function torso(c,s) {
  const h=s.hip,ch=s.chest;
  strut(c,h,ch,5,'#879798','#536a70',true);
  at(c,s.belly.x,s.belly.y,s.bodyAngle,()=>{
    box(c,-9.5,-6,19,15,4,'#61777b',INK,1.8);
    for(let i=-3;i<=7;i+=4) box(c,-9,i,18,1.8,0.8,'#adb5a6',INK,.5);
  });
  at(c,h.x,h.y,s.bodyAngle*.5,()=>{
    c.beginPath();c.moveTo(-13,-5);c.quadraticCurveTo(-12,-7,-9,-7);c.lineTo(10,-7);
    c.quadraticCurveTo(15,-6,14,-2);c.lineTo(12,4);c.lineTo(5,8);c.lineTo(-5,7);c.lineTo(-12,3);c.closePath();
    shape(c,ORANGE,INK,1.9);line(c,[[-9,-4],[8,-4]],'#ffd498',1.6);
    box(c,-2,0,7,3,1,'#ba5d3f',INK,.8);
  });
  at(c,ch.x,ch.y,s.bodyAngle,()=>{
    box(c,-6.1,-16,12.2,12,2,'#849a99',INK,1.5);
    line(c,[[-5,-13],[5,-13]],INK,1);line(c,[[-5,-10],[5,-10]],INK,1);
    c.beginPath();c.moveTo(-13,-11);c.quadraticCurveTo(-16,-10,-16,-6);
    c.lineTo(-12,8);c.quadraticCurveTo(-10.5,13,-6,14);c.lineTo(7,14);
    c.quadraticCurveTo(11,14,13,8);c.lineTo(16,-5);c.quadraticCurveTo(17,-10,12,-11);
    c.closePath();shape(c,ORANGE,INK,2);
    poly(c,[[12,-9],[15,-6],[12,7],[8,12],[5,12],[9,1]],DARK_ORANGE);
    line(c,[[-12,-7],[-7,-8],[7,-8]],'#ffcf91',1.6);
    box(c,-8,-3.7,11,6.5,1.2,'#ffe8b8',INK,0.9);
    textAt(c,'PIP',-2.5,1.1,4.6,INK,'center');
    for(let i=0;i<3;i++) line(c,[[-4+i*3.4,7.5],[-2+i*3.4,5.3]],INK,1.1);
  });
}
function head(c,s,clock) {
  at(c,s.head.x,s.head.y,s.headAngle,()=>{
    line(c,[[-8,-12],[-12,-23],[-10.3,-25]],INK,2.5);
    oval(c,-10.5,-25,2.65,2.65,ORANGE,INK,1.3);
    box(c,-25,-4,6,13,2.5,STEEL,INK,1.7);
    box(c,18,-4,6.8,10,2.3,'#d88755',INK,1.5);
    c.beginPath();c.moveTo(-19,-10);c.quadraticCurveTo(-17,-15,-10,-15);c.lineTo(12,-15.8);
    c.quadraticCurveTo(20,-15.4,21,-9);c.lineTo(22,5);c.quadraticCurveTo(21,13,13,14);
    c.lineTo(-12,14);c.quadraticCurveTo(-20,13,-21,6);c.lineTo(-21,-5);c.closePath();
    shape(c,CREAM,INK,2.15);
    c.beginPath();c.moveTo(-19,-7);c.quadraticCurveTo(-19,-13,-10,-13.5);c.lineTo(12,-14);
    c.quadraticCurveTo(18,-14,19.2,-9);c.lineTo(18,-8);c.lineTo(-10,-7);c.closePath();shape(c,ORANGE,null);
    line(c,[[-12,-11],[1,-11.7]],'#ffd696',1.45);
    c.beginPath();c.moveTo(-14,-5.2);c.quadraticCurveTo(-14,-7,-11,-7);
    c.lineTo(15.5,-7.2);c.quadraticCurveTo(20,-7,19.9,-3);c.lineTo(19.5,2.6);
    c.quadraticCurveTo(19,6.5,15,7);c.lineTo(-10.8,7);c.quadraticCurveTo(-15,6,-15,2.2);
    c.closePath();shape(c,'#263a42',INK,1.2);
    const blink=(clock%4.8>4.63);
    box(c,-6,blink?0:-2.9,5.4,blink?1.1:6.5,1.7,'#b5ede6');
    box(c,8.4,blink?-0.7:-3.6,5.1,blink?1.1:6.7,1.6,'#b5ede6');
    if(!blink){box(c,-5.1,-2.2,1.5,2,0.4,'#efffef');box(c,9.1,-2.9,1.5,2,0.4,'#efffef');}
    line(c,[[6,10],[12,9.8]],'#a59274',.9);
    oval(c,-17,6,1.25,1.25,'#a89c7e',INK,.6);
  });
}
function robotArt(c,s,clock) {
  leg(c,s.far,true);arm(c,s.far,true);leg(c,s.near,false);
  torso(c,s);head(c,s,clock);arm(c,s.near,false);
}

export class Arena {
  constructor(canvas) { this.canvas=canvas; this.c=canvas.getContext('2d'); this.camera=0; this.resize(); }
  resize() {
    const rect=this.canvas.getBoundingClientRect();
    this.w=Math.max(1,rect.width);this.h=Math.max(1,rect.height);this.dpr=Math.min(2,window.devicePixelRatio||1);
    this.canvas.width=Math.round(this.w*this.dpr);this.canvas.height=Math.round(this.h*this.dpr);
    this.scale=Math.min(this.h/210,this.w/312,3.3);this.ground=this.h*.79;
    this.left=clamp((this.w-2*METRE*this.scale)/2,this.w*.245,this.w*.36);
  }
  sx(x){return this.left+(x-this.camera)*this.scale;}
  sy(y){return this.ground+y*this.scale;}
  toWorld(clientX,clientY) {
    const rect=this.canvas.getBoundingClientRect();
    return {x:(clientX-rect.left-this.left)/this.scale+this.camera,y:(clientY-rect.top-this.ground)/this.scale};
  }
  grid() {
    const {c,w,h,scale:s}=this;
    c.fillStyle='#e5edf0';c.fillRect(0,0,w,h);
    const step=METRE/8*s, origin=this.sx(0);
    for(let i=Math.floor(-origin/step);i<Math.ceil((w-origin)/step);i++) {
      const x=Math.round(origin+i*step)+.5;
      line(c,[[x,0],[x,h]],i%4===0?'#c0d0d6':'#d3dfe2',i%4===0?0.95:0.64);
    }
    for(let i=Math.floor(-this.ground/step);i<Math.ceil((h-this.ground)/step);i++) {
      const y=Math.round(this.ground+i*step)+.5;
      line(c,[[0,y],[w,y]],i%4===0?'#c0d0d6':'#d3dfe2',i%4===0?0.95:0.64);
    }
    const big=step*4;
    for(let n=Math.floor(-origin/big);n<Math.ceil((w-origin)/big);n++) {
      for(let m=-1;m*big+this.ground>8;m--) {
        const x=origin+n*big,y=this.ground+m*big;
        line(c,[[x-2.3,y],[x+2.3,y]],'#a9bfc7',.85);line(c,[[x,y-2.3],[x,y+2.3]],'#a9bfc7',.85);
      }
    }
    for(let y=this.ground, i=0;y>54;y-=step/2,i++){
      const major=i%8===0;line(c,[[0,y],[major?11:i%2===0?7:4,y]],'#8199a4',.85);
    }
  }
  floor(course) {
    const {c,w,h,scale:s}=this,xMin=this.camera-this.left/s, xMax=xMin+w/s;
    let xs=[xMin-5,xMax+5];
    if(course.kind==='step') xs.push(GROUND_STEP-.015,GROUND_STEP);
    if(course.kind==='hill') xs.push(55,55+34/.135);
    xs=xs.filter(x=>x>=xMin-6&&x<=xMax+6).sort((a,b)=>a-b);
    const edge=xs.map(x=>[this.sx(x),this.sy(groundAt(x,course))]);
    c.save();c.beginPath();c.moveTo(...edge[0]);edge.slice(1).forEach(p=>c.lineTo(...p));
    c.lineTo(w+2,h+2);c.lineTo(-2,h+2);c.closePath();c.fillStyle='#496cb3';c.fill();c.clip();
    const vp=w*.51;
    for(let x=Math.floor(xMin/(METRE/4))*METRE/4;x<=xMax+METRE/4;x+=METRE/4) {
      const ax=this.sx(x), ay=this.sy(groundAt(x,course));
      line(c,[[ax,ay],[ax+(ax-vp)*.36,h+2]],'#7795cb',1);
    }
    for(const d of [4,14,33,65,109]) {
      line(c,edge.map(([x,y])=>[x,y+d*s/1.6]),d===4?'#8fa9d4':'#7291c7',d===4?1.35:.85);
    }
    const zero=this.sx(0), base=this.sy(groundAt(0,course));
    for(let i=-2;i<=2;i++){
      poly(c,[[zero+i*5*s,base+1],[zero+(i+0.6)*5*s,base+1],[zero+(i+.25)*5*s,base+5.3*s],[zero+(i-.35)*5*s,base+5.3*s]],'#e5ebdb');
    }
    c.restore();line(c,edge,'#253f6d',2);
    const step=w<500?1:.5;
    for(let m=Math.ceil(xMin/METRE/step)*step;m*METRE<xMax;m+=step) {
      const x=this.sx(m*METRE), y=this.sy(groundAt(m*METRE,course));
      if(x<22||x>w-22)continue;
      line(c,[[x,y+4],[x,y+10]],'#e4ecf4',1.4);
      let label=Number.isInteger(m)?m+' m':m.toFixed(1)+' m';
      if(m===0)label='0 m';
      textAt(c,label,x,y+26,12.5,'#f1f4f8','center');
    }
    if(course.kind==='step'&&this.sx(GROUND_STEP)>-2&&this.sx(GROUND_STEP)<w+2) {
      const x=this.sx(GROUND_STEP),y=this.sy(-12);
      for(let i=0;i<4;i++)line(c,[[x+2+i*4,y+1],[x+.1+i*4,y+4]],'#fbc484',2);
    }
  }
  flag(course,clock) {
    const {c,scale:s}=this, x=this.sx(course.target*METRE), y=this.sy(groundAt(course.target*METRE,course));
    if(x>this.w+40||x<-55)return;
    c.save();c.translate(x,y);c.scale(s,s);
    oval(c,4,1,15,2.5,'rgba(29,49,79,.23)');
    box(c,-2.3,-58,2.8,57,.6,'#e2d4ad',INK,.9);
    box(c,-5.5,-3.2,9.5,3.2,1,'#617589',INK,1);
    const wave=Math.sin(clock*2)*.72;
    const fy=(xx,v)=>-57+v*17+Math.sin(xx*Math.PI*1.45)*2.3+xx*wave;
    const point=(u,v)=>[0.5+u*31,fy(u,v)];
    const patch=(u0,u1,v0,v1,fill)=>{
      const pts=[];for(let j=0;j<=8;j++)pts.push(point(lerp(u0,u1,j/8),v0));
      for(let j=8;j>=0;j--)pts.push(point(lerp(u0,u1,j/8),v1));
      poly(c,pts,fill);
    };
    patch(0,1,0,1,'#fff2ce');
    for(let col=0;col<6;col++)for(let row=0;row<3;row++)if((col+row)%2===0)patch(col/6,(col+1)/6,row/3,(row+1)/3,'#f27d50');
    const border=[];for(let u=0;u<=12;u++)border.push(point(u/12,0));
    for(let u=12;u>=0;u--)border.push(point(u/12,1));poly(c,border,null,INK,.85);
    oval(c,-.9,-59,1.8,1.8,'#f58555',INK,.8);
    c.restore();
  }
  shadow(robot) {
    const {c,scale:s}=this, x=this.sx(robot.x),y=this.sy(groundAt(robot.x,robot.course));
    oval(c,x+1.5*s,y+1.7*s,40*s,3.3*s,'rgba(37,54,72,.15)');
    robot.feet().forEach(f=>{
      const ground=groundAt(robot.x+f.x,robot.course), height=Math.max(0,ground-robot.y-f.y);
      oval(c,this.sx(robot.x+f.x+3),this.sy(ground)+.5*s,(13+height*.05)*s,2*s,'rgba(32,49,70,'+clamp(.25-height*.008,.045,.25)+')');
    });
  }
  dimension(course) {
    const {c,h,w}=this, x1=this.sx(0),x2=this.sx(course.target*METRE),y=h-14;
    if(x1<15||x2>w-14||x2-x1<70)return;
    const mid=(x1+x2)/2;
    line(c,[[x1,y],[mid-26,y]],'#a3bae0',.8);line(c,[[mid+26,y],[x2,y]],'#a3bae0',.8);
    for(const x of [x1,x2])line(c,[[x-2.5,y+3],[x+2.5,y-3]],'#c5d6ee',1);
    textAt(c,course.target.toFixed(1)+' m',mid,y+3.5,11.5,'#e4edfa','center');
  }
  annotate(s,game) {
    const {c,w,scale:sc}=this, focus=game.drag?.part || game.hover || (game.keysActive?game.selected:null);
    if(game.mode==='trial')return;
    if(focus) {
      const found=handles(s).find(([key])=>key===focus);
      if(!found)return;
      const p=found[1],x=this.sx(p.x),y=this.sy(p.y),r=(focus==='head'?22:13)*sc;
      c.save();c.setLineDash([4,3]);oval(c,x,y,r,r,'rgba(255,149,68,.10)','#a44726',1.5);c.setLineDash([]);
      const name=NAMES[focus], labelWidth=name.length*7.1+16;
      const lx=clamp(x+r+9,7,w-labelWidth-6),ly=clamp(y-r-4,65,this.h-31);
      box(c,lx,ly-14,labelWidth,22,5,'#fff5dd',INK,1);
      textAt(c,name,lx+8,ly+1,12,INK,'left','Rubik, sans-serif');
      c.restore();return;
    }
    if(game.memory.examples || game.mode!=='teach')return;
    const p=s.near.foot,x=this.sx(p.x+7),y=this.sy(p.y-2);
    const labelX=x+clamp(w*.068,21,58),labelY=y-clamp(this.h*.14,32,65);
    if(labelX+86>w||labelY<53)return;
    c.save();c.setLineDash([3,4]);
    c.beginPath();c.moveTo(x+8,y-4);c.quadraticCurveTo(x+31,y-12,labelX-3,labelY+3);
    c.strokeStyle='#526b80';c.lineWidth=1.2;c.stroke();c.setLineDash([]);
    oval(c,x,y,4,4,'#fff5d7',INK,1.3);
    box(c,labelX,labelY-13,83,25,5,'#fff9e9','#677c86',1);
    textAt(c,'Grab a foot',labelX+41.5,labelY+3.5,12.5,INK,'center','Rubik, sans-serif');
    c.restore();
  }
  draw(robot,game,clock,dt) {
    const c=this.c,w=this.w,h=this.h;
    const min=robot.x-(w*.53-this.left)/this.scale, max=robot.x+(this.left-w*.20)/this.scale;
    const wanted=clamp(0,min,max);
    this.camera=lerp(this.camera,wanted,dt>=1?1:1-Math.exp(-dt*7));
    c.setTransform(this.dpr,0,0,this.dpr,0,0);c.clearRect(0,0,w,h);
    c.lineJoin='round';c.lineCap='round';
    this.grid();this.floor(robot.course);this.dimension(robot.course);
    this.flag(robot.course,clock);this.shadow(robot);
    const s=robot.skeleton();
    if(game.drag && game.drag.trail.length>1) {
      const pts=game.drag.trail.map(p=>[this.sx(p.x),this.sy(p.y)]);
      c.save();c.setLineDash([3,5]);line(c,pts,'#c36139',2);c.restore();
    }
    c.save();c.translate(this.sx(0),this.ground);c.scale(this.scale,this.scale);
    robotArt(c,s,clock);c.restore();
    this.annotate(s,game);
  }
}
