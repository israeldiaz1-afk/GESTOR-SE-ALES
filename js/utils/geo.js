'use strict';
const Geo = {
  _watchId:null,_lastPos:null,_listeners:[],
  start(){
    if(!navigator.geolocation) return Promise.reject('GPS no disponible');
    return new Promise((resolve,reject)=>{
      this._watchId=navigator.geolocation.watchPosition(
        pos=>{
          this._lastPos={lat:pos.coords.latitude,lng:pos.coords.longitude,acc:pos.coords.accuracy};
          this._listeners.forEach(fn=>fn(this._lastPos));
          resolve(this._lastPos);
        },
        err=>{Logger.warn('GPS:',err.message);reject(err);},
        {timeout:10000,maximumAge:5000,enableHighAccuracy:true}
      );
    });
  },
  stop(){if(this._watchId)navigator.geolocation.clearWatch(this._watchId);},
  getPos(){return this._lastPos;},
  onUpdate(fn){this._listeners.push(fn);},
  formatCoords(pos){if(!pos)return '— sin GPS —';return `${pos.lat.toFixed(6)}, ${pos.lng.toFixed(6)}`;},
  formatForDisplay(pos){
    if(!pos)return '— GPS —';
    const ns=pos.lat>=0?'N':'S',ew=pos.lng>=0?'E':'O';
    const acc=pos.acc?` ±${Math.round(pos.acc)}m`:'';
    return `${Math.abs(pos.lat).toFixed(5)}°${ns} ${Math.abs(pos.lng).toFixed(5)}°${ew}${acc}`;
  },
  mapsUrl(pos){
    if(!pos)return null;
    return `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
  },
};
