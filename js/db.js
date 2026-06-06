'use strict';
const DB = (() => {
  let _db=null;
  function open(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open('roadsign_db',3);
      req.onupgradeneeded=e=>{
        const db=e.target.result;
        if(!db.objectStoreNames.contains('evaluations')){
          const s=db.createObjectStore('evaluations',{keyPath:'id',autoIncrement:true});
          s.createIndex('ts','ts',{unique:false});s.createIndex('type','signType',{unique:false});
        }
        if(!db.objectStoreNames.contains('learningEvents')){
          const l=db.createObjectStore('learningEvents',{keyPath:'id',autoIncrement:true});
          l.createIndex('signType','signType',{unique:false});l.createIndex('param','param',{unique:false});
        }
        if(!db.objectStoreNames.contains('userProfile')) db.createObjectStore('userProfile',{keyPath:'key'});
        if(!db.objectStoreNames.contains('cropImages')) db.createObjectStore('cropImages',{keyPath:'evalId'});
      };
      req.onsuccess=e=>{_db=e.target.result;resolve(_db);};
      req.onerror=e=>reject(e.target.error);
    });
  }
  function tx(s,m='readonly'){return _db.transaction(s,m).objectStore(s);}
  function p(req){return new Promise((res,rej)=>{req.onsuccess=e=>res(e.target.result);req.onerror=e=>rej(e.target.error);});}

  return {
    init:open,
    saveEvaluation(o){return p(tx('evaluations','readwrite').add(o));},
    updateEvaluation(o){return p(tx('evaluations','readwrite').put(o));},
    getAllEvaluations(){return p(tx('evaluations').getAll());},
    getEvaluationsSince(ts){
      return p(tx('evaluations').index('ts').getAll(IDBKeyRange.lowerBound(ts)));
    },
    deleteEvaluation(id){return p(tx('evaluations','readwrite').delete(id));},
    countEvaluations(){return p(tx('evaluations').count());},
    async getTodayEvaluations(){
      const d=new Date();d.setHours(0,0,0,0);return this.getEvaluationsSince(d.getTime());
    },
    saveCropImage(evalId,blob){return p(tx('cropImages','readwrite').put({evalId,blob}));},
    getCropImage(evalId){return p(tx('cropImages').get(evalId));},
    saveEvent(ev){return p(tx('learningEvents','readwrite').add(ev));},
    getAllEvents(){return p(tx('learningEvents').getAll());},
    clearLearning(){return p(tx('learningEvents','readwrite').clear());},
    countEvents(){return p(tx('learningEvents').count());},
    setProfile(key,value){return p(tx('userProfile','readwrite').put({key,value}));},
    getProfile(key){return p(tx('userProfile').get(key)).then(r=>r?r.value:null);},
    async estimateSize(){
      if('storage' in navigator&&'estimate' in navigator.storage){
        const est=await navigator.storage.estimate();return{used:est.usage||0,quota:est.quota||0};
      }return{used:0,quota:0};
    },
    async deleteOlderThan(days){
      const limit=Date.now()-(days*86400000),all=await this.getAllEvaluations();
      const old=all.filter(e=>e.ts<limit);for(const e of old) await this.deleteEvaluation(e.id);return old.length;
    },
  };
})();
