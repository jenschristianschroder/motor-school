export function drawIcon(canvas,name=canvas.dataset.icon) {
  canvas.dataset.icon=name;
  canvas.setAttribute('aria-hidden','true');
  const scale=3,size=24;canvas.width=size*scale;canvas.height=size*scale;
  const c=canvas.getContext('2d');
  c.scale(scale,scale);c.lineWidth=1.65;c.lineJoin='round';c.lineCap='round';
  c.strokeStyle=c.fillStyle=getComputedStyle(canvas.parentElement).color;
  const path=(points,close=false,fill=false)=>{
    c.beginPath();c.moveTo(...points[0]);points.slice(1).forEach(p=>c.lineTo(...p));
    if(close)c.closePath();if(fill)c.fill();else c.stroke();
  };
  const rect=(x,y,w,h,r=0,fill=false)=>{c.beginPath();c.roundRect(x,y,w,h,r);if(fill)c.fill();else c.stroke();};
  const arc=(x,y,r,a,b)=>{c.beginPath();c.arc(x,y,r,a,b);c.stroke();};
  switch(name) {
    case 'book':
      path([[12,6],[8.8,4.5],[3,4.5],[3,18],[8.3,18],[12,20],[15.7,18],[21,18],[21,4.5],[15.2,4.5],[12,6],[12,19]]);
      break;
    case 'mute':case 'sound':
      path([[3,9],[7,9],[12,5],[12,19],[7,15],[3,15]],true);
      if(name==='mute'){path([[16,9],[21,15]]);path([[21,9],[16,15]]);}
      else{arc(12,12,5,-.8,.8);arc(12,12,9,-.8,.8);}break;
    case 'layers':
      path([[2.8,8.4],[12,3.7],[21.2,8.4],[12,13.1]],true);
      path([[3,12],[12,16.7],[21,12]]);path([[3,15.8],[12,20.4],[21,15.8]]);break;
    case 'down':path([[5,9],[12,15],[19,9]]);break;
    case 'expand':
      path([[4,9],[4,4],[9,4]]);path([[15,4],[20,4],[20,9]]);
      path([[20,15],[20,20],[15,20]]);path([[9,20],[4,20],[4,15]]);break;
    case 'collapse':
      path([[9,4],[9,9],[4,9]]);path([[15,4],[15,9],[20,9]]);
      path([[20,15],[15,15],[15,20]]);path([[4,15],[9,15],[9,20]]);break;
    case 'chip':
      rect(5.3,5.3,13.4,13.4,2.3);rect(9,9,6,6,1);
      for(const i of [8.5,12,15.5]){path([[i,2.3],[i,5]]);path([[i,19],[i,21.7]]);path([[2.3,i],[5,i]]);path([[19,i],[21.7,i]]);}break;
    case 'play':path([[6.5,3.3],[20,12],[6.5,20.7]],true,true);break;
    case 'stop':rect(5,5,14,14,2,true);break;
    case 'reset':path([[3,6],[3,11],[8,11]]);arc(12.4,12,8,-2.83,2.48);break;
    case 'undo':path([[8.6,4.3],[3.6,9.2],[8.6,14.1]]);path([[4.2,9.2],[14.1,9.2]]);arc(14.1,14.8,5.6,-Math.PI/2,Math.PI/2);break;
    case 'ruler':
      c.save();c.translate(12,12);c.rotate(-.42);rect(-9.5,-4.8,19,9.6,1.2);
      for(let i=-6,j=0;i<8;i+=3,j++)path([[i,-4.5],[i,j%2?-2.3:0]]);c.restore();break;
    case 'device':rect(3,4.5,18,13,1.8);path([[8,21],[16,21]]);path([[12,17.5],[12,21]]);break;
    case 'timer':arc(12,13.5,7.5,0,2*Math.PI);path([[9,2.5],[15,2.5]]);path([[12,3],[12,6]]);path([[12,9],[12,13.5],[14,14.5]]);break;
    case 'close':path([[6,6],[18,18]]);path([[18,6],[6,18]]);break;
    case 'bulb':
      c.beginPath();c.moveTo(8.5,15.8);c.bezierCurveTo(8.5,13.9,5.3,12.5,5.3,8.8);
      c.bezierCurveTo(5.3,.7,18.7,.7,18.7,8.8);c.bezierCurveTo(18.7,12.5,15.5,13.9,15.5,15.8);c.closePath();c.stroke();
      path([[9,18.8],[15,18.8]]);path([[10.4,21],[13.6,21]]);path([[9.7,8.8],[12,11.2],[14.3,8.8]]);path([[12,11.2],[12,15.8]]);break;
  }
}
export function initIcons(){document.querySelectorAll('canvas[data-icon]').forEach(c=>drawIcon(c));}
