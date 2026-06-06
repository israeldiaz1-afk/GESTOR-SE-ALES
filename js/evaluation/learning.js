'use strict';
const Learning = (() => {
  let _adj={},_counts={};
  async function load(){
    try{const ev=await DB.getAllEvents();_rebuild(ev);}catch(e){Logger.warn('Learning load:',e);}
  }
  function _rebuild(events){
    _adj={};_counts={};
    for(const ev of [...events].sort((a,b)=>a.ts-b.ts)){
      const k=`${ev.signType}::${ev.param}`;
      if(!_adj[k]){_adj[k]=0;_counts[k]=0;}
      _adj[k]=_adj[k]*0.7+ev.delta*0.3;_counts[k]++;
    }
  }
  async function recordCorrection(signType,param,aiValue,userValue){
    if(aiValue===userValue) return;
    const delta=userValue-aiValue,event={signType,param,aiValue,userValue,delta,ts:Date.now()};
    try{
      await DB.saveEvent(event);
      const k=`${signType}::${param}`;
      if(!_adj[k]){_adj[k]=0;_counts[k]=0;}
      _adj[k]=_adj[k]*0.7+delta*0.3;_counts[k]++;
    }catch(e){Logger.error('Learning save:',e);}
  }
  function adjust(signType,param,aiValue){
    const k=`${signType}::${param}`,adj=_adj[k]??0,count=_counts[k]??0;
    if(count<5) return aiValue;
    return Math.max(1,Math.min(5,Math.round(aiValue+adj)));
  }
  function adjustAll(signType,values){
    const r={};for(const[p,v] of Object.entries(values)) r[p]=adjust(signType,p,v);return r;
  }
  async function getAccuracy(){
    try{
      const ev=await DB.getAllEvents();if(!ev.length) return null;
      const changed=ev.filter(e=>e.delta!==0).length;
      return Math.round(((ev.length-changed)/ev.length)*100);
    }catch{return null;}
  }
  async function reset(){await DB.clearLearning();_adj={};_counts={};Logger.info('Learning reset');}
  function getStats(){return{totalEvents:Object.values(_counts).reduce((a,b)=>a+b,0)};}
  return{load,recordCorrection,adjust,adjustAll,getAccuracy,reset,getStats};
})();
