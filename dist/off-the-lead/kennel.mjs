import {COUNT,DT,LIMIT} from './pasture.mjs';
import {foundation,validModel,ACTIONS,INPUTS} from './policy.mjs';
const prefix='off-the-lead.v1/';
export const idFor=()=>globalThis.crypto?.randomUUID?.()||Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
export function freshSeed(heldOut=false){
  const a=new Uint32Array(1);
  if(globalThis.crypto?.getRandomValues)globalThis.crypto.getRandomValues(a);else a[0]=Math.random()*0x100000000;
  return ((a[0]&0x3fffffff)|(heldOut?0x80000000:0x40000000))>>>0;
}
const finitePoint=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.vx)&&Number.isFinite(p.vy)&&Number.isFinite(p.angle);
const validStart=w=>w&&Number.isInteger(w.drill)&&w.drill>=0&&w.drill<3&&Number.isInteger(w.tick)&&w.tick>=0&&w.tick<Math.round(LIMIT/DT)&&
  Number.isFinite(w.gate)&&Number.isFinite(w.opening)&&Number.isFinite(w.stressSum)&&finitePoint(w.dog)&&
  Array.isArray(w.sheep)&&w.sheep.length===COUNT&&w.sheep.every(s=>finitePoint(s)&&[s.stress,s.nerve,s.phase].every(Number.isFinite))&&!w.done;
const validSample=s=>s&&s.f?.length===INPUTS&&s.y?.length===ACTIONS&&[...s.f,...s.y].every(Number.isFinite);
export class Kennel{
  constructor(storage){
    this.storage=storage;this.durable=!!storage;this.items=new Map();
    if(storage)try{
      for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith(prefix))this.sync(k,storage.getItem(k));}
    }catch{this.durable=false;}
  }
  sync(k,json){
    if(!k?.startsWith(prefix))return;
    const name=k.slice(prefix.length);
    if(json===null){this.items.delete(name);return;}
    try{
      const v=JSON.parse(json);
      if(name.startsWith('dog/')&&(!v.id||!validModel(v.policy)))return;
      if(name.startsWith('lesson/')&&(!v.id||!validStart(v.start)||!Array.isArray(v.samples)||!v.samples.length||!v.samples.every(validSample)))return;
      this.items.set(name,v);
    }catch{}
  }
  write(key,value){
    this.items.set(key,value);
    try{if(this.storage)this.storage.setItem(prefix+key,JSON.stringify(value));else this.durable=false;}
    catch{this.durable=false;}
  }
  list(group){return [...this.items].filter(([k])=>k.startsWith(group+'/')).map(([,v])=>v).sort((a,b)=>a.created-b.created||String(a.id).localeCompare(String(b.id)));}
  dogs(){return [{id:'foundation',created:0,parent:null,policy:foundation()},...this.list('dog')];}
  active(){const dogs=this.dogs();return dogs.find(v=>v.id===this.items.get('active'))||dogs[0];}
  label(id){const i=this.dogs().findIndex(d=>d.id===id);return i<=0?'G0 · Foundation':'G'+i;}
  addDog(parent,result,alloc,lessonIds){
    const dog={id:idFor(),created:Date.now(),parent,policy:result.policy,metrics:result.metrics,alloc:[...alloc],lessonIds:[...lessonIds]};
    this.write('dog/'+dog.id,dog);return dog;
  }
  lessons(){return this.list('lesson');}
  addLesson(start,samples,seconds,parent){
    const l={id:idFor(),created:Date.now(),start,samples,seconds,parent,enabled:true};
    this.write('lesson/'+l.id,l);return l;
  }
  awards(){return this.list('card');}
  award(id,drill,seed,result){
    // Only the first independent result for a dog on a sealed field is filed.
    const key='card/'+id+'/'+seed;
    if(!this.items.has(key))this.write(key,{id,drill,seed,created:Date.now(),...result});
  }
}
