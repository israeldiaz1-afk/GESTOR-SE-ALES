'use strict';
const SignDetector = (() => {
  function classifyFromColorDetection(pred, crop) {
    const color=pred.color||'unknown',score=pred.score||0.5;
    let signType='UNKNOWN',category='desconocido',confidence=score*0.9;
    const aspect=crop?crop.width/crop.height:1;
    const isCirc=aspect>0.75&&aspect<1.35,isTri=aspect>0.85&&aspect<1.25;
    switch(color){
      case 'red':
        if(isCirc){signType='R203';category='velocidad';confidence=Math.min(score+0.05,0.92);}
        else if(isTri){signType='R2';category='prioridad';confidence=Math.min(score+0.08,0.92);}
        else{signType='R100';category='prohibicion';confidence=score*0.85;}
        break;
      case 'blue':
        if(isCirc){signType='M501';category='obligacion';confidence=score*0.88;}
        else{signType='S10';category='informacion';confidence=score*0.85;}
        break;
      case 'yellow': signType='P18';category='peligro';confidence=score*0.87;break;
      case 'white':  signType='H_PASO';category='horizontal';confidence=score*0.80;break;
      default: signType='UNKNOWN';category='desconocido';confidence=0.45;
    }
    return {signType,category,confidence};
  }
  function nms(detections) {
    if(detections.length<=1) return detections;
    const sorted=[...detections].sort((a,b)=>b.confidence-a.confidence),kept=[];
    for(const d of sorted) if(!kept.some(k=>_iou(d.bbox,k.bbox)>0.4)) kept.push(d);
    return kept;
  }
  function _iou([ax,ay,aw,ah],[bx,by,bw,bh]){
    const ix=Math.max(0,Math.min(ax+aw,bx+bw)-Math.max(ax,bx));
    const iy=Math.max(0,Math.min(ay+ah,by+bh)-Math.max(ay,by));
    const i=ix*iy,u=aw*ah+bw*bh-i;return u>0?i/u:0;
  }
  return {classifyFromColorDetection,nms};
})();
