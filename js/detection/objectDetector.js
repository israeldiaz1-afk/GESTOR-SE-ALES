'use strict';
const ObjectDetector = (() => {
  let _ready = false;
  async function load(onProgress) {
    onProgress?.('Iniciando detector visual…', 50);
    await new Promise(r => setTimeout(r, 200));
    _ready = true;
    onProgress?.('Detector listo', 100);
  }
  function detect(canvas) {
    if (!canvas || !canvas.width) return [];
    const results = [], W = canvas.width, H = canvas.height;
    const ctx = canvas.getContext('2d');
    const stepX = Math.floor(W/8), stepY = Math.floor(H/8);
    for (let row=0; row<7; row++) {
      for (let col=0; col<7; col++) {
        const x=col*stepX, y=row*stepY, w=stepX*2, h=stepY*2;
        if(x+w>W||y+h>H||w<40||h<40) continue;
        const a = _analyzeRegion(ctx,x,y,w,h);
        if(a.isSignCandidate) results.push({bbox:[x,y,w,h],score:a.score,class:a.class,color:a.color});
      }
    }
    return _nms(results,0.4);
  }
  function _analyzeRegion(ctx,x,y,w,h) {
    try {
      const data=ctx.getImageData(x,y,w,h).data;
      let rC=0,bC=0,yC=0,wC=0,tot=0,rS=0,gS=0,bS=0;
      for(let i=0;i<data.length;i+=4){
        const r=data[i],g=data[i+1],b=data[i+2];
        rS+=r;gS+=g;bS+=b;tot++;
        if(r>150&&g<90&&b<90) rC++;
        if(b>130&&r<110&&g<140) bC++;
        if(r>170&&g>140&&b<80) yC++;
        if(r>200&&g>200&&b>200) wC++;
      }
      if(!tot) return {isSignCandidate:false};
      const rR=rC/tot,bR=bC/tot,yR=yC/tot,wR=wC/tot;
      const maxC=Math.max(rS/tot,gS/tot,bS/tot),minC=Math.min(rS/tot,gS/tot,bS/tot);
      const sat=maxC>0?(maxC-minC)/maxC:0, brt=(rS+gS+bS)/(tot*3*255);
      if(rR>0.20&&sat>0.3) return {isSignCandidate:true,score:Math.min(0.5+rR,0.95),class:'stop sign',color:'red'};
      if(bR>0.20&&sat>0.25) return {isSignCandidate:true,score:Math.min(0.5+bR,0.95),class:'blue sign',color:'blue'};
      if(yR>0.18&&sat>0.25) return {isSignCandidate:true,score:Math.min(0.5+yR,0.95),class:'warning sign',color:'yellow'};
      if(wR>0.35&&sat<0.15&&brt>0.5) return {isSignCandidate:true,score:0.48,class:'road marking',color:'white'};
      return {isSignCandidate:false};
    } catch {return {isSignCandidate:false};}
  }
  function _nms(dets,threshold) {
    const sorted=[...dets].sort((a,b)=>b.score-a.score),kept=[];
    for(const d of sorted) if(!kept.some(k=>_iou(d.bbox,k.bbox)>threshold)) kept.push(d);
    return kept.slice(0,6);
  }
  function _iou([ax,ay,aw,ah],[bx,by,bw,bh]) {
    const ix=Math.max(0,Math.min(ax+aw,bx+bw)-Math.max(ax,bx));
    const iy=Math.max(0,Math.min(ay+ah,by+bh)-Math.max(ay,by));
    const i=ix*iy,u=aw*ah+bw*bh-i;return u>0?i/u:0;
  }
  function isReady(){return _ready;}
  return {load,detect,isReady};
})();
