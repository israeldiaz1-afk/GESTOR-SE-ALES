'use strict';
const EvaluationEngine = (() => {
  function propose(detection, sourceCanvas){
    const {signType,category,bbox,confidence}=detection;
    const[x,y,w,h]=bbox;
    const imgMetrics=sourceCanvas?_analyze(sourceCanvas,x,y,w,h):{};
    const base=_baseProposals(signType,category,confidence);
    const withImg=_applyMetrics(base,imgMetrics);
    const final=Learning.adjustAll(signType,withImg);
    return{values:final,rating:calcRating(final),confidence:Math.round(confidence*100),source:'ai'};
  }
  function _baseProposals(signType,category,confidence){
    const cl=confidence>=0.9?5:confidence>=0.75?4:confidence>=0.6?3:confidence>=0.45?2:1;
    const p={visibilidad:Math.min(5,cl+1),retroreflectancia:3,legibilidad:cl>=3?4:3,
      estado_fisico:4,color_contraste:cl>=3?4:3,posicionamiento:3,
      cumplimiento_norma:3,limpieza:4,soporte:4};
    if(category==='horizontal') p.soporte=5;
    if(signType==='UNKNOWN'){p.legibilidad=2;p.cumplimiento_norma=2;}
    return p;
  }
  function _applyMetrics(base,m){
    const r={...base};
    if(m.bboxAreaRatio!==undefined){
      if(m.bboxAreaRatio<0.005) r.visibilidad=Math.max(1,r.visibilidad-1);
      if(m.bboxAreaRatio>0.05)  r.visibilidad=Math.min(5,r.visibilidad+1);
    }
    if(m.saturation!==undefined){
      if(m.saturation<0.25){r.retroreflectancia=Math.max(1,r.retroreflectancia-1);r.color_contraste=Math.max(1,r.color_contraste-1);}
      if(m.saturation>0.6){r.retroreflectancia=Math.min(5,r.retroreflectancia+1);r.color_contraste=Math.min(5,r.color_contraste+1);}
    }
    if(m.edgeVariance>0.4){r.limpieza=Math.max(1,r.limpieza-1);r.estado_fisico=Math.max(1,r.estado_fisico-1);}
    return r;
  }
  function _analyze(canvas,x,y,w,h){
    try{
      const ctx=canvas.getContext('2d');
      const data=ctx.getImageData(Math.max(0,Math.round(x)),Math.max(0,Math.round(y)),
        Math.min(Math.round(w),canvas.width-Math.round(x)),
        Math.min(Math.round(h),canvas.height-Math.round(y))).data;
      let rS=0,gS=0,bS=0,rMax=0,gMax=0,bMax=0,rMin=255,gMin=255,bMin=255,n=data.length/4;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2];
        rS+=r;gS+=g;bS+=b;
        if(r<rMin)rMin=r;if(r>rMax)rMax=r;
        if(g<gMin)gMin=g;if(g>gMax)gMax=g;
        if(b<bMin)bMin=b;if(b>bMax)bMax=b;
      }
      const rM=rS/n,gM=gS/n,bM=bS/n;
      const brightness=(rM+gM+bM)/(3*255);
      const maxC=Math.max(rM,gM,bM),minC=Math.min(rM,gM,bM);
      const saturation=maxC>0?(maxC-minC)/maxC:0;
      const edgeVariance=((rMax-rMin)+(gMax-gMin)+(bMax-bMin))/(3*255);
      const bboxAreaRatio=(w*h)/(canvas.width*canvas.height);
      return{brightness,saturation,edgeVariance,bboxAreaRatio};
    }catch{return{};}
  }
  async function recordValidation(detection,aiValues,userValues,accepted){
    for(const param of Object.keys(aiValues)){
      const uv=accepted?aiValues[param]:userValues[param];
      await Learning.recordCorrection(detection.signType,param,aiValues[param],uv);
    }
  }
  return{propose,recordValidation};
})();
