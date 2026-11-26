import {createWorld,copyWorld,DECISION,rng,stepWorld,clamp} from './pasture.mjs';
import {ACTIONS,INPUTS,copyPolicy,observe,choose,dot,distribution,newPilot,pilotStep} from './policy.mjs';

export const BLOCKS=6,EPISODES=14;
const yieldThread=()=>new Promise(r=>setTimeout(r,0));
function imitate(model,data,rate){
  for(const sample of data){
    const probs=distribution(model,sample.f);
    for(let a=0;a<ACTIONS;a++){
      const error=(sample.y[a]-probs[a])*rate;
      for(let i=0;i<INPUTS;i++)model.actor[a*INPUTS+i]+=error*sample.f[i];
    }
  }
}
function trajectory(model,world,random){
  const steps=[];let total=0;
  while(!world.done){
    const obs=observe(world),decision=choose(model,obs,random);
    const v=dot(model.critic,obs.f);let reward=0;
    for(let i=0;i<DECISION&&!world.done;i++)reward+=stepWorld(world,obs.moves[decision.a]);
    steps.push({f:obs.f,a:decision.a,p:decision.probs,v,reward:reward/9});total+=reward;
  }
  return {steps,total};
}
// On-policy advantage actor-critic. Returns come exclusively from pasture
// transitions. The critic supplies the baseline for the actor's update.
function reinforce(model,steps,opt){
  const g=new Float64Array(model.actor.length),cg=new Float64Array(INPUTS);
  let advantage=0,nextV=0;
  for(let j=steps.length-1;j>=0;j--){
    const s=steps[j];
    const td=s.reward+.985*nextV-s.v;advantage=td+.985*.93*advantage;nextV=s.v;
    const signal=clamp(advantage,-3,3);
    let entropy=0;for(const p of s.p)entropy-=p*Math.log(p+1e-10);
    for(let a=0;a<ACTIONS;a++){
      const p=s.p[a],term=signal*((a===s.a?1:0)-p)-.004*p*(Math.log(p+1e-10)+entropy);
      for(let i=0;i<INPUTS;i++)g[a*INPUTS+i]+=term*s.f[i];
    }
    for(let i=0;i<INPUTS;i++)cg[i]+=signal*s.f[i];
  }
  for(let i=0;i<g.length;i++){
    const grad=g[i]/steps.length;
    opt[i]=.93*opt[i]+.07*grad*grad;
    model.actor[i]+=clamp(.009*grad/Math.sqrt(.00010+opt[i]),-.043,.043);
  }
  for(let i=0;i<INPUTS;i++)model.critic[i]+=.085*cg[i]/steps.length;
}
function practiceScore(model,fields){
  let result=0;
  for(const field of fields){
    const w=copyWorld(field),p=newPilot();
    while(!w.done)result+=pilotStep(w,model,p);
  }
  return result/fields.length;
}
export async function train(payload,progress,aborted=()=>false){
  const {parent,alloc,lessons,seed}=payload;
  if(!Array.isArray(alloc)||alloc.length!==3||!alloc.every(x=>Number.isInteger(x)&&x>=0)||alloc.reduce((a,b)=>a+b,0)!==BLOCKS)throw Error('Allocate all six practice blocks.');
  const random=rng(seed),model=copyPolicy(parent),opt=new Float64Array(model.actor.length);
  const examples=lessons.flatMap(l=>l.samples),blocks=alloc.flatMap((n,i)=>Array(n).fill(i));
  for(let i=blocks.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[blocks[i],blocks[j]]=[blocks[j],blocks[i]];}
  // Calibration uses fresh practice seeds and the same selected mixture.
  // Qualification fields live in a different seed range.
  const fields=blocks.map((d,i)=>createWorld(((seed+419*i+9211)>>>0)&0x3fffffff,d));
  const baseline=practiceScore(model,fields);
  if(examples.length)for(let k=0;k<5;k++)imitate(model,examples,.035);
  const imitationScore=practiceScore(model,fields);
  let bestScore=-Infinity,best=null,completed=0,rewardSum=0;
  for(let b=0;b<BLOCKS;b++){
    for(let e=0;e<EPISODES;e++){
      if(aborted())throw Error('Training cancelled.');
      const d=blocks[b],relevant=lessons.filter(l=>l.start.drill===d);
      const w=e%4===0&&relevant.length?copyWorld(relevant[Math.floor(random()*relevant.length)].start):
        createWorld(Math.floor(random()*0x40000000),d);
      const episode=trajectory(model,w,random);rewardSum+=episode.total;
      reinforce(model,episode.steps,opt);
      if(examples.length)imitate(model,Array.from({length:6},()=>examples[Math.floor(random()*examples.length)]),.008);
      completed++;
      if(e%4===0){progress({completed,total:BLOCKS*EPISODES,drill:d});await yieldThread();}
    }
    const value=practiceScore(model,fields);
    if(value>bestScore){bestScore=value;best=copyPolicy(model);}
    progress({completed,total:BLOCKS*EPISODES,drill:blocks[b]});await yieldThread();
  }
  return {policy:best,metrics:{episodes:completed,examples:examples.length,meanReward:rewardSum/completed,
    calibrationBefore:baseline,afterImitation:imitationScore,calibrationAfter:bestScore}};
}
