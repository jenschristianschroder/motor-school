import {train} from './learn.mjs';
self.onmessage=async({data})=>{
  try{const result=await train(data,p=>self.postMessage({type:'progress',...p}));self.postMessage({type:'done',result});}
  catch(error){self.postMessage({type:'error',message:error.message||'Training stopped.'});}
};
