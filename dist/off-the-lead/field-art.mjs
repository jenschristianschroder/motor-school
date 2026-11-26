import {W,H,FENCE,DT,rng} from './pasture.mjs';
const TAU=2*Math.PI,ink='#29392c';
function ellipse(c,x,y,rx,ry,fill,stroke,lw=.12){
  c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
}
function drawPath(c,pts,fill,stroke,lw=.13){
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();
  if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
}
function line(c,pts,color,lw=.14){
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=lw;c.stroke();
}
function paperBox(c,x,y,w,h,rad,fill,stroke,lw=.12){
  c.beginPath();c.roundRect(x,y,w,h,rad);c.fillStyle=fill;c.fill();
  if(stroke){c.strokeStyle=stroke;c.lineWidth=lw;c.stroke();}
}
function leaf(c,x,y,size,random){
  ellipse(c,x+.48*size,y+.7*size,size*1.28,size*.77,'rgba(45,69,36,.14)');
  const petals=5+Math.floor(random()*3);
  for(let j=0;j<petals;j++){
    const th=j/petals*TAU,rad=size*(.43+random()*.27),xx=x+Math.cos(th)*rad,yy=y+Math.sin(th)*rad*.74;
    ellipse(c,xx,yy,size*(.53+random()*.18),size*(.47+random()*.14),['#658553','#6e905b','#789b60','#819e62'][Math.floor(random()*4)]);
  }
  for(let j=0;j<4;j++){const xx=x-size*.6+random()*size,yy=y-size*.45+random()*size*.5;line(c,[[xx,yy],[xx+.3*size,yy-.12*size]],'#9cb670',.12*size);}
}
function fence(c,x1,y1,x2,y2,track=false){
  const dx=x2-x1,dy=y2-y1,n=Math.max(1,Math.round(Math.hypot(dx,dy)/(track?4.2:5.7)));
  line(c,[[x1+.35,y1+.55],[x2+.35,y2+.55]],'rgba(43,58,35,.2)',.49);
  line(c,[[x1,y1-.2],[x2,y2-.2]],'#6c6245',track?.36:.24);
  line(c,[[x1,y1-.7],[x2,y2-.7]],'#ddc798',track?.27:.18);
  for(let j=0;j<=n;j++){
    const x=x1+dx*j/n,y=y1+dy*j/n;
    line(c,[[x+.22,y],[x+.60,y+.48]],'rgba(48,53,28,.22)',.34);
    paperBox(c,x-.17,y-1.16,.38,1.45,.08,'#786449','#635d42',.07);
    line(c,[[x-.09,y-1.12],[x+.14,y-1.12]],'#ead7ae',.12);
  }
}
function gatePost(c,x,y){
  ellipse(c,x+.6,y+.3,.97,.35,'rgba(50,70,42,.22)');
  paperBox(c,x-.22,y-2.65,.46,2.98,.08,'#805a3e','#65543b');
  paperBox(c,x-.25,y-2.62,.5,.72,.08,'#fff1c7');
  drawPath(c,[[x,y-2.64],[x+2.1,y-2.50],[x+1.64,y-2.08],[x+2.05,y-1.77],[x,y-1.86]],'#e68055','#936344',.08);
}
function scenery(c,w,pixelsPerUnit){
  const random=rng(w.seed^0xa719bf),gate=w.gate,gap=w.opening/2;
  c.lineCap='round';c.lineJoin='round';
  c.fillStyle='#a7bf7b';c.fillRect(-50,-30,200,130);
  for(let i=-10;i<22;i++){
    const x=i*8;
    drawPath(c,[[x,-6],[x+8,-6],[x-17,H+6],[x-25,H+6]],i%2?'#a4bf79':'#aec887');
  }
  // A worn track traces the headland. The receiving pen has a different
  // ground surface and the wooden rail breaks precisely at the simulated gate.
  c.save();c.beginPath();c.rect(FENCE,-4,W-FENCE+8,H+10);c.clip();
  c.fillStyle='#c6c288';c.fillRect(FENCE,-4,W-FENCE+8,H+10);
  for(let i=0;i<75;i++){
    const x=FENCE+random()*26,y=random()*H;ellipse(c,x,y,.6+random()*2,.22+random()*.65,i%2?'#c1be81':'#ceca93');
  }c.restore();
  c.save();c.globalAlpha=.43;
  for(let i=0;i<6;i++){
    const x=FENCE-8+i*1.7,y=gate+(i%2?-.6:.6)*i*.13;
    ellipse(c,x,y,3+i*.18,1.4+i*.22,'#c8c286');
  }c.restore();
  for(let i=0;i<670;i++){
    const x=random()*W,y=random()*H;
    if(x>FENCE&&random()>.35)continue;
    const shade=x>FENCE?'#b4ad73':i%4?'#8da96d':'#ccda9a';
    if(i%4===0){
      line(c,[[x-.29,y-.34],[x,y+.13],[x+.18,y-.53]],shade,.106);
      if(i%3===0)line(c,[[x+.18,y+.11],[x+.5,y-.27]],shade,.09);
    }else line(c,[[x,y],[x+.25+random()*.29,y-.055]],shade,.10);
  }
  for(let patch=0;patch<11;patch++){
    const px=4+random()*(FENCE-10),py=3+random()*(H-6);
    for(let j=0;j<5;j++){
      const xx=px+(random()-.5)*2.8,yy=py+(random()-.5)*1.6;
      ellipse(c,xx,yy,.105,.105,j%3?'#f2e3a1':'#ffffda');
    }
  }
  fence(c,.3,.7,99.6,.7);fence(c,.3,H-.4,99.6,H-.4);fence(c,.3,.7,.3,H-.4);fence(c,99.6,.7,99.6,H-.4);
  fence(c,FENCE,.65,FENCE,gate-gap,true);fence(c,FENCE,gate+gap,FENCE,H-.45,true);
  c.save();c.setLineDash([.50,.45]);line(c,[[FENCE,gate-gap+.25],[FENCE,gate+gap-.25]],'#f4e6ae',.27);c.restore();
  gatePost(c,FENCE,gate-gap);gatePost(c,FENCE,gate+gap);
  for(let j=0;j<39;j++){const x=-1+j*2.75;leaf(c,x,-1.8+Math.sin(j*.72)*.49,1.55+random()*.88,random);}
  for(let j=0;j<18;j++){
    const x=j<10?-1.6:101.4,y=j<10?(j*5.8+2):((j-10)*7.9+1.6);
    leaf(c,x,y,1.35+random()*.9,random);
  }
  for(let j=0;j<16;j++){const x=j<9?j*2.65:100-(j-9)*2.65;leaf(c,x,H+2+Math.sin(j)*.5,1.7+random()*.65,random);}
  // A farm water trough and a legible sign orient the destination.
  const tx=91,ty=H-5;
  ellipse(c,tx+.5,ty+.42,2.9,1.28,'rgba(63,68,42,.16)');
  paperBox(c,tx-2.5,ty-.91,5,1.8,.74,'#899888','#65796c',.2);paperBox(c,tx-2.15,ty-.64,4.3,1.25,.6,'#759c9d');
  line(c,[[tx-1.4,ty-.18],[tx+.6,ty-.28]],'#b9d1bd',.16);
  const sy=gate>H/2?12.5:H-10,scale=Math.max(1,7.5/(1.13*pixelsPerUnit));
  line(c,[[90.2,sy],[90.2,sy+1.8*scale]],'#816a49',.29);
  paperBox(c,90.2-2.4*scale,sy-.9*scale,4.8*scale,1.8*scale,.19,'#f5e7ba','#9e8d60',.1);
  c.textAlign='center';c.textBaseline='middle';c.fillStyle='#43513b';c.font='bold '+(1.13*scale)+'px Rubik, sans-serif';c.fillText('PEN',90.2,sy);
}
function sheepArt(c,s,i,t){
  const walking=Math.min(1,Math.hypot(s.vx,s.vy)/3),gait=Math.sin(t*9.5+s.phase)*walking;
  ellipse(c,s.x+.32,s.y+.45,1.80,1.02,'rgba(66,78,42,.22)');
  c.save();c.translate(s.x,s.y);c.rotate(s.angle);
  for(const a of [-1,1])for(const b of [-1,1])ellipse(c,.85*a+gait*b*a*.27,.78*b,.34,.28,'#474c3c');
  c.beginPath();c.moveTo(1.29,-.62);
  c.bezierCurveTo(.98,-1.13,.58,-1.24,.24,-1.12);c.bezierCurveTo(-.23,-1.41,-.77,-1.18,-.95,-1.02);
  c.bezierCurveTo(-1.54,-1.06,-1.82,-.55,-1.71,-.20);c.bezierCurveTo(-2.04,.12,-1.71,.70,-1.39,.75);
  c.bezierCurveTo(-1.26,1.23,-.73,1.31,-.37,1.15);c.bezierCurveTo(.06,1.47,.65,1.18,.86,.99);
  c.bezierCurveTo(1.53,1.04,1.72,.37,1.5,.14);c.bezierCurveTo(1.74,-.17,1.65,-.5,1.29,-.62);c.closePath();
  c.fillStyle=['#fff1ce','#f6ecd1','#fff6df'][i%3];c.fill();c.strokeStyle='#89896b';c.lineWidth=.14;c.stroke();
  line(c,[[-1.21,-.53],[-.94,-.78],[-.59,-.73]],'#dfd4b4',.14);line(c,[[-.38,.37],[-.14,.53],[.13,.42]],'#e2d6b8',.13);
  ellipse(c,1.07,-.67,.28,.46,'#555849');ellipse(c,1.07,.71,.29,.43,'#555849');
  ellipse(c,1.47,0,.74,.60,'#56594a','#434d3f',.11);
  ellipse(c,1.12,-.07,.41,.48,'#e7dfc4');ellipse(c,1.86,-.18,.10,.10,'#272f2a');
  c.restore();
}
function dogArt(c,d,t){
  const speed=Math.min(1,Math.hypot(d.vx,d.vy)/6),swing=Math.sin(t*12)*speed;
  ellipse(c,d.x+.43,d.y+.50,2.36,1.12,'rgba(42,57,34,.25)');
  c.save();c.translate(d.x,d.y);c.rotate(d.angle);
  for(const a of [-1,1])for(const b of [-1,1])ellipse(c,a*.98+swing*a*b*.48,b*.75,.47,.25,b<0?'#6b6048':'#d6be8e');
  c.save();c.translate(-1.45,0);c.rotate(.26+Math.sin(t*4)*.23);ellipse(c,-.77,.08,1.11,.38,'#343f36');
  ellipse(c,-1.65,.05,.45,.31,'#f2e7cb');c.restore();
  ellipse(c,-.10,0,1.87,1.01,'#344139','#27382f',.16);
  ellipse(c,-.70,-.47,.73,.24,'#536255');
  drawPath(c,[[.18,-.98],[.82,-.96],[1.19,-.53],[1.05,.73],[.69,.98],[.28,.8],[.53,.35],[.44,-.22]],'#f1e8ce');
  drawPath(c,[[.90,-.89],[1.22,-.74],[1.31,.65],[.94,.87],[.63,1.29],[.61,.68],[.93,.29]],'#e18a51','#955b3e',.08);
  ellipse(c,1.44,0,.93,.75,'#384339',ink,.1);
  drawPath(c,[[.93,-.45],[.62,-1.25],[1.55,-.77]],'#303c32');drawPath(c,[[1.02,.5],[.79,1.26],[1.68,.70]],'#303c32');
  drawPath(c,[[1.0,-.12],[1.55,-.30],[2.24,-.19],[2.53,.03],[2.18,.27],[1.55,.13]],'#f9efd5');
  ellipse(c,2.41,.01,.23,.24,'#26352b');ellipse(c,1.68,-.38,.12,.11,'#cbac72');
  c.restore();
}
export function dogPortrait(canvas){
  const c=canvas.getContext('2d');canvas.width=160;canvas.height=160;c.setTransform(4,0,0,4,0,0);
  paperBox(c,.5,.5,39,39,11,'#dce8bd','#b7c998',.45);
  drawPath(c,[[6,35],[8,28],[14,23],[26,23],[32,28],[35,35]],'#344538');
  drawPath(c,[[13,24],[21,30],[27,24],[25,34],[20,37],[16,32]],'#f1e8ce');
  drawPath(c,[[9,14],[8,5],[15,8],[19,13],[24,12],[30,5],[32,9],[30,19],[28,26],[22,30],[17,30],[11,25]],'#334337','#26382c',.60);
  drawPath(c,[[10,8],[11,15],[15,13]],'#a0815e');drawPath(c,[[29,9],[26,14],[30,14]],'#a0815e');
  drawPath(c,[[18,12],[22,12],[21,17],[23,21],[26,23],[24,28],[20,30],[15,26],[15,23],[19,19]],'#f7eed2');
  ellipse(c,14.3,17.1,1.5,.65,'#bd986a');ellipse(c,25.5,17.1,1.5,.65,'#bd986a');
  ellipse(c,14.9,19,.94,.9,'#1e2e24');ellipse(c,24.9,19,.94,.9,'#1e2e24');
  ellipse(c,20.0,24.2,2.25,1.35,'#25342a');line(c,[[20,25],[20,26.4],[18.2,27]],'#665e4d',.39);
  drawPath(c,[[13,27],[19.5,30.2],[26,27.2],[24.5,31],[18.5,33],[14.5,30.5],[12,31.1]],'#df8552');
}
export class FieldView {
  constructor(canvas){this.canvas=canvas;this.c=canvas.getContext('2d');this.back=document.createElement('canvas');this.key='';this.width=0;}
  resize(){
    const r=this.canvas.getBoundingClientRect(),d=Math.min(2,window.devicePixelRatio||1);
    if(r.width<2||r.height<2)return false;
    const w=Math.round(r.width*d),h=Math.round(r.height*d);
    if(w!==this.canvas.width||h!==this.canvas.height||this.width!==r.width){this.canvas.width=w;this.canvas.height=h;this.key='';}
    this.width=r.width;this.height=r.height;this.dx=w/(W+2.4);this.dy=h/(H+3.2);this.dpr=d;
    return true;
  }
  toWorld(x,y){const r=this.canvas.getBoundingClientRect();return {x:(x-r.left)/r.width*(W+2.4)-1.2,y:(y-r.top)/r.height*(H+3.2)-1.6};}
  transform(c){c.setTransform(this.dx,0,0,this.dy,this.dx*1.2,this.dy*1.6);}
  draw(w,opts={}){
    if(!this.resize())return;
    const key=w.seed+'/'+w.drill,c=this.c;
    if(this.key!==key){this.back.width=this.canvas.width;this.back.height=this.canvas.height;const b=this.back.getContext('2d');this.transform(b);scenery(b,w,this.dy/this.dpr);this.key=key;}
    c.setTransform(1,0,0,1,0,0);c.drawImage(this.back,0,0);this.transform(c);c.lineJoin='round';c.lineCap='round';
    if(opts.target){const p=opts.target;c.save();c.setLineDash([.65,.61]);line(c,[[w.dog.x,w.dog.y],[p.x,p.y]],'#fff0bd',.25);c.setLineDash([]);
      c.beginPath();c.arc(p.x,p.y,1.1,0,TAU);c.strokeStyle='#fff0bd';c.lineWidth=.28;c.stroke();c.restore();}
    const time=w.tick*DT,actors=[...w.sheep.map((s,i)=>({s,i})),{s:w.dog,i:-1}].sort((a,b)=>a.s.y-b.s.y);
    for(const {s,i} of actors){if(i===-1)dogArt(c,s,time);else sheepArt(c,s,i,time);}
    if(opts.label){
      const x=(w.dog.x+1.2)*this.dx/this.dpr,y=(w.dog.y+1.6)*this.dy/this.dpr;
      const side=y<65&&x<125?1:-1,offset=Math.max(18,3.8*this.dy/this.dpr);
      const xx=x+5,yy=y+side*offset;c.setTransform(this.dpr,0,0,this.dpr,0,0);
      line(c,[[x,y+side*6],[xx,yy-side*6]],'#536546',1);
      paperBox(c,xx-16,yy-7.5,32,15,3,'#faf3dc','#768063',.8);
      c.fillStyle='#354633';c.textAlign='center';c.textBaseline='middle';c.font='bold 10px Rubik, sans-serif';c.fillText('Fern',xx,yy+.5);
    }
  }
}
