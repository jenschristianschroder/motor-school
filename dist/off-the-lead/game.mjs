import {COUNT,DRILLS,DT,LIMIT,clamp,compareScore,copyWorld,createWorld,movement,score,stepWorld} from './pasture.mjs';
import {coachSample,newPilot,observe,pilotStep,validModel} from './policy.mjs';
import {FieldView} from './field-art.mjs';
import {Kennel,freshSeed} from './kennel.mjs';
import {BLOCKS,EPISODES} from './learn.mjs';

const $=id=>document.getElementById(id),dialogs=[...document.querySelectorAll('dialog')];
const note=text=>{$('note').textContent=text;};
let storage=null;try{storage=localStorage;}catch{}
const book=new Kennel(storage),stored=book.items.get('field');
const game={seed:Number.isInteger(stored?.seed)?stored.seed:14729,drill:DRILLS[stored?.drill]?stored.drill:0,
  world:null,pilot:newPilot(),dog:book.active(),mode:'ready',paused:false,speed:1,breaks:3,history:[],coach:null,assisted:false,acc:0};
const view=new FieldView($('pitch')),raceViews=[new FieldView($('pitchA')),new FieldView($('pitchB'))];
let dirty=true,lastStamp=0,race=null,training=null,sequence=0;
const keys=new Set(),marks=[];
const currentModal=()=>dialogs.find(d=>d.open);
const newEl=(tag,cls,txt)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(txt!==undefined)e.textContent=txt;return e;};
const timeLeft=w=>Math.max(0,Math.ceil(LIMIT-w.tick*DT));
const pct=n=>Math.round(n*100)+'%';
function ensureVisible(d){if(!d.open)d.showModal();dirty=true;}
function addSnapshot(){
  game.history.push(copyWorld(game.world));
  if(game.history.length>55)game.history.shift();
}
function resetField(){
  game.world=createWorld(game.seed,game.drill);game.pilot=newPilot();game.dog=book.active();
  game.mode='ready';game.paused=false;game.breaks=3;game.coach=null;game.assisted=false;game.acc=0;game.history=[];keys.clear();addSnapshot();
  dirty=true;
}
function chooseField(drill,seed){
  game.drill=drill;game.seed=seed;book.write('field',{drill,seed});resetField();
  note(DRILLS[drill].hint+' Run a trial, or coach Fern from the starting post.');refresh();
}
function loadFieldBook(){
  const box=$('fieldsList');box.replaceChildren();
  for(let i=0;i<DRILLS.length;i++){
    const d=DRILLS[i],b=newEl('button','field-choice'),left=newEl('span'),awards=book.awards().filter(q=>q.drill===i);
    const best=awards.reduce((n,a)=>Math.max(n,a.penned),0);
    left.append(newEl('strong','',d.field),newEl('small','',d.name));
    b.append(left,newEl('em','',best===COUNT?'Qualified':awards.length?'Best '+best+' / 8':'Open card'));
    if(i===game.drill)b.setAttribute('aria-current','true');
    b.addEventListener('click',()=>{chooseField(i,freshSeed());$('fields').close();});box.append(b);
  }
}
function simpleReadout(){
  const w=game.world,value=w.sheep.reduce((n,s)=>n+s.stress,0)/COUNT;
  $('penned').textContent=String(w.penned);marks.forEach((m,i)=>m.classList.toggle('in',i<w.penned));
  $('stress').textContent=pct(value);$('stressFill').style.width=clamp(value*100,0,100)+'%';
  $('clock').textContent=timeLeft(w)+' s';
  if(game.coach){
    const c=game.coach;
    $('coachSign').textContent=c.begun?'Coaching · '+Math.max(0,7-c.ticks*DT).toFixed(1)+' s left':'Hold in the field to guide Fern';
    $('fieldAction').disabled=c.intent<3;
  }
}
function refresh(){
  const coaching=!!game.coach,playing=game.mode==='trial'||game.mode==='practice',active=book.active();
  const shown=game.mode==='ready'||game.mode==='end'?active:game.dog;
  $('fieldTitle').textContent=DRILLS[game.drill].field;$('drillTitle').textContent=DRILLS[game.drill].name;
  $('modelTag').textContent=book.label(shown.id).split(' · ')[0];$('modelTag').title=book.label(shown.id);
  $('lessonCount').textContent=String(book.lessons().length);$('breakCount').textContent=game.breaks+' / 3';
  const primary=coaching?'Save lesson':playing?(game.paused?'Resume '+(game.assisted?'practice':'trial'):'Pause '+(game.assisted?'practice':'trial')):game.mode==='end'?'Run again':'Run trial';
  $('fieldAction').querySelector('span').textContent=primary;$('fieldAction').disabled=coaching&&game.coach.intent<3;
  $('actionIcon').className='play-i'+(coaching?' save':playing&&!game.paused?' pause':'');
  $('coachBtn').textContent=coaching?'Discard correction':game.mode==='ready'?'Coach Fern':'Rewind & coach';
  $('coachBtn').disabled=!coaching&&game.breaks<=0;$('coachSign').hidden=!coaching;
  $('pitch').style.cursor=coaching?'crosshair':'default';
  for(const k of ['fieldsBtn','trainBtn'])$(k).disabled=coaching;
  $('compareBtn').disabled=coaching||book.dogs().length<2;
  $('compareBtn').title=book.dogs().length<2?'Train a generation to compare it with the foundation dog.':'Compare two saved models';
  $('dogCount').textContent=String(book.dogs().length);
  $('localState').textContent=book.durable?'Kennel saved on this device':'Kennel available for this session';
  const label=coaching?'Coaching':playing&&game.paused?'Paused':game.mode==='trial'?'Autonomous trial':game.mode==='practice'?'Assisted practice':game.mode==='end'?'Whistle blown':'At the post';
  $('modeText').textContent=label;$('modeTag').dataset.state=coaching?'coach':game.mode;
  $('speedBtn').textContent=(coaching?1:game.speed)+'×';$('speedBtn').disabled=coaching;
  $('speedBtn').setAttribute('aria-label','Trial speed, '+(coaching?1:game.speed)+' times');
  simpleReadout();dirty=true;
}
function runAction(){
  if(game.coach){saveCoaching();return;}
  if(game.mode==='trial'||game.mode==='practice'){
    game.paused=!game.paused;game.acc=0;
    note(game.paused?'Trial paused. Resume to watch, or rewind to coach a correction.':game.assisted?'Fern is continuing the practice from your correction.':'Fern is working independently.');
  }else{
    resetField();game.mode='trial';note('Watch the sheep at the edges. Choose Rewind & coach when Fern loses one.');
  }
  refresh();
}
function endField(){
  game.mode='end';game.paused=false;
  const s=score(game.world);
  note((game.assisted?'Assisted practice':'Autonomous trial')+' finished with '+s.penned+' of 8 penned and '+pct(s.stress)+' average stress. '+
    (s.penned===COUNT?'Compare on an unseen field to earn a qualification card.':game.breaks?'Rewind the ending to coach a correction, or train another generation.':'Train from the lessons you saved.'));
  refresh();
}
function beginCoaching(){
  if(game.coach){discardCoaching();return;}if(game.breaks<=0)return;
  const original={world:copyWorld(game.world),pilot:{...game.pilot,move:{...game.pilot.move}},mode:game.mode,paused:game.paused,history:game.history.slice()};
  const when=Math.max(0,game.world.tick-Math.round(5/DT));
  const start=game.history.find(h=>h.tick>=when&&!h.done)||game.history[0];
  game.world=copyWorld(start);game.history=game.history.filter(h=>h.tick<=start.tick);
  game.coach={original,start:copyWorld(start),begun:false,intent:0,ticks:0,samples:[],target:null,pointer:null};
  game.mode='coach';game.paused=false;game.acc=0;keys.clear();
  const seconds=(original.world.tick-start.tick)*DT;
  note((seconds>.05?'Rewound '+seconds.toFixed(1)+' seconds. ':'')+'Hold in the field to guide Fern. Release to let her stand. Save the movement as a lesson.');
  refresh();$('pitch').focus({preventScroll:true});
}
function stopInput(){
  keys.clear();const c=game.coach;if(!c)return;
  const pointer=c.pointer;c.pointer=null;c.target=null;
  if(pointer!==null&&$('pitch').hasPointerCapture?.(pointer))$('pitch').releasePointerCapture(pointer);
}
function discardCoaching(){
  const c=game.coach;if(!c)return;stopInput();game.coach=null;
  Object.assign(game,c.original);game.acc=0;note('Correction discarded. Fern is back at the original moment.');refresh();
}
function saveCoaching(){
  const c=game.coach;if(!c||c.intent<3||!c.samples.length)return;
  book.addLesson(c.start,c.samples,c.ticks*DT,game.dog.id);stopInput();game.coach=null;
  game.pilot=newPilot();game.assisted=true;game.mode=game.world.done?'end':'practice';game.paused=!game.world.done;game.breaks--;
  game.acc=0;note('Lesson saved. Choose Train a generation to teach it to a new dog, or continue this practice.');refresh();
}
function coachTick(){
  const c=game.coach,d=game.world.dog;
  const kx=Number(keys.has('ArrowRight')||keys.has('KeyD'))-Number(keys.has('ArrowLeft')||keys.has('KeyA'));
  const ky=Number(keys.has('ArrowDown')||keys.has('KeyS'))-Number(keys.has('ArrowUp')||keys.has('KeyW'));
  let move={x:0,y:0};const intent=!!(c.target||kx||ky);
  if(intent){c.begun=true;c.intent++;}
  if(!c.begun)return;
  if(c.target){const dx=c.target.x-d.x,dy=c.target.y-d.y;move=movement(dx,dy,clamp(Math.hypot(dx,dy)/7,0,1));}
  else if(kx||ky)move=movement(kx,ky,keys.has('ShiftLeft')||keys.has('ShiftRight')?1:.72);
  if(c.ticks%2===0)c.samples.push(coachSample(observe(game.world),move));
  stepWorld(game.world,move);c.ticks++;addSnapshot();
  if(c.ticks>=Math.round(7/DT)||game.world.done){if(c.intent>=3)saveCoaching();else discardCoaching();}
}
const field=$('pitch');
field.addEventListener('pointerdown',e=>{
  const c=game.coach;if(!c||c.pointer!==null||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();field.focus({preventScroll:true});c.pointer=e.pointerId;c.target=view.toWorld(e.clientX,e.clientY);field.setPointerCapture(e.pointerId);dirty=true;
});
field.addEventListener('pointermove',e=>{if(game.coach?.pointer===e.pointerId){game.coach.target=view.toWorld(e.clientX,e.clientY);dirty=true;}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])field.addEventListener(event,e=>{if(game.coach?.pointer===e.pointerId){stopInput();dirty=true;}});
const keyControls=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','ShiftLeft','ShiftRight'];
field.addEventListener('keydown',e=>{
  if(e.altKey||e.metaKey||e.ctrlKey)return;
  if(game.coach&&keyControls.includes(e.code)){e.preventDefault();keys.add(e.code);}
  else if(e.code==='Space'&&!game.coach){e.preventDefault();if(!e.repeat)runAction();}
  else if(e.code==='Escape'&&game.coach){e.preventDefault();discardCoaching();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));field.addEventListener('blur',()=>keys.clear());

let allocation=[2,2,2];
const assigned=()=>allocation.reduce((a,b)=>a+b,0);
function budgetUI(){
  for(let i=0;i<3;i++){
    $('budget'+i).textContent=String(allocation[i]);$('less'+i).disabled=allocation[i]===0;$('more'+i).disabled=assigned()>=BLOCKS;
  }
  $('remainingBlocks').textContent=(BLOCKS-assigned())+' unassigned';$('beginTraining').disabled=assigned()!==BLOCKS;
}
function prepareBudget(){
  const rows=$('budgetRows');rows.replaceChildren();
  for(let i=0;i<3;i++){
    const r=newEl('div','budget-row'),desc=newEl('div'),minus=newEl('button','mini','−'),plus=newEl('button','mini','+'),out=newEl('output');
    desc.append(newEl('strong','',DRILLS[i].name),newEl('small','',DRILLS[i].field));
    minus.id='less'+i;plus.id='more'+i;out.id='budget'+i;
    minus.setAttribute('aria-label','Remove a block from '+DRILLS[i].name);plus.setAttribute('aria-label','Add a block to '+DRILLS[i].name);
    minus.onclick=()=>{if(allocation[i])allocation[i]--;budgetUI();};plus.onclick=()=>{if(assigned()<BLOCKS)allocation[i]++;budgetUI();};
    r.append(desc,minus,out,plus);rows.append(r);
  }
  budgetUI();
}
function prepareLessons(){
  const box=$('lessonList'),list=book.lessons().reverse();box.replaceChildren();
  const summary=()=>$('lessonSummary').textContent='Training examples · '+book.lessons().filter(l=>l.enabled).length+' selected';
  summary();
  if(!list.length){box.append(newEl('p','micro','Fern can learn from trial rewards alone. Coach a correction to add your own example.'));return;}
  list.forEach((l,i)=>{
    const label=newEl('label'),cb=newEl('input');cb.type='checkbox';cb.checked=l.enabled;
    cb.addEventListener('change',()=>{book.write('lesson/'+l.id,{...l,enabled:cb.checked});summary();});
    label.append(cb,newEl('span','','Lesson '+(list.length-i)+' · '+DRILLS[l.start.drill].name+' · '+l.seconds.toFixed(1)+' s'));box.append(label);
  });
}
function openTraining(){
  if(game.coach)return;
  const a=book.items.get('allocation');if(Array.isArray(a)&&a.length===3&&a.every(x=>Number.isInteger(x)&&x>=0)&&a.reduce((v,x)=>v+x,0)===BLOCKS)allocation=a.slice();
  $('trainSetup').hidden=false;$('trainProgress').hidden=true;
  $('trainParent').textContent='Start from '+book.label(book.active().id)+'. Divide six practice blocks between the skills Fern needs.';
  prepareBudget();prepareLessons();ensureVisible($('training'));
}
function stopTraining(){
  if(!training)return;training.cancelled=true;training.worker?.terminate();training=null;
  $('trainSetup').hidden=false;$('trainProgress').hidden=true;
}
function launchTraining(){
  if(training||assigned()!==BLOCKS)return;
  const parent=book.active(),lessons=book.lessons().filter(l=>l.enabled),alloc=allocation.slice();
  const job={id:++sequence,cancelled:false,worker:null,fallback:false};training=job;
  const payload={parent:parent.policy,alloc,lessons:lessons.map(({start,samples})=>({start,samples})),seed:freshSeed()&0x3fffffff};
  $('trainSetup').hidden=true;$('trainProgress').hidden=false;$('episodeCount').textContent='0 / '+(BLOCKS*EPISODES);
  $('trainBar').value=0;$('trainStatus').textContent=lessons.length?'Learning from your steering examples…':'Starting reward-based practice…';
  function progress(p){
    if(training!==job)return;
    $('trainBar').value=p.completed;$('episodeCount').textContent=p.completed+' / '+p.total;
    $('trainStatus').textContent='Practising '+DRILLS[p.drill].name.toLowerCase()+'…';
  }
  function fail(err){
    if(training!==job)return;stopTraining();$('trainParent').textContent='Could not finish this generation. '+(err?.message||'Try the practice again.');
  }
  function complete(result){
    if(training!==job||job.cancelled)return;
    if(!validModel(result?.policy)||result.metrics?.episodes!==BLOCKS*EPISODES){fail(Error('The model did not pass validation.'));return;}
    job.worker?.terminate();training=null;
    const dog=book.addDog(parent.id,result,alloc,lessons.map(l=>l.id));book.write('allocation',alloc);
    $('training').close();refresh();openRace(parent.id,dog.id,true,lessons.at(-1));
  }
  async function fallback(){
    if(training!==job||job.fallback)return;job.fallback=true;job.worker?.terminate();job.worker=null;
    try{const {train}=await import('./learn.mjs');complete(await train(payload,progress,()=>job.cancelled));}catch(e){fail(e);}
  }
  try{
    const worker=new Worker(new URL('./training-worker.mjs',import.meta.url),{type:'module'});job.worker=worker;
    worker.onmessage=({data})=>{if(data.type==='done')complete(data.result);else if(data.type==='progress')progress(data);else fail(Error(data.message));};
    worker.onerror=e=>{e.preventDefault();fallback();};worker.postMessage(payload);
  }catch{fallback();}
}

const option=(value,label)=>{const o=newEl('option','',label);o.value=value;return o;};
function getDog(id){return book.dogs().find(d=>d.id===id)||book.dogs()[0];}
function sceneWorld(sealed){
  const choice=$('raceScene').value;
  if(choice.startsWith('moment/')){
    const l=book.lessons().find(x=>x.id===choice.slice(7));if(l)return copyWorld(l.start);
  }else if(choice.startsWith('unseen/')){
    const drill=Number(choice.split('/')[1]);return createWorld(sealed?freshSeed(true):game.seed,drill);
  }
  return createWorld(game.seed,game.drill);
}
function raceMeters(){
  if(!race)return;
  race.worlds.forEach((w,i)=>{const s=score(w);$(i?'scoreB':'scoreA').textContent=s.penned+'/8 penned · '+(100*s.stress).toFixed(1)+'% stress · '+s.seconds.toFixed(1)+' s';});
}
function resetRace(sealed=false){
  const start=sceneWorld(sealed),ids=[$('dogA').value,$('dogB').value],speed=race?.speed||4;
  race={dogs:ids.map(getDog),worlds:[copyWorld(start),copyWorld(start)],pilots:[newPilot(),newPilot()],running:false,done:false,
    sealed:sealed&&$('raceScene').value.startsWith('unseen/'),acc:0,speed,needsDraw:true};
  $('raceSpeed').textContent=speed+'×';$('raceRun').textContent='Start comparison';
  $('useA').textContent='Work with '+book.label(ids[0]).split(' · ')[0];$('useB').textContent='Work with '+book.label(ids[1]).split(' · ')[0];
  $('raceNote').textContent=$('raceScene').value.startsWith('unseen/')?'The unseen layout is drawn when the test starts. Both dogs get the same field.':
    $('raceScene').value.startsWith('moment/')?'Replay starts at the exact moment before your correction.':'Both dogs start at the post on the practice field.';
  raceMeters();dirty=true;
}
function openRace(a,b,auto=false,lesson=null){
  const dogs=book.dogs();if(dogs.length<2)return;
  if(!a||!b){const active=book.active(),last=active.parent?active:dogs.at(-1);a=last.parent||dogs[0].id;b=last.id;}
  for(const k of ['dogA','dogB']){
    const select=$(k);select.replaceChildren();for(const d of dogs)select.append(option(d.id,book.label(d.id)));
    select.value=k==='dogA'?a:b;
  }
  const scenes=$('raceScene');scenes.replaceChildren(option('practice','Current practice field'));
  for(const [i,d] of DRILLS.entries())scenes.append(option('unseen/'+i,'Unseen · '+d.name));
  const lessons=book.lessons();
  for(let i=lessons.length-1;i>=0;i--){const l=lessons[i];scenes.append(option('moment/'+l.id,'Lesson '+(i+1)+' · '+DRILLS[l.start.drill].name));}
  if(lesson)scenes.value='moment/'+lesson.id;
  else if(!auto)scenes.value='unseen/'+game.drill;
  if(auto){
    const m=getDog(b).metrics;
    $('comparisonIntro').textContent=book.label(b)+' completed '+m.episodes+' practice episodes. Across six practice fields, average reward went from '+m.calibrationBefore.toFixed(1)+' to '+m.calibrationAfter.toFixed(1)+'. Compare the dogs, then choose which one to work with.';
  }else $('comparisonIntro').textContent='Choose two frozen models. Each starts with exactly the same flock, gate and time remaining.';
  ensureVisible($('comparison'));resetRace();if(auto)startRace();
}
function startRace(){
  if(race?.running){race.running=false;$('raceRun').textContent='Resume comparison';return;}
  if(race&&!race.done&&race.started){race.running=true;$('raceRun').textContent='Pause comparison';return;}
  resetRace(true);race.started=true;race.running=true;$('raceRun').textContent='Pause comparison';
  $('raceNote').textContent=race.sealed?'Qualification trial. All eight sheep must enter the pen for a clean card.':'Replay in progress. Compare how the dogs approach the same problem.';
}
function raceFinish(){
  race.running=false;race.done=true;$('raceRun').textContent=race.sealed?'Draw another field':'Replay comparison';
  const results=race.worlds.map(score),order=compareScore(...results);
  let msg=order===0?'The two dogs tied on this field.':book.label(race.dogs[order<0?0:1].id)+' ranked first on this field.';
  if(race.sealed){
    race.dogs.forEach((d,i)=>book.award(d.id,race.worlds[i].drill,race.worlds[i].seed,results[i]));
    msg+=results.some(v=>v.penned===COUNT)?' Qualification recorded in the field book.':' The best pen count is recorded in the field book.';
  }else msg+=' Try an unseen field to test what carries over.';
  $('raceNote').textContent=msg;raceMeters();
}
function workWith(which){
  if(!race)return;const dog=race.dogs[which];book.write('active',dog.id);$('comparison').close();resetField();
  note(book.label(dog.id)+' is at the post. Run a trial or coach the next correction.');refresh();
}
function clearTime(){lastStamp=0;game.acc=0;if(race)race.acc=0;}
function frame(ts){
  const elapsed=lastStamp?Math.min(.12,(ts-lastStamp)/1000):0;lastStamp=ts;
  const modal=currentModal();
  if(!document.hidden&&modal===$('comparison')&&race){
    let changed=race.needsDraw||dirty;
    if(race.running){
      race.acc+=elapsed*race.speed;
      while(race.running&&race.acc+1e-9>=DT){
        race.acc-=DT;
        race.worlds.forEach((w,i)=>{if(!w.done)pilotStep(w,race.dogs[i].policy,race.pilots[i]);});
        if(race.worlds.every(w=>w.done))raceFinish();changed=true;
      }
    }
    if(changed){race.worlds.forEach((w,i)=>raceViews[i].draw(w));raceMeters();race.needsDraw=false;dirty=false;}
  }else if(!document.hidden&&!modal){
    if(game.coach||(!game.paused&&(game.mode==='trial'||game.mode==='practice'))){
      game.acc+=elapsed*(game.coach?1:game.speed);
      while(game.acc+1e-9>=DT&&(game.coach||(!game.paused&&game.mode!=='end'))){
        game.acc-=DT;
        if(game.coach)coachTick();
        else{pilotStep(game.world,game.dog.policy,game.pilot);addSnapshot();if(game.world.done)endField();}
        dirty=true;
      }
    }
    if(dirty){view.draw(game.world,{label:game.mode==='ready',target:game.coach?.target});simpleReadout();dirty=false;}
  }
  requestAnimationFrame(frame);
}
for(let i=0;i<COUNT;i++){const m=newEl('i');$('sheepMarks').append(m);marks.push(m);}
$('fieldAction').onclick=runAction;$('coachBtn').onclick=beginCoaching;
$('speedBtn').onclick=()=>{game.speed=game.speed===1?2:game.speed===2?4:1;refresh();};
$('helpBtn').onclick=()=>{stopInput();ensureVisible($('help'));};
$('fieldsBtn').onclick=()=>{loadFieldBook();ensureVisible($('fields'));};
$('restartBtn').onclick=()=>{chooseField(game.drill,game.seed);$('fields').close();};
$('trainBtn').onclick=openTraining;$('beginTraining').onclick=launchTraining;$('cancelTraining').onclick=()=>{stopTraining();$('training').close();};
$('compareBtn').onclick=()=>openRace();$('raceRun').onclick=startRace;
$('raceSpeed').onclick=()=>{if(!race)return;race.speed=race.speed===1?2:race.speed===2?4:1;$('raceSpeed').textContent=race.speed+'×';};
for(const k of ['dogA','dogB','raceScene'])$(k).onchange=()=>resetRace();
$('useA').onclick=()=>workWith(0);$('useB').onclick=()=>workWith(1);
document.querySelectorAll('.close,.close-text').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
for(const d of dialogs){
  d.addEventListener('close',()=>{if(d.id==='training'&&training)stopTraining();if(d.id==='comparison')race=null;clearTime();dirty=true;});
  d.addEventListener('click',e=>{if(e.target!==d)return;const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();});
}
window.addEventListener('blur',()=>{stopInput();clearTime();});
document.addEventListener('visibilitychange',()=>{stopInput();clearTime();});
window.addEventListener('storage',e=>{book.sync(e.key,e.newValue);if(game.mode==='ready')game.dog=book.active();refresh();});
const ro=new ResizeObserver(()=>{dirty=true;if(race)race.needsDraw=true;});ro.observe(field);ro.observe($('pitchA'));ro.observe($('pitchB'));
document.fonts?.ready.then(()=>{view.key='';dirty=true;});resetField();refresh();requestAnimationFrame(frame);
