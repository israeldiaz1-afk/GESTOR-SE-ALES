'use strict';
const Detector = (() => {
  let _running=false,_loopId=null,_fps=0,_fcount=0,_fts=0;
  async function init(onProgress){await ObjectDetector.load(onProgress);}
  function detectFrame(canvas){
    if(!ObjectDetector.isReady()||!canvas||!canvas.width) return [];
    try{
      const rawPreds=ObjectDetector.detect(canvas),results=[];
      for(const pred of rawPreds){
        const [x,y,w,h]=pred.bbox;
        const crop=ImageUtils.cropToCanvas(canvas,[x,y,w,h],96);
        const {signType,category,confidence}=SignDetector.classifyFromColorDetection(pred,crop);
        results.push({id:`det_${Date.now()}_${Math.random().toString(36).slice(2,5)}`,
          signType,category,confidence,bbox:pred.bbox,dominantColor:pred.color,
          isHorizontal:pred.class==='road marking',crop,ts:Date.now(),gps:Geo.getPos()});
      }
      return SignDetector.nms(results);
    }catch(e){Logger.warn('detectFrame:',e);return [];}
  }
  function startLoop(videoEl,canvasEl,onDetections){
    _running=true;_fts=performance.now();
    const loop=()=>{
      if(!_running) return;
      if(videoEl.readyState>=2&&!videoEl.paused){
        canvasEl.width=videoEl.videoWidth||640;canvasEl.height=videoEl.videoHeight||480;
        canvasEl.getContext('2d').drawImage(videoEl,0,0);
        const dets=detectFrame(canvasEl);
        if(dets.length>0) onDetections(dets);
        _fcount++;const now=performance.now();
        if(now-_fts>=1000){_fps=Math.round(_fcount*1000/(now-_fts));_fcount=0;_fts=now;}
      }
      _loopId=setTimeout(loop,1000/6);
    };
    _loopId=setTimeout(loop,300);
  }
  function stopLoop(){_running=false;if(_loopId){clearTimeout(_loopId);_loopId=null;}}
  function getFPS(){return _fps;}
  function isReady(){return ObjectDetector.isReady();}
  return {init,detectFrame,startLoop,stopLoop,getFPS,isReady};
})();
