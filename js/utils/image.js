'use strict';
const ImageUtils = {
  cropToCanvas(source,bbox,outSize=128){
    try{
      const [x,y,w,h]=bbox;
      const srcW=(source.width||source.videoWidth||640);
      const srcH=(source.height||source.videoHeight||480);
      // Recorte seguro dentro de los límites
      const cx=Math.max(0,Math.round(x)), cy=Math.max(0,Math.round(y));
      const cw=Math.max(1,Math.min(Math.round(w),srcW-cx));
      const ch=Math.max(1,Math.min(Math.round(h),srcH-cy));
      // Mantener proporción del recorte (no deformar la señal)
      const aspect=cw/ch;
      let outW=outSize, outH=outSize;
      if(aspect>1) outH=Math.round(outSize/aspect);
      else outW=Math.round(outSize*aspect);
      const out=document.createElement('canvas');
      out.width=outW; out.height=outH;
      const ctx=out.getContext('2d');
      ctx.imageSmoothingQuality='high';
      ctx.drawImage(source,cx,cy,cw,ch,0,0,outW,outH);
      return out;
    }catch(e){const out=document.createElement('canvas');out.width=out.height=outSize;return out;}
  },
  async fileToImageBitmap(file){
    return new Promise((resolve,reject)=>{
      const img=new Image(),url=URL.createObjectURL(file);
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Error cargando imagen'));};
      img.src=url;
    });
  },
  imageBitmapToCanvas(img){
    const c=document.createElement('canvas');
    c.width=img.naturalWidth||img.width;c.height=img.naturalHeight||img.height;
    c.getContext('2d').drawImage(img,0,0);return c;
  },
  resizeCanvas(src,maxW,maxH){
    const ratio=Math.min(maxW/src.width,maxH/src.height,1);
    if(ratio>=1) return src;
    const out=document.createElement('canvas');
    out.width=Math.round(src.width*ratio);out.height=Math.round(src.height*ratio);
    out.getContext('2d').drawImage(src,0,0,out.width,out.height);return out;
  },
  getDominantColor(canvas,x,y,w,h){
    try{
      const ctx=canvas.getContext('2d');
      const data=ctx.getImageData(Math.max(0,Math.round(x)),Math.max(0,Math.round(y)),
        Math.min(Math.round(w),canvas.width-Math.round(x)),
        Math.min(Math.round(h),canvas.height-Math.round(y))).data;
      let r=0,g=0,b=0,n=0;
      for(let i=0;i<data.length;i+=16){r+=data[i];g+=data[i+1];b+=data[i+2];n++;}
      r/=n;g/=n;b/=n;
      if(r>160&&g<80&&b<80) return 'red';
      if(b>120&&r<100&&g<130) return 'blue';
      if(r>180&&g>150&&b<80) return 'yellow';
      return 'unknown';
    }catch{return 'unknown';}
  },
};
