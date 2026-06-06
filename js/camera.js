'use strict';
const Camera = (() => {
  let _stream=null,_facingMode='environment',_videoEl=null;
  async function start(videoEl){_videoEl=videoEl;await _startStream();}
  async function _startStream(){
    if(_stream) stop();
    const constraints={video:{facingMode:{ideal:_facingMode},width:{ideal:1280},height:{ideal:720}},audio:false};
    try{
      _stream=await navigator.mediaDevices.getUserMedia(constraints);
      if(_videoEl){_videoEl.srcObject=_stream;await _videoEl.play();}
    }catch(e){Logger.error('Camera:',e);throw new Error('No se pudo acceder a la cámara. Revisa los permisos.');}
  }
  async function flip(){_facingMode=_facingMode==='environment'?'user':'environment';await _startStream();}
  function stop(){
    if(_stream){_stream.getTracks().forEach(t=>t.stop());_stream=null;}
    if(_videoEl){_videoEl.srcObject=null;_videoEl=null;}
  }
  function isActive(){return !!_stream;}
  return{start,stop,flip,isActive};
})();
