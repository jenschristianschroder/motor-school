import {PARTS,NAMES,clamp,newMemory,readMemory,teach,predict,trialGait,finishTrial} from './brain.mjs';
import {COURSES,METRE,Robot,neutral,bounded,pick,handles} from './rig.mjs';
import {Arena} from './arena.mjs';
import {drawIcon,initIcons} from './icons.mjs';

const $=id=>document.getElementById(id);
const KEY='motor-school.pip.v1';
let stored=null,canSave=true;
try { stored=localStorage.getItem(KEY); } catch {canSave=false;}
let memory=readMemory(stored);
const game={memory,mode:'teach',hover:null,selected:'nearFoot',keysActive:false,drag:null,
  trial:null,last:null,history:[],expanded:false,distance:0};
const robot=new Robot(COURSES[memory.lesson]), arena=new Arena($('field'));
const still=neutral(), teaching=neutral(), held=new Set();
const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let audioContext=null, lastUi=0, traceDirty=true, lastTrace=0, clock=0, accumulator=0, lastStamp=0;
const coachInitial='Grab a foot, lift it, sweep it toward the flag, then let go. Run a test to see what Pip learned.';
const course=()=>COURSES[memory.lesson];
const record=()=>memory.records[memory.lesson];
const note=s=>{$('coachText').textContent=s;};
const modalOpen=()=>Array.from(document.querySelectorAll('dialog')).some(d=>d.open);
function save(){
  try{localStorage.setItem(KEY,JSON.stringify(memory));canSave=true;}catch{canSave=false;}
  $('saveState').textContent=canSave?'Memory stays on this device':'Memory available for this session';
}
function tone(hz,seconds=.075,delay=0,type='sine') {
  if(!memory.sound)return;
  try{
    const AudioApi=window.AudioContext || window.webkitAudioContext;
    if(!AudioApi)return;
    audioContext ||= new AudioApi();
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
    const osc=audioContext.createOscillator(),gain=audioContext.createGain();
    const start=audioContext.currentTime+delay;
    osc.type=type;osc.frequency.setValueAtTime(hz,start);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(.045,start+.012);
    gain.gain.exponentialRampToValueAtTime(.0001,start+seconds);
    osc.connect(gain);gain.connect(audioContext.destination);osc.start(start);osc.stop(start+seconds+.02);
  }catch{}
}
function soundUI(){
  const b=$('soundBtn'),label=memory.sound?'Turn sound off':'Turn sound on';
  b.title=label;b.setAttribute('aria-label',label);b.setAttribute('aria-pressed',String(memory.sound));
  drawIcon(b.querySelector('canvas'),memory.sound?'sound':'mute');
}
function stageReadout(){
  let distance=game.distance;
  if(Math.abs(distance)<.005)distance=0;
  const target=course().target;
  $('distance').textContent=distance.toFixed(2);
  $('targetDistance').textContent=' / '+target.toFixed(2)+' m';
  $('meterFill').style.width=clamp(distance/target*100,0,100)+'%';
  $('meter').setAttribute('aria-valuenow',String(clamp(distance,0,target).toFixed(2)));
  $('meter').setAttribute('aria-valuemax',String(target));
  $('meter').setAttribute('aria-valuetext',distance.toFixed(2)+' of '+target+' metres');
  if(game.trial)$('timeLeft').textContent=Math.max(0,game.trial.limit-game.trial.time).toFixed(1)+' s';
}
function refresh(){
  const running=game.mode==='trial', won=game.mode==='result'&&game.last?.won;
  $('lessonName').textContent=course().name;$('lessonDesc').textContent=course().description;
  $('lessonNumber').textContent='Lesson '+String(memory.lesson+1).padStart(2,'0')+' / 03';
  [...$('lessonBars').children].forEach((b,i)=>b.classList.toggle('active',i<=memory.lesson));
  $('exampleCount').textContent=memory.examples;$('bestDistance').textContent=record().best.toFixed(2);
  $('modeText').textContent=running?'Test in progress':game.drag?'Learning':won?'Flag reached':game.mode==='result'?'Trial complete':'Teach mode';
  $('modeTag').dataset.mode=won?'win':game.mode;
  $('trialClock').hidden=!running;
  const action=running?'Stop test':game.mode==='result'?'Test again':'Run test';
  const button=$('runBtn');button.querySelector('span').textContent=action;
  button.classList.toggle('running',running);
  drawIcon(button.querySelector('canvas'),running?'stop':'play');
  $('expandedRun').textContent=action;
  $('undoBtn').disabled=!game.history.length||!!game.drag||running;
  $('nextBtn').hidden=!(won&&memory.lesson<COURSES.length-1);
  $('saveState').textContent=canSave?'Memory stays on this device':'Memory available for this session';
  stageReadout();traceDirty=true;
}
function tracePath(c,values,x0,y0,w,max,amp,color){
  c.beginPath();
  values.forEach((v,i)=>{const x=x0+i/(values.length-1||1)*w,y=y0-clamp(v/max,-1,1)*amp;
    if(!i)c.moveTo(x,y);else c.lineTo(x,y);});
  c.strokeStyle=color;c.lineWidth=1.7;c.lineJoin='round';c.lineCap='round';c.stroke();
}
function drawTrace(){
  const canvas=$('trace'),r=canvas.getBoundingClientRect(),w=r.width,h=r.height;
  if(!w||!h)return;
  const d=Math.min(2,devicePixelRatio||1);
  if(canvas.width!==Math.round(w*d)||canvas.height!==Math.round(h*d)){canvas.width=Math.round(w*d);canvas.height=Math.round(h*d);}
  const c=canvas.getContext('2d');c.setTransform(d,0,0,d,0,0);c.clearRect(0,0,w,h);
  const step=13;
  c.strokeStyle='#dce3da';c.lineWidth=.75;c.beginPath();
  for(let x=0;x<w;x+=step){c.moveTo(x+.5,0);c.lineTo(x+.5,h);}
  for(let y=h/2%step;y<h;y+=step){c.moveTo(0,y+.5);c.lineTo(w,y+.5);}c.stroke();
  c.setLineDash([3,3]);c.beginPath();c.moveTo(0,h/2);c.lineTo(w,h/2);c.strokeStyle='#a6b8af';c.lineWidth=1;c.stroke();c.setLineDash([]);
  let pts=[],part=game.drag?.part||memory.lastPart;
  if(game.drag)pts=game.drag.samples;
  else if(part)pts=Array.from({length:70},(_,i)=>predict(memory,part,i/69));
  if(pts.length>1){
    const max=Math.max(16,...pts.map(p=>Math.max(Math.abs(p.x),Math.abs(p.y))));
    tracePath(c,pts.map(p=>p.x),3,h/2,w-6,max,h*.40,'#c37348');
    tracePath(c,pts.map(p=>-p.y),3,h/2,w-6,max,h*.40,'#3f6b9f');
    if(game.trial){const x=3+game.trial.phase%1*(w-6);c.strokeStyle='#263b4b';c.lineWidth=1;c.beginPath();c.moveTo(x,0);c.lineTo(x,h);c.stroke();}
  }
  $('traceState').textContent=part?NAMES[part]:'Waiting for a drag';
  canvas.setAttribute('aria-label',part?'Learned horizontal and vertical movement of the '+NAMES[part].toLowerCase():'No movement demonstrations yet');
}
function clearTargets(){for(const p of PARTS){teaching[p].x=0;teaching[p].y=0;}}
function cancelDrag(){
  const d=game.drag;if(!d)return;
  game.drag=null;held.clear();clearTargets();
  if(d.id!==null && $('field').hasPointerCapture?.(d.id))$('field').releasePointerCapture(d.id);
  $('field').style.cursor='default';refresh();
}
function resetPose(message=true) {
  cancelDrag();game.trial=null;game.last=null;game.mode='teach';game.hover=null;
  game.distance=0;robot.reset(course());arena.camera=0;clearTargets();held.clear();
  if(message)note(memory.examples?'Pip is back at the start. Its demonstrations are ready for the next test.':coachInitial);
  refresh();
}
function switchLesson(index) {
  if(index===memory.lesson)return;
  memory.lesson=index;resetPose(false);save();tone(440);
  note([coachInitial,'There’s a raised ledge halfway along the course. Teach Pip to lift its toes before reaching forward.',
    'Pip needs traction on the incline. Try shorter forward steps and keep its weight over the planted foot.'][index]);
}
function beginDrag(part,id,start,p){
  if(game.mode==='trial'||game.drag||modalOpen())return false;
  if(robot.fallen){resetPose(false);robot.step(1/120,still,false);}
  game.mode='teach';game.last=null;game.selected=part;game.hover=part;
  const initial={...robot.pos[part]};
  game.drag={part,id,start,anchor:p,initial,age:0,travel:0,previous:{...initial},
    samples:[{...initial,t:0}],trail:[{...p}],keyX:0,keyY:0};
  teaching[part]={...initial};$('field').style.cursor='grabbing';
  note('Guide the '+NAMES[part].toLowerCase()+' through the movement. Release to teach it to Pip.');
  refresh();return true;
}
function moveDrag(dx,dy){
  const d=game.drag;if(!d)return;
  const factor=d.part==='belly'?1.8:d.part==='back'?1.52:d.part==='head'?1.48:1;
  const value=bounded(d.part,d.initial.x+dx*factor,d.initial.y+dy*factor);
  teaching[d.part]=value;
  const segment=Math.hypot(value.x-d.previous.x,value.y-d.previous.y);
  if(segment<.45)return;
  d.travel+=segment;d.previous={...value};
  d.samples.push({...value,t:d.age});
  d.trail.push({x:d.anchor.x+(value.x-d.initial.x)/factor,y:d.anchor.y+(value.y-d.initial.y)/factor});
  if(d.samples.length>360)d.samples=d.samples.filter((_,i)=>i%2===0||i===d.samples.length-1);
  if(d.trail.length>85)d.trail.shift();
  traceDirty=true;
}
function endDrag(){
  const d=game.drag;if(!d)return;
  const before={part:d.part,model:structuredClone(memory.parts[d.part]),tempo:memory.tempo,lastPart:memory.lastPart};
  const learned=d.travel>=5&&teach(memory,d.part,d.samples);
  cancelDrag();game.hover=null;
  if(learned){
    game.history.push(before);if(game.history.length>8)game.history.shift();
    save();tone(480);tone(650,.075,.055);
    if(d.part.endsWith('Foot')){
      const lift=-Math.min(0,...d.samples.map(s=>s.y));
      note(lift<5?'Pip learned the foot slide. Try lifting the foot as you move it forward so the other foot can push.':
        NAMES[d.part]+' learned. Run a test to see how much ground that step covers.');
    }else if(!memory.parts.nearFoot.n&&!memory.parts.farFoot.n){
      note('Pip learned that '+NAMES[d.part].toLowerCase()+' movement. Try it in a test, or guide a foot to add a step.');
    }else note(NAMES[d.part]+' learned. Run a test to see how it works with Pip’s step.');
  }else note('That touch was too small to learn from. Drag the joint through a movement before letting go.');
  refresh();
}
function undo(){
  if(!game.history.length||game.mode==='trial'||game.drag)return;
  const h=game.history.pop();memory.parts[h.part]=h.model;memory.tempo=h.tempo;
  memory.examples=PARTS.reduce((s,p)=>s+memory.parts[p].n,0);memory.lastPart=h.lastPart;
  for(const r of memory.records)r.fit=null;
  resetPose(false);save();note('Undid the last '+NAMES[h.part].toLowerCase()+' demonstration.');refresh();
}
function startTrial(){
  if(game.drag)endDrag();
  game.mode='trial';game.hover=null;game.keysActive=false;game.distance=0;game.last=null;
  robot.reset(course());arena.camera=0;
  game.trial={time:0,phase:0,gait:trialGait(memory,memory.lesson),limit:memory.examples?course().time:3,targets:neutral()};
  note(memory.examples?'Pip is moving on its own. Watch which foot is planted when the other one swings forward.':
    'This is Pip’s untrained baseline. After the test, guide a foot to give it its first step.');
  refresh();tone(420,.1);
}
function endTrial(){
  const t=game.trial;if(!t)return;
  const target=course().target,won=game.distance>=target;
  const raw=won?target:game.distance, distance=Math.max(0,raw);
  game.distance=raw;
  const personalBest=finishTrial(memory,memory.lesson,t.gait,distance,t.time,won);
  game.last={won,distance};game.mode='result';game.trial=null;
  let feedback;
  if(won){
    feedback='Pip reached the '+target+' m flag in '+t.time.toFixed(1)+' seconds. '+
      (memory.lesson<2?'Its motor memory is ready for the next course.':'All the way up! Try a new demonstration to beat that time.');
    tone(523,.12);tone(659,.14,.10);tone(784,.22,.21);
  }else if(robot.fallen){
    feedback='Pip tipped over at '+distance.toFixed(2)+' m. Try a smaller upper-body movement to keep its weight over the planted foot.';
  }else if(raw<-.08){
    feedback='Pip travelled '+Math.abs(raw).toFixed(2)+' m backward. Lift a foot first, then sweep it toward the flag and plant it.';
  }else if(distance<.06){
    feedback=memory.examples?'Pip moved in place. Give a foot some lift before reaching forward, then bring it down.':
      'Pip stayed at the starting line. Grab a foot and draw a small forward arc to teach its first step.';
  }else{
    feedback='Pip walked '+distance.toFixed(2)+' m'+(personalBest?' — a new best.':'.')+
      (course().kind==='step'?' Try a higher foot arc to clear the ledge.':' Try teaching the other leg, or run another test to explore a different stride.');
  }
  note(feedback);save();refresh();
}
function toggleTrial(){
  if(game.mode==='trial'){resetPose(false);note('Test stopped. Pip is ready for another demonstration.');}
  else startTrial();
}
function expand(state=!game.expanded){
  game.expanded=state;$('arenaCard').classList.toggle('enlarged',state);document.body.classList.toggle('expanded',state);
  const b=$('expandBtn'),label=state?'Restore training floor':'Expand training floor';
  b.setAttribute('aria-label',label);b.title=label;b.setAttribute('aria-pressed',String(state));
  drawIcon(b.querySelector('canvas'),state?'collapse':'expand');$('expandedRun').hidden=!state;
  arena.resize();arena.draw(robot,game,clock,1);
}
function buildLessons(){
  const list=$('lessonList');list.replaceChildren();
  COURSES.forEach((c,i)=>{
    const b=document.createElement('button'),idx=document.createElement('span'),instructions=document.createElement('span'),
      title=document.createElement('strong'),desc=document.createElement('small'),state=document.createElement('span');
    b.className='lesson-option';idx.className='course-index';idx.textContent=String(i+1).padStart(2,'0');
    instructions.className='option-copy';title.textContent=c.name;desc.textContent=c.terrain+' · '+c.target+' m';
    state.className='course-state';state.textContent=memory.records[i].won?'Completed':i===memory.lesson?'Current':'';
    if(i===memory.lesson)b.setAttribute('aria-current','true');
    instructions.append(title,desc);b.append(idx,instructions,state);
    b.addEventListener('click',()=>{$('lessonsDialog').close();switchLesson(i);});list.append(b);
  });
}
function showDialog(dialog){
  if(game.drag)cancelDrag();held.clear();game.hover=null;
  dialog.showModal();
}
const field=$('field');
field.addEventListener('pointerdown',e=>{
  if((e.pointerType==='mouse'&&e.button!==0)||game.drag||game.mode==='trial')return;
  const world=arena.toWorld(e.clientX,e.clientY),hit=pick(robot.skeleton(),world,e.pointerType==='touch'?5:1.5);
  if(!hit)return;
  field.focus({preventScroll:true});game.keysActive=false;
  if(beginDrag(hit.key,e.pointerId,world,hit.p)){e.preventDefault();field.setPointerCapture(e.pointerId);}
});
field.addEventListener('pointermove',e=>{
  if(game.mode==='trial')return;
  const world=arena.toWorld(e.clientX,e.clientY);
  if(game.drag){
    if(game.drag.id===e.pointerId)moveDrag(world.x-game.drag.start.x,world.y-game.drag.start.y);
  }else{
    if(e.pointerType==='touch')return;
    game.keysActive=false;game.hover=pick(robot.skeleton(),world,1.5)?.key||null;
    field.style.cursor=game.hover?'grab':'default';
  }
});
field.addEventListener('pointerup',e=>{
  if(game.drag?.id!==e.pointerId)return;
  const world=arena.toWorld(e.clientX,e.clientY);
  moveDrag(world.x-game.drag.start.x,world.y-game.drag.start.y);endDrag();
});
for(const evt of ['pointercancel','lostpointercapture'])field.addEventListener(evt,e=>{if(game.drag?.id===e.pointerId)cancelDrag();});
field.addEventListener('pointerleave',()=>{if(!game.drag)game.hover=null;});
field.addEventListener('keydown',e=>{
  if(e.altKey||e.metaKey||e.ctrlKey)return;
  if(e.code==='Enter'){e.preventDefault();if(!e.repeat)toggleTrial();return;}
  if(game.mode==='trial')return;
  if(e.code==='KeyJ'&&!game.drag){
    e.preventDefault();game.keysActive=true;game.hover=null;
    game.selected=PARTS[(PARTS.indexOf(game.selected)+(e.shiftKey?-1:1)+PARTS.length)%PARTS.length];
    note(NAMES[game.selected]+' selected. Hold Space and use the arrow keys to guide it.');return;
  }
  if(e.code==='Space'){
    e.preventDefault();
    if(!e.repeat&&!game.drag){game.keysActive=true;const [,p]=handles(robot.skeleton()).find(([key])=>key===game.selected);
      beginDrag(game.selected,null,p,p);}
  }else if(e.code.startsWith('Arrow')&&game.drag?.id===null){e.preventDefault();held.add(e.code);}
});
window.addEventListener('keyup',e=>{
  held.delete(e.code);
  if(e.code==='Space'&&game.drag?.id===null){e.preventDefault();endDrag();}
});
field.addEventListener('blur',()=>{if(game.drag?.id===null)cancelDrag();game.keysActive=false;});
document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||modalOpen())return;
  if(game.drag){cancelDrag();note('Gesture cancelled.');}
  else if(game.expanded){expand(false);$('expandBtn').focus();}
});
function cancelOnLeave(){if(game.drag)cancelDrag();held.clear();lastStamp=0;accumulator=0;}
window.addEventListener('blur',cancelOnLeave);document.addEventListener('visibilitychange',cancelOnLeave);
$('runBtn').addEventListener('click',toggleTrial);$('expandedRun').addEventListener('click',toggleTrial);
$('resetBtn').addEventListener('click',()=>{tone(290);resetPose();});$('undoBtn').addEventListener('click',undo);
$('expandBtn').addEventListener('click',()=>expand());
$('nextBtn').addEventListener('click',()=>switchLesson(Math.min(2,memory.lesson+1)));
$('helpBtn').addEventListener('click',()=>{$('clearConfirm').hidden=true;showDialog($('helpDialog'));});
$('courseBtn').addEventListener('click',()=>{buildLessons();showDialog($('lessonsDialog'));});
$('soundBtn').addEventListener('click',()=>{memory.sound=!memory.sound;soundUI();save();tone(580,.13);});
document.querySelectorAll('.close-btn').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d=>{
  d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();
    if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
  d.addEventListener('close',()=>{lastStamp=0;accumulator=0;});
});
$('clearBtn').addEventListener('click',()=>{$('clearConfirm').hidden=false;$('keepBtn').focus();});
$('keepBtn').addEventListener('click',()=>{$('clearConfirm').hidden=true;$('clearBtn').focus();});
$('eraseBtn').addEventListener('click',()=>{
  const sound=memory.sound;memory=newMemory();memory.sound=sound;game.memory=memory;game.history=[];
  $('helpDialog').close();resetPose(false);save();note('Pip has a fresh motor memory. '+coachInitial);refresh();
});
function tick(dt){
  const d=game.drag;if(d){
    d.age+=dt;
    if(d.id===null){
      d.keyX+=((held.has('ArrowRight')?1:0)-(held.has('ArrowLeft')?1:0))*45*dt;
      d.keyY+=((held.has('ArrowDown')?1:0)-(held.has('ArrowUp')?1:0))*45*dt;
      moveDrag(d.keyX,d.keyY);
    }
  }
  if(game.mode==='trial'){
    const t=game.trial;t.time+=dt;t.phase+=dt*memory.tempo*t.gait.tempo;
    for(const key of PARTS)t.targets[key]=predict(memory,key,t.phase,t.gait);
    robot.step(dt,t.targets,true);game.distance=robot.x/METRE;
    if(game.distance>=course().target||t.time>=t.limit||(robot.fallen&&robot.fallTime>.5))endTrial();
  }else if(game.mode!=='result')robot.step(dt,d?teaching:still,false);
}
function frame(ms){
  const delta=lastStamp?Math.min((ms-lastStamp)/1000,.08):0;lastStamp=ms;
  if(!document.hidden&&!modalOpen()){
    clock+=delta;accumulator+=delta;
    while(accumulator>=1/120){tick(1/120);accumulator-=1/120;}
    arena.draw(robot,game,reduced?0:clock,delta);
    if(game.mode==='trial'&&ms-lastUi>90){stageReadout();lastUi=ms;}
    if(traceDirty||((game.drag||game.trial)&&ms-lastTrace>80)){drawTrace();traceDirty=false;lastTrace=ms;}
  }
  requestAnimationFrame(frame);
}
initIcons();soundUI();refresh();if(memory.examples)note('Pip remembers '+memory.examples+(memory.examples===1?' demonstration.':' demonstrations.')+' Run a test, or guide a joint to keep teaching.');
const resize=new ResizeObserver(()=>{arena.resize();traceDirty=true;arena.draw(robot,game,reduced?0:clock,1);});resize.observe(field);resize.observe($('trace'));
document.fonts.ready.then(()=>{traceDirty=true;});
requestAnimationFrame(frame);
